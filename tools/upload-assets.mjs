#!/usr/bin/env node
/**
 * 内容与素材上传工具（唯一入口，两个目标：线上 Workers KV / 本地 wrangler KV）。
 *
 * 目录约定（与 tools/optimize-media.mjs 的产物一致）：
 *   <source>/content.json   内容 bundle（含 assets[].id / assets[].path）
 *   <source>/assets/**      bundle 引用的素材，路径与 assets[].path 一致  → media/<id>
 *   <source>/static/**      代码内固定引用的素材（字体/塔罗牌/引导图…）     → media/static/<相对路径>
 *   <source>/demos/**       agent 演示小程序                              → demo/<相对路径>
 *   素材索引                                                             → content/assets.json
 *   内容                                                                 → content/draft.json（--publish 同时写 published.json）
 *
 * 目标：
 *   远程（默认）：Cloudflare Workers KV。需要 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / KV_NAMESPACE_ID
 *   本地（--local）：wrangler 的本地 KV（npm run dev:api 与 E2E 用同一份）。需要 --persist-to <dir>
 *
 * 用法：
 *   npm run upload:assets -- --source ../seki-media-opt --publish
 *   npm run content:local -- --source ../seki-media-opt --publish --prune
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

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

/**
 * 把素材目录编译成 KV 键值对（值以 base64 存放，兼容 Cloudflare bulk 与 wrangler bulk 两种格式）。
 * @param {string} sourceDir
 * @param {{ publish?: boolean }} [options]
 * @returns {{ pairs: Array<{key: string, value: string, metadata: Record<string, unknown>}>, bundle: any }}
 */
export function buildKvPairs(sourceDir, { publish = false } = {}) {
  const bundle = JSON.parse(readFileSync(join(sourceDir, "content.json"), "utf8"));
  const pairs = [];
  const addBinary = (key, file, contentType, metadata = {}) =>
    pairs.push({ key, value: readFileSync(file).toString("base64"), metadata: { contentType, ...metadata } });

  // 1) bundle 素材
  for (const asset of bundle.assets) {
    const file = join(sourceDir, asset.path);
    if (!existsSync(file)) { console.warn(`⚠️  缺少素材文件: ${asset.path}`); continue; }
    addBinary(`media/${asset.id}`, file, asset.mimeType ?? mimeFor(asset.path), { fileName: asset.fileName, size: statSync(file).size });
  }

  // 2) static 素材 + 3) demo 小程序
  const staticFiles = listFiles(join(sourceDir, "static"));
  for (const file of staticFiles) {
    const rel = relative(join(sourceDir, "static"), file).split(sep).join("/");
    addBinary(`media/static/${rel}`, file, mimeFor(file), { fileName: rel.split("/").pop(), size: statSync(file).size });
  }
  for (const file of listFiles(join(sourceDir, "demos"))) {
    const rel = relative(join(sourceDir, "demos"), file).split(sep).join("/");
    addBinary(`demo/${rel}`, file, mimeFor(file), { size: statSync(file).size });
  }

  // 4) 素材索引（含 static/**，供 /api/assets 列表与 Content-Type 使用）
  const index = bundle.assets.map((asset) => ({
    id: asset.id, type: asset.type, kind: asset.type, path: asset.path, mimeType: asset.mimeType,
    fileName: asset.fileName, originalName: asset.originalName, label: asset.label,
    presentation: asset.presentation, url: `/api/assets/${asset.id}`,
  }));
  for (const file of staticFiles) {
    const rel = relative(join(sourceDir, "static"), file).split(sep).join("/");
    const mime = mimeFor(file);
    index.push({ id: `static/${rel}`, type: kindFor(mime), kind: kindFor(mime), path: `static/${rel}`, mimeType: mime, fileName: rel.split("/").pop(), originalName: rel.split("/").pop(), url: `/api/assets/static/${rel}` });
  }
  const indexWithSize = index.map((entry) => {
    const file = entry.path.startsWith("static/") ? join(sourceDir, "static", entry.path.slice("static/".length)) : join(sourceDir, entry.path);
    return { ...entry, byteSize: existsSync(file) ? statSync(file).size : 0 };
  });
  pairs.push({ key: "content/assets.json", value: Buffer.from(JSON.stringify(indexWithSize, null, 2)).toString("base64"), metadata: { contentType: "application/json; charset=utf-8" } });
  const contentJson = Buffer.from(JSON.stringify(bundle, null, 2)).toString("base64");
  const uploaded = new Date().toISOString();
  pairs.push({ key: "content/draft.json", value: contentJson, metadata: { contentType: "application/json; charset=utf-8", uploaded } });
  if (publish) pairs.push({ key: "content/published.json", value: contentJson, metadata: { contentType: "application/json; charset=utf-8", uploaded } });

  return { pairs, bundle };
}

