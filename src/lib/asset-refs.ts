import type { ContentBundle } from "../content-bundle/schema";

export interface AssetReference {
  path: string;
  label: string;
}

const INTRO_SETTINGS: Record<string, string> = {
  bgmAssetId: "BGM",
  textSoundAssetId: "文字音效",
  clickSoundAssetId: "点击音效",
};

const WELCOME_FIELDS: Record<string, string> = {
  backgroundAssetId: "背景",
  characterAssetId: "人物",
  dialogueAssetId: "对话框",
  nameplateAssetId: "名牌",
  highlightedChoiceAssetId: "高亮选项",
  cursorAssetId: "指针",
};

const DESKTOP_FIELDS: Record<string, string> = {
  referenceAssetId: "桌面原图",
  wallpaperAssetId: "壁纸",
  wallpaperTopOverlayAssetId: "顶部装饰",
  wallpaperBottomOverlayAssetId: "底部装饰",
  brandIconAssetId: "系统栏图标",
  bgmAssetId: "BGM",
  clickSoundAssetId: "点击音效",
};

function describeReference(path: string): string {
  let match = path.match(/^intro\.settings\.([A-Za-z]+)$/);
  if (match) return `开场设置 · ${INTRO_SETTINGS[match[1]] ?? match[1]}`;

  match = path.match(/^intro\.scenes\[(\d+)\]\.(backgroundAssetId|characterAssetId)$/);
  if (match) return `开场 · 第 ${Number(match[1]) + 1} 幕${match[2] === "backgroundAssetId" ? "背景" : "人物"}`;

  match = path.match(/^onboarding\.(openSoundAssetId|purrSoundAssetId)$/);
  if (match) return `新人引导 · ${match[1] === "openSoundAssetId" ? "打开音效" : "呼噜音效"}`;

  match = path.match(/^welcome\.([A-Za-z]+AssetId)$/);
  if (match) return `欢迎页 · ${WELCOME_FIELDS[match[1]] ?? match[1]}`;

  match = path.match(/^ending\.bgmAssetId$/);
  if (match) return "结局 · BGM";

  match = path.match(/^(?:desktop|desktops\.([^.]+))\.icons\[(\d+)\]\.iconAssetId$/);
  if (match) return `桌面${match[1] ? ` ${match[1]}` : ""} · 图标 ${Number(match[2]) + 1} 图片`;

  match = path.match(/^(?:desktop|desktops\.([^.]+))\.([A-Za-z]+AssetId)$/);
  if (match) return `桌面${match[1] ? ` ${match[1]}` : ""} · ${DESKTOP_FIELDS[match[2]] ?? match[2]}`;

  if (/projectPages\[/.test(path) && /\.asset$/.test(path)) return "项目页面 · 素材";

  return path;
}

/** 扫描内容 bundle 中所有引用了指定素材的位置。 */
export function findAssetReferences(bundle: ContentBundle, assetId: string): AssetReference[] {
  const seen = new Set<string>();
  const found: AssetReference[] = [];

  const visit = (value: unknown, path: string) => {
    if (value === assetId) {
      if (path && !seen.has(path)) {
        seen.add(path);
        found.push({ path, label: describeReference(path) });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    }
  };

  const root = bundle as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(root)) {
    if (key !== "assets") visit(value, key);
  }
  return found;
}
