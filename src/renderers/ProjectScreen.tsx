import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Project } from "../schema/content";
import { getEnabledProjectPages, getProjectPageNavigation } from "../runtime/flow";
import { BlockRenderer } from "../blocks/BlockRenderer";
import { ProjectPageRenderer } from "./ProjectPageRenderer";
import "./ProjectScreen.css";
import "./ProjectWindowLight.css";
import "./KamiProject.css";

type ProjectScreenProps = {
  project: Project;
  activePageId?: string;
  onGotoPage: (pageId: string) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onComplete: () => void;
  onClose?: () => void;
  folderTitle?: string;
  fileTitle?: string;
  resolveAsset?: (assetId: string) => string | undefined;
  embedded?: boolean;
  modal?: boolean;
  maximized?: boolean;
  onMinimize?: () => void;
  onToggleMaximized?: () => void;
};

export function ProjectScreen({ project, activePageId, onGotoPage, onNextPage, onPrevPage, onComplete, onClose, folderTitle, fileTitle, resolveAsset, embedded = false, modal = true, maximized: controlledMaximized, onMinimize, onToggleMaximized }: ProjectScreenProps) {
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [localMaximized, setMaximized] = useState(false);
  const maximized = controlledMaximized ?? localMaximized;
  const [minimized, setMinimized] = useState(false);
  const windowRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const isReport = project.presentation === "report";
  const pages = getEnabledProjectPages(project);
  const navigation = getProjectPageNavigation(project, activePageId);
  const activePage = navigation.currentPage ?? pages[0];
  const currentIndex = navigation.currentIndex >= 0 ? navigation.currentIndex : 0;
  const firstPageId = pages[0]?.id;
  const hasPageConfig = project.pages !== undefined && project.pageIds !== undefined;
  const Root = embedded ? "div" : "main";

  useEffect(() => {
    if (firstPageId && !navigation.currentPage) onGotoPage(firstPageId);
  }, [firstPageId, navigation.currentPage, onGotoPage]);
  useEffect(() => {
    if (!isReport) return;
    if (minimized) restoreRef.current?.focus();
    else windowRef.current?.querySelector<HTMLButtonElement>("button[aria-label='关闭项目说明并返回文件夹']")?.focus();
  }, [isReport, minimized]);

  if (isReport && minimized) return <div className="project-restore-tray">
    <button ref={restoreRef} type="button" onClick={() => setMinimized(false)} aria-label="还原项目说明窗口"><span aria-hidden="true">▣</span>{folderTitle ?? project.title} / {fileTitle ?? "项目说明"}<span>还原 ↑</span></button>
  </div>;

  if (!activePage) {
    return (
      <Root className={`screen project-screen${isReport ? " project-screen--report" : ""}${!modal ? " project-screen--managed" : ""}`} role={embedded ? "dialog" : undefined} aria-label={embedded ? project.title : undefined}>
        <article className="project-window project-window--legacy kami-portfolio">
          <header className="project-legacy-header">
            <span className="eyebrow">项目档案 / {project.desktopSlot}</span>
            <h1>{project.title}</h1>
            {project.subtitle && <p>{project.subtitle}</p>}
          </header>
          <div className="project-content">{hasPageConfig ? <p className="project-empty-pages" role="status">当前项目没有启用的页面，请在 Editor 中启用至少一个 Page。</p> : project.blocks.map((block) => <BlockRenderer key={block.id} block={block} projectId={project.id} resolveAsset={resolveAsset} />)}</div>
          <footer>
            {project.rewardItem && <span className="reward-note">完成后获得：{project.rewardItem.title}</span>}
            {onClose && <button type="button" className="text-button" aria-label="关闭项目说明并返回文件夹" onClick={onClose}>返回文件夹</button>}
            <button className="primary-button" onClick={onComplete}>完成项目</button>
          </footer>
        </article>
      </Root>
    );
  }

  const pageNumber = currentIndex + 1;
  const isLastPage = pageNumber === pages.length;
  const finalAction = project.finalAction;

  const navigateTo = (pageId: string) => {
    const targetIndex = pages.findIndex((page) => page.id === pageId);
    if (targetIndex < 0 || targetIndex === currentIndex) return;
    setDirection(targetIndex < currentIndex ? "prev" : "next");
    onGotoPage(pageId);
  };

  const goPrev = () => {
    if (!navigation.canPrev) return;
    setDirection("prev");
    onPrevPage();
  };

  const goNext = () => {
    if (!navigation.canNext) return;
    setDirection("next");
    onNextPage();
  };

  const keepFocusInWindow = (event: KeyboardEvent<HTMLElement>) => {
    if (!isReport) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose?.(); return; }
    if (!modal || event.key !== "Tab") return;
    const controls = windowRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0']");
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <Root className={`screen project-screen${isReport ? " project-screen--report" : ""}${!modal ? " project-screen--managed" : ""}${maximized ? " is-maximized" : ""}`} role={embedded ? "dialog" : undefined} aria-modal={isReport && embedded && modal ? true : undefined} aria-label={embedded ? project.title : undefined}>
      <article ref={windowRef} className={`project-window project-window--paged kami-portfolio${isReport ? " project-window--report" : ""}${project.resourceLinks?.length ? " has-resource-links" : ""}`} onKeyDown={keepFocusInWindow}>
        <header className="project-window-header">
          <div className="project-window-identity">
            <p className="project-window-path"><span>{folderTitle ?? project.title}</span><span aria-hidden="true">/</span><strong>{fileTitle ?? "项目说明"}</strong></p>
            {project.subtitle && <p className="project-window-subtitle">{project.subtitle}</p>}
          </div>
          <span className="project-window-count" aria-live="polite">{String(pageNumber).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}</span>
          <div className="project-window-controls" aria-label="窗口控制">
            <button type="button" className="window-dot window-dot--minimize" title="最小化" aria-label="最小化项目说明窗口" onClick={() => onMinimize ? onMinimize() : setMinimized(true)} disabled={!isReport}>{isReport ? "−" : null}</button>
            <button type="button" className="window-dot window-dot--maximize" title={maximized ? "还原" : "最大化"} aria-label={maximized ? "还原项目说明窗口" : "最大化项目说明窗口"} onClick={() => onToggleMaximized ? onToggleMaximized() : setMaximized((value) => !value)} disabled={!isReport}>{isReport ? "□" : null}</button>
            <button type="button" className="window-dot window-dot--close" title="关闭" aria-label="关闭项目说明并返回文件夹" onClick={onClose} disabled={!onClose}>{isReport ? "×" : null}</button>
          </div>
        </header>

        <div className="project-paged-body">
          <aside className="project-sidebar">
            <h2>{isReport ? "章节目录" : "项目模块"}</h2>
            <nav aria-label={isReport ? "项目说明章节" : "项目模块"}>
              {pages.map((page, index) => {
                const selected = page.id === activePage.id;
                return (
                  <button key={page.id} type="button" className={selected ? "project-nav-item is-active" : "project-nav-item"} aria-current={selected ? "page" : undefined} onClick={() => navigateTo(page.id)}>
                    <span className="project-nav-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="project-nav-label">{page.navLabel}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="project-page-viewport" key={activePage.id}>
            <ProjectPageRenderer page={activePage} blocks={project.blocks} direction={direction} projectId={project.id} resolveAsset={resolveAsset} />
          </div>
        </div>

        {project.resourceLinks?.length ? <nav className="project-resource-links" aria-label="个人资料链接">{project.resourceLinks.map(link => link.href ? <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label}</a> : <button key={link.label} type="button" disabled title="链接待补充">{link.label}<small>待补充</small></button>)}</nav> : null}
        <footer className="project-pager">
          <div className="project-pager-reward">
            {!modal && isLastPage && finalAction?.disabled && <button type="button" className="project-pager-button" onClick={onComplete}>完成阅读</button>}
            {isLastPage && project.rewardItem && !isReport && <span className="reward-note">完成后获得：{project.rewardItem.title}</span>}
          </div>
          <div className="project-pager-controls">
            <button type="button" className="project-pager-button" onClick={goPrev} disabled={!navigation.canPrev}>← 上一页</button>
            <span className="project-pager-count" aria-live="polite">{String(pageNumber).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}</span>
            <button type="button" className="project-pager-button" onClick={isLastPage ? onComplete : goNext} disabled={isLastPage ? Boolean(finalAction?.disabled) : !navigation.canNext}>{isLastPage && finalAction ? finalAction.label : "下一页 →"}</button>
          </div>
          <div className="project-pager-complete">
            {isLastPage && !finalAction && <button type="button" className="primary-button" onClick={onComplete}>完成项目</button>}
          </div>
        </footer>
      </article>
    </Root>
  );
}
