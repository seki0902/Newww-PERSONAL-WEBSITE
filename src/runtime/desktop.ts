import type { ContentBundle } from "../content-bundle/schema";
import type { Project } from "../schema/content";
import type { DesktopWindowState, RuntimeState } from "./persist";
import { addUnique, getEnabledProjectPages } from "./flow";

export type DesktopContent = ContentBundle["desktop"];
export type DesktopAction =
  | { type: "open-folder"; iconId: string }
  | { type: "open-document"; iconId: string; projectId: string; fileLabel: string }
  | { type: "open-progress" }
  | { type: "reveal-tarot" | "complete-tarot"; windowId: string }
  | { type: "focus" | "minimize" | "maximize" | "restore" | "close" | "read"; windowId: string }
  | { type: "navigate"; windowId: string; pageId: string };

const folderId = (iconId: string) => `folder:${iconId}`;
const documentId = (projectId: string) => `document:${projectId}`;
const tarotId = (projectId: string) => `tarot:${projectId}`;
const nextOrder = (windows: DesktopWindowState[]) => Math.max(0, ...windows.map((window) => window.order)) + 1;
const topWindow = (windows: DesktopWindowState[]) => windows.filter((window) => !window.minimized).reduce<DesktopWindowState | undefined>((top, window) => !top || window.order > top.order ? window : top, undefined);
const desktopStage = { stage: "desktop" as const, activeProjectId: undefined, activePageId: undefined, activeFolderIconId: undefined, activeFolderFileLabel: undefined };

function showFolder(windows: DesktopWindowState[], iconId: string) {
  const id = folderId(iconId);
  const existing = windows.find((window) => window.id === id);
  const shown: DesktopWindowState = { id, iconId, kind: "folder", maximized: existing?.maximized ?? false, minimized: false, order: nextOrder(windows) };
  return { desktopWindows: existing ? windows.map((window) => window.id === id ? shown : window) : [...windows, shown], focusedWindowId: id };
}

