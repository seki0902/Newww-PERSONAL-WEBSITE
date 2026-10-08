import { z } from "zod";

const blockBase = { id: z.string().min(1) };
export const editableSentenceSchema = z.union([z.string(), z.array(z.string()).min(1)]);

export const textBlockSchema = z.object({ ...blockBase, type: z.literal("text"), markdown: editableSentenceSchema });
export const imageBlockSchema = z.object({ ...blockBase, type: z.literal("image"), asset: z.string().min(1), alt: z.string().optional(), caption: z.string().optional() });
export const videoBlockSchema = z.object({ ...blockBase, type: z.literal("video"), asset: z.string().min(1), poster: z.string().optional(), caption: z.string().optional() });
export const metricsBlockSchema = z.object({
  ...blockBase,
  type: z.literal("metrics"),
  items: z.array(z.object({ label: z.string().min(1), value: editableSentenceSchema, note: editableSentenceSchema.optional() })).min(1),
});
export const comparisonBlockSchema = z.object({
  ...blockBase,
  type: z.literal("comparison"),
  before: z.object({ label: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
  after: z.object({ label: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
});
export const tableBlockSchema = z.object({
  ...blockBase, type: z.literal("table"), title: z.string().optional(),
  columns: z.array(z.string().min(1)).min(2), rows: z.array(z.array(editableSentenceSchema)).min(1),
});
export const flowBlockSchema = z.object({
  ...blockBase, type: z.literal("flow"), title: z.string().optional(),
  steps: z.array(z.object({ title: z.string().min(1), body: editableSentenceSchema.optional() })).min(2),
  caption: editableSentenceSchema.optional(), variant: z.enum(["linear", "state"]).default("linear"),
});
export const cardsBlockSchema = z.object({
  ...blockBase, type: z.literal("cards"), title: z.string().optional(),
  items: z.array(z.object({ title: z.string().min(1), body: editableSentenceSchema })).min(1),
  layout: z.enum(["grid", "list", "quotes"]).default("grid"),
});
export const calloutBlockSchema = z.object({
  ...blockBase, type: z.literal("callout"), title: z.string().optional(), text: editableSentenceSchema,
  tone: z.enum(["note", "key"]).default("key"),
});
export const hubBlockSchema = z.object({
  ...blockBase, type: z.literal("hub"), title: z.string().optional(),
  root: z.object({ title: z.string().min(1), body: editableSentenceSchema.optional() }),
  nodes: z.array(z.object({ title: z.string().min(1), subtitle: z.string().optional(), body: editableSentenceSchema })).min(1),
  caption: editableSentenceSchema.optional(),
});
export const conversationBlockSchema = z.object({
  ...blockBase, type: z.literal("conversation"), title: z.string().optional(),
  turns: z.array(z.object({ user: editableSentenceSchema, process: editableSentenceSchema, output: editableSentenceSchema.optional() })).min(1),
  caption: editableSentenceSchema.optional(),
});
export const demoPresetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  input: z.string().min(1),
  scriptOutput: z.string().min(1),
  avatarOptions: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
  ratioOptions: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
  finalVideoAssetId: z.string().min(1).optional(),
  finalImageAssetId: z.string().min(1).optional(),
  resultPlaceholder: z.string().min(1).optional(),
});
export const interactiveDemoBlockSchema = z.object({
  ...blockBase,
  type: z.literal("interactive_demo"),
  presets: z.array(demoPresetSchema).min(1),
});
export const agentDemoBlockSchema = z.object({
  ...blockBase,
  type: z.literal("agent_demo"),
  app: z.enum(["content-agent", "ads-agent"]),
});

export const blockSchema = z.discriminatedUnion("type", [textBlockSchema, imageBlockSchema, videoBlockSchema, metricsBlockSchema, comparisonBlockSchema, interactiveDemoBlockSchema, agentDemoBlockSchema, tableBlockSchema, flowBlockSchema, cardsBlockSchema, calloutBlockSchema, hubBlockSchema, conversationBlockSchema]);
export const projectPageSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  internalName: z.string().min(1),
  title: z.string().min(1),
  navLabel: z.string().min(1),
  subtitle: z.string().optional(),
  order: z.number().int(),
  blockIds: z.array(z.string().min(1)),
  enabled: z.boolean(),
  kind: z.enum(["overview", "background", "process", "demo", "evidence", "result", "reflection", "custom"]).optional(),
});
export const tarotReadingSchema = z.object({ id: z.string().min(1), name: z.string().min(1), image: z.string().min(1), hint: z.string().min(1) });
export const itemSchema = z.object({ id: z.string().min(1), title: z.string().min(1), icon: z.string().optional() });
export const projectFinalActionSchema = z.object({
  label: z.string().min(1),
  disabled: z.boolean().default(false),
});
export const projectSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), subtitle: z.string().optional(), order: z.number().int(), desktopSlot: z.string().min(1),
  tarot: tarotReadingSchema, rewardItem: itemSchema.optional(), blocks: z.array(blockSchema).min(1), enabled: z.boolean(),
  finalAction: projectFinalActionSchema.optional(),
  resourceLinks: z.array(z.object({ label: z.string().min(1), href: z.string().url().refine(value => /^(https?:|mailto:)/.test(value)).optional() })).optional(),
  presentation: z.enum(["report"]).optional(),
  // Optional so existing projects continue to render from their original block list.
  pageIds: z.array(z.string().min(1)).optional(), pages: z.array(projectPageSchema).optional(),
});
export const introContentSchema = z.object({ lines: z.array(z.string().min(1)).min(1), video: z.object({ src: z.string().min(1), poster: z.string().optional() }).optional() });

