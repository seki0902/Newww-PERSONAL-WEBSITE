import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${process.env.E2E_PORT ?? "8790"}`,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // 夹具写入本地 KV 后起 wrangler pages dev：本地 E2E 跑的就是生产那套 Workers 代码。
    command: "node tests/support/e2e-worker.mjs",
    url: `http://127.0.0.1:${process.env.E2E_PORT ?? "8790"}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      E2E_PORT: process.env.E2E_PORT ?? "8790",
      ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? "e2e-token",
    },
  },
});
