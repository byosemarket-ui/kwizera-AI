/**
 * Phase 18B — document and book extraction into text units that keep provenance (page, chapter, section,
 * paragraph, line). Reuses the shared PDF text layer (no OCR, no script execution) and HTML structuring;
 * DOCX/EPUB are read with the bounded ZIP reader. Units are only analysed — whole books are never indexed.
 */
import path from "node:path";
import { htmlToStructuredText } from "../knowledge-processing-engine/knowledge-chunker.js";
import { extractPdfText } from "../knowledge-processing-engine/pdf-text.js";
import { ZipArchive, ZipError } from "./zip-reader.js";

export interface TextUnit {
  text: string;
  page?: number;
  chapter?: string;
  section?: string;
  paragraph: number;
  line?: number;
  listItem?: boolean;
  ordered?: boolean;
  /** Consecutive list items share a list id so workflows can be reassembled. */
  listId?: number;
}

export interface ExtractedDocument {
  format: string;
  title: string | null;
  units: TextUnit[];
  pages: number;
  chapters: string[];
  sections: number;
  chars: number;
  notes: string[];
}

export class DocumentExtractionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

const MAX_UNITS = 20_000;
const MAX_CHARS = 3_000_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/**
 * Markdown-like text → units. "## Page N" (from the PDF extractor) sets the page; headings set chapter/section;
 * list items are flagged and grouped. `book` promotes level-1 headings (or "Chapter …" lines) to chapters.
 */
export function unitsFromMarkdown(markdown: string, opts: { pdf?: boolean; book?: boolean } = {}): { units: TextUnit[]; chapters: string[]; sections: number } {
  const units: TextUnit[] = [];
  const chapters: string[] = [];
  let page: number | undefined;
  let chapter: string | undefined;
  let section: string | undefined;
  let sections = 0;
  let paragraph = 0;
  let listId = 0;
  let inList = false;
  let buffer: string[] = [];
  let bufferLine = 0;
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      paragraph += 1;
      units.push({ text, page, chapter, section, paragraph, line: bufferLine });
    }
    buffer = [];
  };
  for (let i = 0; i < lines.length && units.length < MAX_UNITS; i += 1) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line) { flush(); inList = false; continue; }
    const pageMatch = opts.pdf ? line.match(/^##\s+Page\s+(\d{1,5})$/) : null;
    if (pageMatch) { flush(); page = Number(pageMatch[1]); inList = false; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const chapterLine = opts.book && !heading ? line.match(/^(chapter|part|book)\s+([0-9ivxlc]+|[a-z]+)\b[.:\s-]*(.{0,100})$/i) : null;
    if (heading || chapterLine) {
      flush();
      inList = false;
      const title = (heading ? heading[2]! : line).replace(/[#*_`]+/g, "").trim().slice(0, 140);
      const level = heading ? heading[1]!.length : 1;
      const isChapter = opts.book ? level === 1 || Boolean(chapterLine) || (level === 2 && !chapters.length) : false;
      if (isChapter) {
        chapter = title;
        section = undefined;
        if (!chapters.includes(title)) chapters.push(title);
      } else {
        section = title;
        sections += 1;
      }
      continue;
    }
    const list = line.match(/^([-*•]|\d{1,3}[.)])\s+(.+)$/);
    if (list) {
      flush();
      if (!inList) { listId += 1; inList = true; }
      paragraph += 1;
      units.push({ text: list[2]!.trim(), page, chapter, section, paragraph, line: i + 1, listItem: true, ordered: /\d/.test(list[1]!), listId });
      continue;
    }
    inList = false;
    if (!buffer.length) bufferLine = i + 1;
    buffer.push(line);
  }
  flush();
  return { units, chapters, sections };
}

function docxToMarkdown(xml: string): string {
  const out: string[] = [];
  for (const match of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const p = match[0];
    const text = decodeXml([...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => m[1] ?? " ").join("")).replace(/\s+/g, " ").trim();
    if (!text) { out.push(""); continue; }
    const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "";
    const heading = style.match(/^(?:Heading|heading|Titre|Überschrift)\s?(\d)$/)?.[1] ?? (/^Title$/i.test(style) ? "1" : null);
    if (heading) out.push("", `${"#".repeat(Math.min(6, Number(heading)))} ${text}`, "");
    else if (/<w:numPr>/.test(p)) out.push(`- ${text}`);
    else out.push(text, "");
  }
  return out.join("\n");
}

function epubToMarkdown(zip: ZipArchive, notes: string[]): { markdown: string; title: string | null } {
  const container = zip.readText("META-INF/container.xml");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new DocumentExtractionError("EPUB_INVALID", "The EPUB has no package document.");
  const opf = zip.readText(opfPath);
  if (!opf) throw new DocumentExtractionError("EPUB_INVALID", "The EPUB package document is missing.");
  const base = path.posix.dirname(opfPath);
  const manifest = new Map<string, { href: string; type: string }>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    const type = tag.match(/\bmedia-type="([^"]+)"/)?.[1] ?? "";
    if (id && href) manifest.set(id, { href: decodeURIComponent(href), type });
  }
  const title = decodeXml(opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/)?.[1] ?? "").trim() || null;
  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]!).slice(0, 400);
  const parts: string[] = [];
  let skipped = 0;
  for (const idref of spine) {
    const item = manifest.get(idref);
    if (!item || !/html|xml/.test(item.type)) { skipped += 1; continue; }
    const entryName = path.posix.normalize(path.posix.join(base === "." ? "" : base, item.href.split("#")[0]!));
    if (entryName.startsWith("..")) { skipped += 1; continue; }
    const html = zip.readText(entryName);
    if (!html) { skipped += 1; continue; }
    const structured = htmlToStructuredText(html);
    const body = structured.text.trim();
    if (!body) continue;
    const hasHeading = /^#\s+/m.test(body);
    const chapterTitle = structured.title && !hasHeading ? structured.title : null;
    parts.push(chapterTitle ? `# ${chapterTitle}\n\n${body}` : body);
  }
  if (skipped) notes.push(`${skipped} EPUB part(s) were not text and were skipped.`);
  return { markdown: parts.join("\n\n"), title };
}

