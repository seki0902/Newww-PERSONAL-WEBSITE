import type { Block } from "../schema/content";

export function MetricsBlock({ block }: { block: Extract<Block, { type: "metrics" }> }) {
  return <dl className="metrics-block">{block.items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd>{item.note && <small>{item.note}</small>}</div>)}</dl>;
}
