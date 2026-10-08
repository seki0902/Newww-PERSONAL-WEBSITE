#!/usr/bin/env node
/**
 * 把"优化后的媒体目录"（optimize-media 的产物）上传到 Cloudflare R2：
 *   content.json        → content/draft.json（--publish 时同时写 published.json）
 *   assets/**.{webp,ogg,png,...} → media/<素材 id>（按 content.json 的 assets[].path 反查 id）
 *   static/**           → media/static/<相对路径>
 *   demos/**            → demo/<相对路径>
 *   并生成 content/assets.json（素材索引，API 用它决定 Content-Type）
 *
 * 需要环境变量（Cloudflare 控制台 → R2 → Manage R2 API Tokens 创建）：
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * 用法：
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=seki-portfolio \
 *   node tools/r2-upload.mjs --source ../seki-media-opt --publish
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const sourceDir = value("--source", "../seki-media-opt");
const bucket = value("--bucket", process.env.R2_BUCKET ?? "seki-portfolio");
const accountId = value("--account", process.env.R2_ACCOUNT_ID ?? "");
const accessKeyId = value("--access-key", process.env.R2_ACCESS_KEY_ID ?? "");
const secretAccessKey = value("--secret-key", process.env.R2_SECRET_ACCESS_KEY ?? "");
const publish = args.includes("--publish");
const prune = args.includes("--prune");

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("缺少 R2 凭据：需要 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
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
const kindFor = (mime) => mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : mime.startsWith("font/") || mime.includes("woff") ? "font" : "file";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

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
const uploadedKeys = [];
let bytes = 0;

async function put(key, body, contentType) {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: key.startsWith("content/") ? "no-store" : "public, max-age=31536000, immutable" }));
  uploadedKeys.push(key);
  bytes += body.length;
}

// 1) bundle 素材
for (const asset of bundle.assets) {
  const file = join(sourceDir, asset.path);
  if (!existsSync(file)) { console.warn(`⚠️  缺少素材文件: ${asset.path}`); continue; }
  const body = readFileSync(file);
  await put(`media/${asset.id}`, body, asset.mimeType ?? mimeFor(asset.path));
}

// 2) static 素材 + 3) demo 小程序
for (const [dir, prefix] of [["static", "media/static"], ["demos", "demo"]]) {
  for (const file of listFiles(join(sourceDir, dir))) {
    const rel = relative(join(sourceDir, dir), file).split(sep).join("/");
    const body = readFileSync(file);
    await put(`${prefix}/${rel}`, body, mimeFor(file));
  }
}

// 4) 内容文档 + 素材索引
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
const indexWithSizes = index.map((entry) => {
  const file = join(sourceDir, entry.path.startsWith("static/") ? join("static", entry.path.slice("static/".length)) : entry.path);
  const size = existsSync(file) ? statSync(file).size : 0;
  const sha256 = existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : undefined;
  return { ...entry, byteSize: size, sha256 };
});
await put("content/assets.json", Buffer.from(JSON.stringify(indexWithSizes, null, 2)), "application/json; charset=utf-8");
await put("content/draft.json", Buffer.from(JSON.stringify(bundle, null, 2)), "application/json; charset=utf-8");
if (publish) await put("content/published.json", Buffer.from(JSON.stringify(bundle, null, 2)), "application/json; charset=utf-8");

// 5) 可选：清理 R2 中已不存在的 key
if (prune) {
  const existing = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const object of page.Contents ?? []) existing.push(object.Key);
    token = page.NextContinuationToken;
  } while (token);
  const stale = existing.filter((key) => !uploadedKeys.includes(key));
  if (stale.length) {
    for (let i = 0; i < stale.length; i += 1000) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: stale.slice(i, i + 1000).map((Key) => ({ Key })) } }));
    }
  }
  console.log(`清理过期对象 ${stale.length} 个`);
}

console.log(`上传完成：${uploadedKeys.length} 个对象 / ${(bytes / 1048576).toFixed(2)} MB → r2://${bucket}`);
if (!publish) console.log("提示：只写了 draft，未发布（加 --publish 才会写 published.json）");
