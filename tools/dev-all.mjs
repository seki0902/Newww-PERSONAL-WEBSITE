#!/usr/bin/env node
// 一条命令启动本地开发：
//   - wrangler pages dev：生产同款 Workers 运行时 + 本地 KV（默认 8788），数据在 .wrangler/state
//   - vite dev server（5173，代理 /api 与 /demos 到 8788）
// 首次使用可先 npm run content:local -- --source <素材目录> 把内容灌进本地 KV。
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const apiPort = process.env.API_PORT ?? "8788";
const adminToken = process.env.ADMIN_TOKEN ?? "dev-token";

if (!existsSync(join(projectRoot, "dist", "index.html"))) {
  console.log("[dev-all] 未找到 dist/，先执行 npm run build");
  const build = spawnSync("npm", ["run", "build"], { cwd: projectRoot, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const children = [];
const run = (name, command, args, env = process.env) => {
  const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit", env });
  child.on("exit", (code) => {
    console.log(`[dev-all] ${name} 退出（code=${code}）`);
    for (const other of children) if (other !== child && !other.killed) other.kill("SIGTERM");
    process.exitCode = code ?? 0;
  });
  children.push(child);
};

run("api", "npx", [
  "wrangler", "pages", "dev", "dist",
  "--port", apiPort,
  "--persist-to", join(projectRoot, ".wrangler", "state"),
  "--binding", `ADMIN_TOKEN=${adminToken}`,
]);
run("vite", "npx", ["vite", "--host", "0.0.0.0", "--port", "5173"], {
  ...process.env,
  API_ORIGIN: process.env.API_ORIGIN ?? `http://127.0.0.1:${apiPort}`,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { for (const child of children) child.kill(signal); });
}
