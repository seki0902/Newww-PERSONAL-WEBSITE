import type { Block } from "../schema/content";
import { sentenceText } from "./sentence";

export function MetricsBlock({ block }: { block: Extract<Block, { type: "metrics" }> }) {
  return <dl className="metrics-block">{block.items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{sentenceText(item.value)}</dd>{item.note && <small>{sentenceText(item.note)}</small>}</div>)}</dl>;
}
