import { describe, expect, it } from "vitest";
import { assetUrl, createAssetResolver, isLegacyAssetPath, mediaUrl, staticAsset } from "../../src/lib/media";

const bundle = { assets: [{ id: "asset-bgm-desktop" }, { id: "asset-bg-office" }] };

describe("staticAsset", () => {
  it("把历史 public/assets 路径转换为数据库素材地址", () => {
    expect(staticAsset("fonts/kami-seki-regular.woff2")).toBe("/api/assets/static/fonts/kami-seki-regular.woff2");
    expect(staticAsset("/assets/fonts/kami-seki-regular.woff2")).toBe("/api/assets/static/fonts/kami-seki-regular.woff2");
    expect(staticAsset("assets/tarot/back-1.png")).toBe("/api/assets/static/tarot/back-1.png");
  });
});

describe("mediaUrl", () => {
  it("bundle id、历史路径、外链分别处理", () => {
    expect(mediaUrl("asset-bg-office")).toBe("/api/assets/asset-bg-office");
    expect(mediaUrl("/assets/tarot/a1.webp")).toBe("/api/assets/static/tarot/a1.webp");
    expect(mediaUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(mediaUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(mediaUrl(undefined)).toBeUndefined();
  });

  it("保留站内绝对路径", () => {
    expect(mediaUrl("/demos/content-agent/index.html")).toBe("/demos/content-agent/index.html");
  });
});

describe("isLegacyAssetPath", () => {
  it("识别带/不带前导斜杠的 assets 路径", () => {
    expect(isLegacyAssetPath("/assets/x.png")).toBe(true);
    expect(isLegacyAssetPath("assets/x.png")).toBe(true);
    expect(isLegacyAssetPath("asset-x")).toBe(false);
  });
});

describe("createAssetResolver / assetUrl", () => {
  it("只解析 bundle 中存在的 id，未知 id 交给调用方兜底", () => {
    const resolve = createAssetResolver(bundle);
    expect(resolve("asset-bg-office")).toBe("/api/assets/asset-bg-office");
    expect(resolve("missing-id")).toBeUndefined();
    expect(resolve("/assets/onboarding/canva-welcome-character.png")).toBe("/api/assets/static/onboarding/canva-welcome-character.png");
    expect(resolve(undefined)).toBeUndefined();
  });

  it("兼容旧的 assetUrl(bundle, id, preview) 调用", () => {
    expect(assetUrl(bundle, "asset-bgm-desktop")).toBe("/api/assets/asset-bgm-desktop");
    expect(assetUrl(bundle, "nope")).toBeUndefined();
  });
});
