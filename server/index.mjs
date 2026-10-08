// 站点服务：SPA 静态托管 + 内容/素材 API（内容与素材全部来自 PostgreSQL）。
// 该服务即生产容器入口；本地开发时由 vite dev server 反向代理 /api 与 /demos。
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetStats, createPool, deleteAsset, ensureSchema, getAssetById, getAssetByPath, getDocument,
  listAssets, publishDocument, putDocument, upsertAsset,
} from "./db.mjs";
import { mimeTypeForPath, readBody, safeResolve, sendBuffer, sendJson, sendStaticFile, sha256 } from "./lib/http.mjs";
import { loadEnvFile } from "./lib/load-env.mjs";

loadEnvFile();

// ---------- 配置 ----------
export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distDir = join(projectRoot, "dist");
const baseProjects = JSON.parse(readFileSync(join(projectRoot, "content", "projects.json"), "utf8"));
const { validateContentBundle } = await import(new URL("../src/schema/content-contract.mjs", import.meta.url).href);

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_PRODUCTION = NODE_ENV === "production";

const log = (...args) => console.log(`[server ${new Date().toISOString()}]`, ...args);

// 生产环境必须显式配置 ADMIN_TOKEN 才能写内容；未配置时写接口直接关闭。
const canWrite = (req) => {
  if (!ADMIN_TOKEN) return !IS_PRODUCTION;
  return req.headers["x-admin-token"] === ADMIN_TOKEN;
};

const jsonBody = async (req, limit) => {
  const raw = await readBody(req, limit);
  return JSON.parse(raw.toString("utf8"));
};

// ---------- 路由 ----------
/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
async function handleApi(req, res, url, pool) {
  const pathname = url.pathname;

  if (pathname === "/api/health" && (req.method === "GET" || req.method === "HEAD")) {
    try {
      const stats = await assetStats(pool);
      const published = await getDocument(pool, "published");
      sendJson(req, res, 200, {
        ok: true,
        db: "up",
        env: NODE_ENV,
        version: process.env.APP_VERSION ?? "dev",
        revision: process.env.APP_REVISION ?? "dev",
        content: { publishedUpdatedAt: published?.updatedAt ?? null },
        assets: stats,
      });
    } catch (error) {
      sendJson(req, res, 503, { ok: false, db: "down", error: error.message });
    }
    return true;
  }

  if (pathname === "/api/content") {
    if (req.method === "GET" || req.method === "HEAD") {
      const wantDraft = url.searchParams.get("draft") === "1";
      if (wantDraft && !canWrite(req)) {
        sendJson(req, res, 403, { error: "draft content 需要编辑权限" });
        return true;
      }
      const record = await getDocument(pool, wantDraft ? "draft" : "published");
      if (!record) {
        sendJson(req, res, 503, { error: `内容尚未初始化：数据库中缺少 ${wantDraft ? "draft" : "published"} 文档，请先运行 npm run content:import` });
        return true;
      }
      sendJson(req, res, 200, record.doc);
      return true;
    }
    if (req.method === "PUT" || req.method === "POST") {
      if (!canWrite(req)) {
        sendJson(req, res, 403, { error: "没有写入权限（需要 x-admin-token）" });
        return true;
      }
      try {
        const input = await jsonBody(req, 32 * 1024 * 1024);
        const validated = validateContentBundle(input, baseProjects);
        await putDocument(pool, "draft", validated);
        sendJson(req, res, 200, { ok: true, updatedAt: new Date().toISOString() });
      } catch (error) {
        sendJson(req, res, 400, { error: `内容校验失败：${error.message}` });
      }
      return true;
    }
    res.writeHead(405, { allow: "GET, PUT" });
    res.end();
    return true;
  }

  if (pathname === "/api/publish" && req.method === "POST") {
    if (!canWrite(req)) {
      sendJson(req, res, 403, { error: "没有发布权限（需要 x-admin-token）" });
      return true;
    }
    await publishDocument(pool);
    sendJson(req, res, 200, { ok: true, publishedAt: new Date().toISOString() });
    return true;
  }

  if (pathname === "/api/assets") {
    if (req.method === "GET") {
      if (!canWrite(req) && IS_PRODUCTION) {
        sendJson(req, res, 403, { error: "需要编辑权限" });
        return true;
      }
      const assets = await listAssets(pool);
      sendJson(req, res, 200, assets.map((asset) => ({ ...asset, url: `/api/assets/${asset.id}` })));
      return true;
    }
    if (req.method === "POST") {
      if (!canWrite(req)) {
        sendJson(req, res, 403, { error: "没有上传权限（需要 x-admin-token）" });
        return true;
      }
      try {
        const data = await readBody(req, 256 * 1024 * 1024);
        const kind = String(req.headers["x-asset-kind"] ?? req.headers["x-asset-type"] ?? "image");
        const originalName = decodeURIComponent(String(req.headers["x-file-name"] ?? "asset"));
        const path = decodeURIComponent(String(req.headers["x-asset-path"] ?? `assets/${kind}s/${Date.now()}-${originalName}`));
        const id = String(req.headers["x-asset-id"] ?? `asset-${sha256(data).slice(0, 12)}`);
        const mimeType = mimeTypeForPath(originalName);
        await upsertAsset(pool, {
          id, kind, path, mimeType, fileName: originalName, originalName, data, sha256: sha256(data),
          label: originalName.replace(/\.[^.]+$/, ""),
        });
        sendJson(req, res, 201, { id, type: kind, kind, path, fileName: originalName, originalName, mimeType, label: originalName.replace(/\.[^.]+$/, ""), byteSize: data.byteLength, url: `/api/assets/${id}` });
      } catch (error) {
        sendJson(req, res, error.statusCode === 413 ? 413 : 400, { error: error.message });
      }
      return true;
    }
    res.writeHead(405, { allow: "GET, POST" });
    res.end();
    return true;
  }

  if (pathname.startsWith("/api/assets/")) {
    const id = decodeURIComponent(pathname.slice("/api/assets/".length));
    if (req.method === "DELETE") {
      if (!canWrite(req)) {
        sendJson(req, res, 403, { error: "没有删除权限（需要 x-admin-token）" });
        return true;
      }
      if (id.startsWith("static/")) {
        sendJson(req, res, 400, { error: "内置静态素材不可删除" });
        return true;
      }
      const deleted = await deleteAsset(pool, id);
      if (!deleted) {
        sendJson(req, res, 404, { error: `asset not found: ${id}` });
        return true;
      }
      sendJson(req, res, 200, { ok: true, id });
      return true;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD, DELETE" });
      res.end();
      return true;
    }
    const asset = await getAssetById(pool, id);
    if (!asset) {
      sendJson(req, res, 404, { error: `asset not found: ${id}` });
      return true;
    }
    sendBuffer(req, res, { data: asset.data, mimeType: asset.mime_type, etag: asset.sha256, fileName: asset.file_name });
    return true;
  }

  return false;
}

