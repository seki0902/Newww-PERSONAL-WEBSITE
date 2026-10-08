import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Project } from "../schema/content";
import type { ContentBundle } from "../content-bundle/schema";
import { assetUrl } from "../content-bundle/loader";
import { FolderWindow } from "./FolderWindow";
import { DesktopClock } from "./DesktopClock";
import "./DesktopScreen.css";
import "./DesktopLayout.css";

type DesktopScreenProps = {
  projects: Project[];
  unlocked: string[];
  completed: string[];
  inventory: string[];
  progress: number;
  onOpen: (id: string) => void;
  activeFolderIconId?: string;
  currentIconId?: string;
  onOpenFolder?: (iconId: string) => void;
  onCloseFolder?: () => void;
  onOpenProjectFromFolder?: (projectId: string, iconId: string, fileLabel: string) => void;
  onTarot: () => void;
  onReset: () => void;
  onProgress?: () => void;
  content?: ContentBundle;
  preview?: boolean;
  audioActive?: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  readProjectIds?: string[];
  guidanceActive?: boolean;
  children?: ReactNode;
};

const referenceIcons = [
  { id: "content-agent", label: "内容Agent", asset: "asset-icon-content-agent", labelBox: [61.864, 216.722, 118.136, 24], artHeight: "79.7%", light: false },
  { id: "ads-agent", label: "投放 Agent", asset: "asset-icon-ads-agent", labelBox: [203.984, 217.141, 101.992, 24], artHeight: "81.9%", light: false },
  { id: "content-growth", label: "内容增长", asset: "asset-icon-content-growth", labelBox: [61.864, 366.341, 86.944, 24], artHeight: "81.5%", light: false },
  { id: "full-funnel", label: "全流程营销", asset: "asset-icon-full-funnel", labelBox: [203.984, 366.301, 101.992, 24], artHeight: "81.5%", light: false },
  { id: "research", label: "科研成果", asset: "asset-icon-research", labelBox: [61.864, 515.019, 86.944, 24], artHeight: "67.8%", light: true },
  { id: "global", label: "语言 & 海外", asset: "asset-icon-global", labelBox: [203.984, 515.398, 101.992, 24], artHeight: "67.8%", light: true },
  { id: "about-seki", label: "关于 SEKI", asset: "asset-icon-about", labelBox: [61.864, 665.017, 86.944, 24], artHeight: "81.5%", light: true },
  { id: "misc-media", label: "杂项 / 影音", asset: "asset-icon-media", labelBox: [203.984, 664.638, 101.992, 24], artHeight: "81.5%", light: true },
];

const referenceBox = ([left, top, width, height]: number[]): CSSProperties => ({
  left: `${left / 1672 * 100}%`, top: `${top / 941 * 100}%`,
  width: `${width / 1672 * 100}%`, height: `${height / 941 * 100}%`,
});

