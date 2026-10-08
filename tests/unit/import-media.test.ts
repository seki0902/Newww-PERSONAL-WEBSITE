// 数据库集成测试：需要 TEST_DATABASE_URL（CI 由 postgres service 提供）。
// 本地可用 docker 起一个 postgres 后：TEST_DATABASE_URL=postgres://... npm test
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, ensureSchema, getAssetById, getAssetByPath, getDocument, listAssets } from "../../server/db.mjs";
import { buildFixtureDir } from "../support/fixtures.mjs";
import { importMedia } from "../../tools/import-media.mjs";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const suite = databaseUrl ? describe : describe.skip;

suite("import-media（真实数据库）", () => {
  let pool: ReturnType<typeof createPool>;
  let fixtureDir: string;

  beforeAll(async () => {
    fixtureDir = mkdtempSync(join(tmpdir(), "seki-import-test-"));
    buildFixtureDir(fixtureDir);
    pool = createPool(databaseUrl);
    await ensureSchema(pool);
    await importMedia({ sourceDir: fixtureDir, databaseUrl, publish: true, prune: true, pool, log: () => undefined });
  });

  afterAll(async () => {
    await pool?.end();
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("素材写入数据库并且可以按 id/path 读回", async () => {
    const assets = await listAssets(pool);
    expect(assets.length).toBeGreaterThan(10);
    const image = await getAssetById(pool, "fx-image");
    expect(image?.mime_type).toBe("image/png");
    expect(image?.data.byteLength).toBeGreaterThan(0);
    const font = await getAssetByPath(pool, "static/fonts/kami-seki-regular.woff2");
    expect(font?.kind).toBe("font");
    const demo = await getAssetByPath(pool, "demo/content-agent/index.html");
    expect(demo?.data.toString("utf8")).toContain("content-agent");
  });

  it("draft 与 published 文档一致，且通过 schema 校验", async () => {
    const draft = await getDocument(pool, "draft");
    const published = await getDocument(pool, "published");
    expect(draft?.doc).toBeTruthy();
    expect(published?.doc).toEqual(draft?.doc);
  });

  it("二次导入是幂等的", async () => {
    const before = await listAssets(pool);
    await importMedia({ sourceDir: fixtureDir, databaseUrl, publish: true, pool, log: () => undefined });
    const after = await listAssets(pool);
    expect(after.map((asset) => asset.id).sort()).toEqual(before.map((asset) => asset.id).sort());
  });
});