/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
async function handleRequest(req, res, pool) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url, pool);
      if (!handled) sendJson(req, res, 404, { error: `unknown api: ${pathname}` });
      return;
    }

    // 演示小程序：/demos/<app>/... 直接映射到数据库里的 demo/* 资产，保证相对路径引用可用。
    if (pathname.startsWith("/demos/")) {
      let relativePath = decodeURIComponent(pathname.slice("/demos/".length));
      if (relativePath.endsWith("/")) relativePath += "index.html";
      if (!relativePath) relativePath = "index.html";
      const asset = await getAssetByPath(pool, `demo/${relativePath}`);
      if (!asset) {
        sendJson(req, res, 404, { error: `demo asset not found: ${relativePath}` });
        return;
      }
      sendBuffer(req, res, { data: asset.data, mimeType: asset.mime_type, etag: asset.sha256, fileName: asset.file_name, maxAge: 3600 });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET" });
      res.end();
      return;
    }

    if (!existsSync(distDir)) {
      sendJson(req, res, 503, { error: "前端产物不存在：请先运行 npm run build" });
      return;
    }

    const candidate = safeResolve(distDir, pathname === "/" ? "index.html" : pathname);
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      const isHashed = /-[\w-]{8,}\.(js|css|woff2?|png|jpe?g|webp|svg)$/.test(pathname);
      sendStaticFile(req, res, candidate, { maxAge: isHashed ? 31_536_000 : 0, immutable: isHashed });
      return;
    }
    // SPA 回退：非静态资源的路径统一返回 index.html
    sendStaticFile(req, res, join(distDir, "index.html"), { maxAge: 0 });
  } catch (error) {
    const status = error.statusCode ?? 500;
    if (status >= 500) log("request failed:", req.method, pathname, error);
    sendJson(req, res, status, { error: error.message });
  }
}

export function createApp(pool) {
  return createServer((req, res) => { void handleRequest(req, res, pool); });
}

export async function startServer() {
  if (!DATABASE_URL) throw new Error("缺少 DATABASE_URL 环境变量");
  const pool = createPool(DATABASE_URL);
  await ensureSchema(pool);
  const server = createApp(pool);
  await new Promise((resolvePromise) => server.listen(PORT, HOST, resolvePromise));
  log(`listening on http://${HOST}:${PORT} (${NODE_ENV})`);
  const shutdown = async (signal) => {
    log(`received ${signal}, shutting down`);
    server.close();
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  return { server, pool };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await startServer();
}
