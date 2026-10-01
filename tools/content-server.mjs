import { createServer } from "node:http";
import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { validateContentBundle } from "../src/schema/content-contract.mjs";

const root = process.cwd();
const draftDir = join(root, "content", "draft");
const draftFile = join(draftDir, "content.json");
const draftAssets = join(draftDir, "assets");
const publishedDir = join(root, "public", "content", "current");
const baseProjects = JSON.parse(readFileSync(join(root, "content", "projects.json"), "utf8"));
const imageMime = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const audioMime = new Set(["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4"]);
const videoMime = new Set(["video/mp4", "video/webm", "video/ogg"]);
const editorOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const assetContentTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg" };

const json = (response, status, payload) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(payload)); };
const text = (response, status, payload) => { response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }); response.end(payload); };
const body = async (request) => { const chunks = []; for await (const chunk of request) chunks.push(chunk); return Buffer.concat(chunks); };

export function validateContent(content, { verifyFiles = true } = {}) {
  const validated = validateContentBundle(content, baseProjects);
  for (const asset of validated.assets) {
    const target = safePath(draftDir, asset.path);
    if (verifyFiles && (!existsSync(target) || !statSync(target).isFile())) throw new Error(`Asset file missing: ${asset.id}`);
  }
  return validated;
}

function safePath(base, relative) {
  const target = resolve(base, normalize(relative));
  if (!target.startsWith(`${resolve(base)}\\`) && target !== resolve(base)) throw new Error("Invalid asset path");
  return target;
}
export async function readDraft() { return JSON.parse(await readFile(draftFile, "utf8")); }
export async function saveDraft(content) { const validated = validateContent(content); const temp = `${draftFile}.${randomUUID()}.tmp`; await writeFile(temp, `${JSON.stringify(validated, null, 2)}\n`); await rename(temp, draftFile); return validated; }
export async function publishContent() { const content = validateContent(await readDraft()); await mkdir(publishedDir, { recursive: true }); await cp(draftAssets, join(publishedDir, "assets"), { recursive: true, force: true }); await writeFile(join(publishedDir, "content.json"), `${JSON.stringify(content, null, 2)}\n`); return content; }

async function listAssets() { const content = await readDraft(); return content.assets; }
async function uploadAsset(request) {
  const mimeType = request.headers["content-type"]?.split(";")[0] ?? "";
  const type = request.headers["x-asset-type"];
  const expected = type === "image" ? imageMime : type === "audio" ? audioMime : type === "video" ? videoMime : undefined;
  if (!expected?.has(mimeType)) throw new Error("Unsupported asset MIME type");
  const originalName = decodeURIComponent(String(request.headers["x-file-name"] ?? "asset"));
  const extension = extname(basename(originalName)).toLowerCase() || (type === "image" ? ".png" : type === "audio" ? ".mp3" : ".mp4");
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
  const relative = `assets/${type}s/${fileName}`;
  const target = safePath(draftDir, relative);
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, await body(request));
  return { id: `asset-${randomUUID().slice(0, 12)}`, type, fileName, originalName, path: relative, mimeType, label: originalName.replace(extname(originalName), "") };
}

function sendStaticAsset(request, response, relative) {
  let target;
  try { target = safePath(draftDir, `assets/${decodeURIComponent(relative)}`); } catch { text(response, 400, "Invalid path"); return; }
  try { if (!statSync(target).isFile()) { text(response, 404, "Asset not found"); return; } } catch { text(response, 404, "Asset not found"); return; }
  const stream = createReadStream(target);
  stream.once("error", () => { if (response.headersSent) response.destroy(); else text(response, 404, "Asset not found"); });
  stream.once("open", () => {
    response.writeHead(200, { "Content-Type": assetContentTypes[extname(target).toLowerCase()] ?? "application/octet-stream" });
    stream.pipe(response);
  });
  response.once("close", () => stream.destroy());
}

export function createContentServer() {
  return createServer(async (request, response) => {
    response.setHeader("Vary", "Origin");
    if (editorOrigins.has(request.headers.origin)) response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
    if (request.method === "OPTIONS") { response.writeHead(204, { "Access-Control-Allow-Methods": "GET,PUT,POST", "Access-Control-Allow-Headers": "Content-Type,X-File-Name,X-Asset-Type" }); response.end(); return; }
    try {
      if (request.method === "GET" && request.url === "/api/content") return json(response, 200, await readDraft());
      if (request.method === "PUT" && request.url === "/api/content") return json(response, 200, await saveDraft(JSON.parse((await body(request)).toString("utf8"))));
      if (request.method === "GET" && request.url === "/api/assets") return json(response, 200, await listAssets());
      if (request.method === "POST" && request.url === "/api/assets") return json(response, 201, await uploadAsset(request));
      if (request.method === "POST" && request.url === "/api/publish") { await publishContent(); return json(response, 200, { ok: true }); }
      if (request.method === "GET" && request.url?.startsWith("/assets/")) return sendStaticAsset(request, response, request.url.slice(8));
      text(response, 404, "Not found");
    } catch (error) { text(response, 400, error instanceof Error ? error.message : "Content service error"); }
  });
}

if (process.argv.includes("--publish")) { await publishContent(); console.log("Published content bundle"); }
else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { createContentServer().listen(4174, "127.0.0.1", () => console.log("Content service: http://127.0.0.1:4174")); }
