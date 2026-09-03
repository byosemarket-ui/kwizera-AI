export function estimateCharWidth(fontSizePx: number): number {
  return fontSizePx * 0.56;
}

export function wrapText(text: string, maxWidthPx: number, fontSizePx: number, maxLines: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const charW = estimateCharWidth(fontSizePx);
  const maxChars = Math.max(8, Math.floor(maxWidthPx / charW));
  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      current = "";
    } else {
      current = word;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export function fitText(input: {
  text: string;
  width: number;
  height: number;
  hierarchy: number;
  roleMaxLines?: number;
}): { lines: string[]; fontSizePx: number; maxLines: number } {
  const maxLines = input.roleMaxLines ?? (input.hierarchy <= 2 ? 2 : 3);
  const minSize = Math.max(14, Math.round(Math.min(input.width, input.height) * 0.028));
  const preferred = input.hierarchy <= 2
    ? Math.round(Math.min(input.width, input.height) * 0.055)
    : input.hierarchy === 3
      ? Math.round(Math.min(input.width, input.height) * 0.042)
      : Math.round(Math.min(input.width, input.height) * 0.034);
  const usableWidth = input.width * 0.82;
  let fontSizePx = preferred;
  let lines = wrapText(input.text, usableWidth, fontSizePx, maxLines);
  while (fontSizePx > minSize) {
    const overflow = lines.join(" ").length < input.text.replace(/\s+/g, " ").trim().length
      && lines.length >= maxLines;
    const tooWide = lines.some((line) => line.length * estimateCharWidth(fontSizePx) > usableWidth);
    if (!overflow && !tooWide) break;
    fontSizePx -= 2;
    lines = wrapText(input.text, usableWidth, fontSizePx, maxLines);
  }
  return { lines, fontSizePx, maxLines };
}

export function needsExtendedLatin(text: string): boolean {
  return /[^\u0000-\u007F]/.test(text);
}
