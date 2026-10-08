(() => {
  "use strict";
  const realFetch = window.fetch.bind(window);
  const ready = realFetch("./fixtures.json").then(response => response.json());
  const sessions = new Map();
  const streams = new Set();
  let tasks = [];
  let serial = 0;
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const event = (type, payload) => ({ type, payload });
  const stage = (agent, status) => event("agent_status", { agent, status, message: "演示：" + ({ topic: "整理选题", research: "核验信息", script: "编写稿件", review: "审核稿件", generation: "生成模拟任务" })[agent] });

  function clear() {
    for (const stream of [...streams]) stream.cancel();
    sessions.clear();
    tasks = [];
  }

  function reply(request, fixtures) {
    let state = sessions.get(request.session_id);
    if (!state) {
      state = { topic: null, draft: null, review: null, generation: null, transcript: [] };
      sessions.set(request.session_id, state);
    }
    const message = request.message.trim();
    const events = [];
    let text;
    let finish = () => {};
    const selected = message.match(/第\s*([123])\s*个/);
    const modifying = /修改|改成|缩短|开头|润色|重写|精简/.test(message);
    const generating = /生成.*视频|数字人|提交|审核并生成/.test(message);
    const writing = /写稿|口播稿|脚本/.test(message);
    const choose = index => {
      const topic = fixtures.topics[index];
      state.topic = { title: topic.title, display_index: index + 1, topic_id: topic.id, content_angle: topic.summary };
      state.draft = { current_version: 1, version_count: 1, body: topic.script };
      state.review = null;
      state.generation = null;
      return topic;
    };

    if (selected || writing || modifying || generating || /审核|核验/.test(message)) {
      if (selected) choose(Number(selected[1]) - 1);
      else if (!state.draft) choose(0);
      if (selected || writing) {
        events.push(stage("topic", "working"), stage("topic", "finished"), stage("research", "finished"), stage("script", "working"), stage("script", "finished"));
        events.push(event("draft_updated", { draft_version: state.draft.current_version, draft_id: "demo-draft" }));
        text = "已确认选题并生成 v" + state.draft.current_version + " 测试口播稿：\n\n" + state.draft.body + "\n\n可以继续要求修改，或输入“审核并生成视频”。";
      } else if (modifying) {
        state.draft.current_version++;
        state.draft.version_count++;
        state.draft.body = "修改稿：" + message + "\n\n" + state.draft.body;
        state.review = null;
        state.generation = null;
        events.push(stage("script", "working"), stage("script", "finished"), event("draft_updated", { draft_version: state.draft.current_version, draft_id: "demo-draft" }));
        text = "已按你的要求保留原内容并生成 v" + state.draft.current_version + "：\n\n" + state.draft.body;
      } else {
        state.review = { status: "pass", draft_version: state.draft.current_version, summary: "测试稿件的结构检查通过；本次为预设演示。", must_fix: [], risk_items: [] };
        events.push(stage("review", "working"), stage("review", "finished"), event("review_updated", { status: "pass", draft_version: state.draft.current_version }));
        text = "已审核当前 v" + state.draft.current_version + " 稿件，可以提交数字人演示任务。";
        if (generating) {
          const task = { task_id: "demo-video-" + (++serial), status: "generating", script: state.draft.body, draft_version: state.draft.current_version };
          tasks.unshift(task);
          state.generation = { generation_id: task.task_id, draft_version: task.draft_version, status: "generating", provider: { status: "generating", progress: 0, raw_status: "演示生成中" } };
          events.push(stage("generation", "working"), event("generation_started", { draft_version: task.draft_version, generation_id: task.task_id }));
          finish = () => {
            task.status = "completed";
            state.generation.status = "completed";
            state.generation.provider = { status: "completed", progress: 100, raw_status: "模拟完成" };
          };
          events.push(stage("generation", "finished"), event("generation_completed", { generation_id: task.task_id, status: "completed" }));
          text = "演示任务已完成，使用的是 v" + task.draft_version + " 稿件。\n\n" + task.script + "\n\n模拟结果，不是真实成片。";
        }
      }
    } else {
      events.push(stage("topic", "working"), stage("topic", "finished"));
      events.push(event("candidate_batch_updated", { candidate_batch_id: "demo-topics", summary: "下面是三个测试选题，点击选择后继续写稿。", candidates: fixtures.topics.map((topic, index) => ({ topic_id: topic.id, title: topic.title, display_index: index + 1 })) }));
      text = "已整理三个测试选题。点击一个选题，或发送“第1个”继续；也可以要求修改稿件、审核并生成视频。";
    }
    state.transcript.push({ role: "user", text: message });
    events.push(event("message_completed", { text }), event("agent_finished", {}));
    const encoder = new TextEncoder();
    let timer;
    let index = 0;
    const stream = new ReadableStream({
      start(controller) {
        const record = {
          cancel() {
            clearTimeout(timer);
            streams.delete(record);
            controller.close();
          }
        };
        streams.add(record);
        const emit = () => {
          if (!streams.has(record)) return;
          if (index === events.length) {
            streams.delete(record);
            controller.close();
            return;
          }
          const next = events[index++];
          if (next.type === "generation_completed") finish();
          if (next.type === "message_completed") state.transcript.push({ role: "assistant", text });
          controller.enqueue(encoder.encode("data: " + JSON.stringify(next) + "\n\n"));
          timer = setTimeout(emit, next.type === "generation_started" ? 500 : 35);
        };
        emit();
      }
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  }

  window.fetch = async (url, options = {}) => {
    const path = new URL(String(url), location.href).pathname;
    if (!path.startsWith("/api/")) return realFetch(url, options);
    const fixtures = await ready;
    if (path === "/api/agent/chat/stream") return reply(JSON.parse(options.body), fixtures);
    if (path === "/api/tasks") return json({ tasks });
    if (path.startsWith("/api/agent/session/")) {
      const id = decodeURIComponent(path.split("/").pop());
      return sessions.has(id) ? json(sessions.get(id)) : json({}, 404);
    }
    return json({ message: "此演示未提供该操作" }, 404);
  };

  document.getElementById("btnResetDemo").addEventListener("click", () => {
    clear();
    setTimeout(() => {
      document.getElementById("btnNewSession").click();
      document.getElementById("btnRefreshTasks").click();
    }, 0);
  });

  document.addEventListener("DOMContentLoaded", async () => {
    await ready;
    document.getElementById("agentInput").value = "帮我找三个内容创作选题";
    document.getElementById("agentForm").requestSubmit();
    document.getElementById("btnRefreshTasks").click();
  });
})();
