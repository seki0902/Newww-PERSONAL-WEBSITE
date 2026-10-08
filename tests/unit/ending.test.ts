// 桌面窗口模式下的收尾行为：读完最后一个启用项目应进入结局页（stage "complete"）。
import { beforeEach, describe, expect, it } from "vitest";
import { initialRuntimeState } from "../../src/runtime/persist";
import { setRuntimeProjects, useRuntimeStore } from "../../src/runtime/store";

const makeProject = (id: string, order: number, tarotId: string) => ({
  id, title: `项目${order}`, order, enabled: true, desktopSlot: `slot-${order}`,
  tarot: { id: tarotId, name: `塔罗${order}`, image: "/assets/tarot/a1.webp", hint: "提示" },
  blocks: [{ id: `b-${id}`, type: "text", markdown: "正文" }],
  pages: [{ id: `p-${id}`, projectId: id, internalName: "概览", title: "概览", navLabel: "概览", order: 1, blockIds: [`b-${id}`], enabled: true }],
  pageIds: [`p-${id}`],
}) as never;

const desktopFor = (projectId: string, iconId: string) => ({
  systemName: "SEKI OS",
  icons: [{
    id: iconId, label: "项目", type: "project", locked: false, projectId,
    folder: { items: [{ id: `f-${iconId}`, label: "项目说明", content: "", kind: "document", targetProjectId: projectId, disabled: false }] },
  }],
}) as never;

const documentWindow = (projectId: string, iconId: string) => ({
  id: `document:${projectId}`, iconId, kind: "document" as const, projectId,
  fileLabel: "项目说明", pageId: `p-${projectId}`, minimized: false, maximized: false, order: 1,
});

const resetStore = () => useRuntimeStore.setState({
  ...initialRuntimeState,
  stage: "desktop",
  selectedDesktopId: "content",
  unlockedProjectIds: ["project-1", "project-2"],
  desktopWindows: [],
  focusedWindowId: undefined,
  desktopReadProjectIds: {},
});

describe("桌面窗口模式的结局触发", () => {
  beforeEach(resetStore);

  it("只有一个项目时，读完直接进入结局", () => {
    setRuntimeProjects([makeProject("project-1", 1, "tarot-1")], desktopFor("project-1", "icon-1"), "content");
    useRuntimeStore.setState({ completedProjectIds: [], desktopWindows: [documentWindow("project-1", "icon-1")] });

    useRuntimeStore.getState().desktopWindowAction({ type: "read", windowId: "document:project-1" });

    const state = useRuntimeStore.getState();
    expect(state.completedProjectIds).toEqual(["project-1"]);
    expect(state.desktopReadProjectIds).toEqual({ content: ["project-1"] });
    expect(state.stage).toBe("complete");
  });

  it("还有未完成项目时停留在桌面", () => {
    setRuntimeProjects(
      [makeProject("project-1", 1, "tarot-1"), makeProject("project-2", 2, "tarot-2")],
      desktopFor("project-1", "icon-1"),
      "content",
    );
    useRuntimeStore.setState({ completedProjectIds: [], desktopWindows: [documentWindow("project-1", "icon-1")] });

    useRuntimeStore.getState().desktopWindowAction({ type: "read", windowId: "document:project-1" });

    const state = useRuntimeStore.getState();
    expect(state.completedProjectIds).toEqual(["project-1"]);
    expect(state.stage).toBe("desktop");
  });

  it("读完最后一个项目后，再关闭窗口不会重复触发结局", () => {
    setRuntimeProjects([makeProject("project-1", 1, "tarot-1")], desktopFor("project-1", "icon-1"), "content");
    useRuntimeStore.setState({ completedProjectIds: [], desktopWindows: [documentWindow("project-1", "icon-1")] });

    useRuntimeStore.getState().desktopWindowAction({ type: "read", windowId: "document:project-1" });
    expect(useRuntimeStore.getState().stage).toBe("complete");

    useRuntimeStore.getState().desktopWindowAction({ type: "close", windowId: "document:project-1" });
    expect(useRuntimeStore.getState().stage).toBe("complete");
  });
});
