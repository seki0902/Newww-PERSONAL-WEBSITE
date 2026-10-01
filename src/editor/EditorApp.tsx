import { useEffect, useMemo, useState } from "react";
import { contentBundleSchema, validateContentBundle, type ContentBundle, type IntroScene } from "../content-bundle/schema";
import { projects as baseProjects } from "../content";
import { ProjectPagesEditor } from "./ProjectPagesEditor";
import "./EditorApp.css";

const api = "http://127.0.0.1:4174/api";
const blankScene = (): IntroScene => ({ id: `scene-${Date.now()}`, order: 1, enabled: true, speaker: "", text: "请输入对话", characterPosition: "right" });

const editorSections = [
  { id: "intro", label: "开场剧情", detail: "场景、人物与对话" },
  { id: "onboarding", label: "新人引导", detail: "开机后的两页欢迎弹窗" },
  { id: "desktop", label: "桌面系统", detail: "桌面名称、壁纸与图标" },
  { id: "projects", label: "项目页面", detail: "项目内容页与区块" },
  { id: "assets", label: "素材库", detail: "图片、音频与视频" },
  { id: "settings", label: "全局设置", detail: "开场音效与打字速度" },
] as const;

type EditorSection = (typeof editorSections)[number]["id"];

export function EditorApp() {
  const [bundle, setBundle] = useState<ContentBundle>();
  const [selectedId, setSelectedId] = useState<string>();
  const [activeSection, setActiveSection] = useState<EditorSection>("intro");
  const [status, setStatus] = useState("正在读取 Draft…");
  const [publishing, setPublishing] = useState(false);
  const selected = useMemo(() => bundle?.intro.scenes.find((scene) => scene.id === selectedId) ?? bundle?.intro.scenes[0], [bundle, selectedId]);
  const backgroundAsset = bundle?.assets.find((asset) => asset.id === selected?.backgroundAssetId);
  const characterAsset = bundle?.assets.find((asset) => asset.id === selected?.characterAssetId);
  const activeSectionIndex = editorSections.findIndex((section) => section.id === activeSection);
  const activeSectionMeta = editorSections[activeSectionIndex];

  useEffect(() => {
    void fetch(`${api}/content`)
      .then(async (response) => { if (!response.ok) throw new Error(); return contentBundleSchema.parse(await response.json()); })
      .then((data) => { setBundle(data); setSelectedId(data.intro.scenes[0]?.id); setStatus("Draft 已载入"); })
      .catch(() => setStatus("无法连接本地 Content Service。请先运行 npm run content:server。"));
  }, []);

  const updateScene = (patch: Partial<IntroScene>) => {
    if (!bundle || !selected) return;
    setBundle({ ...bundle, intro: { ...bundle.intro, scenes: bundle.intro.scenes.map((scene) => scene.id === selected.id ? { ...scene, ...patch } : scene) } });
  };
  const updateAssetPresentation = (assetId: string, patch: NonNullable<ContentBundle["assets"][number]["presentation"]>) => {
    setBundle((latest) => latest ? { ...latest, assets: latest.assets.map((asset) => asset.id === assetId ? { ...asset, presentation: { ...asset.presentation, ...patch } } : asset) } : latest);
  };
  const save = async () => {
    if (!bundle) return false;
    try {
      const content = validateContentBundle(bundle, baseProjects);
      const response = await fetch(`${api}/content`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
      if (!response.ok) { setStatus(`保存失败：${await response.text()}`); return false; }
      setStatus("Draft 已保存");
      return true;
    } catch (reason) {
      setStatus(`保存失败：${reason instanceof Error ? reason.message : "内容格式不正确"}`);
      return false;
    }
  };
  const preview = async () => {
    const target = window.open("about:blank", "_blank");
    if (await save()) {
      if (target) target.location.href = "/?preview=1";
      else window.open("/?preview=1", "_blank");
    } else target?.close();
  };
  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      if (!await save()) return;
      setStatus("正在发布…");
      const response = await fetch(`${api}/publish`, { method: "POST" });
      setStatus(response.ok ? "发布完成" : `发布失败：${await response.text()}`);
    } catch (reason) {
      setStatus(`发布失败：${reason instanceof Error ? reason.message : "网络连接异常"}`);
    } finally {
      setPublishing(false);
    }
  };
  const reorder = (direction: -1 | 1) => {
    if (!bundle || !selected) return;
    const scenes = [...bundle.intro.scenes].sort((a, b) => a.order - b.order);
    const index = scenes.findIndex((scene) => scene.id === selected.id);
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    setBundle({ ...bundle, intro: { ...bundle.intro, scenes: scenes.map((scene, order) => ({ ...scene, order: order + 1 })) } });
  };
  const upload = async (file?: File) => {
    if (!file || !bundle) return;
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "video";
    setStatus("正在上传素材…");
    try {
      const response = await fetch(`${api}/assets`, { method: "POST", headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name), "X-Asset-Type": type }, body: file });
      if (!response.ok) { setStatus(`上传失败：${await response.text()}`); return; }
      const asset = await response.json();
      setBundle((latest) => latest ? { ...latest, assets: [...latest.assets, asset] } : latest);
      setStatus("素材已上传，记得保存 Draft");
    } catch (reason) {
      setStatus(`上传失败：${reason instanceof Error ? reason.message : "网络连接异常"}`);
    }
  };

  if (!bundle) return <main className="editor-shell"><p>{status}</p></main>;

  const audioAssets = bundle.assets.filter((asset) => asset.type === "audio");
  const updateOnboarding = (patch: Partial<ContentBundle["onboarding"]>) => setBundle({ ...bundle, onboarding: { ...bundle.onboarding, ...patch } });
  const updateOnboardingCaption = (id: string, caption: string) => updateOnboarding({ pages: bundle.onboarding.pages.map((page) => page.id === id ? { ...page, caption } : page) });
  const updateIntroSettings = (patch: Partial<ContentBundle["intro"]["settings"]>) => setBundle({ ...bundle, intro: { ...bundle.intro, settings: { ...bundle.intro.settings, ...patch } } });
  const updateDesktop = (patch: Partial<ContentBundle["desktop"]>) => setBundle({ ...bundle, desktop: { ...bundle.desktop, ...patch } });
  const updateDesktopIcon = (id: string, patch: Partial<ContentBundle["desktop"]["icons"][number]>) => updateDesktop({ icons: bundle.desktop.icons.map((icon) => icon.id === id ? { ...icon, ...patch } : icon) });
  const moveSection = (direction: -1 | 1) => {
    const target = activeSectionIndex + direction;
    if (target >= 0 && target < editorSections.length) setActiveSection(editorSections[target].id);
  };

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div><span className="eyebrow">LOCAL EDITOR LITE</span><h1>内容中间层</h1></div>
        <div className="editor-actions"><button disabled={publishing} onClick={() => void save()}>保存 Draft</button><button disabled={publishing} onClick={() => void preview()}>预览</button><button disabled={publishing} className="publish-button" onClick={() => void publish()}>发布</button></div>
      </header>
      <p className="editor-status">{status}</p>
      <div className="editor-workspace">
        <nav className="editor-directory" aria-label="内容目录">
          <span className="editor-directory-label">CONTENT DIRECTORY</span>
          {editorSections.map((section, index) => <button key={section.id} type="button" data-testid={`editor-section-${section.id}`} className={activeSection === section.id ? "selected" : ""} onClick={() => setActiveSection(section.id)}><small>{String(index + 1).padStart(2, "0")}</small><b>{section.label}</b><span>{section.detail}</span></button>)}
        </nav>
        <section className="editor-panel" aria-labelledby="editor-panel-title">
          <header className="editor-panel-header">
            <div><span className="eyebrow">{String(activeSectionIndex + 1).padStart(2, "0")} / {String(editorSections.length).padStart(2, "0")}</span><h2 id="editor-panel-title">{activeSectionMeta.label}</h2><p>{activeSectionMeta.detail}</p></div>
            <div className="editor-panel-navigation"><button type="button" onClick={() => moveSection(-1)} disabled={activeSectionIndex === 0}>← 上一页</button><button type="button" onClick={() => moveSection(1)} disabled={activeSectionIndex === editorSections.length - 1}>下一页 →</button></div>
          </header>

          {activeSection === "intro" && <div className="editor-grid editor-grid--story">
            <aside className="scene-list">
              <div className="section-title"><h2>开场场景</h2><button type="button" onClick={() => { const scene = blankScene(); setBundle({ ...bundle, intro: { ...bundle.intro, scenes: [...bundle.intro.scenes, { ...scene, order: bundle.intro.scenes.length + 1 }] } }); setSelectedId(scene.id); }}>新增场景</button></div>
              {[...bundle.intro.scenes].sort((a, b) => a.order - b.order).map((scene) => <button type="button" key={scene.id} className={selected?.id === scene.id ? "selected" : ""} onClick={() => setSelectedId(scene.id)}><small>{scene.order.toString().padStart(2, "0")} · {scene.enabled ? "启用" : "停用"}</small><b>{scene.speaker || "无 Speaker"}</b><span>{scene.text.slice(0, 34)}</span></button>)}
            </aside>
            <section className="scene-editor">
              <h2>场景编辑</h2>
              {selected && <>
                <label>说话人<input value={selected.speaker ?? ""} onChange={(event) => updateScene({ speaker: event.target.value })} /></label>
                <label>对话文字<textarea value={selected.text} onChange={(event) => updateScene({ text: event.target.value })} /></label>
                <label>背景<select value={selected.backgroundAssetId ?? ""} onChange={(event) => updateScene({ backgroundAssetId: event.target.value || undefined })}><option value="">无</option>{bundle.assets.filter((asset) => asset.type === "image").map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
                {backgroundAsset && <label>背景显示<select aria-label="背景显示" value={backgroundAsset.presentation?.backgroundLayout ?? "cover"} onChange={(event) => updateAssetPresentation(backgroundAsset.id, { backgroundLayout: event.target.value as "cover" | "cropped" })}><option value="cover">默认铺满</option><option value="cropped">边缘裁切</option></select><small>作用于使用同一素材的所有场景</small></label>}
                <label>人物<select value={selected.characterAssetId ?? ""} onChange={(event) => updateScene({ characterAssetId: event.target.value || undefined })}><option value="">无（内心独白）</option>{bundle.assets.filter((asset) => asset.type === "image").map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
                {characterAsset && <label>立绘处理<select aria-label="立绘处理" value={characterAsset.presentation?.portraitStyle ?? "standard"} onChange={(event) => updateAssetPresentation(characterAsset.id, { portraitStyle: event.target.value as "standard" | "white-cutout" })}><option value="standard">原图</option><option value="white-cutout">去白底并裁切</option></select><small>作用于使用同一素材的所有场景</small></label>}
                <label>人物位置<select value={selected.characterPosition ?? "right"} onChange={(event) => updateScene({ characterPosition: event.target.value as IntroScene["characterPosition"] })}><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></label>
                <label className="check"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateScene({ enabled: event.target.checked })} /> 启用</label>
                <div className="order-actions"><button type="button" onClick={() => reorder(-1)}>上移</button><button type="button" onClick={() => reorder(1)}>下移</button></div>
              </>}
            </section>
          </div>}

          {activeSection === "onboarding" && <section className="onboarding-editor editor-standalone-section">
            <div className="editor-section-intro"><h3>新人引导弹窗</h3><p>这里的文字和音效会直接显示在开机动画后的 Canva 风格弹窗中；保存后可用预览检查效果。</p></div>
            <label>窗口标题<input value={bundle.onboarding.title} onChange={(event) => updateOnboarding({ title: event.target.value })} /></label>
            <div className="onboarding-page-fields">{bundle.onboarding.pages.map((page, index) => <label key={page.id}>第 {index + 1} 页字幕<textarea value={page.caption} onChange={(event) => updateOnboardingCaption(page.id, event.target.value)} /></label>)}</div>
            <div className="editor-two-columns">
              <label>开始按钮文字<input value={bundle.onboarding.buttonLabel} onChange={(event) => updateOnboarding({ buttonLabel: event.target.value })} /></label>
              <label>底部提示文字<input value={bundle.onboarding.hint} onChange={(event) => updateOnboarding({ hint: event.target.value })} /></label>
            </div>
            <label>字幕打字速度（毫秒 / 字）<input type="number" min="1" value={bundle.onboarding.typewriterSpeed} onChange={(event) => updateOnboarding({ typewriterSpeed: Number(event.target.value) })} /></label>
            <div className="editor-two-columns">
              <label>弹窗打开音效<select value={bundle.onboarding.openSoundAssetId ?? ""} onChange={(event) => updateOnboarding({ openSoundAssetId: event.target.value || undefined })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
              <label>猫咪呼噜音效<select value={bundle.onboarding.purrSoundAssetId ?? ""} onChange={(event) => updateOnboarding({ purrSoundAssetId: event.target.value || undefined })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
            </div>
          </section>}

          {activeSection === "desktop" && <section className="desktop-editor editor-standalone-section">
            <label>系统名称<input value={bundle.desktop.systemName} onChange={(event) => updateDesktop({ systemName: event.target.value })} /></label>
            <label>桌面壁纸<select value={bundle.desktop.wallpaperAssetId ?? ""} onChange={(event) => updateDesktop({ wallpaperAssetId: event.target.value || undefined })}><option value="">无</option>{bundle.assets.filter((asset) => asset.type === "image").map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
            <label>桌面探索 BGM<select value={bundle.desktop.bgmAssetId ?? ""} onChange={(event) => updateDesktop({ bgmAssetId: event.target.value || undefined })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
            <div className="desktop-icon-editor"><h3>桌面图标</h3>{bundle.desktop.icons.map((icon) => <div key={icon.id} className="desktop-icon-field"><label>{icon.type}<input value={icon.label} onChange={(event) => updateDesktopIcon(icon.id, { label: event.target.value })} /></label><label className="check"><input type="checkbox" checked={icon.locked} onChange={(event) => updateDesktopIcon(icon.id, { locked: event.target.checked })} /> 锁定</label></div>)}</div>
          </section>}

          {activeSection === "projects" && <ProjectPagesEditor bundle={bundle} onChange={setBundle} />}

          {activeSection === "assets" && <section className="asset-library editor-standalone-section"><h2>素材库</h2><label className="upload-label">上传素材<input type="file" accept="image/*,audio/*,video/*" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>{bundle.assets.map((asset) => <div className="asset-item" key={asset.id}><small>{asset.type}</small><b>{asset.label ?? asset.originalName}</b><span>{asset.id}</span></div>)}</section>}

          {activeSection === "settings" && <section className="settings-editor editor-standalone-section">
            <h2>开场设置</h2>
            <label>进入桌面前 BGM<select value={bundle.intro.settings.bgmAssetId ?? ""} onChange={(event) => updateIntroSettings({ bgmAssetId: event.target.value || undefined })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
            <label>BGM 音量<input type="number" min="0" max="1" step="0.05" value={bundle.intro.settings.bgmVolume ?? 0.24} onChange={(event) => updateIntroSettings({ bgmVolume: Number(event.target.value) })} /></label>
            <label>开场字幕打字速度<input type="number" min="1" value={bundle.intro.settings.typewriterSpeed ?? 28} onChange={(event) => updateIntroSettings({ typewriterSpeed: Number(event.target.value) })} /></label>
            <label>文字音效间隔<input type="number" min="1" value={bundle.intro.settings.textSoundInterval ?? 4} onChange={(event) => updateIntroSettings({ textSoundInterval: Number(event.target.value) })} /></label>
            <label>字幕音效<select value={bundle.intro.settings.textSoundAssetId ?? ""} onChange={(event) => updateIntroSettings({ textSoundAssetId: event.target.value || undefined })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
            <label>点击音效<select value={bundle.intro.settings.clickSoundAssetId ?? ""} onChange={(event) => updateIntroSettings({ clickSoundAssetId: event.target.value || undefined })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
            <label>结尾 BGM<select value={bundle.ending.bgmAssetId ?? ""} onChange={(event) => setBundle({ ...bundle, ending: { ...bundle.ending, bgmAssetId: event.target.value || undefined } })}><option value="">无</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label ?? asset.originalName}</option>)}</select></label>
          </section>}
        </section>
      </div>
    </main>
  );
}
