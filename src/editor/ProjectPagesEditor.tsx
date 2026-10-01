import { useEffect, useMemo, useState } from "react";
import { projects } from "../content";
import type { ContentBundle } from "../content-bundle/schema";
import type { ProjectPage } from "../schema/content";

const pageKinds: NonNullable<ProjectPage["kind"]>[] = ["overview", "background", "process", "demo", "evidence", "result", "reflection", "custom"];

function orderedPages(pages: ProjectPage[]) {
  return [...pages].sort((a, b) => a.order - b.order);
}

function replacePages(bundle: ContentBundle, projectId: string, pages: ProjectPage[]): ContentBundle {
  const normalized = orderedPages(pages).map((page, index) => ({ ...page, order: index + 1 }));
  const existing = bundle.projectPages.some((config) => config.projectId === projectId);
  return {
    ...bundle,
    projectPages: existing
      ? bundle.projectPages.map((config) => config.projectId === projectId ? { projectId, pages: normalized } : config)
      : [...bundle.projectPages, { projectId, pages: normalized }],
  };
}

function blockSummary(type: string) {
  const labels: Record<string, string> = { text: "文字", image: "图片", video: "视频", metrics: "数据", comparison: "对比", interactive_demo: "交互 Demo" };
  return labels[type] ?? type;
}

export function ProjectPagesEditor({ bundle, onChange }: { bundle: ContentBundle; onChange: (bundle: ContentBundle) => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [pageId, setPageId] = useState<string>();
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  const configured = bundle.projectPages.find((config) => config.projectId === project?.id)?.pages;
  const pages = useMemo(() => orderedPages(configured ?? project?.pages ?? []), [configured, project]);
  const selected = pages.find((page) => page.id === pageId) ?? pages[0];

  useEffect(() => {
    if (selected?.id !== pageId) setPageId(selected?.id);
  }, [pageId, selected?.id]);

  if (!project) return null;

  const updatePages = (next: ProjectPage[]) => onChange(replacePages(bundle, project.id, next));
  const updatePage = (patch: Partial<ProjectPage>) => {
    if (!selected) return;
    updatePages(pages.map((page) => page.id === selected.id ? { ...page, ...patch } : page));
  };
  const addPage = () => {
    const id = `page-${Date.now()}`;
    const page: ProjectPage = { id, projectId: project.id, internalName: "新项目页面", title: "新项目页面", navLabel: "新页面", order: pages.length + 1, blockIds: [], enabled: true, kind: "custom" };
    updatePages([...pages, page]);
    setPageId(id);
  };
  const deletePage = () => {
    if (!selected) return;
    const index = pages.findIndex((page) => page.id === selected.id);
    const remaining = pages.filter((page) => page.id !== selected.id);
    updatePages(remaining);
    setPageId(remaining[Math.min(index, remaining.length - 1)]?.id);
  };
  const movePage = (direction: -1 | 1) => {
    if (!selected) return;
    const next = [...pages];
    const index = next.findIndex((page) => page.id === selected.id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updatePages(next.map((page, order) => ({ ...page, order: order + 1 })));
  };
  const toggleBlock = (blockId: string, included: boolean) => {
    if (!selected) return;
    updatePage({ blockIds: included ? [...selected.blockIds, blockId] : selected.blockIds.filter((id) => id !== blockId) });
  };
  const moveBlock = (blockId: string, direction: -1 | 1) => {
    if (!selected) return;
    const blockIds = [...selected.blockIds];
    const index = blockIds.indexOf(blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blockIds.length) return;
    [blockIds[index], blockIds[target]] = [blockIds[target], blockIds[index]];
    updatePage({ blockIds });
  };

  return (
    <section className="project-pages-editor">
      <div className="section-title">
        <div><span className="eyebrow">PROJECT CONTENT</span><h2>Project Pages</h2></div>
        <label>项目<select value={project.id} onChange={(event) => { setProjectId(event.target.value); setPageId(undefined); }}>{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      </div>
      <div className="page-editor-grid">
        <aside className="page-list">
          <button type="button" className="add-page-button" onClick={addPage}>新增 Page</button>
          {pages.map((page) => <button type="button" key={page.id} className={selected?.id === page.id ? "selected" : ""} onClick={() => setPageId(page.id)}><small>{String(page.order).padStart(2, "0")} · {page.enabled ? "启用" : "停用"}</small><b>{page.navLabel}</b><span>{page.title}</span></button>)}
          {!pages.length && <p className="editor-empty">当前项目还没有 Page。</p>}
        </aside>
        <div className="page-detail">
          {selected ? <>
            <div className="page-detail-actions"><button type="button" onClick={() => movePage(-1)} disabled={selected.order === 1}>上移</button><button type="button" onClick={() => movePage(1)} disabled={selected.order === pages.length}>下移</button><button type="button" className="danger-button" onClick={deletePage}>删除 Page</button></div>
            <label>导航名称<input value={selected.navLabel} onChange={(event) => updatePage({ navLabel: event.target.value })} /></label>
            <label>页面标题<input value={selected.title} onChange={(event) => updatePage({ title: event.target.value })} /></label>
            <label>内部名称<input value={selected.internalName} onChange={(event) => updatePage({ internalName: event.target.value })} /></label>
            <label>页面类型<select value={selected.kind ?? "custom"} onChange={(event) => updatePage({ kind: event.target.value as ProjectPage["kind"] })}>{pageKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label className="check"><input type="checkbox" checked={selected.enabled} onChange={(event) => updatePage({ enabled: event.target.checked })} /> Enabled</label>
            <div className="page-blocks"><h3>Page Blocks</h3><p>勾选要显示的 Block；已选 Block 可调整页面内顺序。</p>{project.blocks.map((block) => {
              const index = selected.blockIds.indexOf(block.id);
              const included = index >= 0;
              return <div className={included ? "page-block-row is-included" : "page-block-row"} key={block.id}><label><input type="checkbox" checked={included} onChange={(event) => toggleBlock(block.id, event.target.checked)} /><span><b>{blockSummary(block.type)}</b><small>{block.id}</small></span></label>{included && <div><button type="button" aria-label={`上移 ${block.id}`} disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>↑</button><button type="button" aria-label={`下移 ${block.id}`} disabled={index === selected.blockIds.length - 1} onClick={() => moveBlock(block.id, 1)}>↓</button></div>}</div>;
            })}</div>
          </> : <p className="editor-empty">新增 Page 后可编辑页面信息和 Block。</p>}
        </div>
      </div>
    </section>
  );
}
