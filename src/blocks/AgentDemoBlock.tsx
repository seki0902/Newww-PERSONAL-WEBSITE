import type { Block } from "../schema/content";
import "./AgentDemoBlock.css";

type DemoBlock = Extract<Block, { type: "agent_demo" }>;
const titles = { "content-agent": "内容 Agent 交互演示", "ads-agent": "投放 Agent 交互演示" };

export function AgentDemoBlock({ block }: { block: DemoBlock }) {
  const title = titles[block.app];
  const url = `/demos/${block.app}/index.html`;
  return (
    <section className="agent-demo" aria-label={title}>
      <div className="agent-demo-toolbar">
        <p><strong>可操作演示</strong><span>示例数据与模拟生成</span></p>
      </div>
      <iframe className="agent-demo-frame" src={url} title={title} loading="lazy" />
    </section>
  );
}
