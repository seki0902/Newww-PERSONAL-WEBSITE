#!/usr/bin/env node
// 素材导入工具：把本地媒体目录（素材不随源码入库）写入 PostgreSQL。
//
// 目录约定：
//   <source>/content.json   内容 bundle（含 assets[].id / assets[].path）
//   <source>/assets/**      bundle 引用的素材，路径与 assets[].path 一致
//   <source>/static/**      代码内固定引用的素材（字体/塔罗牌/引导图等），id = "static/<相对路径>"
//   <source>/demos/**       agent 演示小程序，id = "demo/<相对路径>"，运行时通过 /demos/** 访问
//
// 用法：DATABASE_URL=... node tools/import-media.mjs --source ../seki-media [--publish] [--prune]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, ensureSchema, putDocument, upsertAsset, publishDocument } from "../server/db.mjs";
import { mimeTypeForPath, sha256 } from "../server/lib/http.mjs";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const listFiles = (dir) => {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  if (statSync(dir, { throwIfNoEntry: false })?.isDirectory()) walk(dir);
  return out;
};

const kindFor = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("font/") || mimeType.includes("woff")) return "font";
  return "file";
};

/**
 * @param {{ sourceDir: string, databaseUrl: string, pool?: import("pg").Pool, publish?: boolean, prune?: boolean, log?: (...args: unknown[]) => void }} options
 */
export async function importMedia({ sourceDir, databaseUrl, pool: providedPool, publish = false, prune = false, log = console.log }) {
  const { validateContentBundle } = await import(new URL("../src/schema/content-contract.mjs", import.meta.url).href);
  const baseProjects = JSON.parse(readFileSync(join(projectRoot, "content", "projects.json"), "utf8"));
  const bundlePath = join(sourceDir, "content.json");
  const bundle = validateContentBundle(JSON.parse(readFileSync(bundlePath, "utf8")), baseProjects);

  const pool = providedPool ?? createPool(databaseUrl);
  const imported = [];
  const warnings = [];
  try {
    await ensureSchema(pool);

    // 1) bundle 素材：保留原 id，便于内容里的引用无需改写。
    for (const asset of bundle.assets) {
      const filePath = join(sourceDir, asset.path);
      if (!statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
        warnings.push(`缺少素材文件：${asset.path}（引用 id=${asset.id}）`);
        continue;
      }
      const data = readFileSync(filePath);
      await upsertAsset(pool, {
        id: asset.id,
        kind: asset.type,
        path: asset.path,
        mimeType: asset.mimeType || mimeTypeForPath(asset.path),
        fileName: asset.fileName,
        originalName: asset.originalName,
        data,
        sha256: sha256(data),
        presentation: asset.presentation,
        label: asset.label,
      });
      imported.push(asset.id);
    }

    // 2) 代码内固定引用的静态素材（id 前缀 static/）+ 3) demo 小程序（id 前缀 demo/）。
    for (const [prefix, folder] of [["static", "static"], ["demo", "demos"]]) {
      for (const file of listFiles(join(sourceDir, folder))) {
        const relativePath = relative(join(sourceDir, folder), file).split(sep).join("/");
        const id = `${prefix}/${relativePath}`;
        const data = readFileSync(file);
        const mimeType = mimeTypeForPath(file);
        await upsertAsset(pool, {
          id,
          kind: kindFor(mimeType),
          path: id,
          mimeType,
          fileName: relativePath.split("/").pop() ?? relativePath,
          originalName: relativePath.split("/").pop() ?? relativePath,
          data,
          sha256: sha256(data),
          label: relativePath,
        });
        imported.push(id);
      }
    }

    await putDocument(pool, "draft", bundle);
    if (publish) await publishDocument(pool);

    if (prune) {
      await pool.query("DELETE FROM media_assets WHERE id <> ALL($1::text[])", [imported]);
    }

    const bytes = await pool.query("SELECT coalesce(sum(byte_size),0)::bigint AS bytes, count(*)::int AS count FROM media_assets");
    log(`导入完成：${imported.length} 个素材，数据库现有 ${bytes.rows[0].count} 个 / ${(Number(bytes.rows[0].bytes) / 1048576).toFixed(1)} MB`);
    if (publish) log("已把 draft 发布为 published");
    for (const warning of warnings) log("⚠️ ", warning);
    return { imported, warnings, published: publish };
  } finally {
    if (!providedPool) await pool.end();
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback;
  };
  const sourceDir = value("--source", process.env.MEDIA_SOURCE_DIR ?? join(projectRoot, "..", "seki-media"));
  const databaseUrl = value("--database-url", process.env.DATABASE_URL ?? "");
  if (!databaseUrl) {
    console.error("缺少 DATABASE_URL（或传 --database-url）");
    process.exit(1);
  }
  await importMedia({
    sourceDir,
    databaseUrl,
    publish: args.includes("--publish"),
    prune: args.includes("--prune"),
  });
}
