import { expect, test, type Page } from "@playwright/test";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "e2e-token";

/** 走完视觉小说：逐句点击直到出现「开机热区」。 */
async function passVisualNovel(page: Page) {
  const reveal = page.locator(".novel-scene-reveal");
  const dialogue = page.locator(".dialogue-box");
  const hotspot = page.getByTestId("computer-hotspot");
  for (let step = 0; step < 40 && !(await hotspot.isVisible().catch(() => false)); step += 1) {
    if (await reveal.isVisible().catch(() => false)) await reveal.click({ force: true });
    else if (await dialogue.isVisible().catch(() => false)) await dialogue.click({ force: true });
    await page.waitForTimeout(80);
  }
  await expect(hotspot).toBeVisible();
  await hotspot.click();
}

/** 开机动画约 4.8s，结束后进入新人引导。 */
async function passStartup(page: Page) {
  await expect(page.getByTestId("onboarding-overlay")).toBeVisible({ timeout: 20_000 });
}

async function passOnboarding(page: Page) {
  const start = page.getByTestId("onboarding-start");
  for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
    await expect(start).toBeEnabled();
    // 按钮带无限引导动画（元素持续位移），Playwright 的稳定性等待会一直重试，这里用 force 点击。
    await start.click({ force: true });
  }
  await expect(page.getByTestId("welcome-overlay")).toBeVisible();
}

async function enterDesktop(page: Page) {
  await page.getByTestId("welcome-overlay").getByRole("button", { name: /内容桌面/ }).click();
  await expect(page.getByTestId("desktop-screen")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("完整通关流程：开场 → 开机 → 引导 → 桌面 → 抽牌 → 项目 → 结局", async ({ page }) => {
  await page.goto("/");

  // 1) 视觉小说开场
  await expect(page.locator(".visual-novel")).toBeVisible();
  await passVisualNovel(page);

  // 2) 开机动画 + 新人引导 + 欢迎页
  await passStartup(page);
  await passOnboarding(page);
  await enterDesktop(page);

  // 3) 桌面：项目图标可用，锁定图标不可点
  const projectIcon = page.getByTestId("project-1");
  await expect(projectIcon).toBeVisible();
  await expect(page.getByTestId("desktop-icon-fx-icon-locked")).toBeDisabled();
  await expect(page.getByTestId("desktop-progress")).toContainText("0%");

  // 4) 抽塔罗牌解锁项目（未解锁时打开的是牌桌）
  await projectIcon.click();
  const tarotBack = page.getByRole("button", { name: "牌背 1" });
  await expect(tarotBack).toBeVisible();
  const tarotArt = tarotBack.locator("img");
  await expect.poll(async () => tarotArt.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await tarotBack.click();
  await expect(page.getByTestId("tarot-quote")).toBeVisible();
  await page.getByRole("button", { name: "完成抽牌" }).click();

  // 5) 项目窗口：第一页正文与图片（图片来自数据库）
  await expect(page.getByRole("dialog", { name: "测试项目一" })).toBeVisible();
  await expect(page.getByText("这是 E2E 夹具项目正文。")).toBeVisible();
  await expect(page.getByRole("button", { name: "概览" })).toBeVisible();

  // 6) 翻页到第二页：验证图片区块与 iframe 演示小程序（两者都来自数据库素材）
  await page.getByRole("button", { name: "下一页 →" }).click();
  const blockImage = page.locator(".project-content-block[data-block-type='image'] img");
  await expect(blockImage).toBeVisible();
  await expect.poll(async () => blockImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const demoFrame = page.frameLocator("iframe.agent-demo-frame");
  await expect(demoFrame.getByTestId("demo-root")).toHaveText("content-agent demo");

  // 7) 完成项目（最后一页的翻页按钮由 finalAction 文案决定）
  await page.getByRole("button", { name: "完成项目" }).click();
  // 现状：桌面窗口模式下完成项目后停留在桌面，进度变为 100%（原有行为，未做改动）。
  await expect(page.getByTestId("desktop-progress")).toContainText("100%");
  await expect(page.getByRole("button", { name: "完成项目" })).toHaveCount(0);
  await page.getByTestId("desktop-progress").click();
  await expect(page.getByRole("dialog", { name: "探索进度" })).toContainText("1 / 1 个项目已完成");

  // 8) 刷新后进度仍然保留（localStorage 存档）
  await page.reload();
  await expect(page.getByTestId("desktop-progress")).toContainText("100%");

  // 9) 重置进度回到开场
  await page.getByRole("button", { name: "重置探索进度" }).click();
  await expect(page.locator(".visual-novel")).toBeVisible();
});

test("编辑器路由：带 token 可以读取 draft，未带 token 时写接口被拒绝", async ({ page, request }) => {
  await page.goto(`/?editor=1&token=${ADMIN_TOKEN}`);
  await expect(page.getByRole("heading", { name: "内容中间层" })).toBeVisible();
  await expect(page.getByTestId("editor-section-intro")).toBeVisible();
  await expect(page.getByText("Draft 已载入")).toBeVisible();

  const anonymous = await request.put("/api/content", { data: { version: 1 }, headers: { "content-type": "application/json" } });
  expect(anonymous.status()).toBe(403);
});
