// 素材 URL 解析：所有素材（字体/图片/音频/视频/demo 小程序）都由服务端从 PostgreSQL 提供。
// 约定：
//   /api/assets/<id>            —— 内容 bundle 里的素材 id
//   /api/assets/static/<path>   —— 代码内固定引用的素材（原 public/assets/**）
//   /demos/<app>/...            —— agent 演示小程序（原 public/demos/**）
export const API_ASSET_PREFIX = "/api/assets/";
export const STATIC_ASSET_PREFIX = `${API_ASSET_PREFIX}static/`;
export const DEMO_PREFIX = "/demos/";

/** 把 static/ 下的相对路径转换为可访问 URL（入参形如 "fonts/x.woff2" 或 "/assets/fonts/x.woff2"）。 */
export function staticAsset(relativePath: string): string {
  const normalized = relativePath
    .replace(/^\/+/, "")
    .replace(/^assets\//, "")
    .replace(/^static\//, "");
  return `${STATIC_ASSET_PREFIX}${normalized}`;
}

/** 判断是否为历史内容里遗留的站内素材路径。 */
export const isLegacyAssetPath = (value: string) => value.startsWith("/assets/") || value.startsWith("assets/");

/** 普通素材引用（可能是 bundle id，也可能是历史 /assets/ 路径）→ URL。 */
export function mediaUrl(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  if (/^(https?:|data:|blob:)/i.test(ref)) return ref;
  if (isLegacyAssetPath(ref)) return staticAsset(ref);
  if (ref.startsWith("/")) return ref;
  return `${API_ASSET_PREFIX}${ref}`;
}

/**
 * bundle 感知的解析器：bundle 里不存在的 id 返回 undefined，
 * 便于组件回退到兜底图（保持改造前行为）。
 */
export function createAssetResolver(bundle: { assets: { id: string }[] } | undefined, _preview = false) {
  void _preview; // 兼容旧签名（素材统一来自数据库，不再区分 preview 源）
  return (ref: string | undefined): string | undefined => {
    if (!ref) return undefined;
    if (/^(https?:|data:|blob:)/i.test(ref) || isLegacyAssetPath(ref)) return mediaUrl(ref);
    return bundle?.assets.some((asset) => asset.id === ref) ? `${API_ASSET_PREFIX}${ref}` : undefined;
  };
}

/** 兼容旧调用签名 assetUrl(bundle, assetId, preview)。 */
export function assetUrl(bundle: { assets: { id: string }[] } | undefined, assetId: string | undefined, preview = false) {
  return createAssetResolver(bundle, preview)(assetId);
}
