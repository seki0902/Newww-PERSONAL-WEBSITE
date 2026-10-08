#!/usr/bin/env node
// E2E 服务器：夹具写入本地 KV 后，用 wrangler pages dev 起「生产同款」Workers 运行时。
// 与生产使用同一份 functions/** 代码与同一套 KV 键布局，本地不再有第二套 API 实现。
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildKvPairs, pushLocal } from "../../tools/upload-assets.mjs";
import { buildFixtureDir } from "./fixtures.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const port = process.env.E2E_PORT ?? "8790";
const adminToken = process.env.ADMIN_TOKEN ?? "e2e-token";
const log = (message) => console.log(`[e2e] ${message}`);

if (!existsSync(join(projectRoot, "dist", "index.html"))) {
  console.error("[e2e] 缺少前端产物 dist/，请先运行 npm run build（npm run test:e2e 会自动执行）。");
  process.exit(1);
}

// 1) 生成夹具：媒体文件运行时生成，仓库里不出现任何素材文件。
const fixtureDir = mkdtempSync(join(tmpdir(), "seki-fixtures-"));
const { bundle } = buildFixtureDir(fixtureDir);

// 2) 写入本地 KV（与 wrangler pages dev 共用 --persist-to 存储）。
const persistDir = mkdtempSync(join(tmpdir(), "seki-kv-"));
const { pairs } = buildKvPairs(fixtureDir, { publish: true });
pushLocal(pairs, { persistTo: persistDir, log });
log(`夹具就绪：${bundle.assets.length} 个素材 / ${pairs.length} 个 KV key（fixtures: ${fixtureDir}）`);

// 3) 起 Workers 运行时（读 wrangler.toml 的 KV 绑定，ADMIN_TOKEN 由 --binding 注入）。
const child = spawn(
  "npx",
  ["wrangler", "pages", "dev", "dist", "--port", port, "--persist-to", persistDir, "--binding", `ADMIN_TOKEN=${adminToken}`, "--log-level", "warn"],
  { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
);
child.stdout.on("data", (data) => process.stdout.write(`[worker] ${data}`));
child.stderr.on("data", (data) => process.stderr.write(`[worker] ${data}`));
child.on("exit", (code) => {
  console.error(`[e2e] worker 退出（code=${code}）`);
  process.exit(code ?? 1);
});

const health = `http://127.0.0.1:${port}/api/health`;
for (let attempt = 1; attempt <= 90; attempt += 1) {
  try {
    const response = await fetch(health, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      log(`server ready: ${health}（port ${port}）`);
      break;
    }
  } catch {
    // 还没起来，继续等
  }
  if (attempt === 90) {
    console.error(`[e2e] 等待 worker 就绪超时：${health}`);
    child.kill("SIGTERM");
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

const shutdown = () => {
  child.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