function DesktopGuideTrail() {
  return <svg className="desktop-guide-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <rect className="desktop-guide-trail-tail" x="1" y="1" width="98" height="98" rx="11" pathLength="100" vectorEffect="non-scaling-stroke" />
    <rect className="desktop-guide-trail-head" x="1" y="1" width="98" height="98" rx="11" pathLength="100" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function DesktopScreen({ projects, unlocked, completed, inventory, progress, onOpen, activeFolderIconId, currentIconId, onOpenFolder, onCloseFolder, onOpenProjectFromFolder, onTarot, onReset, onProgress, content, preview, audioActive = true, muted, onMutedChange, readProjectIds = [], guidanceActive = false, children }: DesktopScreenProps) {
  const clickSoundRef = useRef<HTMLAudioElement>(null);
  const [activeIconId, setActiveIconId] = useState<string>();
  const wallpaper = content && assetUrl(content, content.desktop.wallpaperAssetId, Boolean(preview));
  const topOverlay = content && assetUrl(content, content.desktop.wallpaperTopOverlayAssetId, Boolean(preview));
  const bottomOverlay = content && assetUrl(content, content.desktop.wallpaperBottomOverlayAssetId, Boolean(preview));
  const brandIcon = content && assetUrl(content, content.desktop.brandIconAssetId, Boolean(preview));
  const canvaReference = content && assetUrl(content, content.desktop.referenceAssetId, Boolean(preview));
  const clickSound = content && assetUrl(content, content.desktop.clickSoundAssetId, Boolean(preview));
  const iconList = content?.desktop.icons ?? [];
  const guidanceIconId = guidanceActive ? iconList.find((icon) => {
    if (icon.locked) return false;
    const targetProjectId = icon.projectId ?? icon.folder.items.find((file) => !file.disabled && file.targetProjectId)?.targetProjectId;
    const project = targetProjectId ? projects.find((candidate) => candidate.id === targetProjectId) : undefined;
    return Boolean(project?.enabled && !readProjectIds.includes(project.id) && icon.folder.items.some((file) => !file.disabled && file.targetProjectId === project.id));
  })?.id : undefined;
  const activeFolder = iconList.find((icon) => icon.id === activeFolderIconId);
  const nextProject = projects.find((project) => project.enabled && !completed.includes(project.id));
  const availableProject = projects.find((project) => project.enabled && unlocked.includes(project.id) && !completed.includes(project.id))
    ?? projects.find((project) => project.enabled && unlocked.includes(project.id));
  const openProjectArchive = () => availableProject ? onOpen(availableProject.id) : onTarot();

  const playClick = () => {
    const audio = clickSoundRef.current;
    if (!audio || muted) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const activateIcon = (icon: ContentBundle["desktop"]["icons"][number]) => {
    if (content && onOpenFolder && icon.locked) return;
    playClick();
    setActiveIconId(icon.id);
    if (content && onOpenFolder) { onOpenFolder(icon.id); return; }
    const project = icon.projectId ? projects.find((candidate) => candidate.id === icon.projectId) : undefined;
    if (project) {
      if (unlocked.includes(project.id)) onOpen(project.id);
      else if (nextProject?.id === project.id) onTarot();
      return;
    }
    if (icon.type === "project") openProjectArchive();
  };
  const folderWindow = content && activeFolder && onCloseFolder && onOpenProjectFromFolder
    ? <FolderWindow title={activeFolder.label} items={activeFolder.folder.items} resolveAsset={(assetId) => assetUrl(content, assetId, Boolean(preview))} onClose={onCloseFolder} onOpenProject={(projectId, fileLabel) => onOpenProjectFromFolder(projectId, activeFolder.id, fileLabel)} />
    : null;

  if (canvaReference) {
    return <main className="desktop-screen seki-desktop desktop-screen--canva-reference" data-testid="desktop-screen">
      {clickSound && <audio ref={clickSoundRef} data-testid="desktop-click-sound" src={clickSound} preload="auto" muted={muted} />}
      <div className="desktop-reference-canvas">
        <img className="desktop-original-artwork" data-testid="desktop-original-artwork" src={canvaReference} alt="" aria-hidden="true" />
        <header className="desktop-reference-menubar">
          <div className="desktop-reference-brand">{brandIcon && <img src={brandIcon} alt="" />}<strong>{content?.desktop.systemName ?? "SEKI OS"}</strong><i aria-hidden="true" /><span>{content?.desktop.tagline ?? "Explore. Build. Grow."}</span></div>
          <div className="desktop-reference-status">
            {audioActive && <button type="button" aria-label={muted ? "开启声音" : "关闭声音"} title={muted ? "开启声音" : "关闭声音"} onClick={() => { playClick(); onMutedChange(!muted); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d={muted ? "m17 9 5 6m0-6-5 6" : "M17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"} /></svg></button>}
            <svg className="desktop-status-battery" viewBox="0 0 28 18" aria-hidden="true"><rect x="1" y="2" width="22" height="14" rx="2" /><path d="M25 6v6" /><rect x="4" y="5" width="16" height="8" fill="currentColor" /></svg><span>100%</span><DesktopClock />
          </div>
        </header>
        <section className="desktop-reference-workspace" aria-label="项目图标">
          {iconList.map((icon, index) => {
            const originalIndex = referenceIcons.findIndex((source) => source.id === icon.id);
            const positionIndex = originalIndex >= 0 ? originalIndex : index;
            const position = referenceBox([39 + positionIndex % 2 * 149, 98 + Math.floor(positionIndex / 2) * 149, 140, 142]);
            const project = icon.projectId ? projects.find((candidate) => candidate.id === icon.projectId) : undefined;
            const actionable = content && onOpenFolder ? !icon.locked : Boolean(project && (unlocked.includes(project.id) || nextProject?.id === project.id));
            const image = content && assetUrl(content, icon.iconAssetId, Boolean(preview));
            return <button key={icon.id} type="button" data-testid={project?.id ?? `desktop-icon-${icon.id}`} data-icon-id={icon.id} aria-current={currentIconId === icon.id ? "true" : undefined} className={`desktop-reference-icon${guidanceIconId === icon.id ? " is-guide" : ""}${currentIconId === icon.id ? " is-current" : ""}${originalIndex >= 0 && icon.iconAssetId === referenceIcons[originalIndex].asset ? " is-original-art" : ""}${positionIndex >= 4 ? " is-light-label" : ""}${activeIconId === icon.id ? " is-activating" : ""}`} style={position} aria-label={`${icon.label}，${actionable ? "打开文件夹" : "暂未开放"}`} title={`${icon.label}，${actionable ? "打开文件夹" : "暂未开放"}`} disabled={!actionable} aria-disabled={!actionable} onClick={() => activateIcon(icon)} onAnimationEnd={() => setActiveIconId((current) => current === icon.id ? undefined : current)}>
              <span className="desktop-reference-icon-art">{image ? <img src={image} alt="" /> : <span aria-hidden="true">▣</span>}</span><b>{icon.label}</b>{guidanceIconId === icon.id && <DesktopGuideTrail />}
            </button>;
          })}
        </section>
        <footer className="desktop-reference-taskbar">
          <div className="desktop-reference-footer-brand"><button type="button" aria-label="重置探索进度" title="重置探索进度" onClick={() => { playClick(); onReset(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><rect x="14" y="14" width="8" height="8" rx="1" /></svg></button><i aria-hidden="true" /><span>{content?.desktop.footerSlogan ?? "A more interesting me."}</span></div>
          <button className="desktop-reference-progress-button" data-testid="desktop-progress" type="button" aria-label={`查看探索进度，${progress}%`} onClick={() => { playClick(); onProgress?.(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h7l2 2h11v12H2Z" /></svg>{content?.desktop.progressLabel ?? "探索进度"} {progress}%</button>
        </footer>
        {children ? <section className="desktop-window-layer" aria-label="桌面探索窗口">{children}</section> : null}
        {folderWindow}
      </div>
    </main>;
  }

  return (
    <main className={`desktop-screen ${content ? "seki-desktop" : ""}`} data-testid="desktop-screen">
      {clickSound && <audio ref={clickSoundRef} data-testid="desktop-click-sound" src={clickSound} preload="auto" muted={muted} />}
      <div className="desktop-wallpaper" style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined} aria-hidden="true">
        {topOverlay && <img className="desktop-wallpaper-overlay desktop-wallpaper-overlay--top" src={topOverlay} alt="" />}
        {bottomOverlay && <img className="desktop-wallpaper-overlay desktop-wallpaper-overlay--bottom" src={bottomOverlay} alt="" />}
      </div>

      <header className="desktop-menubar">
        <div className="desktop-brand">
          {brandIcon ? <img src={brandIcon} alt="" aria-hidden="true" /> : <span aria-hidden="true">⌁</span>}
          <strong>{content?.desktop.systemName ?? "档案桌面"}</strong>
          <i aria-hidden="true" />
          <span>{content?.desktop.tagline ?? "Explore. Build. Grow."}</span>
        </div>
        <div className="desktop-status" aria-label="系统状态">
          <span aria-hidden="true">⌁</span><span aria-hidden="true">↯</span><span aria-hidden="true">▰</span><span>100%</span>
          <DesktopClock />
          <span aria-hidden="true">⌕</span>
        </div>
      </header>

      <section className="desktop-workspace" aria-label="项目图标">
        <div className="desktop-icons">
          {iconList.map((icon) => {
            const project = icon.projectId ? projects.find((candidate) => candidate.id === icon.projectId) : undefined;
            const isUnlocked = Boolean(project && unlocked.includes(project.id));
            const isCompleted = Boolean(project && completed.includes(project.id));
            const canUnlock = Boolean(project && nextProject?.id === project.id);
            const isFolderEntry = Boolean(content && onOpenFolder);
            const isActionable = isFolderEntry ? !icon.locked : icon.type === "project" && (!project || isUnlocked || canUnlock);
            const image = content && assetUrl(content, icon.iconAssetId, Boolean(preview));
            const state = isFolderEntry ? icon.locked ? "暂未开放" : "打开文件夹" : isCompleted ? "已完成" : isUnlocked ? "已解锁" : canUnlock ? "点击抽牌解锁" : icon.locked ? "暂未开放" : "可打开";
            return (
              <button
                key={icon.id}
                type="button"
                data-testid={project?.id ?? `desktop-icon-${icon.id}`}
                data-icon-id={icon.id}
                className={`desktop-icon${guidanceIconId === icon.id ? " is-guide" : ""}${isUnlocked ? " is-unlocked" : ""}${isCompleted ? " is-completed" : ""}${activeIconId === icon.id ? " is-activating" : ""}`}
                aria-label={`${icon.label}，${state}`}
                aria-disabled={!isActionable}
                disabled={!isActionable}
                onClick={() => activateIcon(icon)}
                onAnimationEnd={() => setActiveIconId((current) => current === icon.id ? undefined : current)}
              >
                <span className="desktop-icon-art" aria-hidden={!image}>
                  {image ? <img src={image} alt={`${icon.label} 图标`} /> : <span>{icon.type === "system" ? "✦" : icon.type === "inventory" ? "◒" : "▣"}</span>}
                </span>
                <b>{icon.label}</b>{guidanceIconId === icon.id && <DesktopGuideTrail />}
              </button>
            );
          })}
          {!content && projects.map((project) => {
            const isUnlocked = project.enabled && unlocked.includes(project.id);
            return <button key={project.id} data-testid={project.id} className="desktop-icon" disabled={!isUnlocked} onClick={() => onOpen(project.id)}><b>{project.title}</b></button>;
          })}
        </div>
      </section>

      <footer className="desktop-taskbar">
        <div className="desktop-taskbar-brand"><span aria-hidden="true">⊞</span><i aria-hidden="true" /><span>{content?.desktop.footerSlogan ?? "A more interesting me."}</span></div>
        {!content && <span>物件 {inventory.length} · 已完成 {completed.length}/{projects.length}</span>}
        <div className="desktop-taskbar-actions">
          {audioActive && <button type="button" aria-label={muted ? "开启声音" : "关闭声音"} onClick={() => onMutedChange(!muted)}>{muted ? "♪×" : "♪"}</button>}
          <button type="button" aria-label="重置探索进度" onClick={onReset}>↻</button>
          <button type="button" data-testid="desktop-progress" aria-label={`查看探索进度，${progress}%`} onClick={onProgress}>{content?.desktop.progressLabel ?? "探索进度"} {progress}%</button>
        </div>
      </footer>

      {children ? <section className="desktop-window-layer" aria-label="桌面探索窗口">{children}</section> : null}
      {folderWindow}
    </main>
  );
}
