// 轻量 HTTP 工具：JSON、二进制（支持 Range/ETag/304）、静态文件、请求体读取。
import { createReadStream, statSync } from "node:fs";
import { extname, normalize, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Readable } from "node:stream";

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

export const mimeTypeForPath = (path) => MIME_BY_EXT[extname(path).toLowerCase()] ?? "application/octet-stream";

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** 安全路径拼接：拒绝 ../ 与绝对路径逃逸。 */
export function safeResolve(baseDir, relativePath) {
  const base = resolve(baseDir);
  const target = resolve(base, normalize(relativePath).replace(/^([/\\])+/, ""));
  if (target !== base && !target.startsWith(base + sep)) throw new Error(`path escapes base directory: ${relativePath}`);
  return target;
}

const acceptsGzip = (req) => /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));

/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
export function sendJson(req, res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  let finalBody = body;
  if (req && acceptsGzip(req) && body.byteLength > 1024) {
    finalBody = gzipSync(body);
    headers["content-encoding"] = "gzip";
  }
  headers["content-length"] = String(finalBody.byteLength);
  res.writeHead(status, headers);
  res.end(finalBody);
}

const baseHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

/**
 * 输出二进制内容，支持 ETag(304) 与 Range(206)。
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {{ data: Buffer, mimeType: string, etag?: string, maxAge?: number, fileName?: string, download?: boolean, inline?: boolean }} options
 */
export function sendBuffer(req, res, options) {
  const { data, mimeType } = options;
  const etag = `"${options.etag ?? sha256(data).slice(0, 32)}"`;
  const headers = {
    ...baseHeaders,
    "content-type": mimeType,
    etag,
    "accept-ranges": "bytes",
    "cache-control": `public, max-age=${options.maxAge ?? 31_536_000}, immutable`,
  };
  if (options.fileName) {
    headers["content-disposition"] = `${options.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(options.fileName)}`;
  }
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { etag, "cache-control": headers["cache-control"] });
    res.end();
    return;
  }
  const range = parseRange(req.headers.range, data.byteLength);
  if (range) {
    const chunk = data.subarray(range.start, range.end + 1);
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${range.start}-${range.end}/${data.byteLength}`,
      "content-length": String(chunk.byteLength),
    });
    res.end(chunk);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": String(data.byteLength) });
  res.end(data);
}

/** @returns {{ start: number, end: number } | null} */
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  let start = rawStart === "" ? size - Number(rawEnd) : Number(rawStart);
  let end = rawEnd === "" || rawStart === "" ? size - 1 : Number(rawEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end || start >= size) return null;
  return { start, end };
}

/** 静态文件（dist/）：带弱缓存 + 404 交由调用方处理。 */
export function sendStaticFile(req, res, filePath, { maxAge = 0, immutable = false } = {}) {
  const stat = statSync(filePath);
  const headers = {
    ...baseHeaders,
    "content-type": mimeTypeForPath(filePath),
    "content-length": String(stat.size),
    "cache-control": immutable ? `public, max-age=${maxAge}, immutable` : "no-cache",
    "last-modified": stat.mtime.toUTCString(),
  };
  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

/** @param {import("node:http").IncomingMessage} req @param {number} limit */
export async function readBody(req, limit = 64 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.byteLength;
    if (total > limit) throw Object.assign(new Error(`payload too large (> ${limit} bytes)`), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

export { Readable };
