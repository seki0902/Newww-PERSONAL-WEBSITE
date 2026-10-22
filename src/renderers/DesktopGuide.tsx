import { useEffect, useRef, useState } from "react";
const steps = [
  { id: "projects", title: "点图标，直接看作品", body: "点击桌面项目图标，有 Demo 就直接试用，有文件就直接打开。想看文字介绍，可以返回项目文件夹。" },
  { id: "routes", title: "左下角，随时换条路线", body: "点击“切换路线”，查看三条路线的项目介绍，确认后就能切换。已读记录会保留。" },
  { id: "pdf", title: "PDF 图标，查看完整作品集", body: "点击桌面右上方的 PDF 图标，可以连续阅读和下载完整作品集。也可以在左下角重新打开这份引导。" },
] as const;
export function DesktopGuide({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const step = steps[index];
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const selector = index === 0 ? ".desktop-reference-icon" : index === 1 ? ".desktop-navigation" : ".desktop-pdf-shortcut";
    const target = document.querySelector(selector);
    target?.classList.add("desktop-guide-highlight");
    return () => target?.classList.remove("desktop-guide-highlight");
  }, [index]);
  return <div className={`desktop-guide desktop-guide--${step.id}`} data-testid="desktop-guide"><section className="desktop-guide-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="desktop-guide-title" onKeyDown={event => { if (event.key === "Escape") onComplete(); if (event.key === "Tab") { const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button"); if (buttons?.length && ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]))) { event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0].focus(); } } }}><small>桌面使用说明 · {index + 1} / 3</small><h2 id="desktop-guide-title">{step.title}</h2><p>{step.body}</p><footer><button type="button" className="route-secondary" onClick={onComplete}>跳过引导</button><button type="button" className="route-primary" onClick={() => index < steps.length - 1 ? setIndex(index + 1) : onComplete()}>{index < steps.length - 1 ? "下一步" : "开始探索"}</button></footer></section></div>;
}
