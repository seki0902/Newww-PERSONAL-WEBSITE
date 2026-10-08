/**
 * Cloudflare Pages Function：把原 Node 服务端的 /api/* 完整搬到 Workers 运行时。
 * 数据全部放 R2（内容 JSON + 素材二进制），公开站点不再依赖 ECS / PostgreSQL。
 *
 * 路由：
 *   GET  /api/health
 *   GET  /api/content[?draft=1]          读取内容 bundle
 *   PUT  /api/content                    （需 x-admin-token）保存 draft
 *   POST /api/publish                    （需 x-admin-token）draft -> published
 *   GET  /api/assets                     （需 x-admin-token）素材索引
 *   POST /api/assets                     （需 x-admin-token）上传素材
 *   GET/HEAD /api/assets/<id...>         读取素材（Range / ETag / 强缓存）
 */
interface Env {
  BUCKET: R2Bucket;
  ADMIN_TOKEN?: string;
  APP_REVISION?: string;
}

interface AssetMeta {
  id: string;
  kind?: string;
  path?: string;
  mimeType?: string;
  fileName?: string;
  originalName?: string;
  byteSize?: number;
  label?: string;
  sha256?: string;
  url?: string;
}

const CONTENT_KEY = (id: "draft" | "published") => `content/${id}.json`;
const ASSET_INDEX_KEY = "content/assets.json";
const MEDIA_KEY = (id: string) => `media/${id}`;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const canWrite = (request: Request, env: Env) =>
  Boolean(env.ADMIN_TOKEN) && request.headers.get("x-admin-token") === env.ADMIN_TOKEN;

function parseRange(header: string | null, size: number): { offset: number; length: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  let start = rawStart === "" ? size - Number(rawEnd) : Number(rawStart);
  let end = rawEnd === "" || rawStart === "" ? size - 1 : Number(rawEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end || start >= size) return null;
  return { offset: start, length: end - start + 1 };
}

async function readAssetIndex(env: Env): Promise<AssetMeta[]> {
  const object = await env.BUCKET.get(ASSET_INDEX_KEY);
  if (!object) return [];
  try {
    const parsed = JSON.parse(await object.text()) as unknown;
    return Array.isArray(parsed) ? (parsed as AssetMeta[]) : [];
  } catch {
    return [];
  }
}

async function serveObject(request: Request, env: Env, key: string, meta?: { mimeType?: string; fileName?: string }) {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return json({ error: "method not allowed" }, 405, { allow: "GET, HEAD" });

  const head = await env.BUCKET.head(key);
  if (!head) return json({ error: `asset not found: ${key}` }, 404);

  const etag = head.httpEtag ?? `"${head.etag}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, "cache-control": "public, max-age=31536000, immutable" } });
  }

  const range = parseRange(request.headers.get("range"), head.size);
  const object = await env.BUCKET.get(key, range ? { range } : undefined);
  if (!object) return json({ error: `asset not found: ${key}` }, 404);

  const headers = new Headers({
    "content-type": meta?.mimeType ?? object.httpMetadata?.contentType ?? "application/octet-stream",
    etag,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  });
  if (meta?.fileName) headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`);

  if (range && object.range) {
    const offset = (object.range as { offset?: number }).offset ?? range.offset;
    const length = (object.range as { length?: number }).length ?? range.length;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${head.size}`);
    headers.set("content-length", String(length));
    return new Response(method === "HEAD" ? null : object.body, { status: 206, headers });
  }
  headers.set("content-length", String(head.size));
  return new Response(method === "HEAD" ? null : object.body, { status: 200, headers });
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const url = new URL(request.url);
  const segments = Array.isArray(params.path) ? params.path : [params.path ?? ""];
  const rest = segments.filter(Boolean).join("/");
  const method = request.method.toUpperCase();
  const index = await readAssetIndex(env);

  if (rest === "health") {
    const published = await env.BUCKET.head(CONTENT_KEY("published"));
    return json({
      ok: true,
      storage: "r2",
      revision: env.APP_REVISION ?? "dev",
      content: { publishedUpdatedAt: published?.uploaded?.toISOString() ?? null },
      assets: { count: index.length, bytes: index.reduce((sum, asset) => sum + (asset.byteSize ?? 0), 0) },
    });
  }

  if (rest === "content") {
    if (method === "GET" || method === "HEAD") {
      const wantDraft = url.searchParams.get("draft") === "1";
      if (wantDraft && !canWrite(request, env)) return json({ error: "draft content 需要编辑权限" }, 403);
      const object = await env.BUCKET.get(CONTENT_KEY(wantDraft ? "draft" : "published"));
      if (!object) return json({ error: `内容尚未初始化：R2 缺少 content/${wantDraft ? "draft" : "published"}.json` }, 503);
      return new Response(object.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }
    if (method === "PUT" || method === "POST") {
      if (!canWrite(request, env)) return json({ error: "没有写入权限（需要 x-admin-token）" }, 403);
      const body = await request.text();
      try { JSON.parse(body); } catch { return json({ error: "内容不是合法 JSON" }, 400); }
      await env.BUCKET.put(CONTENT_KEY("draft"), body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      return json({ ok: true, updatedAt: new Date().toISOString() });
    }
    return json({ error: "method not allowed" }, 405, { allow: "GET, PUT" });
  }

  if (rest === "publish" && method === "POST") {
    if (!canWrite(request, env)) return json({ error: "没有发布权限（需要 x-admin-token）" }, 403);
    const draft = await env.BUCKET.get(CONTENT_KEY("draft"));
    if (!draft) return json({ error: "draft 不存在，无法发布" }, 409);
    await env.BUCKET.put(CONTENT_KEY("published"), draft.body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    await draft.body?.cancel?.();
    return json({ ok: true, publishedAt: new Date().toISOString() });
  }

  if (rest === "assets") {
    if (method === "GET") {
      if (!canWrite(request, env)) return json({ error: "需要编辑权限" }, 403);
      return json(index);
    }
    if (method === "POST") {
      if (!canWrite(request, env)) return json({ error: "没有上传权限（需要 x-admin-token）" }, 403);
      const kind = request.headers.get("x-asset-kind") ?? request.headers.get("x-asset-type") ?? "image";
      const originalName = decodeURIComponent(request.headers.get("x-file-name") ?? "asset");
      const id = request.headers.get("x-asset-id") ?? `asset-${crypto.randomUUID().slice(0, 12)}`;
      const path = decodeURIComponent(request.headers.get("x-asset-path") ?? `assets/${kind}s/${Date.now()}-${originalName}`);
      const buffer = await request.arrayBuffer();
      const contentType = request.headers.get("content-type") ?? "application/octet-stream";
      await env.BUCKET.put(MEDIA_KEY(id), buffer, { httpMetadata: { contentType } });
      const entry = {
        id, kind, path, mimeType: contentType, fileName: originalName, originalName,
        byteSize: buffer.byteLength, label: originalName.replace(/\.[^.]+$/, ""), url: `/api/assets/${id}`,
      };
      await env.BUCKET.put(ASSET_INDEX_KEY, JSON.stringify([...index.filter((asset) => asset.id !== id), entry], null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });
      return json(entry, 201);
    }
    return json({ error: "method not allowed" }, 405, { allow: "GET, POST" });
  }

  if (rest.startsWith("assets/")) {
    const id = decodeURIComponent(rest.slice("assets/".length));
    const meta = index.find((asset) => asset.id === id);
    return serveObject(request, env, MEDIA_KEY(id), { mimeType: meta?.mimeType, fileName: meta?.fileName });
  }

  return json({ error: `unknown api: /api/${rest}` }, 404);
};
