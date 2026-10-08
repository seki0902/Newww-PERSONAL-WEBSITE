// 极简 .env 读取（本地开发用；容器环境由 docker compose 注入变量，无需 .env 解析）。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** @param {string} filePath */
export function loadEnvFile(filePath = join(process.cwd(), ".env")) {
  if (!existsSync(filePath)) return false;
  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}
