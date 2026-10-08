import { describe, expect, it } from "vitest";
import { addUnique, getEnabledProjectPages, getEnabledProjects, getNextProject, getProgress, getProjectPageNavigation } from "../../src/runtime/flow";

const project = (id: string, order: number, enabled: boolean, pages: { id: string; enabled: boolean; order: number }[] = []) => ({
  id, order, enabled,
  pages: pages.map((page) => ({ ...page })),
  pageIds: pages.map((page) => page.id),
}) as never;

describe("flow helpers", () => {
  it("addUnique 不产生重复项", () => {
    expect(addUnique(["a"], "a")).toEqual(["a"]);
    expect(addUnique(["a"], "b")).toEqual(["a", "b"]);
  });

  it("getEnabledProjects 过滤并按 order 排序", () => {
    const projects = [project("b", 2, true), project("a", 1, true), project("c", 3, false)];
    expect(getEnabledProjects(projects).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("getNextProject 返回第一个未完成项目；getProgress 计算百分比", () => {
    const projects = [project("a", 1, true), project("b", 2, true), project("c", 3, false)];
    expect(getNextProject(projects, ["a"])?.id).toBe("b");
    expect(getNextProject(projects, ["a", "b"])).toBeUndefined();
    expect(getProgress(projects, ["a"])).toBe(50);
    expect(getProgress([], [])).toBe(0);
  });

  it("getEnabledProjectPages 只保留启用且被 pageIds 引用的页面", () => {
    const pages = [{ id: "p1", enabled: true, order: 1 }, { id: "p2", enabled: false, order: 2 }];
    const item = project("a", 1, true, pages);
    expect(getEnabledProjectPages(item).map((page) => page.id)).toEqual(["p1"]);
  });

  it("getProjectPageNavigation 给出上一页/下一页能力", () => {
    const pages = [{ id: "p1", enabled: true, order: 1 }, { id: "p2", enabled: true, order: 2 }];
    const item = project("a", 1, true, pages);
    const middle = getProjectPageNavigation(item, "p1");
    expect(middle.canPrev).toBe(false);
    expect(middle.canNext).toBe(true);
    expect(middle.currentPage?.id).toBe("p1");
    expect(getProjectPageNavigation(item, "missing").currentIndex).toBe(-1);
  });
});
