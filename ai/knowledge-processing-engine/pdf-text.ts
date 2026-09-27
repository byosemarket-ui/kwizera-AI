/**
 * PDF → structured markdown text (pages and, where font sizes allow, headings).
 * Uses the unpdf (PDF.js) text layer only: no rendering, no script execution, no OCR.
 * Scanned/image-only PDFs yield no text and are reported as such instead of being ingested empty.
 */

export interface PdfTextResult {
  ok: boolean;
  markdown: string;
  pageCount: number;
  pagesWithText: number;
  headings: string[];
  chars: number;
  errorCode?: "PDF_INVALID" | "PDF_ENCRYPTED" | "PDF_NO_TEXT" | "PDF_TOO_LARGE" | "PDF_EXTRACTION_UNAVAILABLE";
  message?: string;
}

const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 400;

interface TextItem { str: string; fontSize: number; hasEOL: boolean }

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

function pageToLines(items: TextItem[]): Array<{ text: string; size: number }> {
  const lines: Array<{ text: string; size: number }> = [];
  let text = "";
  let size = 0;
  for (const item of items) {
    text += item.str;
    size = Math.max(size, Number.isFinite(item.fontSize) ? item.fontSize : 0);
    if (item.hasEOL) {
      if (text.trim()) lines.push({ text: text.replace(/\s+/g, " ").trim(), size });
      text = "";
      size = 0;
    }
  }
  if (text.trim()) lines.push({ text: text.replace(/\s+/g, " ").trim(), size });
  return lines;
}

/** Median font size weighted by characters: the body text size of the page. */
function bodySize(lines: Array<{ text: string; size: number }>): number {
  const sizes: number[] = [];
  for (const line of lines) for (let i = 0; i < Math.min(line.text.length, 200); i += 1) sizes.push(line.size);
  if (!sizes.length) return 0;
  sizes.sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)]!;
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  const empty = { markdown: "", pageCount: 0, pagesWithText: 0, headings: [], chars: 0 };
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, ...empty, errorCode: "PDF_TOO_LARGE", message: "The PDF is larger than 40 MB." };
  if (!isPdf(bytes)) return { ok: false, ...empty, errorCode: "PDF_INVALID", message: "The file is not a valid PDF document." };
  let unpdf: typeof import("unpdf");
  try {
    unpdf = await import("unpdf");
  } catch {
    return { ok: false, ...empty, errorCode: "PDF_EXTRACTION_UNAVAILABLE", message: "PDF text extraction is not installed on this server." };
  }
  let pages: TextItem[][];
  let pageCount: number;
  try {
    const pdfOptions = { isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 };
    const doc = await unpdf.getDocumentProxy(new Uint8Array(bytes), pdfOptions as Parameters<typeof unpdf.getDocumentProxy>[1]);
    pageCount = doc.numPages;
    if (pageCount > MAX_PAGES) return { ok: false, ...empty, pageCount, errorCode: "PDF_TOO_LARGE", message: `The PDF has more than ${MAX_PAGES} pages.` };
    const extracted = await unpdf.extractTextItems(doc);
    pages = extracted.items as TextItem[][];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password|encrypt/i.test(message)) return { ok: false, ...empty, errorCode: "PDF_ENCRYPTED", message: "The PDF is password-protected." };
    return { ok: false, ...empty, errorCode: "PDF_INVALID", message: "The PDF could not be parsed." };
  }

  const out: string[] = [];
  const headings: string[] = [];
  let pagesWithText = 0;
  pages.forEach((items, index) => {
    const lines = pageToLines(items);
    if (!lines.length) return;
    pagesWithText += 1;
    out.push(`## Page ${index + 1}`);
    const body = bodySize(lines);
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) out.push(paragraph.join(" "));
      paragraph = [];
    };
    for (const line of lines) {
      const heading = body > 0 && line.size >= body * 1.25 && line.text.length <= 120 && /\p{L}/u.test(line.text) && !/[.,;:]$/.test(line.text);
      if (heading) {
        flush();
        out.push(`### ${line.text}`);
        if (headings.length < 200) headings.push(line.text);
      } else {
        paragraph.push(line.text);
        if (/[.!?:]$/.test(line.text)) flush();
      }
    }
    flush();
  });
  const markdown = out.join("\n\n").trim();
  const chars = markdown.replace(/^#+ .*$/gm, "").replace(/\s+/g, "").length;
  if (chars < 40) {
    return {
      ok: false, markdown: "", pageCount, pagesWithText, headings: [], chars,
      errorCode: "PDF_NO_TEXT", message: "No extractable text was found. Scanned or image-only PDFs need OCR, which is not available.",
    };
  }
  return { ok: true, markdown, pageCount, pagesWithText, headings, chars };
}
