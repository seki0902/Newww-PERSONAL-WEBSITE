import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 素材与内容一律通过 /api 由服务端从 PostgreSQL 读取；
// 开发/预览模式下把 /api 与 /demos 代理到本地 node server（默认 127.0.0.1:8787）。
const apiProxy = {
  "/api": { target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787", changeOrigin: true },
  "/demos": { target: process.env.API_ORIGIN ?? "http://127.0.0.1:8787", changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
