import { create } from "zustand";
import { projects as baseProjects } from "../content";
import type { Block, Project } from "../schema/content";
import { currentDemoState, demoKey, initialDemoState } from "./demo";
import { addUnique, getEnabledProjectPages, getNextProject, getProjectPageNavigation } from "./flow";
import { clearRuntimeState, initialRuntimeState, restoreRuntimeState, saveRuntimeState, type DemoRuntimeState, type RuntimeState } from "./persist";
import { reconcileDesktopState, reduceDesktopState, type DesktopAction, type DesktopContent } from "./desktop";

interface RuntimeStore extends RuntimeState {
  desktopWindowAction: (action: DesktopAction) => void;
  selectDesktop: (desktopId: string) => void;
  openFolder: (iconId: string) => void; closeFolder: () => void;
  openProjectFromFolder: (projectId: string, iconId: string, fileLabel: string) => void; closeProject: () => void;
  finishIntro: () => void; finishVisualNovel: () => void; finishVideo: () => void; startTarot: (projectId: string) => void; completeTarot: (projectId: string) => void;
  openProject: (projectId: string) => void; gotoPage: (pageId: string) => void; nextPage: () => void; prevPage: () => void;
  selectDemoPreset: (projectId: string, blockId: string, presetId: string) => void;
  setDemoTopic: (projectId: string, blockId: string, topic: string) => void;
  generateDemoScript: (projectId: string, blockId: string) => void;
  editDemoScript: (projectId: string, blockId: string, script: string) => void;
  continueDemo: (projectId: string, blockId: string) => void;
  selectDemoAvatar: (projectId: string, blockId: string, avatarId: string) => void;
  selectDemoRatio: (projectId: string, blockId: string, ratioId: string) => void;
  generateDemoVideo: (projectId: string, blockId: string) => void;
  restartDemo: (projectId: string, blockId: string) => void;
  completeProject: (projectId: string) => void; resetProgress: () => void;
}
const commit = (set: (state: Partial<RuntimeStore>) => void, update: Partial<RuntimeStore>) => { set(update); saveRuntimeState({ ...useRuntimeStore.getState(), ...update }); };
type DemoBlock = Extract<Block, { type: "interactive_demo" }>;
const demoTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
let runtimeProjects: Project[] = baseProjects;
let runtimeDesktop: DesktopContent | undefined;

function getDemoBlock(projectId: string, blockId: string): DemoBlock | undefined {
  const block = runtimeProjects.find((project) => project.id === projectId)?.blocks.find((item) => item.id === blockId);
  return block?.type === "interactive_demo" ? block : undefined;
}

function clearDemoTimers(key: string) {
  for (const timer of demoTimers.get(key) ?? []) clearTimeout(timer);
  demoTimers.delete(key);
}

function scheduleDemo(key: string, delay: number, callback: () => void) {
  const timer = setTimeout(callback, delay);
  demoTimers.set(key, [...(demoTimers.get(key) ?? []), timer]);
}

function commitDemo(set: (state: Partial<RuntimeStore>) => void, get: () => RuntimeStore, key: string, state: DemoRuntimeState) {
  commit(set, { demoStates: { ...get().demoStates, [key]: state } });
}

