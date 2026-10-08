#!/usr/bin/env node
/**
 * 一次性创建 Cloudflare 侧资源（无需银行卡）：
 *   1. 校验 API Token
 *   2. 创建 Pages 项目（若不存在）
 *   3. 创建 Workers KV 命名空间 seki-portfolio（若不存在）并写回 wrangler.toml
 *   4. 给 Pages 项目写入 ADMIN_TOKEN 密钥（编辑器写权限；未提供则随机生成并打印一次）
 *
 * 需要的环境变量：
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN   （权限：Account → Cloudflare Pages: Edit、Account → Workers KV Storage: Edit）
 * 可选：
 *   CF_PAGES_PROJECT（默认 seki-portfolio）、CF_KV_TITLE（默认 seki-portfolio）、ADMIN_TOKEN（不传则随机生成）
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
const project = process.env.CF_PAGES_PROJECT ?? "seki-portfolio";
const kvTitle = process.env.CF_KV_TITLE ?? "seki-portfolio";
const adminToken = process.env.ADMIN_TOKEN ?? randomBytes(24).toString("hex");

if (!accountId || !apiToken) {
  console.error("缺少 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const api = async (path, init = {}) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const detail = JSON.stringify(payload.errors ?? payload).slice(0, 300);
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status} ${detail}`);
  }
  return payload.result;
};

// 1) token 校验
const verify = await api("/user/tokens/verify");
console.log(`✅ Token 有效（status=${verify.status}）`);

// 2) Pages 项目
const projects = await api(`/accounts/${accountId}/pages/projects`);
let pagesProject = projects.find((entry) => entry.name === project);
if (!pagesProject) {
  pagesProject = await api(`/accounts/${accountId}/pages/projects`, {
    method: "POST",
    body: JSON.stringify({ name: project, production_branch: "master" }),
  });
  console.log(`✅ 已创建 Pages 项目：${project}`);
} else {
  console.log(`✅ Pages 项目已存在：${project}（${pagesProject.subdomain}）`);
}

// 3) KV 命名空间
const namespaces = await api(`/accounts/${accountId}/storage/kv/namespaces?per_page=100`);
let namespace = namespaces.find((entry) => entry.title === kvTitle);
if (!namespace) {
  namespace = await api(`/accounts/${accountId}/storage/kv/namespaces`, {
    method: "POST",
    body: JSON.stringify({ title: kvTitle }),
  });
  console.log(`✅ 已创建 KV 命名空间：${kvTitle} (id=${namespace.id})`);
} else {
  console.log(`✅ KV 命名空间已存在：${kvTitle} (id=${namespace.id})`);
}
const wranglerPath = "wrangler.toml";
if (existsSync(wranglerPath)) {
  const updated = readFileSync(wranglerPath, "utf8").replace(/^id = ".*"$/m, `id = "${namespace.id}"`);
  writeFileSync(wranglerPath, updated);
  console.log("✅ wrangler.toml 已写入 KV namespace id");
}

// 4) Pages 密钥 ADMIN_TOKEN
await api(`/accounts/${accountId}/pages/projects/${project}/secrets`, {
  method: "POST",
  body: JSON.stringify({ name: "ADMIN_TOKEN", value: adminToken, type: "secret_text" }),
});
console.log("✅ 已写入 Pages 密钥 ADMIN_TOKEN");

console.log(`
下一步：
  1) 部署前端：  npx wrangler pages deploy dist --project-name=${project}
  2) 上传素材：  CLOUDFLARE_ACCOUNT_ID=${accountId} CLOUDFLARE_API_TOKEN=<token> KV_NAMESPACE_ID=${namespace.id} \\
                 npm run upload:assets -- --source ../seki-media-opt --publish
  3) 线上地址：  https://${pagesProject.subdomain ?? `${project}.pages.dev`}
  4) 编辑器：    https://${pagesProject.subdomain ?? `${project}.pages.dev`}/?editor=1&token=${adminToken}
`);
if (process.env.ADMIN_TOKEN) console.log("（ADMIN_TOKEN 来自环境变量，未重新生成）");
