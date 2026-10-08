#!/usr/bin/env node
// E2E 服务器：初始化测试库（可用 TEST_DATABASE_URL）+ 导入夹具 + 启动站点服务。
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixtureDir } from "./fixtures.mjs";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://seki:seki@127.0.0.1:55432/seki_portfolio";
const port = process.env.E2E_PORT ?? "8790";
process.env.DATABASE_URL = databaseUrl;
process.env.PORT = port;
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";
// 生产语义下写接口必须带 x-admin-token，E2E 也借此验证权限分支。
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "e2e-token";

const fixtureDir = process.env.E2E_FIXTURE_DIR ?? mkdtempSync(join(tmpdir(), "seki-fixtures-"));
if (process.env.E2E_REUSE_FIXTURES !== "1" || !existsSync(join(fixtureDir, "content.json"))) {
  buildFixtureDir(fixtureDir);
}

const { importMedia } = await import(new URL("../../tools/import-media.mjs", import.meta.url).href);
await importMedia({ sourceDir: fixtureDir, databaseUrl, publish: true, prune: true, log: (message) => console.log(`[e2e] ${message}`) });

const { startServer } = await import(new URL("../../server/index.mjs", import.meta.url).href);
const { server } = await startServer();
console.log(`[e2e] server ready: http://127.0.0.1:${port} (fixtures: ${fixtureDir})`);

const shutdown = () => { server.close(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
