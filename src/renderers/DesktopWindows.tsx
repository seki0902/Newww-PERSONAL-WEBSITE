import type { ContentBundle } from "../content-bundle/schema";
import type { Project } from "../schema/content";
import { getProjectPageNavigation } from "../runtime/flow";
import { useRuntimeStore } from "../runtime/store";
import { FolderWindow } from "./FolderWindow";
import { ProjectScreen } from "./ProjectScreen";
import { TarotScreen } from "./TarotScreen";
import { DesktopProgressWindow } from "./DesktopProgressWindow";
import "./DesktopWindows.css";

export function DesktopWindows({ desktop, projects, resolveAsset, muted }: { desktop: ContentBundle["desktop"]; projects: Project[]; resolveAsset: (id: string | undefined) => string | undefined; muted: boolean }) {
  const windows = useRuntimeStore((state) => state.desktopWindows);
  const focusedWindowId = useRuntimeStore((state) => state.focusedWindowId);
  const act = useRuntimeStore((state) => state.desktopWindowAction);
  const read = useRuntimeStore((state) => state.desktopReadProjectIds?.[state.selectedDesktopId ?? ""]);
  const unlocked = useRuntimeStore((state) => state.unlockedProjectIds);
  const collected = useRuntimeStore((state) => state.completedTarotIds);
  const ordered = [...(windows ?? [])].sort((a, b) => a.order - b.order);
  // A document returns to its owning folder on close; that folder's temporary
  // minimized shortcut must not cover the document's reading controls.
  const minimized = ordered.filter((entry) => entry.minimized && !(entry.kind === "folder" && ordered.some((child) => child.iconId === entry.iconId && !child.minimized && (child.kind === "document" || child.kind === "tarot"))));
  const focusWindow = (id: string | undefined, iconId?: string) => window.requestAnimationFrame(() => {
    const root = id ? document.getElementById(`desktop-window-${id}`) : undefined;
    const control = root?.querySelector<HTMLButtonElement>("button[aria-label^='关闭']")
      ?? (iconId === "desktop-progress" ? document.querySelector<HTMLButtonElement>("[data-testid='desktop-progress']") : iconId ? document.querySelector<HTMLButtonElement>(`[data-icon-id='${CSS.escape(iconId)}']`) : undefined);
    control?.focus();
  });
  const close = (windowId: string, iconId: string, read = false) => {
    act({ type: read ? "read" : "close", windowId });
    focusWindow(useRuntimeStore.getState().focusedWindowId, iconId);
  };

  return <>
    {(windows ?? []).map((entry) => {
      const icon = desktop.icons.find((icon) => icon.id === entry.iconId);
      if (!icon && entry.kind !== "progress") return null;
      const project = entry.kind === "document" || entry.kind === "tarot" ? projects.find((project) => project.id === entry.projectId) : undefined;
      const navigation = project && entry.kind === "document" ? getProjectPageNavigation(project, entry.pageId) : undefined;
      const items = icon?.folder.items.map((item) => ({ ...item, disabled: item.disabled || Boolean(item.targetProjectId && !projects.some((project) => project.id === item.targetProjectId && project.enabled)) })) ?? [];
      const minimize = () => { act({ type: "minimize", windowId: entry.id }); focusWindow(useRuntimeStore.getState().focusedWindowId, entry.iconId); };
      return <div key={entry.id} id={`desktop-window-${entry.id}`} hidden={entry.minimized} className="desktop-managed-window" data-window-id={entry.id} data-focused={focusedWindowId === entry.id} style={{ zIndex: 10 + ordered.findIndex((window) => window.id === entry.id) }} onPointerDownCapture={() => act({ type: "focus", windowId: entry.id })} onFocusCapture={() => act({ type: "focus", windowId: entry.id })}>
        {entry.kind === "progress" ? <DesktopProgressWindow projects={projects} desktop={desktop} read={read ?? []} unlocked={unlocked} collected={collected} maximized={entry.maximized} onClose={() => close(entry.id, entry.iconId)} onMinimize={minimize} onMaximize={() => act({ type: "maximize", windowId: entry.id })} onOpenProject={(iconId) => { act({ type: "close", windowId: entry.id }); act({ type: "open-folder", iconId }); }} />
          : entry.kind === "tarot" && project ? <TarotScreen project={project} muted={muted} drawSound={resolveAsset(desktop.tarotSoundAssetId ?? desktop.clickSoundAssetId)} embedded managed maximized={entry.maximized} revealed={entry.revealed ?? false} onReveal={() => act({ type: "reveal-tarot", windowId: entry.id })} onComplete={() => act({ type: "complete-tarot", windowId: entry.id })} onClose={() => close(entry.id, entry.iconId)} onMinimize={minimize} onMaximize={() => act({ type: "maximize", windowId: entry.id })} />
          : entry.kind === "folder" && icon
          ? <FolderWindow title={icon.label} items={items} resolveAsset={resolveAsset} onClose={() => close(entry.id, icon.id)} onOpenProject={(projectId, fileLabel) => act({ type: "open-document", iconId: icon.id, projectId, fileLabel })} managed maximized={entry.maximized} onMinimize={() => { act({ type: "minimize", windowId: entry.id }); focusWindow(useRuntimeStore.getState().focusedWindowId, icon.id); }} onToggleMaximized={() => act({ type: "maximize", windowId: entry.id })} />
          : project && navigation && entry.kind === "document" && icon ? <ProjectScreen
            project={{ ...project, presentation: "report", finalAction: project.finalAction?.label === "阅读完毕" ? { ...project.finalAction, disabled: false } : project.finalAction }}
            activePageId={entry.pageId} folderTitle={icon.label} fileTitle={entry.fileLabel} embedded modal={false} maximized={entry.maximized}
            resolveAsset={resolveAsset} onClose={() => close(entry.id, icon.id)} onComplete={() => close(entry.id, icon.id, true)}
            onGotoPage={(pageId) => act({ type: "navigate", windowId: entry.id, pageId })}
            onNextPage={() => { if (navigation.canNext) act({ type: "navigate", windowId: entry.id, pageId: navigation.pages[navigation.currentIndex + 1].id }); }}
            onPrevPage={() => { if (navigation.canPrev) act({ type: "navigate", windowId: entry.id, pageId: navigation.pages[navigation.currentIndex - 1].id }); }}
            onMinimize={() => { act({ type: "minimize", windowId: entry.id }); focusWindow(useRuntimeStore.getState().focusedWindowId, icon.id); }} onToggleMaximized={() => act({ type: "maximize", windowId: entry.id })}
          /> : null}
      </div>;
    })}
    {minimized.length > 0 && <nav className="desktop-minimized-tray" aria-label="最小化的窗口">{minimized.map((entry) => {
      const title = entry.kind === "progress" ? "探索进度" : entry.kind === "folder" ? `${desktop.icons.find((icon) => icon.id === entry.iconId)?.label} 文件夹` : `${entry.kind === "tarot" ? "抽牌 · " : ""}${projects.find((project) => project.id === entry.projectId)?.title}`;
      return <button key={entry.id} type="button" aria-label={`还原 ${title}`} onClick={() => { act({ type: "restore", windowId: entry.id }); focusWindow(entry.id); }}>{title}<span aria-hidden="true"> ↑</span></button>;
    })}</nav>}
  </>;
}
