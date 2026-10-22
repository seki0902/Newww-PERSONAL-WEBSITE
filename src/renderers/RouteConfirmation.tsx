import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ContentBundle } from "../content-bundle/schema";
import type { Project } from "../schema/content";
import "./DesktopNavigation.css";

type Choice = ContentBundle["welcome"]["choices"][number];
export function RouteConfirmation({ choices, currentId, getProjects, onConfirm, onCancel }: { choices: Choice[]; currentId?: string; getProjects: (id: string) => Project[]; onConfirm: (id: string) => void; onCancel?: () => void }) {
  const [selected, setSelected] = useState<string>();
  const panel = useRef<HTMLElement>(null);
  const choice = choices.find(choice => choice.id === selected);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [selected]);
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); if (selected) setSelected(undefined); else onCancel?.(); }
    if (event.key !== "Tab") return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (!buttons?.length) return;
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
  };
  return <div className="route-overlay" data-testid="route-overlay">
    <section ref={panel} className="route-window" role="dialog" aria-modal="true" aria-labelledby="route-title" onKeyDown={handleKey}>
      <header><span className="route-eyebrow">SEKI OS · 选择探索路线</span><h1 id="route-title">{choice ? choice.label : "想先了解哪一部分？"}</h1><p>{choice ? "这条路线里有这些项目，选好后就可以在桌面直接体验。" : "三条路线随时可以在桌面左下角切换。"}</p></header>
      {choice ? <ul className="route-projects">{getProjects(choice.id).filter(project => project.enabled).map(project => <li key={project.id}><h2>{project.title}</h2><p>{project.subtitle || "打开项目查看作品与具体说明。"}</p></li>)}</ul>
        : <div className="route-options">{choices.map((item, index) => <button type="button" key={item.id} onClick={() => setSelected(item.id)}><span>0{index + 1}</span><strong>{item.label}</strong><small>{item.id === currentId ? "当前路线" : "查看项目 →"}</small></button>)}</div>}
      <footer>{choice ? <><button type="button" className="route-secondary" onClick={() => setSelected(undefined)}>返回选择</button><button type="button" className="route-primary" onClick={() => onConfirm(choice.id)}>进入这条路线</button></> : onCancel ? <button type="button" className="route-secondary" onClick={onCancel}>留在当前桌面</button> : null}</footer>
    </section>
  </div>;
}