export function reduceDesktopState(state: RuntimeState, action: DesktopAction, projects: Project[], desktop: DesktopContent): Partial<RuntimeState> {
  const windows = state.desktopWindows ?? [];
  if (action.type === "open-progress") {
    const id = "desktop-progress";
    const existing = windows.find((window) => window.id === id);
    const shown: DesktopWindowState = { id, iconId: id, kind: "progress", minimized: false, maximized: existing?.maximized ?? false, order: nextOrder(windows) };
    return { ...desktopStage, desktopWindows: existing ? windows.map((window) => window.id === id ? shown : window) : [...windows, shown], focusedWindowId: id };
  }
  if (action.type === "open-folder") {
    const icon = desktop.icons.find((icon) => icon.id === action.iconId);
    if (!icon || icon.locked) return {};
    const project = projects.find(project => project.id === icon.projectId && project.enabled);
    const file = project && icon.folder.items.find(file => !file.disabled && file.targetProjectId === project.id);
    if (project && file && !state.unlockedProjectIds.includes(project.id) && !windows.some(window => window.kind === "document" && window.projectId === project.id)) {
      return reduceDesktopState(state, { type: "open-document", iconId: icon.id, projectId: project.id, fileLabel: file.label }, projects, desktop);
    }
    return { ...desktopStage, ...showFolder(windows, icon.id) };
  }
  if (action.type === "open-document") {
    const icon = desktop.icons.find((icon) => icon.id === action.iconId);
    const file = icon?.folder.items.find((file) => !file.disabled && file.targetProjectId === action.projectId && file.label === action.fileLabel);
    const project = projects.find((project) => project.id === action.projectId && project.enabled);
    if (!icon || icon.locked || !file || !project) return {};
    const existingDocument = windows.find((window) => window.id === documentId(project.id) && window.kind === "document");
    const needsTarot = !state.unlockedProjectIds.includes(project.id) && !existingDocument;
    const id = needsTarot ? tarotId(project.id) : documentId(project.id);
    const existing = windows.find((window) => window.id === id);
    const common = { id, iconId: icon.id, projectId: project.id, fileLabel: file.label, minimized: false, maximized: existing?.maximized ?? false, order: nextOrder(windows) };
    const shown: DesktopWindowState = needsTarot ? { ...common, kind: "tarot", revealed: existing?.kind === "tarot" ? existing.revealed : false } : {
      ...common,
      id, kind: "document", iconId: icon.id, projectId: project.id, fileLabel: file.label,
      pageId: file.targetPageId && (existing?.kind !== "document" || existing.fileLabel !== file.label) ? getEnabledProjectPages(project).find((page) => page.id === file.targetPageId)?.id ?? getEnabledProjectPages(project)[0]?.id : existing?.kind === "document" ? existing.pageId : getEnabledProjectPages(project)[0]?.id,
      minimized: false, maximized: existing?.maximized ?? false, order: nextOrder(windows),
    };
    const documents = existing ? windows.map((window) => window.id === id ? shown : window) : [...windows, shown];
    return { ...desktopStage, desktopWindows: documents.map((window) => window.kind === "folder" && window.iconId === icon.id ? { ...window, minimized: true } : window), focusedWindowId: id };
  }

  const window = windows.find((window) => window.id === action.windowId);
  if (!window) return {};
  if (action.type === "reveal-tarot" || action.type === "complete-tarot") {
    if (window.kind !== "tarot") return {};
    if (action.type === "reveal-tarot") return { desktopWindows: windows.map((entry) => entry.id === window.id ? { ...window, revealed: true } : entry) };
    const project = projects.find((project) => project.id === window.projectId && project.enabled);
    if (!project || !window.revealed) return {};
    const id = documentId(project.id);
    const targetPageId = desktop.icons.find((icon) => icon.id === window.iconId)?.folder.items.find((file) => file.targetProjectId === project.id && file.label === window.fileLabel)?.targetPageId;
    const shown: DesktopWindowState = { ...window, kind: "document", id, pageId: getEnabledProjectPages(project).find((page) => page.id === targetPageId)?.id ?? getEnabledProjectPages(project)[0]?.id, order: nextOrder(windows) };
    return { ...desktopStage, desktopWindows: windows.map((entry) => entry.id === window.id ? shown : entry), focusedWindowId: id, unlockedProjectIds: addUnique(state.unlockedProjectIds, project.id), completedTarotIds: addUnique(state.completedTarotIds, project.tarot.id) };
  }
  if (action.type === "navigate") {
    if (window.kind !== "document") return {};
    const project = projects.find((project) => project.id === window.projectId && project.enabled);
    if (!project || !getEnabledProjectPages(project).some((page) => page.id === action.pageId)) return {};
    return { desktopWindows: windows.map((entry) => entry.id === window.id ? { ...entry, pageId: action.pageId } : entry) };
  }
  if (action.type === "minimize") {
    const updated = windows.map((entry) => entry.id === window.id ? { ...entry, minimized: true } : entry);
    return { desktopWindows: updated, focusedWindowId: topWindow(updated)?.id };
  }
  if (action.type === "focus" || action.type === "restore" || action.type === "maximize") {
    if (action.type === "focus" && state.focusedWindowId === window.id && !window.minimized) return {};
    return {
      desktopWindows: windows.map((entry) => entry.id === window.id ? { ...entry, minimized: false, maximized: action.type === "maximize" ? !entry.maximized : entry.maximized, order: nextOrder(windows) } : entry),
      focusedWindowId: window.id,
    };
  }
  if (action.type === "close" || action.type === "read") {
    const remaining = windows.filter((entry) => entry.id !== window.id);
    let update: Partial<RuntimeState> = { desktopWindows: remaining, focusedWindowId: topWindow(remaining)?.id };
    if (window.kind === "document" || window.kind === "tarot") {
      const icon = desktop.icons.find((icon) => icon.id === window.iconId && !icon.locked);
      if (icon && window.kind === "document") update = showFolder(remaining, icon.id);
      if (action.type === "read" && window.kind === "document") {
        const desktopId = state.selectedDesktopId;
        if (desktopId) update.desktopReadProjectIds = { ...state.desktopReadProjectIds, [desktopId]: addUnique(state.desktopReadProjectIds?.[desktopId] ?? [], window.projectId) };
        const project = projects.find((project) => project.id === window.projectId);
        update.completedProjectIds = addUnique(state.completedProjectIds, window.projectId);
        if (project?.rewardItem) update.inventoryItemIds = addUnique(state.inventoryItemIds, project.rewardItem.id);
      }
    }
    return { ...desktopStage, ...update };
  }
  return {};
}

