#!/usr/bin/env node
// 一条命令启动本地开发：API server（默认 8787）+ vite dev server（5173，代理 /api 与 /demos）。
import { spawn } from "node:child_process";

const children = [];
const run = (name, command, args) => {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  child.on("exit", (code) => {
    console.log(`[dev-all] ${name} 退出（code=${code}）`);
    for (const other of children) if (other !== child && !other.killed) other.kill("SIGTERM");
    process.exitCode = code ?? 0;
  });
  children.push(child);
};

run("server", "node", ["server/index.mjs"]);
run("vite", "npx", ["vite", "--host", "0.0.0.0", "--port", "5173"]);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { for (const child of children) child.kill(signal); });
}
