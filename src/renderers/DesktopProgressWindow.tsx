import { useEffect, useRef } from "react";
import type { ContentBundle } from "../content-bundle/schema";
import type { Project } from "../schema/content";
import { getProgress } from "../runtime/flow";
import "./DesktopProgressWindow.css";

export function DesktopProgressWindow({ projects, desktop, read, unlocked, collected, maximized, onClose, onMinimize, onMaximize, onOpenProject }: { projects: Project[]; desktop: ContentBundle["desktop"]; read: string[]; unlocked: string[]; collected: string[]; maximized: boolean; onClose: () => void; onMinimize: () => void; onMaximize: () => void; onOpenProject: (iconId: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const available = projects.filter((project) => project.enabled);
  const completed = available.filter((project) => read.includes(project.id));
  const cards = projects.filter((project) => collected.includes(project.tarot.id));
  return <section className="desktop-progress-layer" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <article role="dialog" aria-label="探索进度" className={`desktop-progress-window${maximized ? " is-maximized" : ""}`}>
      <header className="folder-window-titlebar"><div className="folder-window-controls">
        <button ref={closeRef} type="button" className="folder-window-control folder-window-control--close" aria-label="关闭探索进度" onClick={onClose} />
        <button type="button" className="folder-window-control folder-window-control--minimize" aria-label="最小化探索进度" onClick={onMinimize} />
        <button type="button" className="folder-window-control folder-window-control--maximize" aria-label={maximized ? "还原探索进度" : "最大化探索进度"} onClick={onMaximize} />
      </div><h1>探索进度</h1></header>
      <div className="desktop-progress-content">
        <div className="desktop-progress-summary"><strong>{getProgress(projects, read)}<small>%</small></strong><div><h2>每个项目，都是一段新的探索</h2><p>{completed.length} / {available.length} 个项目已完成</p></div></div>
        <progress max={available.length || 1} value={completed.length} aria-label="项目探索完成度" />
        <div className="desktop-progress-projects">{available.map((project) => {
          const icon = desktop.icons.find((icon) => !icon.locked && icon.folder.items.some((file) => !file.disabled && file.targetProjectId === project.id));
          return <div key={project.id}><div><h3>{project.title}</h3><p>{read.includes(project.id) ? "已完成阅读" : unlocked.includes(project.id) ? "已抽牌，待完成阅读" : "待抽牌探索"}</p></div><button type="button" disabled={!icon} onClick={() => icon && onOpenProject(icon.id)} aria-label={`继续探索 ${project.title}`}>继续探索 <span aria-hidden="true">→</span></button></div>;
        })}</div>
        <h2>已收集的塔罗牌</h2>{cards.length ? <ul className="desktop-progress-collection">{cards.map((project) => <li key={project.tarot.id}>{project.tarot.name}<span>{project.title}</span></li>)}</ul> : <p className="desktop-progress-empty">打开项目说明，抽取第一张塔罗牌。</p>}
      </div>
    </article>
  </section>;
}
