import { useEffect, useState } from "react";
import type { Project } from "../schema/content";
import { getEnabledProjectPages, getProjectPageNavigation } from "../runtime/flow";
import { BlockRenderer } from "../blocks/BlockRenderer";
import { ProjectPageRenderer } from "./ProjectPageRenderer";
import "./ProjectScreen.css";

type ProjectScreenProps = {
  project: Project;
  activePageId?: string;
  onGotoPage: (pageId: string) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onComplete: () => void;
  resolveAsset?: (assetId: string) => string | undefined;
};

export function ProjectScreen({ project, activePageId, onGotoPage, onNextPage, onPrevPage, onComplete, resolveAsset }: ProjectScreenProps) {
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const pages = getEnabledProjectPages(project);
  const navigation = getProjectPageNavigation(project, activePageId);
  const activePage = navigation.currentPage ?? pages[0];
  const currentIndex = navigation.currentIndex >= 0 ? navigation.currentIndex : 0;
  const firstPageId = pages[0]?.id;
  const hasPageConfig = project.pages !== undefined && project.pageIds !== undefined;

  useEffect(() => {
    if (firstPageId && !navigation.currentPage) onGotoPage(firstPageId);
  }, [firstPageId, navigation.currentPage, onGotoPage]);

  if (!activePage) {
    return (
      <main className="screen project-screen">
        <article className="project-window">
          <header className="project-legacy-header">
            <span className="eyebrow">项目档案 / {project.desktopSlot}</span>
            <h1>{project.title}</h1>
            {project.subtitle && <p>{project.subtitle}</p>}
          </header>
          <div className="project-content">{hasPageConfig ? <p className="project-empty-pages" role="status">当前项目没有启用的页面，请在 Editor 中启用至少一个 Page。</p> : project.blocks.map((block) => <BlockRenderer key={block.id} block={block} projectId={project.id} resolveAsset={resolveAsset} />)}</div>
          <footer>
            {project.rewardItem && <span className="reward-note">完成后获得：{project.rewardItem.title}</span>}
            <button className="primary-button" onClick={onComplete}>完成项目</button>
          </footer>
        </article>
      </main>
    );
  }

  const pageNumber = currentIndex + 1;
  const isLastPage = pageNumber === pages.length;

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

  return (
    <main className="screen project-screen">
      <article className="project-window project-window--paged">
        <header className="project-window-header">
          <div className="project-window-controls" aria-hidden="true">
            <span className="window-dot window-dot--close" />
            <span className="window-dot window-dot--minimize" />
            <span className="window-dot window-dot--maximize" />
          </div>
          <div className="project-window-identity">
            <p className="project-window-path"><span>SEKI OS</span><span aria-hidden="true">/</span><span>{project.desktopSlot}</span><span aria-hidden="true">/</span><strong>{project.title}</strong></p>
            {project.subtitle && <p className="project-window-subtitle">{project.subtitle}</p>}
          </div>
          <span className="project-window-count" aria-live="polite">{String(pageNumber).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}</span>
        </header>

        <div className="project-paged-body">
          <aside className="project-sidebar">
            <h2>项目模块</h2>
            <nav aria-label="项目模块">
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

        <footer className="project-pager">
          <div className="project-pager-reward">
            {isLastPage && project.rewardItem && <span className="reward-note">完成后获得：{project.rewardItem.title}</span>}
          </div>
          <div className="project-pager-controls">
            <button type="button" className="project-pager-button" onClick={goPrev} disabled={!navigation.canPrev}>← 上一页</button>
            <div className="project-page-indicators" role="group" aria-label="跳转到项目模块">
              {pages.map((page, index) => {
                const selected = page.id === activePage.id;
                return <button key={page.id} type="button" className={selected ? "project-page-indicator is-active" : "project-page-indicator"} aria-label={`第 ${index + 1} 页：${page.navLabel}`} aria-current={selected ? "page" : undefined} onClick={() => navigateTo(page.id)} />;
              })}
            </div>
            <button type="button" className="project-pager-button" onClick={goNext} disabled={!navigation.canNext}>下一页 →</button>
          </div>
          <div className="project-pager-complete">
            {isLastPage && <button type="button" className="primary-button" onClick={onComplete}>完成项目</button>}
          </div>
        </footer>
      </article>
    </main>
  );
}
