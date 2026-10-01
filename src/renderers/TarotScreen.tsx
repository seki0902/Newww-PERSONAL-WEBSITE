import { useState } from "react";
import type { Project } from "../schema/content";

export function TarotScreen({ project, onComplete }: { project: Project; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return <main className="screen tarot-screen"><section className="tarot-panel"><span className="eyebrow">解锁仪式 / {project.order.toString().padStart(2, "0")}</span><h1>选择一张牌</h1>{!revealed ? <div className="tarot-cards">{[1, 2, 3].map((card) => <button key={card} className="tarot-back" aria-label={`牌背 ${card}`} onClick={() => setRevealed(true)}><img src="/assets/tarot-placeholder.svg" alt="" /></button>)}</div> : <div className="tarot-reveal"><img src={project.tarot.image} alt={`${project.tarot.name} 牌面`} /><div><span className="eyebrow">已翻开</span><h2>{project.tarot.name}</h2><p>{project.tarot.hint}</p><button className="primary-button" onClick={onComplete}>完成抽牌</button></div></div>}</section></main>;
}
