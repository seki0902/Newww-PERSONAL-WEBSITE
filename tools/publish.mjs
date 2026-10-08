#!/usr/bin/env node
// 把数据库中的 draft 内容发布为 published 快照（等价于 POST /api/publish）。
import { createPool, publishDocument } from "../server/db.mjs";

const args = process.argv.slice(2);
const index = args.indexOf("--database-url");
const databaseUrl = index >= 0 ? args[index + 1] : process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  console.error("缺少 DATABASE_URL（或传 --database-url）");
  process.exit(1);
}
const pool = createPool(databaseUrl);
try {
  await publishDocument(pool);
  console.log("已发布：draft → published");
} finally {
  await pool.end();
}
