import type { Block } from "../schema/content";
import type { DemoRuntimeState } from "./persist";

export type InteractiveDemoBlock = Extract<Block, { type: "interactive_demo" }>;

export const demoKey = (projectId: string, blockId: string) => `${projectId}:${blockId}`;

export function initialDemoState(block: InteractiveDemoBlock, presetId = block.presets[0].id): DemoRuntimeState {
  const preset = block.presets.find((item) => item.id === presetId) ?? block.presets[0];
  return { phase: "idle", presetId: preset.id, topic: preset.input, script: "", progress: 0 };
}

export function currentDemoState(block: InteractiveDemoBlock, saved?: DemoRuntimeState): DemoRuntimeState {
  return saved && block.presets.some((preset) => preset.id === saved.presetId) ? saved : initialDemoState(block);
}