/** RFC-4180-style CSV parsing (quoted fields, escaped quotes), bounded. */
export function parseCsv(text: string, maxRows = 2_000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const delimiter = (text.split("\n")[0]?.match(/;/g)?.length ?? 0) > (text.split("\n")[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length && rows.length < maxRows; i += 1) {
    const c = text[i]!;
    if (quoted) {
      if (c === "\"" && text[i + 1] === "\"") { field += "\""; i += 1; } else if (c === "\"") quoted = false; else field += c;
    } else if (c === "\"") quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row.map((f) => f.trim()));
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim()) && rows.length < maxRows) rows.push(row.map((f) => f.trim()));
  return rows;
}

function csvUnits(text: string): { units: TextUnit[]; rows: number } {
  const rows = parseCsv(text);
  if (!rows.length) return { units: [], rows: 0 };
  const header = rows[0]!;
  const headerLike = header.every((h) => h && !/^-?\d+([.,]\d+)?$/.test(h));
  const body = headerLike ? rows.slice(1) : rows;
  const units = body.map((r, i) => ({
    text: r.map((v, j) => (headerLike && header[j] ? `${header[j]}: ${v}` : v)).filter((s) => s.replace(/^[^:]*:\s*/, "")).join("; "),
    paragraph: i + 1,
    line: i + (headerLike ? 2 : 1),
    section: headerLike ? header.slice(0, 4).join(", ") : undefined,
  })).filter((u) => u.text);
  return { units, rows: body.length };
}

export function documentFormat(fileName: string, mimeType: string): string | null {
  const ext = path.extname(fileName).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") return "pdf";
  if (ext === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === ".epub" || mimeType === "application/epub+zip") return "epub";
  if (ext === ".csv" || mimeType === "text/csv") return "csv";
  if (ext === ".md" || ext === ".markdown" || mimeType === "text/markdown" || mimeType === "text/x-markdown") return "md";
  if (ext === ".html" || ext === ".htm" || mimeType === "text/html") return "html";
  if (ext === ".txt" || mimeType === "text/plain") return "txt";
  if (ext === ".doc" || mimeType === "application/msword") return "doc";
  return null;
}

