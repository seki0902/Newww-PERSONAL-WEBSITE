#!/usr/bin/env node
/**
 * 把"优化后的媒体目录"（tools/optimize-media.mjs 的产物）上传到 Cloudflare Workers KV：
 *   assets/**.{webp,ogg,...}  → media/<素材 id>
 *   static/**                 → media/static/<相对路径>
 *   demos/**                  → demo/<相对路径>
 *   content.json              → content/draft.json（--publish 时同时写 published.json）
 *   素材索引                  → content/assets.json
 *
 * 选择 KV 而不是 R2：KV 免费且无需银行卡；压缩后素材总量约 7MB（免费额度 1GB / 每天 10 万读）。
 *
 * 环境变量：
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN（Workers KV Storage: Edit）, KV_NAMESPACE_ID
 *
 * 用法：
 *   npm run upload:assets -- --source ../seki-media-opt --publish [--prune]
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const sourceDir = value("--source", "../seki-media-opt");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? value("--account", "");
const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? value("--token", "");
const namespaceId = process.env.KV_NAMESPACE_ID ?? value("--namespace", "");
const publish = args.includes("--publish");
const prune = args.includes("--prune");

if (!accountId || !apiToken || !namespaceId) {
  console.error("缺少环境变量：CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / KV_NAMESPACE_ID");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm",
};
const mimeFor = (path) => MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
const kindFor = (mime) => mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : (mime.startsWith("font/") || mime.includes("woff")) ? "font" : "file";

const listFiles = (dir) => {
  const out = [];
  const walk = (current) => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  walk(dir);
  return out;
};

const bundle = JSON.parse(readFileSync(join(sourceDir, "content.json"), "utf8"));
const pairs = []; // { key, value(base64), metadata }

const addBinary = (key, file, contentType, metadata = {}) =>
  pairs.push({ key, value: readFileSync(file).toString("base64"), metadata: { contentType, ...metadata } });

// 1) bundle 素材
for (const asset of bundle.assets) {
  const file = join(sourceDir, asset.path);
  if (!existsSync(file)) { console.warn(`⚠️  缺少素材文件: ${asset.path}`); continue; }
  addBinary(`media/${asset.id}`, file, asset.mimeType ?? mimeFor(asset.path), { fileName: asset.fileName, size: statSync(file).size });
}

// 2) static 素材 + 3) demo 小程序
for (const file of listFiles(join(sourceDir, "static"))) {
  const rel = relative(join(sourceDir, "static"), file).split(sep).join("/");
  addBinary(`media/static/${rel}`, file, mimeFor(file), { fileName: rel.split("/").pop(), size: statSync(file).size });
}
for (const file of listFiles(join(sourceDir, "demos"))) {
  const rel = relative(join(sourceDir, "demos"), file).split(sep).join("/");
  addBinary(`demo/${rel}`, file, mimeFor(file), { size: statSync(file).size });
}

// 4) 素材索引（含 static/**，供 /api/assets 列表与 Content-Type 使用）
const index = bundle.assets.map((asset) => ({
  id: asset.id, kind: asset.type, path: asset.path, mimeType: asset.mimeType,
  fileName: asset.fileName, originalName: asset.originalName, label: asset.label,
  presentation: asset.presentation, url: `/api/assets/${asset.id}`,
}));
for (const file of listFiles(join(sourceDir, "static"))) {
  const rel = relative(join(sourceDir, "static"), file).split(sep).join("/");
  const mime = mimeFor(file);
  index.push({ id: `static/${rel}`, kind: kindFor(mime), path: `static/${rel}`, mimeType: mime, fileName: rel.split("/").pop(), originalName: rel.split("/").pop(), url: `/api/assets/static/${rel}` });
}
const indexWithSize = index.map((entry) => {
  const file = entry.path.startsWith("static/") ? join(sourceDir, "static", entry.path.slice("static/".length)) : join(sourceDir, entry.path);
  return { ...entry, byteSize: existsSync(file) ? statSync(file).size : 0 };
});
pairs.push({ key: "content/assets.json", value: Buffer.from(JSON.stringify(indexWithSize, null, 2)).toString("base64"), metadata: { contentType: "application/json; charset=utf-8" } });
pairs.push({ key: "content/draft.json", value: Buffer.from(JSON.stringify(bundle, null, 2)).toString("base64"), metadata: { contentType: "application/json; charset=utf-8", uploaded: new Date().toISOString() } });
if (publish) {
  pairs.push({ key: "content/published.json", value: Buffer.from(JSON.stringify(bundle, null, 2)).toString("base64"), metadata: { contentType: "application/json; charset=utf-8", uploaded: new Date().toISOString() } });
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
async function bulk(items, attempt = 1) {
  try {
    const response = await fetch(`${endpoint}/bulk`, {
      method: "PUT",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify(items),
      signal: AbortSignal.timeout(180000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(JSON.stringify(payload.errors ?? payload).slice(0, 400));
    }
  } catch (error) {
    if (attempt < 4) {
      console.warn(`批量上传失败（第 ${attempt} 次）：${error?.message ?? error}，10 秒后重试`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return bulk(items, attempt + 1);
    }
    console.error("上传失败：", error?.message ?? error);
    process.exit(1);
  }
}

// KV bulk 单次上限 10000 个 key / 100MB
const CHUNK = 20;
let uploaded = 0;
for (let i = 0; i < pairs.length; i += CHUNK) {
  const chunk = pairs.slice(i, i + CHUNK);
  await bulk(chunk.map((pair) => ({ ...pair, base64: true })));
  uploaded += chunk.length;
  console.log(`已上传 ${uploaded}/${pairs.length}`);
}

if (prune) {
  const listResponse = await fetch(`${endpoint}/keys?limit=1000`, { headers: { authorization: `Bearer ${apiToken}` } });
  const listed = await listResponse.json().catch(() => ({}));
  const existing = (listed.result ?? []).map((entry) => entry.name);
  const keep = new Set(pairs.map((pair) => pair.key));
  const stale = existing.filter((key) => !keep.has(key));
  if (stale.length) {
    await fetch(`${endpoint}/bulk/delete`, { method: "POST", headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" }, body: JSON.stringify(stale) });
  }
  console.log(`清理过期 key ${stale.length} 个`);
}

const bytes = pairs.reduce((sum, pair) => sum + Buffer.from(pair.value, "base64").length, 0);
console.log(`完成：${uploaded} 个 key / ${(bytes / 1048576).toFixed(2)} MB${publish ? "（已发布 published）" : "（仅 draft）"}`);
