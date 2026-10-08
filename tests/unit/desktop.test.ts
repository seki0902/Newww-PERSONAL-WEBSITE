import { describe, expect, it } from "vitest";
import { reduceDesktopState, type DesktopContent } from "../../src/runtime/desktop";
import { initialRuntimeState, type RuntimeState } from "../../src/runtime/persist";

const project = {
  id: "project-1", title: "项目一", order: 1, enabled: true, desktopSlot: "slot-1",
  tarot: { id: "tarot-1", name: "愚人", image: "/assets/tarot/a1.webp", hint: "开始" },
  blocks: [{ id: "b1", type: "text", markdown: "hello" }],
  pages: [
    { id: "p1", projectId: "project-1", internalName: "概览", title: "概览", navLabel: "概览", order: 1, blockIds: ["b1"], enabled: true },
    { id: "p2", projectId: "project-1", internalName: "结果", title: "结果", navLabel: "结果", order: 2, blockIds: ["b1"], enabled: true },
  ],
  pageIds: ["p1", "p2"],
} as never;

const desktop = {
  systemName: "SEKI OS",
  icons: [
    { id: "icon-1", label: "项目一", type: "project", locked: false, projectId: "project-1", folder: { items: [{ id: "f1", label: "项目说明", content: "", kind: "document", targetProjectId: "project-1", disabled: false }] } },
    { id: "icon-locked", label: "未开放", type: "portfolio", locked: true, folder: { items: [] } },
  ],
} as unknown as DesktopContent;

const base = (): RuntimeState => ({ ...initialRuntimeState });
const projects = [project];

describe("desktop window reducer", () => {
  it("点击未解锁项目图标先打开塔罗窗口", () => {
    const update = reduceDesktopState(base(), { type: "open-folder", iconId: "icon-1" }, projects, desktop);
    expect(update.desktopWindows?.[0]).toMatchObject({ kind: "tarot", projectId: "project-1", revealed: false });
    expect(update.focusedWindowId).toBe("tarot:project-1");
  });

  it("锁定图标点击不产生任何状态变化", () => {
    expect(reduceDesktopState(base(), { type: "open-folder", iconId: "icon-locked" }, projects, desktop)).toEqual({});
    expect(reduceDesktopState(base(), { type: "open-folder", iconId: "missing" }, projects, desktop)).toEqual({});
  });

  it("抽牌 → 翻牌 → 完成抽牌后解锁项目并切换成文档窗口", () => {
    const opened = reduceDesktopState(base(), { type: "open-folder", iconId: "icon-1" }, projects, desktop);
    const revealed = reduceDesktopState({ ...base(), ...opened }, { type: "reveal-tarot", windowId: "tarot:project-1" }, projects, desktop);
    expect(revealed.desktopWindows?.[0]).toMatchObject({ kind: "tarot", revealed: true });
    const completed = reduceDesktopState({ ...base(), ...opened, ...revealed }, { type: "complete-tarot", windowId: "tarot:project-1" }, projects, desktop);
    expect(completed.unlockedProjectIds).toEqual(["project-1"]);
    expect(completed.completedTarotIds).toEqual(["tarot-1"]);
    expect(completed.desktopWindows?.[0]).toMatchObject({ kind: "document", projectId: "project-1", pageId: "p1" });
  });

  it("未翻牌时不能直接完成抽牌", () => {
    const opened = reduceDesktopState(base(), { type: "open-folder", iconId: "icon-1" }, projects, desktop);
    expect(reduceDesktopState({ ...base(), ...opened }, { type: "complete-tarot", windowId: "tarot:project-1" }, projects, desktop)).toEqual({});
  });

  it("进度窗口、最小化、聚焦与关闭行为", () => {
    const progress = reduceDesktopState(base(), { type: "open-progress" }, projects, desktop);
    expect(progress.desktopWindows?.[0]).toMatchObject({ id: "desktop-progress", kind: "progress" });
    const minimized = reduceDesktopState({ ...base(), ...progress }, { type: "minimize", windowId: "desktop-progress" }, projects, desktop);
    expect(minimized.desktopWindows?.[0].minimized).toBe(true);
    const focused = reduceDesktopState({ ...base(), ...minimized }, { type: "restore", windowId: "desktop-progress" }, projects, desktop);
    expect(focused.desktopWindows?.[0].minimized).toBe(false);
    const closed = reduceDesktopState({ ...base(), ...focused }, { type: "close", windowId: "desktop-progress" }, projects, desktop);
    expect(closed.desktopWindows).toEqual([]);
  });

  it("页面导航只接受该项目的启用页面", () => {
    const state = { ...base(), desktopWindows: [{ id: "document:project-1", iconId: "icon-1", kind: "document" as const, projectId: "project-1", fileLabel: "项目说明", pageId: "p1", minimized: false, maximized: false, order: 1 }] };
    expect(reduceDesktopState(state, { type: "navigate", windowId: "document:project-1", pageId: "p2" }, projects, desktop).desktopWindows?.[0]).toMatchObject({ pageId: "p2" });
    expect(reduceDesktopState(state, { type: "navigate", windowId: "document:project-1", pageId: "nope" }, projects, desktop)).toEqual({});
  });

  it("read 动作记录阅读进度并发放奖励物品", () => {
    const withReward = [{ ...(project as Record<string, unknown>), rewardItem: { id: "item-1", title: "纪念品" } }] as never;
    const state: RuntimeState = { ...base(), selectedDesktopId: "content", desktopWindows: [{ id: "document:project-1", iconId: "icon-1", kind: "document", projectId: "project-1", fileLabel: "项目说明", pageId: "p1", minimized: false, maximized: false, order: 1 }] };
    const update = reduceDesktopState(state, { type: "read", windowId: "document:project-1" }, withReward, desktop);
    expect(update.completedProjectIds).toEqual(["project-1"]);
    expect(update.inventoryItemIds).toEqual(["item-1"]);
    expect(update.desktopReadProjectIds).toEqual({ content: ["project-1"] });
  });
});
