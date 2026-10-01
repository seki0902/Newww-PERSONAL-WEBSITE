import type { Project } from "../schema/content";
import type { ContentBundle } from "../content-bundle/schema";
import { assetUrl } from "../content-bundle/loader";

export function DesktopScreen({ projects, unlocked, completed, inventory, progress, onOpen, onTarot, onReset, content, preview, audioActive = true }: { projects: Project[]; unlocked: string[]; completed: string[]; inventory: string[]; progress: number; onOpen: (id: string) => void; onTarot: () => void; onReset: () => void; content?: ContentBundle; preview?: boolean; audioActive?: boolean }) {
  const wallpaper = content && assetUrl(content, content.desktop.wallpaperAssetId, Boolean(preview));
  const bgm = content && assetUrl(content, content.desktop.bgmAssetId, Boolean(preview));
  const iconList = content?.desktop.icons ?? [];
  const availableProject = projects.find((project) => project.enabled && unlocked.includes(project.id) && !completed.includes(project.id))
    ?? projects.find((project) => project.enabled && unlocked.includes(project.id));
  const openProjectArchive = () => availableProject ? onOpen(availableProject.id) : onTarot();

  return (
    <main className={`desktop-screen ${content ? "pink-desktop" : ""}`} style={wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}>
      {audioActive && bgm && <audio data-testid="desktop-bgm" src={bgm} loop autoPlay preload="metadata" />}
      <header className="desktop-header">
        <div><span className="eyebrow">{content?.desktop.systemName ?? "档案桌面"}</span><strong>{content ? "欢迎，Jenny" : `探索进度 ${progress}%`}</strong></div>
        {!content && <div className="inventory">物件 {inventory.length} · 已完成 {completed.length}/{projects.length}</div>}
        <button className="text-button" onClick={onReset}>重新开始</button>
      </header>

      <section className="desktop-icons" aria-label="项目图标">
        {iconList.map((icon) => icon.type === "project" ? (
          <button key={icon.id} className="desktop-icon unlocked" onClick={openProjectArchive}>
            <span aria-hidden="true">▣</span><b>{icon.label}</b><small>{availableProject ? "打开项目" : "抽牌解锁"}</small>
          </button>
        ) : (
          <button key={icon.id} className={`desktop-icon ${icon.locked ? "locked" : "unlocked"}`} disabled>
            <span aria-hidden="true">{icon.type === "system" ? "✦" : icon.type === "inventory" ? "◒" : "▤"}</span>
            <b>{icon.label}</b><small>{icon.locked ? "Locked" : "准备中"}</small>
          </button>
        ))}
        {projects.map((project) => {
          const isUnlocked = project.enabled && unlocked.includes(project.id);
          return (
            <button key={project.id} data-testid={project.id} className={`desktop-icon ${isUnlocked ? "unlocked" : "locked"}`} disabled={!isUnlocked} onClick={() => onOpen(project.id)}>
              <span aria-hidden="true">{isUnlocked ? "▣" : "▧"}</span>
              <b>{project.title}</b><small>{isUnlocked ? "已解锁" : "先抽牌解锁"}</small>
            </button>
          );
        })}
      </section>

      <footer className="desktop-footer">
        <button className="primary-button" onClick={openProjectArchive}>{availableProject ? "打开当前项目" : "抽牌 / 继续调查"}</button>
      </footer>
    </main>
  );
}