/**
 * 推到 Cloudflare Workers KV（线上）。
 * @param {Array<{key: string, value: string, metadata: Record<string, unknown>}>} pairs
 * @param {{ accountId: string, apiToken: string, namespaceId: string, prune?: boolean, log?: (...args: unknown[]) => void }} options
 */
async function pushRemote(pairs, { accountId, apiToken, namespaceId, prune = false, log = console.log }) {
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
      if (!response.ok || payload.success === false) throw new Error(JSON.stringify(payload.errors ?? payload).slice(0, 400));
    } catch (error) {
      if (attempt < 4) {
        console.warn(`批量上传失败（第 ${attempt} 次）：${error?.message ?? error}，10 秒后重试`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return bulk(items, attempt + 1);
      }
      throw error;
    }
  }

  // KV bulk 单次上限 10000 个 key / 100MB
  const CHUNK = 20;
  let uploaded = 0;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);
    await bulk(chunk.map((pair) => ({ ...pair, base64: true })));
    uploaded += chunk.length;
    log(`已上传 ${uploaded}/${pairs.length}`);
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
    log(`清理过期 key ${stale.length} 个`);
  }

  const bytes = pairs.reduce((sum, pair) => sum + Buffer.from(pair.value, "base64").length, 0);
  log(`完成：${uploaded} 个 key / ${(bytes / 1048576).toFixed(2)} MB`);
  return { uploaded, bytes };
}

/**
 * 推到 wrangler 的本地 KV（开发 / E2E 用），与 wrangler pages dev --persist-to 共享同一份存储。
 * @param {Array<{key: string, value: string, metadata: Record<string, unknown>}>} pairs
 * @param {{ persistTo: string, prune?: boolean, log?: (...args: unknown[]) => void }} options
 */
export function pushLocal(pairs, { persistTo, prune = false, log = console.log }) {
  if (prune) {
    // 本地只清 KV 分区，保留其它本地模拟存储（D1/R2 等）。
    rmSync(join(persistTo, "v3", "kv"), { recursive: true, force: true });
    log("已重置本地 KV 分区");
  }
  const dir = mkdtempSync(join(tmpdir(), "seki-kv-bulk-"));
  const file = join(dir, "bulk.json");
  try {
    writeFileSync(file, JSON.stringify(pairs.map((pair) => ({ ...pair, base64: true }))));
    const result = spawnSync("npx", ["wrangler", "kv", "bulk", "put", file, "--binding", "KV", "--local", "--persist-to", persistTo], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    if (result.status !== 0) {
      throw new Error(`wrangler kv bulk put 失败（exit ${result.status}）：${(result.stderr || result.stdout || "").slice(0, 400)}`);
    }
    const bytes = pairs.reduce((sum, pair) => sum + Buffer.from(pair.value, "base64").length, 0);
    log(`本地 KV 写入完成：${pairs.length} 个 key / ${(bytes / 1048576).toFixed(2)} MB → ${persistTo}`);
    return { uploaded: pairs.length, bytes };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback;
  };
  const sourceDir = value("--source", process.env.MEDIA_SOURCE_DIR ?? join(projectRoot, "..", "seki-media-opt"));
  const publish = args.includes("--publish");
  const prune = args.includes("--prune");
  const local = args.includes("--local");

  const { pairs, bundle } = buildKvPairs(sourceDir, { publish });
  console.log(`源目录：${sourceDir}（素材 ${bundle.assets.length} 个 + static/demo，共 ${pairs.length} 个 key）`);

  if (local) {
    const persistTo = value("--persist-to", process.env.WRANGLER_PERSIST_TO ?? join(projectRoot, ".wrangler", "state"));
    pushLocal(pairs, { persistTo, prune });
  } else {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? value("--account", "");
    const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? value("--token", "");
    const namespaceId = process.env.KV_NAMESPACE_ID ?? value("--namespace", "");
    if (!accountId || !apiToken || !namespaceId) {
      console.error("缺少环境变量：CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / KV_NAMESPACE_ID（本地请改用 --local）");
      process.exit(1);
    }
    await pushRemote(pairs, { accountId, apiToken, namespaceId, prune });
  }
}
