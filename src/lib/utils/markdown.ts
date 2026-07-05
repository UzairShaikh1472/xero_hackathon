import { marked } from "marked";

export function markdownToHtml(text: string): string {
  return marked.parse(text, { breaks: true }) as string;
}
