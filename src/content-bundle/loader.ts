import { projects as baseProjects } from "../content";
import { mergeProjectPages, validateContentBundle } from "./schema";

export { assetUrl, createAssetResolver, mediaUrl, staticAsset, STATIC_ASSET_PREFIX, DEMO_PREFIX } from "../lib/media";

const EDITOR_TOKEN_KEY = "interactive-portfolio:editor-token";

/** 编辑器写入令牌：优先取 ?token=，其次取 localStorage（本地开发可留空）。 */
export function editorToken(): string | undefined {
  const fromQuery = new URLSearchParams(window.location.search).get("token");
  if (fromQuery) {
    try { window.localStorage.setItem(EDITOR_TOKEN_KEY, fromQuery); } catch { /* ignore */ }
    return fromQuery;
  }
  try { return window.localStorage.getItem(EDITOR_TOKEN_KEY) ?? undefined; } catch { return undefined; }
}

export async function loadContentBundle() {
  const preview = new URLSearchParams(window.location.search).get("preview") === "1";
  const headers: Record<string, string> = {};
  const token = preview ? editorToken() : undefined;
  if (token) headers["x-admin-token"] = token;
  const response = await fetch(preview ? "/api/content?draft=1" : "/api/content", { cache: "no-store", headers });
  if (!response.ok) throw new Error(`Content load failed: ${response.status}`);
  const bundle = validateContentBundle(await response.json(), baseProjects);
  return { bundle, projects: mergeProjectPages(baseProjects, bundle), preview };
}
