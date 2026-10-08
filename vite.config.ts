import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 素材与内容一律通过 /api 由 Workers KV 提供（生产 = Cloudflare Pages Functions）；
// 开发/预览模式下把 /api 与 /demos 代理到本地 wrangler pages dev（默认 127.0.0.1:8788）。
const apiProxy = {
  "/api": { target: process.env.API_ORIGIN ?? "http://127.0.0.1:8788", changeOrigin: true },
  "/demos": { target: process.env.API_ORIGIN ?? "http://127.0.0.1:8788", changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
