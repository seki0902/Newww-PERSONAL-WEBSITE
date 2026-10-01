import type { Block } from "../schema/content";
import { currentDemoState, demoKey } from "../runtime/demo";
import { useRuntimeStore } from "../runtime/store";

type DemoBlock = Extract<Block, { type: "interactive_demo" }>;

export function InteractiveDemoBlock({ block, projectId, resolveAsset }: { block: DemoBlock; projectId: string; resolveAsset?: (assetId: string) => string | undefined }) {
  const key = demoKey(projectId, block.id);
  const saved = useRuntimeStore((state) => state.demoStates?.[key]);
  const demo = currentDemoState(block, saved);
  const preset = block.presets.find((item) => item.id === demo.presetId) ?? block.presets[0];
  const actions = useRuntimeStore.getState();
  const busy = demo.phase === "script_generating" || demo.phase === "video_generating";
  const videoUrl = preset.finalVideoAssetId ? resolveAsset?.(preset.finalVideoAssetId) : undefined;
  const imageUrl = preset.finalImageAssetId ? resolveAsset?.(preset.finalImageAssetId) : undefined;

  return (
    <section className="interactive-demo" aria-label="交互演示">
      <div className="demo-mode"><strong>Demo Mode</strong><span>当前为交互演示，结果使用预设数据</span></div>
      <ol className="demo-steps" aria-label="演示步骤">
        <li className={demo.phase === "idle" || demo.phase === "script_generating" ? "is-current" : "is-done"}>01 选题</li>
        <li className={demo.phase === "script_ready" ? "is-current" : ["video_config", "video_generating", "completed"].includes(demo.phase) ? "is-done" : ""}>02 编辑口播稿</li>
        <li className={["video_config", "video_generating", "completed"].includes(demo.phase) ? "is-current" : ""}>03 生成视频</li>
      </ol>

      {(demo.phase === "idle" || demo.phase === "script_generating") && <div className="demo-panel">
        <h2>选择一个演示选题</h2>
        <div className="demo-preset-list" role="group" aria-label="预设选题">
          {block.presets.map((item) => <button key={item.id} type="button" aria-pressed={item.id === demo.presetId} onClick={() => actions.selectDemoPreset(projectId, block.id, item.id)}>{item.label}</button>)}
        </div>
        <label className="demo-field" htmlFor={`${block.id}-topic`}>选题内容
          <input id={`${block.id}-topic`} value={demo.topic} disabled={busy} onChange={(event) => actions.setDemoTopic(projectId, block.id, event.target.value)} placeholder="输入想体验的选题" />
        </label>
        <p className="demo-hint">手动输入可体验流程；生成内容仍来自当前所选预设。</p>
        <button className="demo-primary" type="button" disabled={busy || !demo.topic.trim()} onClick={() => actions.generateDemoScript(projectId, block.id)}>生成口播稿</button>
        {demo.phase === "script_generating" && <p className="demo-status" role="status">正在读取预设口播稿…</p>}
      </div>}

      {demo.phase === "script_ready" && <div className="demo-panel">
        <div className="demo-panel-heading"><h2>编辑口播稿</h2><button type="button" className="demo-text-button" onClick={() => actions.restartDemo(projectId, block.id)}>重新选题</button></div>
        <p className="demo-hint">演示稿件可直接修改；修改内容只保存在当前浏览器。</p>
        <label className="demo-field" htmlFor={`${block.id}-script`}>口播稿
          <textarea id={`${block.id}-script`} rows={9} value={demo.script} onChange={(event) => actions.editDemoScript(projectId, block.id, event.target.value)} />
        </label>
        <button className="demo-primary" type="button" disabled={!demo.script.trim()} onClick={() => actions.continueDemo(projectId, block.id)}>下一步：配置视频</button>
      </div>}

      {demo.phase === "video_config" && <div className="demo-panel">
        <div className="demo-panel-heading"><h2>配置数字人视频</h2><button type="button" className="demo-text-button" onClick={() => actions.restartDemo(projectId, block.id)}>重新开始</button></div>
        <fieldset className="demo-options"><legend>数字人形象</legend><div>
          {preset.avatarOptions.map((option) => <button key={option.id} type="button" aria-pressed={demo.avatarId === option.id} onClick={() => actions.selectDemoAvatar(projectId, block.id, option.id)}>{option.label}</button>)}
        </div></fieldset>
        <fieldset className="demo-options"><legend>视频比例</legend><div>
          {preset.ratioOptions.map((option) => <button key={option.id} type="button" aria-pressed={demo.ratioId === option.id} onClick={() => actions.selectDemoRatio(projectId, block.id, option.id)}>{option.label}</button>)}
        </div></fieldset>
        <button className="demo-primary" type="button" disabled={!demo.avatarId || !demo.ratioId} onClick={() => actions.generateDemoVideo(projectId, block.id)}>生成视频</button>
      </div>}

      {demo.phase === "video_generating" && <div className="demo-panel demo-progress-panel" role="status">
        <h2>正在模拟生成视频</h2>
        <progress max="100" value={demo.progress} aria-label="视频生成进度" />
        <p>{demo.progress}%</p>
      </div>}

      {demo.phase === "completed" && <div className="demo-panel">
        <div className="demo-panel-heading"><h2>预设视频结果</h2><button type="button" className="demo-text-button" onClick={() => actions.restartDemo(projectId, block.id)}>再体验一次</button></div>
        <div className="demo-result-media">
          {videoUrl ? <video controls preload="metadata" src={videoUrl}>当前浏览器不支持视频播放。</video> : imageUrl ? <img src={imageUrl} alt={preset.label} /> : <p>{preset.resultPlaceholder ?? "预设结果素材待补充"}</p>}
        </div>
        <p className="demo-result-meta">{preset.label} · {preset.avatarOptions.find((item) => item.id === demo.avatarId)?.label} · {preset.ratioOptions.find((item) => item.id === demo.ratioId)?.label}</p>
        <details className="demo-final-script"><summary>查看本次编辑的口播稿</summary><p>{demo.script}</p></details>
      </div>}
    </section>
  );
}
