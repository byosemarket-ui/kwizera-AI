/**
 * Phase 17 — Source text extraction and heading-aware chunking.
 * Source text is DATA: markup is stripped, scripts are never evaluated, headings are kept for context.
 */
import { createHash } from "node:crypto";

export type ExtractableMimeType = "text/plain" | "text/markdown" | "text/html" | "application/pdf" | string;

export interface ExtractionResult {
  ok: boolean;
  text: string;
  title?: string;
  format: "plain" | "markdown" | "html";
  errorCode?: "UNSUPPORTED_FORMAT" | "EMPTY_CONTENT" | "PDF_EXTRACTION_UNAVAILABLE";
  message?: string;
}

const ENTITY: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'",
  "&mdash;": "—", "&ndash;": "–", "&hellip;": "…", "&rsquo;": "'", "&lsquo;": "'", "&rdquo;": "\"", "&ldquo;": "\"",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITY[m.toLowerCase()] ?? " ");
}

/** HTML → markdown-ish text that keeps headings, paragraphs and list items. */
export function htmlToStructuredText(html: string): { text: string; title?: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i) ?? html.match(/<article[\s\S]*?<\/article>/i);
  let body = mainMatch ? mainMatch[0] : html;
  body = body
    .replace(/<(script|style|noscript|template|svg|iframe|object|embed|form|button|select)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  body = body
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, inner: string) =>
      `\n\n${"#".repeat(Number(level))} ${inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n\n`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|section|li|tr|table|ul|ol|blockquote|pre)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : undefined;
  return { text, title };
}

export function extractSourceText(input: { mimeType?: ExtractableMimeType; content: string; fileName?: string }): ExtractionResult {
  const mime = (input.mimeType ?? "").toLowerCase();
  const name = (input.fileName ?? "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return {
      ok: false,
      text: "",
      format: "plain",
      errorCode: "PDF_EXTRACTION_UNAVAILABLE",
      message: "PDF text extraction is not installed on this server. Upload the document as text or markdown.",
    };
  }
  const raw = String(input.content ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
  let result: ExtractionResult;
  if (mime.includes("html") || name.endsWith(".html") || name.endsWith(".htm") || /^\s*<(!doctype|html)/i.test(raw)) {
    const html = htmlToStructuredText(raw);
    result = { ok: true, text: html.text, title: html.title, format: "html" };
  } else if (mime.includes("markdown") || name.endsWith(".md") || /^#{1,6} /m.test(raw)) {
    result = { ok: true, text: raw.trim(), format: "markdown" };
  } else if (!mime || mime.startsWith("text/") || mime.includes("json") || name.endsWith(".txt")) {
    result = { ok: true, text: raw.trim(), format: "plain" };
  } else {
    return { ok: false, text: "", format: "plain", errorCode: "UNSUPPORTED_FORMAT", message: `Unsupported document type: ${mime}` };
  }
  if (result.text.replace(/\s+/g, "").length < 40) {
    return { ...result, ok: false, errorCode: "EMPTY_CONTENT", message: "No usable text was found in the source." };
  }
  return result;
}

export interface KnowledgeChunk {
  index: number;
  text: string;
  headingPath: string[];
  section: string;
  /** 1-based paragraph range inside the source. */
  paragraphStart: number;
  paragraphEnd: number;
  charStart: number;
  charEnd: number;
  hash: string;
}

export interface ChunkOptions {
  targetChars?: number;
  maxChars?: number;
  minChars?: number;
}

export function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/[\s\u00a0]+/g, " ").replace(/[^\p{L}\p{N} ]+/gu, "").trim();
}

export function chunkHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex").slice(0, 32);
}

function splitSentences(paragraph: string): string[] {
  return paragraph.match(/[^.!?]+(?:[.!?]+["')\]]?|$)\s*/g)?.map((s) => s) ?? [paragraph];
}

interface Block { heading: string[]; text: string; paragraph: number; offset: number }

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const headingStack: string[] = [];
  let paragraph = 0;
  let lines: string[] = [];
  let start = 0;
  const flush = () => {
    const trimmed = lines.join("\n").trim();
    lines = [];
    if (!trimmed) return;
    paragraph += 1;
    blocks.push({ heading: headingStack.filter(Boolean), text: trimmed.replace(/[ \t]+/g, " "), paragraph, offset: start });
  };
  let offset = 0;
  for (const line of text.split("\n")) {
    const lineOffset = offset;
    offset += line.length + 1;
    const heading = line.trim().match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      headingStack.length = Math.min(headingStack.length, level - 1);
      headingStack[level - 1] = heading[2].trim();
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (!lines.length) start = lineOffset;
    lines.push(line);
  }
  flush();
  return blocks;
}

/**
 * Accumulates whole paragraphs under the same heading up to targetChars; long paragraphs split at sentence
 * boundaries only. Chunks never cross a heading so each keeps its own section context.
 */
export function chunkDocument(text: string, options: ChunkOptions = {}): KnowledgeChunk[] {
  const target = options.targetChars ?? 900;
  const max = Math.max(target, options.maxChars ?? 1_400);
  const min = options.minChars ?? 160;
  const blocks = toBlocks(text);
  const chunks: KnowledgeChunk[] = [];
  let current: { parts: string[]; heading: string[]; pStart: number; pEnd: number; cStart: number; cEnd: number } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.parts.join("\n\n").trim();
    if (body) {
      const previous = chunks[chunks.length - 1];
      if (body.length < min && previous && previous.headingPath.join("/") === current.heading.join("/") && previous.text.length + body.length <= max) {
        previous.text = `${previous.text}\n\n${body}`;
        previous.paragraphEnd = current.pEnd;
        previous.charEnd = current.cEnd;
        previous.hash = chunkHash(previous.text);
      } else {
        chunks.push({
          index: chunks.length,
          text: body,
          headingPath: [...current.heading],
          section: current.heading[current.heading.length - 1] ?? "",
          paragraphStart: current.pStart,
          paragraphEnd: current.pEnd,
          charStart: current.cStart,
          charEnd: current.cEnd,
          hash: chunkHash(body),
        });
      }
    }
    current = null;
  };

  for (const block of blocks) {
    const sameHeading = current && current.heading.join("/") === block.heading.join("/");
    if (current && (!sameHeading || current.parts.join("\n\n").length + block.text.length > target)) flush();
    const pieces: string[] = [];
    if (block.text.length > max) {
      let buffer = "";
      for (const sentence of splitSentences(block.text)) {
        if (buffer && buffer.length + sentence.length > target) {
          pieces.push(buffer.trim());
          buffer = "";
        }
        buffer += sentence;
      }
      if (buffer.trim()) pieces.push(buffer.trim());
    } else {
      pieces.push(block.text);
    }
    for (const piece of pieces) {
      if (current && current.parts.join("\n\n").length + piece.length > target) flush();
      if (!current) {
        current = { parts: [], heading: block.heading, pStart: block.paragraph, pEnd: block.paragraph, cStart: block.offset, cEnd: block.offset };
      }
      current.parts.push(piece);
      current.pEnd = block.paragraph;
      current.cEnd = block.offset + block.text.length;
    }
  }
  flush();

  const seen = new Set<string>();
  return chunks
    .filter((chunk) => {
      if (seen.has(chunk.hash)) return false;
      seen.add(chunk.hash);
      return true;
    })
    .map((chunk, index) => ({ ...chunk, index }));
}

export function sourceContentHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}
