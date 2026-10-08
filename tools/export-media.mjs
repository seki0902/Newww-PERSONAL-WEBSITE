#!/usr/bin/env node
// 反向导出：把数据库中的内容与素材导出为目录（备份 / 迁移 / 本地排障）。
// 用法：DATABASE_URL=... node tools/export-media.mjs --out ./seki-media-backup
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createPool, getDocument } from "../server/db.mjs";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const outDir = value("--out", "./seki-media-backup");
const databaseUrl = value("--database-url", process.env.DATABASE_URL ?? "");
if (!databaseUrl) {
  console.error("缺少 DATABASE_URL（或传 --database-url）");
  process.exit(1);
}

const pool = createPool(databaseUrl);
try {
  const published = await getDocument(pool, "published");
  const draft = await getDocument(pool, "draft");
  if (!draft) throw new Error("数据库里没有 draft 文档");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "content.json"), `${JSON.stringify(draft.doc, null, 2)}\n`);
  if (published) writeFileSync(join(outDir, "content.published.json"), `${JSON.stringify(published.doc, null, 2)}\n`);

  const { rows } = await pool.query("SELECT id, kind, path, mime_type, data FROM media_assets ORDER BY id");
  let bytes = 0;
  for (const row of rows) {
    // bundle 素材按 path 落盘；static/ 与 demo/ 前缀还原到目录结构。
    const relativePath = row.path.startsWith("static/") || row.path.startsWith("demo/")
      ? row.path.replace(/^demo\//, "demos/")
      : row.path;
    const target = join(outDir, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, row.data);
    bytes += row.data.byteLength;
  }
  console.log(`导出完成：${rows.length} 个素材 / ${(bytes / 1048576).toFixed(1)} MB → ${outDir}`);
} finally {
  await pool.end();
}
