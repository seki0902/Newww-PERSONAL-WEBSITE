import { describe, expect, it } from "vitest";
import projectsJson from "../../content/projects.json";
import { validateContentBundle, validateProjects } from "../../src/schema/content-contract.mjs";
import { fixtureBundle } from "../support/fixtures.mjs";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
// 故意构造非法内容，因此这里用宽松类型。
type RawProject = { id: string; order: number; tarot: { id: string }; blocks: unknown[]; pages?: unknown[]; pageIds?: string[]; [key: string]: unknown };

describe("validateProjects（仓库内真实内容）", () => {
  it("content/projects.json 通过全部校验", () => {
    const projects = validateProjects(projectsJson);
    expect(projects.length).toBe(projectsJson.length);
    expect(projects.some((project) => project.enabled)).toBe(true);
  });

  it("重复 project id 会被拒绝", () => {
    const broken = clone(projectsJson) as RawProject[];
    broken[1].id = broken[0].id;
    expect(() => validateProjects(broken)).toThrow(/Duplicate project id/);
  });

  it("重复 order 会被拒绝", () => {
    const broken = clone(projectsJson) as RawProject[];
    broken[1].order = broken[0].order;
    expect(() => validateProjects(broken)).toThrow(/Duplicate project order/);
  });

  it("表格行列数不一致会被拒绝", () => {
    const broken = clone(projectsJson) as RawProject[];
    broken.push(clone(broken[0]));
    broken[broken.length - 1].id = "project-broken";
    broken[broken.length - 1].order = 999;
    broken[broken.length - 1].tarot.id = "tarot-broken";
    broken[broken.length - 1].blocks = [{ id: "t1", type: "table", columns: ["a", "b"], rows: [["only-one"]] }];
    delete broken[broken.length - 1].pages;
    delete broken[broken.length - 1].pageIds;
    expect(() => validateProjects(broken)).toThrow(/must match the column count/);
  });
});

describe("validateContentBundle（E2E 夹具内容）", () => {
  it("夹具内容通过校验，并能与仓库项目合并", () => {
    const bundle = validateContentBundle(fixtureBundle(), validateProjects(projectsJson));
    expect(bundle.version).toBe(1);
    expect(bundle.assets.length).toBeGreaterThan(0);
  });

  it("引用不存在的素材会被拒绝", () => {
    const broken = clone(fixtureBundle());
    broken.intro.scenes[0].backgroundAssetId = "not-exist";
    expect(() => validateContentBundle(broken, validateProjects(projectsJson))).toThrow(/references missing asset/);
  });

  it("素材类型与 MIME 不一致会被拒绝", () => {
    const broken = clone(fixtureBundle());
    broken.assets[0].mimeType = "audio/wav";
    expect(() => validateContentBundle(broken, validateProjects(projectsJson))).toThrow(/type and MIME mismatch/);
  });

  it("桌面图标关联不存在的项目会被拒绝", () => {
    const broken = clone(fixtureBundle());
    broken.desktop.icons[0].projectId = "ghost-project";
    expect(() => validateContentBundle(broken, validateProjects(projectsJson))).toThrow(/references missing project/);
  });

  it("重复素材 id 会被拒绝", () => {
    const broken = clone(fixtureBundle());
    broken.assets.push(clone(broken.assets[0]));
    expect(() => validateContentBundle(broken, validateProjects(projectsJson))).toThrow(/Duplicate asset id/);
  });
});
