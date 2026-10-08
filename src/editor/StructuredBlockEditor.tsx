import type { Block, EditableSentence } from "../schema/content";
import "./StructuredBlockEditor.css";
import { SentenceListEditor } from "./SentenceListEditor";

type StructuredBlock = Extract<Block, { type: "table" | "flow" | "cards" | "callout" | "hub" | "conversation" }>;

const optionalTitle = (block: StructuredBlock, onChange: (block: Block) => void) => (
  <label className="structured-field">区块标题<input value={block.title ?? ""} onChange={(event) => onChange({ ...block, title: event.target.value } as Block)} /></label>
);

export function StructuredBlockEditor({ block, onChange }: { block: Block; onChange: (block: Block) => void }) {
  if (!["table", "flow", "cards", "callout", "hub", "conversation"].includes(block.type)) return null;

  const update = (patch: Partial<StructuredBlock>) => onChange({ ...block, ...patch } as Block);
  const field = (label: string, value: string, change: (value: string) => void, multiline = false) => (
    <label className="structured-field">{label}{multiline
      ? <textarea value={value} onChange={(event) => change(event.target.value)} />
      : <input value={value} onChange={(event) => change(event.target.value)} />}</label>
  );
  const sentenceField = (label: string, value: EditableSentence | undefined, change: (value: EditableSentence) => void) => value === undefined
    ? <SentenceListEditor label={label} value={[""]} onChange={change} />
    : Array.isArray(value)
      ? <SentenceListEditor label={label} value={value} onChange={change} />
      : field(label, value, (next) => change(next), true);
  const addButton = (label: string, action: () => void) => <button type="button" className="structured-add" onClick={action}>{label}</button>;
  const removeButton = (label: string, disabled: boolean, action: () => void) => <button type="button" className="structured-remove" disabled={disabled} onClick={action}>{label}</button>;

  switch (block.type) {
    case "table":
      return <section className="structured-block-editor" aria-label="表格内容编辑">
        {optionalTitle(block, onChange)}
        <div className="structured-table-scroll"><table><thead><tr>{block.columns.map((column, index) => <th key={index} scope="col">{field(`第 ${index + 1} 列名称`, column, (value) => update({ columns: block.columns.map((item, i) => i === index ? value : item) }))}</th>)}<th scope="col">行操作</th></tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.columns.map((_, columnIndex) => <td key={columnIndex}>{sentenceField(`第 ${rowIndex + 1} 行，第 ${columnIndex + 1} 列`, row[columnIndex] ?? "", (value) => update({ rows: block.rows.map((items, i) => i === rowIndex ? block.columns.map((__, j) => j === columnIndex ? value : items[j] ?? "") : block.columns.map((__, j) => items[j] ?? "")) }))}</td>)}
            {block.columns.length > 0 && <td>{removeButton("删除此行", block.rows.length <= 1, () => update({ rows: block.rows.filter((_, i) => i !== rowIndex) }))}</td>}</tr>)}</tbody></table></div>
        {addButton("新增一行", () => update({ rows: [...block.rows.map((row) => block.columns.map((_, i) => row[i] ?? [""])), block.columns.map(() => [""])] }))}
      </section>;
    case "flow":
      return <section className="structured-block-editor" aria-label="流程内容编辑">
        {optionalTitle(block, onChange)}
        <label className="structured-field">流程样式<select value={block.variant} onChange={(event) => update({ variant: event.target.value as "linear" | "state" })}><option value="linear">线性步骤</option><option value="state">状态流转</option></select></label>
        <div className="structured-entry-list">{block.steps.map((step, index) => <fieldset className="structured-entry" key={index}><legend>步骤 {index + 1}</legend>
          {field("步骤标题", step.title, (title) => update({ steps: block.steps.map((item, i) => i === index ? { ...item, title } : item) }))}
          {sentenceField("步骤说明", step.body, (body) => update({ steps: block.steps.map((item, i) => i === index ? { ...item, body } : item) }))}
          {removeButton("删除步骤", block.steps.length <= 2, () => update({ steps: block.steps.filter((_, i) => i !== index) }))}</fieldset>)}</div>
        {addButton("新增步骤", () => update({ steps: [...block.steps, { title: "新步骤", body: [""] }] }))}
        {sentenceField("流程说明", block.caption, (caption) => update({ caption }))}
      </section>;
    case "cards":
      return <section className="structured-block-editor" aria-label="卡片内容编辑">
        {optionalTitle(block, onChange)}
        <label className="structured-field">卡片布局<select value={block.layout} onChange={(event) => update({ layout: event.target.value as "grid" | "list" | "quotes" })}><option value="grid">网格</option><option value="list">列表</option><option value="quotes">引用</option></select></label>
        <div className="structured-entry-list">{block.items.map((item, index) => <fieldset className="structured-entry" key={index}><legend>卡片 {index + 1}</legend>
          {field("卡片标题", item.title, (title) => update({ items: block.items.map((entry, i) => i === index ? { ...entry, title } : entry) }))}
          {sentenceField("卡片内容", item.body, (body) => update({ items: block.items.map((entry, i) => i === index ? { ...entry, body } : entry) }))}
          {removeButton("删除卡片", block.items.length <= 1, () => update({ items: block.items.filter((_, i) => i !== index) }))}</fieldset>)}</div>
        {addButton("新增卡片", () => update({ items: [...block.items, { title: "新条目", body: [""] }] }))}
      </section>;
    case "callout":
      return <section className="structured-block-editor" aria-label="提示内容编辑">
        {optionalTitle(block, onChange)}
        {sentenceField("提示文字", block.text, (text) => update({ text }))}
        <label className="structured-field">提示类型<select value={block.tone} onChange={(event) => update({ tone: event.target.value as "note" | "key" })}><option value="note">补充说明</option><option value="key">重点提示</option></select></label>
      </section>;
    case "hub":
      return <section className="structured-block-editor" aria-label="主题分支内容编辑">
        {optionalTitle(block, onChange)}
        <fieldset className="structured-entry"><legend>中心主题</legend>
          {field("主题名称", block.root.title, (title) => update({ root: { ...block.root, title } }))}
          {sentenceField("主题说明", block.root.body, (body) => update({ root: { ...block.root, body } }))}</fieldset>
        <div className="structured-entry-list">{block.nodes.map((node, index) => <fieldset className="structured-entry" key={index}><legend>分支 {index + 1}</legend>
          {field("分支标题", node.title, (title) => update({ nodes: block.nodes.map((item, i) => i === index ? { ...item, title } : item) }))}
          {field("分支副标题", node.subtitle ?? "", (subtitle) => update({ nodes: block.nodes.map((item, i) => i === index ? { ...item, subtitle } : item) }))}
          {sentenceField("分支内容", node.body, (body) => update({ nodes: block.nodes.map((item, i) => i === index ? { ...item, body } : item) }))}
          {removeButton("删除分支", block.nodes.length <= 1, () => update({ nodes: block.nodes.filter((_, i) => i !== index) }))}</fieldset>)}</div>
        {addButton("新增分支", () => update({ nodes: [...block.nodes, { title: "新分支", subtitle: "", body: ["填写分支职责。"] }] }))}
        {sentenceField("图示说明", block.caption, (caption) => update({ caption }))}
      </section>;
    case "conversation":
      return <section className="structured-block-editor" aria-label="对话内容编辑">
        {optionalTitle(block, onChange)}
        <div className="structured-entry-list">{block.turns.map((turn, index) => <fieldset className="structured-entry" key={index}><legend>对话 {index + 1}</legend>
          {sentenceField("用户输入", turn.user, (user) => update({ turns: block.turns.map((item, i) => i === index ? { ...item, user } : item) }))}
          {sentenceField("处理过程", turn.process, (process) => update({ turns: block.turns.map((item, i) => i === index ? { ...item, process } : item) }))}
          {sentenceField("输出结果", turn.output, (output) => update({ turns: block.turns.map((item, i) => i === index ? { ...item, output } : item) }))}
          {removeButton("删除对话", block.turns.length <= 1, () => update({ turns: block.turns.filter((_, i) => i !== index) }))}</fieldset>)}</div>
        {addButton("新增对话", () => update({ turns: [...block.turns, { user: ["用户指令"], process: ["填写系统处理过程。"], output: [""] }] }))}
        {sentenceField("对话说明", block.caption, (caption) => update({ caption }))}
      </section>;
    default:
      return null;
  }
}
