import { expect, test } from "@playwright/test";

test.describe("素材全部来自数据库", () => {
  test("素材通过 /api/assets 提供：类型、缓存与 304", async ({ request }) => {
    const font = await request.get("/api/assets/static/fonts/kami-seki-regular.woff2");
    expect(font.status()).toBe(200);
    expect(font.headers()["content-type"]).toBe("font/woff2");
    expect(font.headers()["cache-control"]).toContain("immutable");
    const etag = font.headers()["etag"];
    expect(etag).toBeTruthy();

    const cached = await request.get("/api/assets/static/fonts/kami-seki-regular.woff2", { headers: { "if-none-match": etag } });
    expect(cached.status()).toBe(304);
  });

  test("音频支持 Range 请求（206）", async ({ request }) => {
    const response = await request.get("/api/assets/fx-bgm", { headers: { range: "bytes=0-15" } });
    expect(response.status()).toBe(206);
    expect((await response.body()).byteLength).toBe(16);
  });

  test("demo 小程序在 /demos 路径下可用（含相对资源）", async ({ request }) => {
    const html = await request.get("/demos/content-agent/index.html");
    expect(html.status()).toBe(200);
    expect(html.headers()["content-type"]).toContain("text/html");
    expect(await html.text()).toContain("content-agent demo");
    const css = await request.get("/demos/content-agent/style.css");
    expect(css.status()).toBe(200);
    expect(css.headers()["content-type"]).toContain("text/css");
  });

  test("未知素材返回 404", async ({ request }) => {
    expect((await request.get("/api/assets/does-not-exist")).status()).toBe(404);
  });

  test("素材上传后可以删除：DELETE /api/assets/<id>", async ({ request }) => {
    const adminHeaders = { "x-admin-token": process.env.ADMIN_TOKEN ?? "e2e-token" };
    const created = await request.post("/api/assets", {
      headers: {
        ...adminHeaders,
        "content-type": "image/png",
        "x-file-name": encodeURIComponent("e2e-delete.png"),
        "x-asset-type": "image",
        "x-asset-id": "asset-e2e-delete",
      },
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    expect(created.status()).toBe(201);

    const deleted = await request.delete("/api/assets/asset-e2e-delete", { headers: adminHeaders });
    expect(deleted.status()).toBe(200);
    expect((await request.get("/api/assets/asset-e2e-delete")).status()).toBe(404);
  });

  test("健康检查报告数据库中的素材数量", async ({ request }) => {
    const health = await (await request.get("/api/health")).json();
    expect(health.ok).toBe(true);
    expect(health.db).toBe("up");
    expect(health.assets.count).toBeGreaterThan(10);
    expect(health.assets.bytes).toBeGreaterThan(0);
  });

  test("前端页面不再请求 /assets 与 /content/current 静态路径", async ({ page }) => {
    const legacyRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const mediaFile = /\.(png|jpe?g|webp|gif|svg|woff2?|wav|mp3|ogg|mp4)$/i.test(url.pathname);
      if ((url.pathname.startsWith("/assets/") && mediaFile) || url.pathname.startsWith("/content/current")) legacyRequests.push(url.pathname);
    });
    await page.goto("/");
    await expect(page.locator(".visual-novel")).toBeVisible();
    await page.waitForTimeout(500);
    expect(legacyRequests).toEqual([]);
  });
});
