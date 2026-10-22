import { useEffect, useRef, useState } from "react";
import { staticAsset } from "../lib/media";
import "./OnboardingOverlay.css";
const steps = [
  { id: "projects", title: "点图标，直接看作品", body: "点击桌面项目图标，有 Demo 就直接试用，有文件就直接打开。想看文字介绍，可以返回项目文件夹。" },
  { id: "routes", title: "左下角，随时换条路线", body: "点击“切换路线”，查看三条路线的项目介绍，确认后就能切换。已读记录会保留。" },
  { id: "pdf", title: "PDF 图标，查看完整作品集", body: "点击桌面右上方的 PDF 图标，可以连续阅读和下载完整作品集。也可以在左下角重新打开这份引导。" },
] as const;
export function DesktopGuide({ onComplete, muted, onMutedChange, openSound, purrSound }: { onComplete: () => void; muted: boolean; onMutedChange: (muted: boolean) => void; openSound?: string; purrSound?: string }) {
  const [index, setIndex] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const openSoundRef = useRef<HTMLAudioElement>(null);
  const purrSoundRef = useRef<HTMLAudioElement>(null);
  const openedSound = useRef(false);
  const step = steps[index];
  useEffect(() => {
    const purr = purrSoundRef.current;
    if (muted) { purr?.pause(); return; }
    if (!openedSound.current && openSoundRef.current) {
      openedSound.current = true;
      openSoundRef.current.volume = .32;
      void openSoundRef.current.play().catch(() => undefined);
    }
    if (purr) { purr.volume = .11; void purr.play().catch(() => undefined); }
    return () => purr?.pause();
  }, [muted, openSound, purrSound]);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const selector = index === 0 ? ".desktop-reference-icon" : index === 1 ? ".desktop-navigation" : ".desktop-pdf-shortcut";
    const target = document.querySelector(selector);
    target?.classList.add("desktop-guide-highlight");
    return () => target?.classList.remove("desktop-guide-highlight");
  }, [index]);
  return <div className={`desktop-guide desktop-guide--${step.id}`} data-testid="desktop-guide">
    {openSound && <audio ref={openSoundRef} data-testid="onboarding-open-sound" src={openSound} preload="auto" muted={muted} />}
    {purrSound && <audio ref={purrSoundRef} data-testid="onboarding-purr-sound" src={purrSound} preload="auto" loop muted={muted} />}
    <section className="desktop-guide-panel onboarding-window" ref={panel} role="dialog" aria-modal="true" aria-labelledby="desktop-guide-title" onKeyDown={event => { if (event.key === "Escape") onComplete(); if (event.key === "Tab") { const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button"); if (buttons?.length && ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]))) { event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0].focus(); } } }}>
      <header className="onboarding-titlebar">
        <img src={staticAsset("onboarding/canva-sleeping-cat.webp")} alt="" aria-hidden="true" />
        <h1>桌面使用说明 · {index + 1} / 3</h1>
        <button type="button" className="onboarding-sound-toggle" aria-label={muted ? "开启声音" : "关闭声音"} onClick={() => onMutedChange(!muted)}><span aria-hidden="true">♪</span></button>
        <button type="button" className="onboarding-sound-toggle" aria-label="关闭使用引导" onClick={onComplete}><span aria-hidden="true">×</span></button>
      </header>
      <div className="onboarding-body">
        <div className="onboarding-art">
          <i className="onboarding-spark onboarding-spark--one" aria-hidden="true" />
          <i className="onboarding-spark onboarding-spark--two" aria-hidden="true" />
          <div className="onboarding-cat-breathe"><img data-testid="desktop-guide-cat" src={staticAsset("onboarding/canva-sleeping-cat.webp")} alt="睡觉的猫猫" /></div>
          <span className="onboarding-snore" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span>
        </div>
        <div className="onboarding-copy">
          <h2 id="desktop-guide-title">{step.title}</h2><p>{step.body}</p>
          <footer><button type="button" className="route-secondary" onClick={onComplete}>跳过引导</button><button type="button" className="route-primary" onClick={() => index < steps.length - 1 ? setIndex(index + 1) : onComplete()}>{index < steps.length - 1 ? "下一步" : "开始探索"}</button></footer>
        </div>
      </div>
    </section>
  </div>;
}
