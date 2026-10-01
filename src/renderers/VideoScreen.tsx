import type { IntroContent } from "../schema/content";
import { useState } from "react";

export function VideoScreen({ intro, onFinish }: { intro: IntroContent; onFinish: () => void }) {
  const [failed, setFailed] = useState(false);
  return <main className="screen video-screen"><section className="video-panel"><span className="eyebrow">转场记录</span>{failed || !intro.video ? <div className="media-fallback">视频暂时无法加载</div> : <video autoPlay controls poster={intro.video.poster} onEnded={onFinish} onError={() => setFailed(true)}><source src={intro.video.src} type="video/mp4" /></video>}<button onClick={onFinish}>跳过视频</button></section></main>;
}