/** @typedef {import("zod").infer<typeof projectSchema>} Project */
/** @typedef {import("zod").infer<typeof projectPageSchema>} ProjectPage */

/** @param {unknown} input */
export function validateProjects(input) {
  const projects = z.array(projectSchema).parse(input);
  const ids = new Set();
  const orders = new Set();
  const tarotIds = new Set();
  let enabledCount = 0;

  for (const project of projects) {
    if (ids.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`);
    if (orders.has(project.order)) throw new Error(`Duplicate project order: ${project.order}`);
    if (tarotIds.has(project.tarot.id)) throw new Error(`Duplicate tarot id: ${project.tarot.id}`);
    ids.add(project.id); orders.add(project.order); tarotIds.add(project.tarot.id);
    if (project.enabled) enabledCount += 1;
    const blockIds = new Set();
    for (const block of project.blocks) {
      if (blockIds.has(block.id)) throw new Error(`Duplicate block id in project ${project.id}: ${block.id}`);
      blockIds.add(block.id);
      if (block.type === "table" && block.rows.some((row) => row.length !== block.columns.length)) {
        throw new Error(`Table ${block.id} rows must match the column count`);
      }
      if (block.type === "interactive_demo") {
        const presetIds = new Set();
        for (const preset of block.presets) {
          if (presetIds.has(preset.id)) throw new Error(`Duplicate DemoPreset id in block ${block.id}: ${preset.id}`);
          presetIds.add(preset.id);
          for (const options of [preset.avatarOptions, preset.ratioOptions]) {
            const optionIds = new Set();
            for (const option of options) {
              if (optionIds.has(option.id)) throw new Error(`Duplicate DemoPreset option id in preset ${preset.id}: ${option.id}`);
              optionIds.add(option.id);
            }
          }
        }
      }
    }

    if (project.pageIds !== undefined || project.pages !== undefined) {
      if (project.pageIds === undefined || project.pages === undefined) {
        throw new Error(`Project ${project.id} must define both pageIds and pages`);
      }

      /** @type {Map<string, ProjectPage>} */
      const pagesById = new Map();
      const pageOrders = new Set();
      for (const page of project.pages) {
        if (page.projectId !== project.id) throw new Error(`Page ${page.id} references a different project: ${page.projectId}`);
        if (pagesById.has(page.id)) throw new Error(`Duplicate page id in project ${project.id}: ${page.id}`);
        if (pageOrders.has(page.order)) throw new Error(`Duplicate page order in project ${project.id}: ${page.order}`);
        const pageBlockIds = new Set();
        for (const blockId of page.blockIds) {
          if (pageBlockIds.has(blockId)) throw new Error(`Duplicate block id in page ${page.id}: ${blockId}`);
          if (!blockIds.has(blockId)) throw new Error(`Page ${page.id} references missing block: ${blockId}`);
          pageBlockIds.add(blockId);
        }
        pagesById.set(page.id, page);
        pageOrders.add(page.order);
      }

      const referencedPageIds = new Set();
      for (const pageId of project.pageIds) {
        if (referencedPageIds.has(pageId)) throw new Error(`Duplicate page id reference in project ${project.id}: ${pageId}`);
        if (!pagesById.has(pageId)) throw new Error(`Project ${project.id} references missing page: ${pageId}`);
        referencedPageIds.add(pageId);
      }
      if (referencedPageIds.size !== pagesById.size) throw new Error(`Project ${project.id} pageIds must reference every configured page`);
    }
  }
  if (!enabledCount) throw new Error("At least one enabled project is required");
  return projects;
}

export const assetSchema = z.object({
  id: z.string().min(1), type: z.enum(["image", "video", "audio"]), fileName: z.string().min(1), originalName: z.string().min(1), path: z.string().min(1), mimeType: z.string().min(1), label: z.string().optional(),
  presentation: z.object({ backgroundLayout: z.enum(["cover", "cropped"]).optional(), portraitStyle: z.enum(["standard", "white-cutout"]).optional() }).optional(),
});
export const introSceneSchema = z.object({
  id: z.string().min(1), order: z.number().int(), enabled: z.boolean(), backgroundAssetId: z.string().optional(), characterAssetId: z.string().optional(), characterPosition: z.enum(["left", "center", "right"]).optional(), speaker: z.string().optional(), text: z.string().min(1),
});
export const onboardingPageSchema = z.object({ id: z.string().min(1), caption: z.string().min(1) });
export const onboardingContentSchema = z.object({
  title: z.string().min(1),
  buttonLabel: z.string().min(1),
  hint: z.string().min(1),
  typewriterSpeed: z.number().positive(),
  openSoundAssetId: z.string().optional(),
  purrSoundAssetId: z.string().optional(),
  pages: z.array(onboardingPageSchema).length(2),
}).default({
  title: "【新人引导系统】| 欢迎新人入职！",
  buttonLabel: "开始",
  hint: "新手引导已开启",
  typewriterSpeed: 24,
  pages: [
    { id: "welcome", caption: "新人，欢迎入职！我是【前辈】留下的交接系统~请你跟着我一步步探索学习，快速上手吧！点击图标，开始你的探索。" },
    { id: "tarot", caption: "糟了！差点忘记了【前辈】有个小爱好是塔罗牌占卜，在你探索的过程中，需要通过抽取【塔罗牌】获取具体的项目内容。祝你幸运！" },
  ],
});
export const welcomeChoiceSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  assetId: z.string().min(1).optional(),
});
export const welcomeContentSchema = z.object({
  speakerName: z.string().trim().min(1),
  message: z.string().min(1).refine((value) => value.trim().length > 0, "Welcome message is required"),
  characterAssetId: z.string().min(1).optional(),
  dialogueAssetId: z.string().min(1).optional(),
  nameplateAssetId: z.string().min(1).optional(),
  backgroundAssetId: z.string().min(1).optional(),
  highlightedChoiceAssetId: z.string().min(1).optional(),
  cursorAssetId: z.string().min(1).optional(),
  clickSoundAssetId: z.string().min(1).optional(),
  choices: z.array(welcomeChoiceSchema).length(3),
}).default({
  speakerName: "SEKI",
  message: "嗨！\n你终于来了。\n想先从一个部分开始了解呢？",
  choices: [
    { id: "content", label: "AI 内容与产品" },
    { id: "education", label: "AI教育" },
    { id: "sales", label: "AI销售和解决方案" },
  ],
});
export const projectPagesConfigSchema = z.object({
  projectId: z.string().min(1),
  enabled: z.boolean().optional(),
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  presentation: z.enum(["report"]).optional(),
  pages: z.array(projectPageSchema),
  blocks: z.array(blockSchema).min(1).optional(),
  finalAction: projectFinalActionSchema.optional(),
});
export const folderItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  content: z.string().default(""),
  kind: z.enum(["document", "demo", "note"]).default("document"),
  iconAssetId: z.string().min(1).optional(),
  targetProjectId: z.string().min(1).optional(),
  targetPageId: z.string().min(1).optional(),
  disabled: z.boolean().default(false),
});
export const folderContentSchema = z.object({
  items: z.array(folderItemSchema).default([]),
}).default({ items: [] });
export const desktopIconSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  iconAssetId: z.string().optional(),
  projectId: z.string().optional(),
  type: z.enum(["project", "system", "inventory", "portfolio"]),
  locked: z.boolean(),
  folder: folderContentSchema,
});
export const desktopContentSchema = z.object({
  projectPages: z.array(projectPagesConfigSchema).optional(),
  referenceAssetId: z.string().optional(),
  tarotSoundAssetId: z.string().optional(),
  wallpaperAssetId: z.string().optional(),
  wallpaperTopOverlayAssetId: z.string().optional(),
  wallpaperBottomOverlayAssetId: z.string().optional(),
  brandIconAssetId: z.string().optional(),
  bgmAssetId: z.string().optional(),
  clickSoundAssetId: z.string().optional(),
  systemName: z.string().min(1),
  tagline: z.string().min(1).optional(),
  footerSlogan: z.string().min(1).optional(),
  progressLabel: z.string().min(1).optional(),
  dateTimeLabel: z.string().min(1).optional(),
  icons: z.array(desktopIconSchema),
});
export const contentBundleSchema = z.object({
  version: z.literal(1),
  assets: z.array(assetSchema),
  intro: z.object({ settings: z.object({ bgmAssetId: z.string().optional(), textSoundAssetId: z.string().optional(), clickSoundAssetId: z.string().optional(), bgmVolume: z.number().min(0).max(1).optional(), typewriterSpeed: z.number().positive().optional(), textSoundInterval: z.number().int().positive().optional() }), scenes: z.array(introSceneSchema) }),
  onboarding: onboardingContentSchema,
  welcome: welcomeContentSchema,
  desktop: desktopContentSchema,
  desktops: z.record(desktopContentSchema).default({}),
  ending: z.object({ bgmAssetId: z.string().optional() }).default({}),
  projectPages: z.array(projectPagesConfigSchema),
});

/** @typedef {import("zod").infer<typeof contentBundleSchema>} ContentBundle */
/** @typedef {import("zod").infer<typeof projectPagesConfigSchema>} ProjectPagesConfig */

/** @param {ContentBundle} bundle */
export function getEnabledScenes(bundle) { return bundle.intro.scenes.filter((scene) => scene.enabled).sort((a, b) => a.order - b.order); }
/** @param {ContentBundle} bundle @param {string} [assetId] */
export function getAsset(bundle, assetId) { return assetId ? bundle.assets.find((asset) => asset.id === assetId) : undefined; }
/** @param {Project[]} baseProjects @param {ContentBundle} bundle @param {string} [desktopId] */
export function mergeProjectPages(baseProjects, bundle, desktopId) {
  /** @type {Map<string, ProjectPagesConfig>} */
  const configs = new Map();
  for (const config of (desktopId ? bundle.desktops[desktopId]?.projectPages : undefined) ?? bundle.projectPages) {
    if (configs.has(config.projectId)) throw new Error(`Duplicate project page config: ${config.projectId}`);
    configs.set(config.projectId, config);
  }
  for (const projectId of configs.keys()) if (!baseProjects.some((project) => project.id === projectId)) throw new Error(`Project page config references missing project: ${projectId}`);
  return validateProjects(baseProjects.map((project) => {
    const config = configs.get(project.id);
    if (!config) return project;
    const pages = [...config.pages].sort((a, b) => a.order - b.order);
    return { ...project, enabled: config.enabled ?? project.enabled, title: config.title ?? project.title, subtitle: config.subtitle ?? project.subtitle, presentation: config.presentation ?? project.presentation, blocks: config.blocks ?? project.blocks, finalAction: config.finalAction ?? project.finalAction, pages, pageIds: pages.map((page) => page.id) };
  }));
}

/** @param {ContentBundle} bundle @param {Project[]} [baseProjects] */
export function validateBundleReferences(bundle, baseProjects) {
  const assetsById = new Map();
  for (const asset of bundle.assets) {
    if (assetsById.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`);
    if (!asset.mimeType.startsWith(`${asset.type}/`)) throw new Error(`Asset type and MIME mismatch: ${asset.id}`);
    assetsById.set(asset.id, asset);
  }
  const requireAsset = (assetId, type, owner) => {
    if (!assetId) return;
    const asset = assetsById.get(assetId);
    if (!asset) throw new Error(`${owner} references missing asset: ${assetId}`);
    if (asset.type !== type) throw new Error(`${owner} requires ${type} asset: ${assetId}`);
  };
  const sceneIds = new Set(); const orders = new Set();
  for (const scene of bundle.intro.scenes) {
    if (sceneIds.has(scene.id)) throw new Error(`Duplicate scene id: ${scene.id}`);
    if (orders.has(scene.order)) throw new Error(`Duplicate scene order: ${scene.order}`);
    if (!scene.text.trim()) throw new Error(`Scene text is required: ${scene.id}`);
    requireAsset(scene.backgroundAssetId, "image", `Scene ${scene.id}`);
    requireAsset(scene.characterAssetId, "image", `Scene ${scene.id}`);
    sceneIds.add(scene.id); orders.add(scene.order);
  }
  if (!getEnabledScenes(bundle).length) throw new Error("At least one enabled scene is required");
  for (const assetId of [bundle.intro.settings.bgmAssetId, bundle.intro.settings.textSoundAssetId, bundle.intro.settings.clickSoundAssetId]) requireAsset(assetId, "audio", "Intro sound");
  for (const assetId of [bundle.onboarding.openSoundAssetId, bundle.onboarding.purrSoundAssetId]) requireAsset(assetId, "audio", "Onboarding sound");
  for (const assetId of [bundle.welcome.characterAssetId, bundle.welcome.dialogueAssetId, bundle.welcome.nameplateAssetId, bundle.welcome.backgroundAssetId, bundle.welcome.highlightedChoiceAssetId, bundle.welcome.cursorAssetId]) requireAsset(assetId, "image", "Welcome image");
  requireAsset(bundle.welcome.clickSoundAssetId, "audio", "Welcome click sound");
  const welcomeChoiceIds = new Set();
  for (const choice of bundle.welcome.choices) {
    if (welcomeChoiceIds.has(choice.id)) throw new Error(`Duplicate welcome choice id: ${choice.id}`);
    welcomeChoiceIds.add(choice.id);
    requireAsset(choice.assetId, "image", `Welcome choice ${choice.id}`);
  }
  for (const [desktopId, desktop] of Object.entries({ default: bundle.desktop, ...bundle.desktops })) {
    requireAsset(desktop.referenceAssetId, "image", `Desktop ${desktopId} Canva reference`);
    requireAsset(desktop.wallpaperAssetId, "image", "Desktop wallpaper");
    requireAsset(desktop.wallpaperTopOverlayAssetId, "image", "Desktop top wallpaper overlay");
    requireAsset(desktop.wallpaperBottomOverlayAssetId, "image", "Desktop bottom wallpaper overlay");
    requireAsset(desktop.brandIconAssetId, "image", "Desktop brand icon");
    requireAsset(desktop.bgmAssetId, "audio", "Desktop BGM");
    requireAsset(desktop.clickSoundAssetId, "audio", "Desktop click sound");
    requireAsset(desktop.tarotSoundAssetId, "audio", "Tarot draw sound");
    const mappedProjectIds = new Set();
    for (const icon of desktop.icons) {
      requireAsset(icon.iconAssetId, "image", `Desktop icon ${icon.id}`);
      const folderItemIds = new Set();
      for (const item of icon.folder.items) {
        if (folderItemIds.has(item.id)) throw new Error(`Duplicate folder item id in desktop icon ${icon.id}: ${item.id}`);
        folderItemIds.add(item.id);
        requireAsset(item.iconAssetId, "image", `Folder item ${item.id}`);
        if (baseProjects && item.targetProjectId && !baseProjects.some((project) => project.id === item.targetProjectId)) {
          throw new Error(`Folder item ${item.id} references missing project: ${item.targetProjectId}`);
        }
      }
      if (!icon.projectId) continue;
      if (icon.type !== "project") throw new Error(`Desktop icon ${icon.id} must be a project icon to map a project`);
      if (mappedProjectIds.has(icon.projectId)) throw new Error(`Duplicate desktop project mapping: ${icon.projectId}`);
      if (baseProjects && !baseProjects.some((project) => project.id === icon.projectId)) throw new Error(`Desktop icon ${icon.id} references missing project: ${icon.projectId}`);
      mappedProjectIds.add(icon.projectId);
    }
  }
  requireAsset(bundle.ending.bgmAssetId, "audio", "Ending BGM");
  const pageConfigSets = [bundle.projectPages, ...Object.values(bundle.desktops).flatMap((desktop) => desktop.projectPages ? [desktop.projectPages] : [])];
  for (const config of pageConfigSets.flat()) {
    for (const page of config.pages) {
      if (!page.internalName.trim() || !page.title.trim() || !page.navLabel.trim()) throw new Error(`Page text is required: ${page.id}`);
    }
  }
  if (baseProjects) {
    for (const projectPages of pageConfigSets) {
    for (const project of mergeProjectPages(baseProjects, { ...bundle, projectPages })) {
      for (const block of project.blocks) {
        if (block.type !== "interactive_demo") continue;
        for (const preset of block.presets) {
          requireAsset(preset.finalVideoAssetId, "video", `Demo preset ${preset.id}`);
          requireAsset(preset.finalImageAssetId, "image", `Demo preset ${preset.id}`);
        }
      }
    }
    }
  }
  return bundle;
}

/** @param {unknown} input @param {Project[]} [baseProjects] */
export function validateContentBundle(input, baseProjects) {
  return validateBundleReferences(contentBundleSchema.parse(input), baseProjects);
}
