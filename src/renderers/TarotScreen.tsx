import { useEffect, useRef, useState } from "react";
import type { Project } from "../schema/content";
import "./TarotScreen.css";

export function TarotScreen({ project, onComplete, muted = false, drawSound, embedded = false, managed = false, maximized = false, revealed: controlledRevealed, onReveal, onClose, onMinimize, onMaximize }: { project: Project; onComplete: () => void; muted?: boolean; drawSound?: string; embedded?: boolean; managed?: boolean; maximized?: boolean; revealed?: boolean; onReveal?: () => void; onClose?: () => void; onMinimize?: () => void; onMaximize?: () => void }) {
  const [localRevealed, setRevealed] = useState(false);
  const revealed = controlledRevealed ?? localRevealed;
  const panelRef = useRef<HTMLElement>(null);
  const soundRef = useRef<HTMLAudioElement>(null);
  const reveal = () => {
    if (!muted && soundRef.current) {
      soundRef.current.currentTime = 0;
      void soundRef.current.play().catch(() => undefined);
    }
    if (onReveal) onReveal(); else setRevealed(true);
  };
  useEffect(() => { panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  const Root = embedded ? "div" : "main";
  return <Root className={`screen tarot-screen${managed ? " tarot-screen--managed" : ""}${maximized ? " is-maximized" : ""}`} role={embedded ? "dialog" : undefined} aria-label={embedded ? `解锁 ${project.title}` : undefined}>
    <section ref={panelRef} className="tarot-panel" onKeyDown={(event) => { if (event.key === "Escape" && onClose) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
      {drawSound && <audio ref={soundRef} data-testid="tarot-draw-sound" src={drawSound} preload="auto" muted={muted} />}
      {onClose && <header className="tarot-window-titlebar"><div className="folder-window-controls">
        <button type="button" className="folder-window-control folder-window-control--close" aria-label="关闭抽牌并返回桌面" onClick={onClose} />
        <button type="button" className="folder-window-control folder-window-control--minimize" aria-label="最小化抽牌窗口" onClick={onMinimize} />
        <button type="button" className="folder-window-control folder-window-control--maximize" aria-label={maximized ? "还原抽牌窗口" : "最大化抽牌窗口"} onClick={onMaximize} />
      </div><span>{project.title}</span></header>}
      <div className="tarot-body"><span className="eyebrow">解锁仪式 / {project.order.toString().padStart(2, "0")}</span><h1>{revealed ? "你抽到了" : "选择一张牌"}</h1><p className="tarot-introduction">抽取一张塔罗牌，开启这段项目探索。</p>
        {!revealed ? <div className="tarot-cards">{[1, 2, 3].map((card) => <button type="button" key={card} className="tarot-back" aria-label={`牌背 ${card}`} onClick={reveal}><img src={`/assets/tarot/back-${card}.png`} alt="" /></button>)}</div>
          : <div className="tarot-reveal" aria-live="polite"><h2>{project.tarot.name}</h2><figure><img src={project.tarot.image} alt={`${project.tarot.name} 牌面`} /><figcaption data-testid="tarot-quote">{project.tarot.hint}</figcaption></figure><button type="button" className="primary-button" onClick={onComplete}>完成抽牌</button></div>}
      </div>
    </section>
  </Root>;
}
