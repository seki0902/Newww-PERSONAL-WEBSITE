import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, clearRuntimeState, initialRuntimeState, restoreRuntimeState, saveRuntimeState } from "../../src/runtime/persist";

const fakeStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    dump: () => store,
  };
};

describe("runtime persist", () => {
  it("保存后可以完整恢复", () => {
    const storage = fakeStorage();
    const state = { ...initialRuntimeState, stage: "desktop" as const, completedProjectIds: ["project-1"], inventoryItemIds: ["item-1"] };
    saveRuntimeState(state, storage);
    expect(restoreRuntimeState(storage)).toEqual(state);
  });

  it("没有存档时返回初始状态", () => {
    const storage = fakeStorage();
    expect(restoreRuntimeState(storage)).toEqual(initialRuntimeState);
  });

  it("存档损坏时清空并回落到初始状态", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, "{ this is not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(restoreRuntimeState(storage)).toEqual(initialRuntimeState);
    expect(storage.dump().has(STORAGE_KEY)).toBe(false);
    warn.mockRestore();
  });

  it("未知字段/非法 stage 的存档会被拒绝", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...initialRuntimeState, stage: "not-a-stage" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(restoreRuntimeState(storage)).toEqual(initialRuntimeState);
    warn.mockRestore();
  });

  it("clearRuntimeState 删除存档", () => {
    const storage = fakeStorage();
    saveRuntimeState(initialRuntimeState, storage);
    clearRuntimeState(storage);
    expect(storage.dump().size).toBe(0);
  });
});
