import type { Block } from "../schema/content";

export function ComparisonBlock({ block }: { block: Extract<Block, { type: "comparison" }> }) {
  return (
    <section className="comparison-block" aria-label={`${block.before.label}与${block.after.label}对比`}>
      <div className="comparison-panel">
        <h2>{block.before.label}</h2>
        <ul>{block.before.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <span className="comparison-arrow" aria-hidden="true">→</span>
      <div className="comparison-panel comparison-panel--after">
        <h2>{block.after.label}</h2>
        <ul>{block.after.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </section>
  );
}