export function reconcileDesktopState(state: RuntimeState, projects: Project[], desktop: DesktopContent): Partial<RuntimeState> {
  const seen = new Set<string>();
  const windows: DesktopWindowState[] = [];
  for (const saved of state.desktopWindows ?? []) {
    if (saved.kind === "progress") { if (!seen.has("desktop-progress")) windows.push({ ...saved, id: "desktop-progress" }); seen.add("desktop-progress"); continue; }
    const aliases: Record<string, string> = { "aisi-career": "full-funnel", "halo-community": "research", "portrait-business": "global" };
    const iconId = desktop.icons.some((icon) => icon.id === saved.iconId) ? saved.iconId : aliases[saved.iconId] ?? saved.iconId;
    const window = { ...saved, iconId, id: saved.kind === "folder" ? folderId(iconId) : saved.kind === "document" ? documentId(saved.projectId) : tarotId(saved.projectId) };
    if (seen.has(window.id)) continue;
    const icon = desktop.icons.find((icon) => icon.id === window.iconId && !icon.locked);
    if (!icon) continue;
    if (window.kind === "document" || window.kind === "tarot") {
      const project = projects.find((project) => project.id === window.projectId && project.enabled);
      const file = icon.folder.items.find((file) => !file.disabled && file.targetProjectId === window.projectId);
      if (!project || !file) continue;
      const pages = getEnabledProjectPages(project);
      windows.push(window.kind === "document" ? { ...window, fileLabel: file.label, pageId: pages.some((page) => page.id === window.pageId) ? window.pageId : pages[0]?.id } : { ...window, fileLabel: file.label });
    } else windows.push(window);
    seen.add(window.id);
  }
  let update: Partial<RuntimeState> = { desktopWindows: windows, focusedWindowId: windows.some((window) => window.id === state.focusedWindowId && !window.minimized) ? state.focusedWindowId : topWindow(windows)?.id };

  // Older saves used the active folder as both an open window and a document owner.
  if (state.stage === "project" && state.activeFolderIconId && state.activeProjectId) {
    const source = desktop.icons.find((icon) => !icon.locked && icon.folder.items.some((file) => !file.disabled && file.targetProjectId === state.activeProjectId));
    const project = projects.find((project) => project.id === state.activeProjectId && project.enabled);
    if (source && project) {
      const file = source.folder.items.find((file) => !file.disabled && file.targetProjectId === project.id)!;
      const openedFolder = reduceDesktopState({ ...state, ...update, unlockedProjectIds: addUnique(state.unlockedProjectIds, project.id) }, { type: "open-folder", iconId: source.id }, projects, desktop);
      update = { ...update, ...openedFolder, ...reduceDesktopState({ ...state, ...update, ...openedFolder, unlockedProjectIds: addUnique(state.unlockedProjectIds, project.id) }, { type: "open-document", iconId: source.id, projectId: project.id, fileLabel: file.label }, projects, desktop) };
      update.desktopWindows = update.desktopWindows?.map((window) => window.kind === "document" && window.projectId === project.id ? { ...window, pageId: getEnabledProjectPages(project).some((page) => page.id === state.activePageId) ? state.activePageId : window.pageId } : window);
    } else update = { ...update, ...desktopStage };
  } else if (state.stage === "desktop" && state.activeFolderIconId) {
    update = { ...update, ...desktopStage, ...reduceDesktopState({ ...state, ...update }, { type: "open-folder", iconId: state.activeFolderIconId }, projects, desktop) };
  } else if (["project", "tarot"].includes(state.stage) && !projects.some((project) => project.id === state.activeProjectId && project.enabled)) {
    update = { ...update, ...desktopStage };
  }
  return update;
}
