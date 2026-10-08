import type { EditableSentence } from "../schema/content";

export function splitSentences(value: string): string[] {
  const source = value.replace(/\r\n?/g, "\n");
  const result: string[] = [];
  let current = "";
  const closers = new Set(["”", "’", "\"", "'", ")", "]", "}", "】", "》", "」"]);
  const abbreviations = new Set(["mr.", "mrs.", "ms.", "dr.", "prof.", "e.g.", "i.e.", "etc."]);
  const isPeriodBoundary = (index: number) => {
    const prev = source[index - 1] ?? "";
    const next = source[index + 1] ?? "";
    if (prev.match(/\d/) && next.match(/\d/)) return false;
    if (next && !/\s/.test(next) && !closers.has(next)) return false;
    const token = current.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
    return !abbreviations.has(token);
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    current += char;
    const boundary = char === "\n" || /[。！？；!?;]/.test(char) || (char === "." && isPeriodBoundary(index));
    if (boundary) {
      while (index + 1 < source.length && closers.has(source[index + 1])) current += source[++index];
      if (current.trim()) result.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [""];
}

function values(value: EditableSentence): string[] {
  return Array.isArray(value) ? value : [value];
}

export function SentenceListEditor({ label, value, onChange }: { label: string; value: EditableSentence; onChange: (value: string[]) => void }) {
  const items = values(value);
  return <fieldset className="sentence-list-editor">
    <legend>{label}</legend>
    {items.map((sentence, index) => <fieldset className="sentence-row" key={index}><label className="structured-field sentence-field">第 {index + 1} 句<textarea value={sentence} onChange={(event) => onChange(items.map((item, i) => i === index ? event.target.value : item))} onBlur={(event) => onChange(items.flatMap((item, i) => i === index ? splitSentences(event.target.value) : [item]))} /></label><button type="button" className="structured-remove" disabled={items.length <= 1} onMouseDown={(event) => event.preventDefault()} onClick={() => onChange(items.filter((_, i) => i !== index))}>删除第 {index + 1} 句</button></fieldset>)}
    <div className="sentence-actions"><button type="button" className="structured-add" onClick={() => onChange([...items, ""])}>新句子。</button></div>
  </fieldset>;
}