/** Extracts a document/book into provenance-bearing units. Throws DocumentExtractionError with a user-safe message. */
export async function extractDocument(bytes: Buffer, fileName: string, mimeType: string, opts: { book?: boolean } = {}): Promise<ExtractedDocument> {
  const format = documentFormat(fileName, mimeType);
  const notes: string[] = [];
  if (!format) throw new DocumentExtractionError("UNSUPPORTED_FORMAT", `${fileName}: unsupported document type.`);
  if (format === "doc") throw new DocumentExtractionError("DOC_UNSUPPORTED", "Legacy .doc files cannot be read on this server; save the file as .docx or PDF.");
  let markdown = "";
  let title: string | null = null;
  let pages = 0;
  let pdf = false;
  try {
    if (format === "pdf") {
      const result = await extractPdfText(bytes);
      if (!result.ok) throw new DocumentExtractionError(result.errorCode ?? "PDF_INVALID", result.message ?? "The PDF could not be read.");
      markdown = result.markdown;
      pages = result.pageCount;
      pdf = true;
      if (result.pagesWithText < result.pageCount) notes.push(`${result.pageCount - result.pagesWithText} page(s) contain no extractable text (no OCR on this server).`);
    } else if (format === "docx") {
      const zip = new ZipArchive(bytes);
      const xml = zip.readText("word/document.xml");
      if (!xml) throw new DocumentExtractionError("DOCX_INVALID", "The DOCX has no document body.");
      markdown = docxToMarkdown(xml);
      title = decodeXml(zip.readText("docProps/core.xml")?.match(/<dc:title>([\s\S]*?)<\/dc:title>/)?.[1] ?? "").trim() || null;
      if (zip.entries.some((e) => /^word\/media\//.test(e.name))) notes.push("Embedded images in the DOCX were not analysed.");
      if (zip.entries.some((e) => /vbaProject\.bin$/i.test(e.name))) notes.push("The document contains macros; they were ignored and never run.");
    } else if (format === "epub") {
      const zip = new ZipArchive(bytes);
      const epub = epubToMarkdown(zip, notes);
      markdown = epub.markdown;
      title = epub.title;
    } else if (format === "csv") {
      const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
      const { units, rows } = csvUnits(text);
      const chars = units.reduce((a, u) => a + u.text.length, 0);
      if (!units.length) throw new DocumentExtractionError("EMPTY_DOCUMENT", "The CSV has no rows.");
      return { format, title: null, units, pages: 0, chapters: [], sections: 0, chars, notes: rows >= 2_000 ? ["Only the first 2,000 rows were analysed."] : [] };
    } else if (format === "html") {
      const structured = htmlToStructuredText(bytes.toString("utf8"));
      markdown = structured.text;
      title = structured.title ?? null;
    } else {
      markdown = bytes.toString("utf8").replace(/^\uFEFF/, "");
    }
  } catch (err) {
    if (err instanceof DocumentExtractionError) throw err;
    if (err instanceof ZipError) throw new DocumentExtractionError(err.code, err.message);
    throw new DocumentExtractionError("EXTRACTION_FAILED", "The document could not be read.");
  }
  if (markdown.length > MAX_CHARS) {
    markdown = markdown.slice(0, MAX_CHARS);
    notes.push("Only the first 3 million characters were analysed.");
  }
  const book = Boolean(opts.book) || format === "epub";
  const { units, chapters, sections } = unitsFromMarkdown(markdown, { pdf, book });
  const chars = units.reduce((a, u) => a + u.text.length, 0);
  if (chars < 20) throw new DocumentExtractionError("EMPTY_DOCUMENT", "No usable text was found in the document.");
  return { format, title, units, pages, chapters, sections, chars, notes };
}
