import { useEffect, useMemo, useState } from "react";
import type { ContentBundle } from "../content-bundle/schema";
import { assetUrl, mediaUrl } from "../content-bundle/loader";
import { findAssetReferences } from "../lib/asset-refs";
import "./AssetLibraryEditor.css";

type Asset = ContentBundle["assets"][number];
type AssetType = Asset["type"];

export interface AssetLibraryEditorProps {
  bundle: ContentBundle;
  onUpload: (file: File) => void | Promise<void>;
  onSaveAssets: (next: Asset[]) => Promise<boolean>;
  onDeleteAsset: (id: string) => Promise<{ ok: boolean; message: string }>;
  onStatus: (message: string) => void;
}

const TYPE_LABEL: Record<AssetType, string> = { image: "图片", audio: "音频", video: "视频" };

export function AssetLibraryEditor({ bundle, onUpload, onSaveAssets, onDeleteAsset, onStatus }: AssetLibraryEditorProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AssetType>("all");
  const [editingId, setEditingId] = useState<string>();
  const [label, setLabel] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [backgroundLayout, setBackgroundLayout] = useState<"" | "cover" | "cropped">("");
  const [portraitStyle, setPortraitStyle] = useState<"" | "standard" | "white-cutout">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editing = useMemo(() => bundle.assets.find((asset) => asset.id === editingId), [bundle.assets, editingId]);
  const references = useMemo(() => (editing ? findAssetReferences(bundle, editing.id) : []), [bundle, editing]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return bundle.assets.filter((asset) => {
      if (filter !== "all" && asset.type !== filter) return false;
      if (!keyword) return true;
      return [asset.label ?? "", asset.originalName, asset.fileName, asset.id].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [bundle.assets, filter, query]);

  useEffect(() => {
    if (!editingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setEditingId(undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingId, busy]);

  const mediaFor = (asset: Asset) => assetUrl(bundle, asset.id) ?? mediaUrl(asset.id);

  const openEditor = (asset: Asset, deleteFirst = false) => {
    setEditingId(asset.id);
    setLabel(asset.label ?? "");
    setOriginalName(asset.originalName);
    setBackgroundLayout(asset.type === "image" ? asset.presentation?.backgroundLayout ?? "" : "");
    setPortraitStyle(asset.type === "image" ? asset.presentation?.portraitStyle ?? "" : "");
    setError("");
    setConfirmDelete(deleteFirst);
  };

  const closeEditor = () => {
    if (busy) return;
    setEditingId(undefined);
    setConfirmDelete(false);
  };

  const save = async () => {
    if (!editing || busy) return;
    const nextName = originalName.trim();
    if (!nextName) {
      setError("原始文件名不能为空");
      return;
    }
    let presentation = editing.presentation;
    if (editing.type === "image") {
      const nextPresentation: NonNullable<Asset["presentation"]> = {};
      if (backgroundLayout) nextPresentation.backgroundLayout = backgroundLayout;
      if (portraitStyle) nextPresentation.portraitStyle = portraitStyle;
      presentation = Object.keys(nextPresentation).length ? nextPresentation : undefined;
    }
    const nextAsset: Asset = {
      ...editing,
      label: label.trim() || undefined,
      originalName: nextName,
      fileName: nextName,
      presentation,
    };
    setBusy(true);
    setError("");
    const ok = await onSaveAssets(bundle.assets.map((asset) => (asset.id === editing.id ? nextAsset : asset)));
    setBusy(false);
    if (!ok) {
      setError("保存失败，请重试");
      return;
    }
    onStatus(`素材「${nextAsset.label ?? nextAsset.originalName}」已保存`);
    setEditingId(undefined);
    setConfirmDelete(false);
  };

  const remove = async () => {
    if (!editing || busy) return;
    if (references.length > 0) {
      setError(`该素材正被 ${references.length} 处引用，请先取消引用再删除`);
      return;
    }
    setBusy(true);
    setError("");
    const result = await onDeleteAsset(editing.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onStatus(result.message);
    setEditingId(undefined);
    setConfirmDelete(false);
  };

  return (
    <section className="asset-library editor-standalone-section">
      <div className="asset-library-heading">
        <div>
          <h2>素材库</h2>
          <p>上传后自动保存 Draft；每个素材都可以改名、预览/试听、删除。删除前会检查引用。</p>
        </div>
        <label className="asset-upload-button">
          上传素材
          <input
            type="file"
            accept="image/*,audio/*,video/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onUpload(file);
            }}
          />
        </label>
      </div>

      <div className="asset-toolbar">
        <input
          type="search"
          className="asset-search"
          placeholder="搜索名称 / 文件名 / ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="asset-filters" role="group" aria-label="素材类型筛选">
          {(["all", "image", "audio", "video"] as const).map((type) => (
            <button key={type} type="button" aria-pressed={filter === type} onClick={() => setFilter(type)}>
              {type === "all" ? `全部 ${bundle.assets.length}` : `${TYPE_LABEL[type]} ${bundle.assets.filter((asset) => asset.type === type).length}`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="editor-empty">没有匹配的素材。</p>
      ) : (
        <div className="asset-grid">
          {filtered.map((asset) => {
            const url = mediaFor(asset);
            const name = asset.label ?? asset.originalName;
            return (
              <article className="asset-card" key={asset.id}>
                <button type="button" className="asset-card-preview" onClick={() => openEditor(asset)} aria-label={`编辑 ${name}`}>
                  {asset.type === "image" && url ? (
                    <img src={url} alt="" loading="lazy" />
                  ) : (
                    <span className="asset-type-icon" aria-hidden="true">{asset.type === "audio" ? "♪" : asset.type === "video" ? "▶" : "?"}</span>
                  )}
                </button>
                <div className="asset-card-body">
                  <strong title={name}>{name}</strong>
                  <span>{TYPE_LABEL[asset.type]} · {asset.originalName}</span>
                  <code title={asset.id}>{asset.id}</code>
                </div>
                <div className="asset-card-actions">
                  <button type="button" onClick={() => openEditor(asset)}>编辑</button>
                  <button type="button" className="danger-button" onClick={() => openEditor(asset, true)}>删除</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="asset-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <div className="asset-modal" role="dialog" aria-modal="true" aria-label={`编辑素材 ${editing.label ?? editing.originalName}`}>
            <header className="asset-modal-header">
              <div>
                <small>{TYPE_LABEL[editing.type]} · {editing.mimeType}</small>
                <h3>{editing.label ?? editing.originalName}</h3>
              </div>
              <button type="button" onClick={closeEditor} disabled={busy} aria-label="关闭弹窗">×</button>
            </header>

            <div className="asset-modal-preview">
              {editing.type === "image" && <img src={mediaFor(editing)} alt={editing.label ?? editing.originalName} />}
              {editing.type === "audio" && <audio controls preload="metadata" src={mediaFor(editing)} />}
              {editing.type === "video" && <video controls preload="metadata" src={mediaFor(editing)} />}
            </div>

            <div className="asset-modal-fields">
              <label>
                显示名称
                <input value={label} placeholder={editing.originalName} onChange={(event) => setLabel(event.target.value)} />
              </label>
              <label>
                原始文件名
                <input value={originalName} onChange={(event) => setOriginalName(event.target.value)} />
              </label>
              {editing.type === "image" && (
                <>
                  <label>
                    背景显示
                    <select value={backgroundLayout} onChange={(event) => setBackgroundLayout(event.target.value as "" | "cover" | "cropped")}>
                      <option value="">默认铺满</option>
                      <option value="cover">铺满</option>
                      <option value="cropped">边缘裁切</option>
                    </select>
                  </label>
                  <label>
                    立绘处理
                    <select value={portraitStyle} onChange={(event) => setPortraitStyle(event.target.value as "" | "standard" | "white-cutout")}>
                      <option value="">原图</option>
                      <option value="standard">标准</option>
                      <option value="white-cutout">去白底并裁切</option>
                    </select>
                  </label>
                </>
              )}
              <dl className="asset-meta">
                <div><dt>ID</dt><dd><code>{editing.id}</code></dd></div>
                <div><dt>路径</dt><dd><code>{editing.path}</code></dd></div>
                <div><dt>类型</dt><dd>{editing.type} / {editing.mimeType}</dd></div>
              </dl>
            </div>

            <div className="asset-usage">
              <h4>引用位置 <span>{references.length}</span></h4>
              {references.length === 0 ? (
                <p>未被任何内容引用，可安全删除。</p>
              ) : (
                <ul>
                  {references.map((reference) => (
                    <li key={reference.path}>
                      {reference.label}
                      <code>{reference.path}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p className="asset-error" role="alert">{error}</p>}

            {confirmDelete ? (
              <div className="asset-delete-confirm">
                <p>确定删除「{editing.label ?? editing.originalName}」？此操作不可恢复。</p>
                <div>
                  <button type="button" className="danger-button" disabled={busy} onClick={() => void remove()}>确认删除</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button>
                </div>
              </div>
            ) : (
              <footer className="asset-modal-actions">
                <button type="button" className="danger-button" disabled={references.length > 0 || busy} onClick={() => setConfirmDelete(true)}>删除素材</button>
                <button type="button" className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "处理中…" : "保存修改"}</button>
                <button type="button" disabled={busy} onClick={closeEditor}>关闭</button>
              </footer>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
