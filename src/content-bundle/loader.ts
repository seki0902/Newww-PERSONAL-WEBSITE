import { projects as baseProjects } from "../content";
import { mergeProjectPages, validateContentBundle, type ContentBundle } from "./schema";

const draftApi = "http://127.0.0.1:4174/api/content";

export async function loadContentBundle() {
  const preview = new URLSearchParams(window.location.search).get("preview") === "1";
  const response = await fetch(preview ? draftApi : "/content/current/content.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Content load failed: ${response.status}`);
  const bundle = validateContentBundle(await response.json(), baseProjects);
  return { bundle, projects: mergeProjectPages(baseProjects, bundle), preview };
}

export function assetUrl(bundle: ContentBundle, assetId: string | undefined, preview: boolean) {
  const asset = bundle.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return undefined;
  return `${preview ? "http://127.0.0.1:4174" : "/content/current"}/${asset.path}`;
}
