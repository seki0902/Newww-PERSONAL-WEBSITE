import { sentenceParagraphs } from "./sentence";
import type { Block } from "../schema/content";

export function TextBlock({ block }: { block: Extract<Block, { type: "text" }> }) {
  return <section className="text-block">{sentenceParagraphs(block.markdown).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>;
}
