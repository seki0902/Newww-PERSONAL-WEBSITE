import type { Block } from "../schema/content";

export function TextBlock({ block }: { block: Extract<Block, { type: "text" }> }) {
  return <section className="text-block">{block.markdown.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>;
}
