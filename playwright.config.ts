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
    command: "node tests/support/e2e-server.mjs",
    url: `http://127.0.0.1:${process.env.E2E_PORT ?? "8790"}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      E2E_PORT: process.env.E2E_PORT ?? "8790",
      NODE_ENV: "production",
    },
  },
});
