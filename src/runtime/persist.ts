import { z } from "zod";
import type { RuntimeStage } from "../schema/content";

export const STORAGE_KEY = "interactive-portfolio:state:v1";
const demoPhaseSchema = z.enum(["idle", "script_generating", "script_ready", "video_config", "video_generating", "completed"]);
const demoRuntimeStateSchema = z.object({
  phase: demoPhaseSchema,
  presetId: z.string(),
  topic: z.string(),
  script: z.string(),
  avatarId: z.string().optional(),
  ratioId: z.string().optional(),
  progress: z.number().min(0).max(100),
});
export type DemoRuntimeState = z.infer<typeof demoRuntimeStateSchema>;
const desktopWindowBase = { id: z.string().min(1), iconId: z.string().min(1), minimized: z.boolean(), maximized: z.boolean(), order: z.number().int().nonnegative() };
const desktopWindowSchema = z.discriminatedUnion("kind", [
  z.object({ ...desktopWindowBase, kind: z.literal("folder") }),
  z.object({ ...desktopWindowBase, kind: z.literal("document"), projectId: z.string().min(1), fileLabel: z.string().min(1), pageId: z.string().optional() }),
  z.object({ ...desktopWindowBase, kind: z.literal("tarot"), projectId: z.string().min(1), fileLabel: z.string().min(1), revealed: z.boolean().optional() }),
  z.object({ ...desktopWindowBase, kind: z.literal("progress") }),
]);
export type DesktopWindowState = z.infer<typeof desktopWindowSchema>;
export interface RuntimeState { version: 1; stage: RuntimeStage; selectedDesktopId?: string; activeFolderIconId?: string; activeFolderFileLabel?: string; activeProjectId?: string; activePageId?: string; completedProjectIds: string[]; completedTarotIds: string[]; unlockedProjectIds: string[]; inventoryItemIds: string[]; demoStates?: Record<string, DemoRuntimeState>; desktopWindows?: DesktopWindowState[]; focusedWindowId?: string; desktopReadProjectIds?: Record<string, string[]>; }
export const initialRuntimeState: RuntimeState = { version: 1, stage: "intro", completedProjectIds: [], completedTarotIds: [], unlockedProjectIds: [], inventoryItemIds: [], demoStates: {} };
const runtimeStateSchema = z.object({ version: z.literal(1), stage: z.enum(["intro", "video", "desktop", "tarot", "project", "complete"]), selectedDesktopId: z.string().optional(), activeFolderIconId: z.string().optional(), activeFolderFileLabel: z.string().optional(), activeProjectId: z.string().optional(), activePageId: z.string().optional(), completedProjectIds: z.array(z.string()), completedTarotIds: z.array(z.string()), unlockedProjectIds: z.array(z.string()), inventoryItemIds: z.array(z.string()), demoStates: z.record(demoRuntimeStateSchema).optional(), desktopWindows: z.array(desktopWindowSchema).optional(), focusedWindowId: z.string().optional(), desktopReadProjectIds: z.record(z.array(z.string())).optional() });
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    // Each Draft preview starts fresh and keeps its progress in this tab only.
    if (new URLSearchParams(window.location?.search ?? "").get("preview") === "1") return undefined;
    return window.localStorage;
  }
  catch { console.warn("Runtime storage is unavailable"); return undefined; }
}
export function saveRuntimeState(state: RuntimeState, storage = browserStorage()) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { console.warn("Runtime state could not be saved"); }
}
export function restoreRuntimeState(storage = browserStorage()): RuntimeState {
  if (!storage) return initialRuntimeState;
  let stored: string | null;
  try { stored = storage.getItem(STORAGE_KEY); }
  catch { console.warn("Runtime state could not be read"); return initialRuntimeState; }
  if (!stored) return initialRuntimeState;
  try { return runtimeStateSchema.parse(JSON.parse(stored)); }
  catch { console.warn("Invalid persisted state"); clearRuntimeState(storage); return initialRuntimeState; }
}
export function clearRuntimeState(storage = browserStorage()) {
  try { storage?.removeItem(STORAGE_KEY); }
  catch { console.warn("Runtime state could not be removed"); }
}