function getRestoredState() {
  const state = restoreRuntimeState();
  const demoStates = Object.fromEntries(Object.entries(state.demoStates ?? {}).map(([key, demo]) => [key, {
    ...demo,
    phase: demo.phase === "script_generating" ? "idle" : demo.phase === "video_generating" ? "video_config" : demo.phase,
    progress: demo.phase === "video_generating" ? 0 : demo.progress,
  }])) as Record<string, DemoRuntimeState>;
  if (state.stage !== "project" || !state.activeProjectId) return { ...state, demoStates, activePageId: undefined };
  // Published pages load after the store, so reconcile against them in setRuntimeProjects.
  return { ...state, demoStates };
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  ...getRestoredState(),
  desktopWindowAction: (action) => {
    if (!runtimeDesktop) return;
    const update = reduceDesktopState(get(), action, runtimeProjects, runtimeDesktop);
    if (Object.keys(update).length) commit(set, update);
  },
  selectDesktop: (desktopId) => commit(set, { selectedDesktopId: desktopId, activeFolderIconId: undefined, activeFolderFileLabel: undefined, stage: "desktop", activeProjectId: undefined, activePageId: undefined, desktopWindows: [], focusedWindowId: undefined }),
  openFolder: (iconId) => {
    if (runtimeDesktop) { get().desktopWindowAction({ type: "open-folder", iconId }); return; }
    commit(set, { stage: "desktop", activeFolderIconId: iconId, activeFolderFileLabel: undefined, activeProjectId: undefined, activePageId: undefined });
  },
  closeFolder: () => commit(set, { activeFolderIconId: undefined, activeFolderFileLabel: undefined }),
  openProjectFromFolder: (projectId, iconId, fileLabel) => {
    if (runtimeDesktop) { get().desktopWindowAction({ type: "open-document", projectId, iconId, fileLabel }); return; }
    const project = runtimeProjects.find((candidate) => candidate.id === projectId);
    if (!project) { console.error(`Project "${projectId}" not found`); return; }
    commit(set, { stage: "project", activeFolderIconId: iconId, activeFolderFileLabel: fileLabel, activeProjectId: projectId, activePageId: getEnabledProjectPages(project)[0]?.id });
  },
  closeProject: () => commit(set, { stage: "desktop", activeProjectId: undefined, activePageId: undefined }),
  finishIntro: () => commit(set, { stage: "video", activePageId: undefined }),
  finishVisualNovel: () => commit(set, { stage: "desktop", activeProjectId: undefined, activePageId: undefined }),
  finishVideo: () => commit(set, { stage: "desktop", activeProjectId: undefined, activePageId: undefined }),
  startTarot: (projectId) => { if (getNextProject(runtimeProjects, get().completedProjectIds)?.id === projectId) commit(set, { stage: "tarot", activeProjectId: projectId, activePageId: undefined }); },
  completeTarot: (projectId) => {
    const project = runtimeProjects.find((candidate) => candidate.id === projectId);
    if (!project) { console.error(`Project "${projectId}" not found`); return; }
    commit(set, { completedTarotIds: addUnique(get().completedTarotIds, project.tarot.id), unlockedProjectIds: addUnique(get().unlockedProjectIds, project.id), stage: "desktop", activeProjectId: undefined, activePageId: undefined });
  },
  openProject: (projectId) => {
    if (!get().unlockedProjectIds.includes(projectId)) return;
    const project = runtimeProjects.find((candidate) => candidate.id === projectId);
    const activePageId = project ? getEnabledProjectPages(project)[0]?.id : undefined;
    commit(set, { stage: "project", activeFolderIconId: undefined, activeFolderFileLabel: undefined, activeProjectId: projectId, activePageId });
  },
  gotoPage: (pageId) => {
    const state = get();
    const project = runtimeProjects.find((candidate) => candidate.id === state.activeProjectId);
    if (state.stage !== "project" || !project) return;
    if (getEnabledProjectPages(project).some((page) => page.id === pageId)) commit(set, { activePageId: pageId });
  },
  nextPage: () => {
    const state = get();
    const project = runtimeProjects.find((candidate) => candidate.id === state.activeProjectId);
    if (state.stage !== "project" || !project) return;
    const navigation = getProjectPageNavigation(project, state.activePageId);
    if (navigation.canNext) commit(set, { activePageId: navigation.pages[navigation.currentIndex + 1].id });
  },
  prevPage: () => {
    const state = get();
    const project = runtimeProjects.find((candidate) => candidate.id === state.activeProjectId);
    if (state.stage !== "project" || !project) return;
    const navigation = getProjectPageNavigation(project, state.activePageId);
    if (navigation.canPrev) commit(set, { activePageId: navigation.pages[navigation.currentIndex - 1].id });
  },
  selectDemoPreset: (projectId, blockId, presetId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block?.presets.some((preset) => preset.id === presetId)) return;
    const key = demoKey(projectId, blockId);
    clearDemoTimers(key);
    commitDemo(set, get, key, initialDemoState(block, presetId));
  },
  setDemoTopic: (projectId, blockId, topic) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    if (demo.phase === "idle") commitDemo(set, get, key, { ...demo, topic });
  },
  generateDemoScript: (projectId, blockId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    if (demo.phase !== "idle" || !demo.topic.trim()) return;
    const preset = block.presets.find((item) => item.id === demo.presetId);
    if (!preset) return;
    clearDemoTimers(key);
    commitDemo(set, get, key, { ...demo, phase: "script_generating", script: "" });
    scheduleDemo(key, 700, () => {
      const latest = get().demoStates?.[key];
      if (latest?.phase === "script_generating" && latest.presetId === preset.id) {
        commitDemo(set, get, key, { ...latest, phase: "script_ready", script: preset.scriptOutput });
      }
      clearDemoTimers(key);
    });
  },
  editDemoScript: (projectId, blockId, script) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    if (demo.phase === "script_ready") commitDemo(set, get, key, { ...demo, script });
  },
  continueDemo: (projectId, blockId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    if (demo.phase === "script_ready" && demo.script.trim()) commitDemo(set, get, key, { ...demo, phase: "video_config" });
  },
  selectDemoAvatar: (projectId, blockId, avatarId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    const preset = block.presets.find((item) => item.id === demo.presetId);
    if (demo.phase === "video_config" && preset?.avatarOptions.some((item) => item.id === avatarId)) commitDemo(set, get, key, { ...demo, avatarId });
  },
  selectDemoRatio: (projectId, blockId, ratioId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    const preset = block.presets.find((item) => item.id === demo.presetId);
    if (demo.phase === "video_config" && preset?.ratioOptions.some((item) => item.id === ratioId)) commitDemo(set, get, key, { ...demo, ratioId });
  },
  generateDemoVideo: (projectId, blockId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    const preset = block.presets.find((item) => item.id === demo.presetId);
    if (demo.phase !== "video_config" || !preset?.avatarOptions.some((item) => item.id === demo.avatarId) || !preset.ratioOptions.some((item) => item.id === demo.ratioId)) return;
    clearDemoTimers(key);
    commitDemo(set, get, key, { ...demo, phase: "video_generating", progress: 0 });
    for (const [delay, progress] of [[350, 35], [700, 70], [1050, 100]]) {
      scheduleDemo(key, delay, () => {
        const latest = get().demoStates?.[key];
        if (latest?.phase === "video_generating" && latest.presetId === preset.id) commitDemo(set, get, key, { ...latest, progress });
      });
    }
    scheduleDemo(key, 1200, () => {
      const latest = get().demoStates?.[key];
      if (latest?.phase === "video_generating" && latest.presetId === preset.id) commitDemo(set, get, key, { ...latest, phase: "completed", progress: 100 });
      clearDemoTimers(key);
    });
  },
  restartDemo: (projectId, blockId) => {
    const block = getDemoBlock(projectId, blockId);
    if (!block) return;
    const key = demoKey(projectId, blockId);
    const demo = currentDemoState(block, get().demoStates?.[key]);
    clearDemoTimers(key);
    commitDemo(set, get, key, initialDemoState(block, demo.presetId));
  },
  completeProject: (projectId) => {
    const project = runtimeProjects.find((candidate) => candidate.id === projectId);
    if (!project) { console.error(`Project "${projectId}" not found`); return; }
    const completedProjectIds = addUnique(get().completedProjectIds, project.id);
    const inventoryItemIds = project.rewardItem ? addUnique(get().inventoryItemIds, project.rewardItem.id) : get().inventoryItemIds;
    const next = getNextProject(runtimeProjects, completedProjectIds);
    commit(set, { completedProjectIds, inventoryItemIds, stage: next ? "tarot" : "complete", activeProjectId: next?.id, activePageId: undefined });
  },
  resetProgress: () => { for (const key of demoTimers.keys()) clearDemoTimers(key); clearRuntimeState(); set({ ...initialRuntimeState, selectedDesktopId: undefined, activeFolderIconId: undefined, activeFolderFileLabel: undefined, activeProjectId: undefined, activePageId: undefined, desktopWindows: [], focusedWindowId: undefined, desktopReadProjectIds: {} }); },
}));

export function setRuntimeProjects(projects: Project[], desktop?: DesktopContent, desktopId?: string) {
  runtimeProjects = projects;
  runtimeDesktop = desktop;
  const previous = useRuntimeStore.getState();
  if (desktop && desktopId && previous.selectedDesktopId !== desktopId && (previous.selectedDesktopId || previous.stage !== "intro")) {
    commit(useRuntimeStore.setState, { selectedDesktopId: desktopId, desktopWindows: previous.selectedDesktopId ? [] : previous.desktopWindows, focusedWindowId: previous.selectedDesktopId ? undefined : previous.focusedWindowId });
  }
  if (desktop) commit(useRuntimeStore.setState, reconcileDesktopState(useRuntimeStore.getState(), projects, desktop));
  const state = useRuntimeStore.getState();
  if (state.stage !== "project" || !state.activeProjectId) return;
  const project = runtimeProjects.find((candidate) => candidate.id === state.activeProjectId);
  const pages = project ? getEnabledProjectPages(project) : [];
  const activePageId = pages.some((page) => page.id === state.activePageId) ? state.activePageId : pages[0]?.id;
  if (activePageId !== state.activePageId) commit(useRuntimeStore.setState, { activePageId });
}
