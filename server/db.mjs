// PostgreSQL 访问层：内容文档（draft/published）+ 媒体资产（二进制存 bytea）。
// 生产环境复用 ECS 上已有的 postgres 容器，但使用独立数据库（见 README）。
import pg from "pg";

const { Pool } = pg;

/** @param {string} databaseUrl */
export function createPool(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX ?? 4),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "seki-portfolio",
  });
  pool.on("error", (error) => console.error("[db] idle client error:", error.message));
  return pool;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS content_documents (
  id text PRIMARY KEY CHECK (id IN ('draft', 'published')),
  doc jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id text PRIMARY KEY,
  kind text NOT NULL,
  path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  file_name text NOT NULL,
  original_name text NOT NULL,
  byte_size bigint NOT NULL,
  sha256 text NOT NULL,
  data bytea NOT NULL,
  presentation jsonb,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_kind_idx ON media_assets (kind);
`;

/** 建表（幂等）。 @param {import("pg").Pool} pool */
export async function ensureSchema(pool) {
  await pool.query(SCHEMA_SQL);
}

/** @param {import("pg").Pool} pool @param {string} id */
export async function getDocument(pool, id) {
  const { rows } = await pool.query("SELECT doc, updated_at FROM content_documents WHERE id = $1", [id]);
  return rows[0] ? { doc: rows[0].doc, updatedAt: rows[0].updated_at } : null;
}

/** @param {import("pg").Pool} pool @param {"draft"|"published"} id @param {unknown} doc */
export async function putDocument(pool, id, doc) {
  await pool.query(
    `INSERT INTO content_documents (id, doc, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
    [id, JSON.stringify(doc)],
  );
}

/** draft -> published 快照。 @param {import("pg").Pool} pool */
export async function publishDocument(pool) {
  const { rowCount } = await pool.query(
    `INSERT INTO content_documents (id, doc, updated_at)
     SELECT 'published', doc, now() FROM content_documents WHERE id = 'draft'
     ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
  );
  if (!rowCount) throw new Error("draft content document not found");
}

const ASSET_COLUMNS = "id, kind, path, mime_type, file_name, original_name, byte_size, sha256, presentation, label, updated_at";

/** @param {import("pg").Pool} pool */
export async function listAssets(pool) {
  const { rows } = await pool.query(`SELECT ${ASSET_COLUMNS} FROM media_assets ORDER BY path`);
  return rows.map((row) => ({ ...row, byteSize: Number(row.byte_size), byte_size: undefined }));
}

/** 返回二进制内容（包含 data）。 @param {import("pg").Pool} pool @param {string} id */
export async function getAssetById(pool, id) {
  const { rows } = await pool.query(
    `SELECT ${ASSET_COLUMNS}, data FROM media_assets WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** @param {import("pg").Pool} pool @param {string} path */
export async function getAssetByPath(pool, path) {
  const { rows } = await pool.query(
    `SELECT ${ASSET_COLUMNS}, data FROM media_assets WHERE path = $1`,
    [path],
  );
  return rows[0] ?? null;
}

/**
 * 写入/更新资产。以 id 为主键，同时保证 path 唯一。
 * @param {import("pg").Pool} pool
 * @param {{ id: string, kind: string, path: string, mimeType: string, fileName: string, originalName: string, data: Buffer, sha256: string, presentation?: unknown, label?: string }} asset
 */
export async function upsertAsset(pool, asset) {
  await pool.query(
    `INSERT INTO media_assets (id, kind, path, mime_type, file_name, original_name, byte_size, sha256, data, presentation, label, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, now())
     ON CONFLICT (id) DO UPDATE SET
       kind = EXCLUDED.kind, path = EXCLUDED.path, mime_type = EXCLUDED.mime_type,
       file_name = EXCLUDED.file_name, original_name = EXCLUDED.original_name,
       byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, data = EXCLUDED.data,
       presentation = EXCLUDED.presentation, label = EXCLUDED.label, updated_at = now()`,
    [
      asset.id, asset.kind, asset.path, asset.mimeType, asset.fileName, asset.originalName,
      asset.data.byteLength, asset.sha256, asset.data,
      asset.presentation === undefined ? null : JSON.stringify(asset.presentation),
      asset.label ?? null,
    ],
  );
}

/** 删除素材。 @param {import("pg").Pool} pool @param {string} id */
export async function deleteAsset(pool, id) {
  const { rowCount } = await pool.query("DELETE FROM media_assets WHERE id = $1", [id]);
  return rowCount > 0;
}

/** @param {import("pg").Pool} pool */
export async function assetStats(pool) {
  const { rows } = await pool.query("SELECT count(*)::int AS count, coalesce(sum(byte_size), 0)::bigint AS bytes FROM media_assets");
  return { count: rows[0].count, bytes: Number(rows[0].bytes) };
}
