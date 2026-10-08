// E2E 夹具：运行时生成极小的媒体文件（PNG/WAV/HTML），保证仓库里不出现任何素材文件。
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 生成一张纯色 PNG（运行时构造，避免在源码里放素材）。 */
export function makePng(width = 2, height = 2, rgb = [90, 140, 190]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit truecolor
  const raw = Buffer.concat(Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), ...Array.from({ length: width }, () => Buffer.from(rgb))])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 生成静音 WAV（44 字节头 + 采样数据）。 */
export function makeWav(seconds = 0.2, sampleRate = 8000) {
  const samples = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// 代码里固定引用的静态素材路径（对应 public/assets 下的历史文件）。
export const STATIC_ASSET_SPECS = [
  "fonts/kami-seki-regular.woff2", "fonts/kami-seki-medium.woff2",
  "fonts/kami-education-regular.woff2", "fonts/kami-education-medium.woff2",
  "onboarding/canva-onboarding-01.png", "onboarding/canva-onboarding-02.png", "onboarding/canva-sleeping-cat.png",
  "onboarding/canva-welcome-character.png", "onboarding/canva-welcome-dialogue.png", "onboarding/canva-welcome-nameplate.png",
  "onboarding/canva-welcome-choice-content.png", "onboarding/canva-welcome-choice-education.png",
  "onboarding/canva-welcome-choice-sales.png", "onboarding/canva-welcome-cursor.png",
  "canva-original/MAHV_kZZuSY.png", "canva-original/MAHV_mLKkCQ.png", "canva-original/MAHV_mFriGQ.png",
  "canva-original/MAHV_lPoNak.png", "canva-original/MAHV_iDthYI.png", "canva-original/MAHV_pm1j1g.png",
  "canva-original/MAHV_saoD2c.png", "canva-original/MAHV_pfICPo.png", "canva-original/MAHV_jjXGNM.png",
  "tarot/back-1.png", "tarot/back-2.png", "tarot/back-3.png",
  "tarot/a1.webp", "tarot/a2.webp", "tarot/a3.webp", "tarot/a4.webp",
  "tarot/a5.webp", "tarot/a6.webp", "tarot/a7.webp", "tarot/a8.webp",
  "project-placeholder.svg",
];

const DEMO_HTML = (app) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${app}</title><link rel="stylesheet" href="style.css"></head>
<body><h1 data-testid="demo-root">${app} demo</h1><script src="app.js"></script></body></html>`;

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const realProjectIds = JSON.parse(readFileSync(join(projectRoot, "content", "projects.json"), "utf8")).map((project) => project.id);

/** 只保留 project-1 启用，其余项目在夹具里全部关闭，保证 E2E 能走到「全部完成」结局。 */
const disabledProjectConfigs = realProjectIds
  .filter((id) => id !== "project-1")
  .map((projectId) => ({ projectId, enabled: false, pages: [] }));

/** 生成夹具内容 bundle（文本 + 生成的媒体）。 */
export function fixtureBundle() {
  const asset = (id, type, ext, mimeType, extra = {}) => ({
    id, type, fileName: `${id}.${ext}`, originalName: `${id}.${ext}`,
    path: `assets/${type === "image" ? "images" : type === "audio" ? "audio" : "video"}/${id}.${ext}`,
    mimeType, ...extra,
  });
  const image = (id) => asset(id, "image", "png", "image/png");
  const audio = (id) => asset(id, "audio", "wav", "audio/wav");
  return {
    version: 1,
    assets: [image("fx-image"), image("fx-wallpaper"), image("fx-icon"), audio("fx-bgm"), audio("fx-click"), audio("fx-tarot"), audio("fx-ending")],
    intro: {
      settings: { bgmAssetId: "fx-bgm", clickSoundAssetId: "fx-click", bgmVolume: 0, typewriterSpeed: 1 },
      scenes: [
        { id: "fx-scene-1", order: 1, enabled: true, text: "第一幕：测试开场", speaker: "SEKI", backgroundAssetId: "fx-image", characterPosition: "center" },
        { id: "fx-scene-2", order: 2, enabled: true, text: "第二幕：准备进入桌面", speaker: "SEKI", backgroundAssetId: "fx-image" },
      ],
    },
    onboarding: {
      title: "E2E 引导", buttonLabel: "开始", hint: "引导已开启", typewriterSpeed: 1,
      pages: [
        { id: "welcome", caption: "欢迎来到测试桌面。" },
        { id: "tarot", caption: "抽一张塔罗牌解锁项目。" },
      ],
    },
    welcome: {
      speakerName: "SEKI", message: "选择要进入的桌面",
      choices: [
        { id: "content", label: "内容桌面", assetId: "fx-icon" },
        { id: "education", label: "教育桌面", assetId: "fx-icon" },
        { id: "sales", label: "销售桌面", assetId: "fx-icon" },
      ],
    },
    desktop: {
      systemName: "SEKI OS", tagline: "测试桌面", footerSlogan: "E2E", progressLabel: "探索进度", dateTimeLabel: "2026-01-01",
      wallpaperAssetId: "fx-wallpaper", bgmAssetId: "fx-bgm", clickSoundAssetId: "fx-click", tarotSoundAssetId: "fx-tarot",
      icons: [
        {
          id: "fx-icon-project", label: "测试项目", type: "project", locked: false, projectId: "project-1",
          folder: { items: [{ id: "fx-item-project", label: "项目说明", kind: "document", targetProjectId: "project-1" }] },
        },
        { id: "fx-icon-locked", label: "未开放", type: "portfolio", locked: true, folder: { items: [] } },
      ],
    },
    desktops: {},
    ending: { bgmAssetId: "fx-ending" },
    projectPages: [...disabledProjectConfigs, {
      projectId: "project-1", enabled: true, title: "测试项目一", presentation: "report", finalAction: { label: "完成项目", disabled: false },
      pages: [
        {
          id: "fx-page-1", projectId: "project-1", internalName: "概览", title: "第一页", navLabel: "概览", order: 1, enabled: true, kind: "overview",
          blockIds: ["fx-block-text"],
        },
        {
          id: "fx-page-2", projectId: "project-1", internalName: "结果", title: "第二页", navLabel: "结果", order: 2, enabled: true, kind: "result",
          blockIds: ["fx-block-text", "fx-block-image", "fx-block-demo"],
        },
      ],
      blocks: [
        { id: "fx-block-text", type: "text", markdown: "这是 E2E 夹具项目正文。" },
        { id: "fx-block-image", type: "image", asset: "fx-image", alt: "夹具图片" },
        { id: "fx-block-demo", type: "agent_demo", app: "content-agent" },
      ],
    }],
  };
}

/** 把夹具写入目标目录，返回目录路径。 */
export function buildFixtureDir(dir) {
  const bundle = fixtureBundle();
  const write = (relativePath, data) => {
    const target = join(dir, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  };
  write("content.json", `${JSON.stringify(bundle, null, 2)}\n`);
  for (const asset of bundle.assets) {
    write(asset.path, asset.type === "image" ? makePng(4, 4) : makeWav());
  }
  for (const spec of STATIC_ASSET_SPECS) {
    if (spec.endsWith(".png")) write(join("static", spec), makePng(3, 3, [200, 180, 120]));
    else if (spec.endsWith(".woff2")) write(join("static", spec), Buffer.from("wOF2fixture-font-bytes"));
    else write(join("static", spec), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#345"/></svg>'));
  }
  for (const app of ["content-agent", "ads-agent"]) {
    write(join("demos", app, "index.html"), DEMO_HTML(app));
    write(join("demos", app, "style.css"), "h1{font-family:sans-serif}");
    write(join("demos", app, "app.js"), `document.body.dataset.demo="${app}";`);
  }
  return { dir, bundle };
}
