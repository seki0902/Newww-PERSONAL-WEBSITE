import type { z } from "zod";
import { contentBundleSchema, introSceneSchema, projectPagesConfigSchema } from "../schema/content-contract.mjs";

export { assetSchema, contentBundleSchema, folderContentSchema, folderItemSchema, getAsset, getEnabledScenes, introSceneSchema, mergeProjectPages, projectPagesConfigSchema, validateBundleReferences, validateContentBundle } from "../schema/content-contract.mjs";

export type ContentBundle = z.infer<typeof contentBundleSchema>;
export type IntroScene = z.infer<typeof introSceneSchema>;
export type ProjectPagesConfig = z.infer<typeof projectPagesConfigSchema>;
