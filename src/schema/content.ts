import type { z } from "zod";
import { blockSchema, demoPresetSchema, introContentSchema, projectPageSchema, projectSchema } from "./content-contract.mjs";

export { blockSchema, comparisonBlockSchema, demoPresetSchema, imageBlockSchema, interactiveDemoBlockSchema, introContentSchema, itemSchema, metricsBlockSchema, projectPageSchema, projectSchema, tarotReadingSchema, textBlockSchema, validateProjects, videoBlockSchema } from "./content-contract.mjs";

export type Block = z.infer<typeof blockSchema>;
export type DemoPreset = z.infer<typeof demoPresetSchema>;
export type ProjectPage = z.infer<typeof projectPageSchema>;
export type Project = z.infer<typeof projectSchema>;
export type IntroContent = z.infer<typeof introContentSchema>;
export type RuntimeStage = "intro" | "video" | "desktop" | "tarot" | "project" | "complete";
