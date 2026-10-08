import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ContentBundle } from "../content-bundle/schema";
import "./FolderWindow.css";

type DesktopIcon = ContentBundle["desktop"]["icons"][number];
type FolderItem = NonNullable<DesktopIcon["folder"]>["items"][number];

type FolderWindowProps = {
  title: string;
  items: FolderItem[];
  resolveAsset: (assetId: string | undefined) => string | undefined;
  onClose: () => void;
  onOpenProject: (projectId: string, fileLabel: string) => void;
  managed?: boolean;
  maximized?: boolean;
  onMinimize?: () => void;
  onToggleMaximized?: () => void;
};

function WindowIcon({ kind }: { kind: FolderItem["kind"] }) {
  if (kind === "demo") return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="25" rx="3" /><path d="M19 15.5 31 21 19 26.5Z" /><path d="M16 40h16M24 33v7" /></svg>;
  if (kind === "note") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 5h19l7 7v31H11Z" /><path d="M30 5v8h7M17 22h14M17 28h14M17 34h9" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 5h19l7 7v31H11Z" /><path d="M30 5v8h7M17 21h14M17 28h14M17 35h14" /></svg>;
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7M8.5 12h9" /></svg>;
}

export function FolderWindow({ title, items, resolveAsset, onClose, onOpenProject, managed = false, maximized = false, onMinimize, onToggleMaximized }: FolderWindowProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [search, setSearch] = useState("");
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const filteredItems = items.filter((item) => item.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    closeRef.current?.focus();
    setSelectedItemId(undefined);
  }, [title]);

  useEffect(() => {
    if (selectedItemId && !selectedItem) setSelectedItemId(undefined);
  }, [selectedItem, selectedItemId]);

  const keepFocusInWindow = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (managed || event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)");
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const openItem = (item: FolderItem) => {
    if (item.disabled) return;
    if (item.targetProjectId) { onOpenProject(item.targetProjectId, item.label); return; }
    setSelectedItemId(item.id);
  };

  return (
    <section className={`desktop-folder-layer${managed ? " desktop-folder-layer--managed" : ""}`} aria-label={`${title} 文件夹`}>
      <section className={`folder-window${maximized ? " is-maximized" : ""}`} ref={dialogRef} role="dialog" aria-modal={managed ? undefined : true} aria-labelledby={titleId} onKeyDown={keepFocusInWindow}>
        <header className="folder-window-titlebar">
          <div className="folder-window-controls">
            <button ref={closeRef} type="button" className="folder-window-control folder-window-control--close" aria-label={`关闭 ${title} 文件夹`} onClick={onClose} />
            <button type="button" className="folder-window-control folder-window-control--minimize" aria-label={`最小化 ${title} 文件夹`} onClick={onMinimize} disabled={!onMinimize} />
            <button type="button" className="folder-window-control folder-window-control--maximize" aria-label={`${maximized ? "还原" : "最大化"} ${title} 文件夹`} onClick={onToggleMaximized} disabled={!onToggleMaximized} />
          </div>
          <div className="folder-window-location">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l1.8 2H20.5v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2Z" /></svg>
            <h1 id={titleId}>{title}</h1>
          </div>
          <label className="folder-window-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="4.5" /><path d="m14 14 5 5" /></svg><input type="search" aria-label={`搜索 ${title} 文件`} placeholder="搜索文件" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedItemId(undefined); }} /></label>
        </header>

        <div className="folder-window-body">
          <aside className="folder-sidebar" aria-label="文件夹导航">
            <button type="button" className="folder-sidebar-item is-active" onClick={() => { setSelectedItemId(undefined); setSearch(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l1.8 2H20.5v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2Z" /></svg>文件列表</button>
            <span className="folder-sidebar-item">{items.length} 个文件</span>
          </aside>

          {selectedItem ? (
            <article className="folder-document-view">
              <button type="button" className="folder-back-button" onClick={() => setSelectedItemId(undefined)}><BackIcon />返回文件列表</button>
              <div className="folder-document-heading"><span className="folder-item-art">{resolveAsset(selectedItem.iconAssetId) ? <img src={resolveAsset(selectedItem.iconAssetId)} alt="" /> : <WindowIcon kind={selectedItem.kind} />}</span><div><p>文件内容</p><h2>{selectedItem.label}</h2></div></div>
              <div className="folder-document-content">{selectedItem.content.trim() ? selectedItem.content : "此文件暂未填写内容。可在内容中间层补充。"}</div>
            </article>
          ) : (
            <section className="folder-file-grid" aria-label={`${title} 中的文件`}>
              {filteredItems.map((item) => {
                const iconAsset = resolveAsset(item.iconAssetId);
                return <button key={item.id} type="button" className="folder-file-item" disabled={item.disabled} onClick={() => openItem(item)} aria-label={item.disabled ? `${item.label}，暂未开放` : `打开 ${item.label}`}>
                  <span className="folder-item-art" aria-hidden="true">{iconAsset ? <img src={iconAsset} alt="" /> : <WindowIcon kind={item.kind} />}</span>
                  <span>{item.label}</span>
                  {item.disabled && <small>暂未开放</small>}
                </button>;
              })}
              {!filteredItems.length && <p className="folder-empty" role="status">{search.trim() ? "没有匹配的文件。" : "这个文件夹暂时没有文件。"}</p>}
            </section>
          )}
        </div>
      </section>
    </section>
  );
}
