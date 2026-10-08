import { useState } from "react";
import { mediaUrl } from "../lib/media";
import type { Block } from "../schema/content";

export function ImageBlock({ block }: { block: Extract<Block, { type: "image" }> }) {
  const [failed, setFailed] = useState(false);
  return <figure className="media-block">{failed ? <div className="media-fallback">图片暂时无法加载</div> : <img src={mediaUrl(block.asset)} alt={block.alt ?? "项目图片"} onError={() => setFailed(true)} />} {block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
}
