import type { z } from "zod";
import { blockSchema, demoPresetSchema, editableSentenceSchema, introContentSchema, projectPageSchema, projectSchema } from "./content-contract.mjs";

export { agentDemoBlockSchema, blockSchema, calloutBlockSchema, cardsBlockSchema, comparisonBlockSchema, conversationBlockSchema, demoPresetSchema, editableSentenceSchema, flowBlockSchema, folderContentSchema, folderItemSchema, hubBlockSchema, imageBlockSchema, interactiveDemoBlockSchema, introContentSchema, itemSchema, metricsBlockSchema, projectFinalActionSchema, projectPageSchema, projectSchema, tableBlockSchema, tarotReadingSchema, textBlockSchema, validateProjects, videoBlockSchema } from "./content-contract.mjs";

export type Block = z.infer<typeof blockSchema>;
export type DemoPreset = z.infer<typeof demoPresetSchema>;
export type ProjectPage = z.infer<typeof projectPageSchema>;
export type Project = z.infer<typeof projectSchema>;
export type IntroContent = z.infer<typeof introContentSchema>;
export type EditableSentence = z.infer<typeof editableSentenceSchema>;
export type RuntimeStage = "intro" | "video" | "desktop" | "tarot" | "project" | "complete";
