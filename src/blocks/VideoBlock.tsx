import { useState } from "react";
import type { Block } from "../schema/content";

export function VideoBlock({ block }: { block: Extract<Block, { type: "video" }> }) {
  const [failed, setFailed] = useState(false);
  return <figure className="media-block">{failed ? <div className="media-fallback">视频素材待补充</div> : <video controls preload="metadata" poster={block.poster} onError={() => setFailed(true)}><source src={block.asset} type="video/mp4" />当前浏览器不支持视频播放。</video>} {block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
}
