import type { EditableSentence } from "../schema/content";

export function sentenceText(value: EditableSentence | undefined): string {
  return Array.isArray(value) ? value.join("\n") : value ?? "";
}

export function sentenceParagraphs(value: EditableSentence | undefined): string[] {
  return Array.isArray(value) ? value : sentenceText(value).split(/\n\n+/).filter(Boolean);
}
