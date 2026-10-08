import { useEffect, useMemo, useState } from "react";
import type { ContentBundle } from "../content-bundle/schema";

type DesktopIcon = ContentBundle["desktop"]["icons"][number];
type FolderItem = DesktopIcon["folder"]["items"][number];

type FolderEditorProps = {
  icons: DesktopIcon[];
  assets: ContentBundle["assets"];
  projects: { id: string; title: string }[];
  onChange: (iconId: string, patch: Partial<DesktopIcon>) => void;
};

const kinds: { value: FolderItem["kind"]; label: string }[] = [
  { value: "document", label: "项目说明文件" },
  { value: "demo", label: "交互 Demo" },
  { value: "note", label: "普通说明" },
];

function createFolderItem(): FolderItem {
  return {
    id: `folder-file-${Date.now()}`,
    label: "新文件",
    content: "",
    kind: "document",
    disabled: false,
  };
}

export function FolderEditor({ icons, assets, projects, onChange }: FolderEditorProps) {
  const [selectedIconId, setSelectedIconId] = useState<string>();
  const selectedIcon = useMemo(() => icons.find((icon) => icon.id === selectedIconId) ?? icons[0], [icons, selectedIconId]);
  const imageAssets = useMemo(() => assets.filter((asset) => asset.type === "image"), [assets]);

  useEffect(() => {
    if (selectedIcon?.id !== selectedIconId) setSelectedIconId(selectedIcon?.id);
  }, [selectedIcon?.id, selectedIconId]);

  if (!selectedIcon) return null;

  const replaceItems = (items: FolderItem[]) => onChange(selectedIcon.id, { folder: { items } });
  const updateItem = (itemId: string, patch: Partial<FolderItem>) => replaceItems(selectedIcon.folder.items.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  const removeItem = (itemId: string) => replaceItems(selectedIcon.folder.items.filter((item) => item.id !== itemId));
  const moveItem = (itemId: string, direction: -1 | 1) => {
    const next = [...selectedIcon.folder.items];
    const index = next.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    replaceItems(next);
  };

  return (
    <section className="folder-editor" aria-labelledby="folder-editor-title">
      <div className="folder-editor-heading">
        <div>
          <span className="eyebrow">FOLDER CONTENT</span>
          <h3 id="folder-editor-title">图标文件夹</h3>
          <p>文件夹标题始终使用外层桌面图标的标题。这里配置点开后显示的文件、图标、标题和内容。</p>
        </div>
        <label>
          编辑图标
          <select value={selectedIcon.id} onChange={(event) => setSelectedIconId(event.target.value)}>
            {icons.map((icon) => <option key={icon.id} value={icon.id}>{icon.label}</option>)}
          </select>
        </label>
      </div>

      <div className="folder-title-preview" aria-label="当前文件夹标题">
        <span>文件夹标题</span><strong>{selectedIcon.label || "未命名图标"}</strong>
      </div>

      <div className="folder-editor-list">
        {selectedIcon.folder.items.map((item, index) => (
          <fieldset key={item.id} className="folder-item-editor">
            <legend>文件 {String(index + 1).padStart(2, "0")}</legend>
            <div className="folder-item-actions">
              <button type="button" aria-label={`上移 ${item.label}`} disabled={index === 0} onClick={() => moveItem(item.id, -1)}>↑</button>
              <button type="button" aria-label={`下移 ${item.label}`} disabled={index === selectedIcon.folder.items.length - 1} onClick={() => moveItem(item.id, 1)}>↓</button>
              <button type="button" className="danger-button" onClick={() => removeItem(item.id)}>删除</button>
            </div>
            <div className="folder-item-grid">
              <label>文件标题<input value={item.label} onChange={(event) => updateItem(item.id, { label: event.target.value })} /></label>
              <label>文件类型<select value={item.kind} onChange={(event) => updateItem(item.id, { kind: event.target.value as FolderItem["kind"] })}>{kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
              <label>文件图标<select value={item.iconAssetId ?? ""} onChange={(event) => updateItem(item.id, { iconAssetId: event.target.value || undefined })}><option value="">使用默认图标</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
              <label>打开到项目页<select value={item.targetProjectId ?? ""} onChange={(event) => updateItem(item.id, { targetProjectId: event.target.value || undefined })}><option value="">只显示本文件内容</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
            </div>
            <label className="folder-item-content">文件内容<textarea value={item.content} onChange={(event) => updateItem(item.id, { content: event.target.value })} placeholder="点击这个文件后显示的正文" /></label>
            <label className="check"><input type="checkbox" checked={item.disabled} onChange={(event) => updateItem(item.id, { disabled: event.target.checked })} /> 暂未开放</label>
          </fieldset>
        ))}
        {!selectedIcon.folder.items.length && <p className="editor-empty">这个文件夹还没有文件。添加后会显示在桌面图标点开的窗口中。</p>}
      </div>
      <button type="button" className="folder-add-button" onClick={() => replaceItems([...selectedIcon.folder.items, createFolderItem()])}>添加文件</button>
    </section>
  );
}
