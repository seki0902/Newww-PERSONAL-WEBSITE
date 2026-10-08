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

  // 3) 桌面：两个项目图标可用、锁定图标不可点、进度 0%
  await expect(page.getByTestId("project-1")).toBeVisible();
  await expect(page.getByTestId("project-2")).toBeVisible();
  await expect(page.getByTestId("desktop-icon-fx-icon-locked")).toBeDisabled();
  await expect(page.getByTestId("desktop-progress")).toContainText("0%");

  // 4) 第一个项目：抽牌解锁 → 阅读两页 → 完成，进度到 50% 且仍在桌面
  await page.getByTestId("project-1").click();
  const tarotBack = page.getByRole("button", { name: "牌背 1" });
  await expect(tarotBack).toBeVisible();
  const tarotArt = tarotBack.locator("img");
  await expect.poll(async () => tarotArt.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await tarotBack.click();
  await expect(page.getByTestId("tarot-quote")).toBeVisible();
  await page.getByRole("button", { name: "完成抽牌" }).click();

  await expect(page.getByRole("dialog", { name: "测试项目一" })).toBeVisible();
  await expect(page.getByText("这是 E2E 夹具项目正文。")).toBeVisible();
  await page.getByRole("button", { name: "下一页 →" }).click();
  const blockImage = page.locator(".project-content-block[data-block-type='image'] img");
  await expect(blockImage).toBeVisible();
  await expect.poll(async () => blockImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.frameLocator("iframe.agent-demo-frame").getByTestId("demo-root")).toHaveText("content-agent demo");
  await page.getByRole("button", { name: "完成项目" }).click();

  await expect(page.getByTestId("desktop-progress")).toContainText("50%");
  await page.getByTestId("desktop-progress").click();
  await expect(page.getByRole("dialog", { name: "探索进度" })).toContainText("1 / 2 个项目已完成");
  await page.keyboard.press("Escape");
  // 读完一个项目后会自动回到所属文件夹窗口，需要先关掉它才能点到桌面图标
  await page.getByRole("button", { name: "关闭 测试项目 文件夹" }).click();

  // 5) 第二个项目：抽牌 → 阅读 → 完成 → 进入结局页
  await page.getByTestId("project-2").click();
  await page.getByRole("button", { name: "牌背 2" }).click();
  await page.getByRole("button", { name: "完成抽牌" }).click();
  await expect(page.getByRole("dialog", { name: "测试项目二" })).toBeVisible();
  await expect(page.getByText("这是第二个项目的正文。")).toBeVisible();
  await page.getByRole("button", { name: "完成项目" }).click();

  await expect(page.getByText("核心项目体验已完成")).toBeVisible();
  await expect(page.getByTestId("ending-bgm")).toHaveCount(1);

  // 6) 刷新后仍在结局（localStorage 存档）
  await page.reload();
  await expect(page.getByText("核心项目体验已完成")).toBeVisible();

  // 7) 重新开始回到开场
  await page.getByRole("button", { name: "重新开始" }).click();
  await expect(page.locator(".visual-novel")).toBeVisible();
});

test("编辑器路由：带 token 可以读取 draft，未带 token 时写接口被拒绝", async ({ page, request }) => {
  await page.goto(`/?editor=1&token=${ADMIN_TOKEN}`);
  await expect(page.getByRole("heading", { name: "内容中间层" })).toBeVisible();
  await expect(page.getByTestId("editor-section-intro")).toBeVisible();
  await expect(page.getByText("Draft 已载入")).toBeVisible();

  await page.getByTestId("editor-section-assets").click();
  // 面板标题与区块标题都叫“素材库”，用区块容器定位，避免 strict mode 冲突。
  await expect(page.locator(".asset-library")).toBeVisible();
  await expect(page.getByPlaceholder("搜索名称 / 文件名 / ID")).toBeVisible();
  await page.locator(".asset-card").first().getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /编辑素材/ })).toBeVisible();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await expect(page.getByRole("dialog", { name: /编辑素材/ })).toHaveCount(0);

  const anonymous = await request.put("/api/content", { data: { version: 1 }, headers: { "content-type": "application/json" } });
  expect(anonymous.status()).toBe(403);
});
