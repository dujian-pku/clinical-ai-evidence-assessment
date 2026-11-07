import type { ReportHighlight } from './assessment.ts';

// Emphasis is optional display metadata. Ignore invalid spans without changing the prose.
export function selectReportHighlights(paragraphs: string[], value: unknown): ReportHighlight[] {
  if (!Array.isArray(value)) return [];
  const selected: ReportHighlight[] = [];
  const ranges = new Map<number, { start: number; end: number }[]>();
  const totalLimit = paragraphs.join('').length * 0.25;
  let total = 0;
  for (const item of value.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const { paragraph, text } = item;
    if (!Number.isInteger(paragraph) || paragraph < 0 || paragraph >= paragraphs.length || typeof text !== 'string') continue;
    if (text.length < 6 || text.length > 60 || text !== text.trim()) continue;
    const body = paragraphs[paragraph];
    const start = body.indexOf(text);
    if (start < 0) continue;
    const end = start + text.length;
    const existing = ranges.get(paragraph) || [];
    if (existing.length >= 2 || existing.some(r => start < r.end && end > r.start)) continue;
    const paragraphTotal = existing.reduce((sum, r) => sum + r.end - r.start, 0);
    if (paragraphTotal + text.length > body.length * 0.4 || total + text.length > totalLimit) continue;
    selected.push({ paragraph, text });
    ranges.set(paragraph, [...existing, { start, end }]);
    total += text.length;
    if (selected.length === 6) break;
  }
  return selected.sort((a, b) => a.paragraph - b.paragraph || paragraphs[a.paragraph].indexOf(a.text) - paragraphs[b.paragraph].indexOf(b.text));
}
