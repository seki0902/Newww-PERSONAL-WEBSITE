import { introContentSchema } from "../schema/content";

export const intro = introContentSchema.parse({
  lines: ["[PLACEHOLDER] 开场文字 01", "[PLACEHOLDER] 开场文字 02", "[PLACEHOLDER] 按下电源键，开始调查。"],
  video: { src: "/assets/placeholder-intro.mp4", poster: "/assets/project-placeholder.svg" },
});
