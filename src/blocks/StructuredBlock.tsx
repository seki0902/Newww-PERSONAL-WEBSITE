import { Fragment } from "react";
import type { Block, EditableSentence } from "../schema/content";
import { sentenceText } from "./sentence";
import "./StructuredBlock.css";

function InlineText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

function BodyText({ text }: { text: EditableSentence }) {
  return <div className="case-body">{sentenceText(text).split("\n").filter(Boolean).map((line, index) => <p key={index}><InlineText text={line} /></p>)}</div>;
}

function BlockTitle({ title }: { title?: string }) {
  return title ? <h2 className="case-section-title">{title}</h2> : null;
}

function Caption({ text }: { text?: EditableSentence }) {
  return text ? <p className="case-caption"><InlineText text={sentenceText(text)} /></p> : null;
}

export function StructuredBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "table": return <section className="case-table-section">
      <BlockTitle title={block.title} />
      <div className="case-table-scroll" role="region" aria-label={block.title ?? "项目对照表"} tabIndex={0}>
        <table className="case-table" data-column-count={block.columns.length}>
          <thead><tr>{block.columns.map((column, index) => <th key={index} scope="col"><InlineText text={column} /></th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => columnIndex === 0
            ? <th key={columnIndex} scope="row"><BodyText text={cell} /></th>
            : <td key={columnIndex} data-label={block.columns[columnIndex]}><BodyText text={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>;
    case "flow": return <section className={`case-flow-section case-flow-section--${block.variant}`}>
      <BlockTitle title={block.title} />
      <ol className="case-flow" data-step-count={block.steps.length} data-flow-layout={block.steps.some(step => sentenceText(step.body).length > 32) ? "timeline" : "sequence"}>{block.steps.map((step, index) => <li key={index}>
        <span className="case-flow-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <strong><InlineText text={step.title} /></strong>
        {step.body ? <BodyText text={step.body} /> : null}
      </li>)}</ol>
      <Caption text={block.caption} />
    </section>;
    case "cards": return <section className={`case-cards-section case-cards-section--${block.layout}`}>
      <BlockTitle title={block.title} />
      <ol className={`case-cards case-cards--${block.layout}`}>{block.items.map((item, index) => <li key={index}>
        {block.layout === "quotes"
          ? <blockquote><p>“<InlineText text={item.title} />”</p>{item.body ? <BodyText text={item.body} /> : null}</blockquote>
          : <>
            <span className="case-item-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>{block.title ? <h3><InlineText text={item.title} /></h3> : <h2><InlineText text={item.title} /></h2>}<BodyText text={item.body} /></div>
          </>}
      </li>)}</ol>
    </section>;
    case "callout": return <aside className={`case-callout case-callout--${block.tone}`}>
      {block.title ? <h2>{block.title}</h2> : null}
      <BodyText text={block.text} />
    </aside>;
    case "hub": return <section className="case-hub-section">
      <BlockTitle title={block.title} />
      <div className="case-hub-root"><span className="case-hub-mark" aria-hidden="true">◈</span><div><h2>{block.root.title}</h2>{block.root.body ? <BodyText text={block.root.body} /> : null}</div></div>
      <div className="case-hub-connector" aria-hidden="true" />
      <ul className="case-hub-nodes" data-node-count={block.nodes.length}>{block.nodes.map((node, index) => <li key={index}>
        <span className="case-node-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <h3>{node.title}</h3>{node.subtitle ? <p className="case-node-subtitle">{node.subtitle}</p> : null}
        <BodyText text={node.body} />
      </li>)}</ul>
      <Caption text={block.caption} />
    </section>;
    case "conversation": return <section className="case-conversation-section">
      <BlockTitle title={block.title} />
      <ol className="case-conversation">{block.turns.map((turn, index) => <li key={index}>
        <header><span className="case-item-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>用户指令</span></header>
        <blockquote><p>“<InlineText text={sentenceText(turn.user)} />”</p></blockquote>
        <div className="case-conversation-response"><strong className="case-response-label">系统处理</strong><BodyText text={turn.process} />{turn.output ? <div className="case-conversation-output"><BodyText text={turn.output} /></div> : null}</div>
      </li>)}</ol>
      <Caption text={block.caption} />
    </section>;
    default: return null;
  }
}
