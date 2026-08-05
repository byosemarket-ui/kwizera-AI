/**
 * Offline document readers — read collected files without modifying originals.
 * Supports text formats natively; PDF/DOCX use conservative text-layer extraction.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { SupportedDocumentFormat } from "./document-understanding-types.js";

export interface RawDocumentRead {
  format: SupportedDocumentFormat;
  text: string;
  encoding: string;
  fileSizeBytes: number;
  issues: string[];
}

const EXT_FORMAT: Record<string, SupportedDocumentFormat> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".md": "markdown",
  ".markdown": "markdown",
  ".html": "html",
  ".htm": "html",
  ".json": "json",
  ".xml": "xml",
  ".csv": "csv",
};

export class DocumentReader {
  detectFormat(filePath: string, resourceType?: string, sourceType?: string): SupportedDocumentFormat {
    const ext = path.extname(filePath).toLowerCase();
    if (EXT_FORMAT[ext]) return EXT_FORMAT[ext];
    if (sourceType === "official-api-documentation" || resourceType === "api-specification") return "api-documentation";
    if (sourceType === "technical-manual") return "technical-manual";
    if (sourceType === "research-paper") return "research-paper";
    if (sourceType === "user-manual") return "user-guide";
    if (sourceType === "company-document") return "company-documentation";
    return "unknown";
  }

  async read(filePath: string, resourceType?: string, sourceType?: string): Promise<RawDocumentRead> {
    const format = this.detectFormat(filePath, resourceType, sourceType);
    const stat = await fs.stat(filePath);
    const issues: string[] = [];

    if (format === "pdf") {
      const buffer = await fs.readFile(filePath);
      const text = extractPdfTextLayer(buffer);
      if (!text.trim()) issues.push("PDF text layer was empty or binary-only; structure inferred from available text fragments.");
      return { format, text, encoding: "binary-text-layer", fileSizeBytes: stat.size, issues };
    }

    if (format === "docx") {
      const buffer = await fs.readFile(filePath);
      const text = extractDocxApproximateText(buffer);
      if (!text.trim()) issues.push("DOCX XML text could not be fully extracted without a dedicated parser; partial text used.");
      return { format, text, encoding: "docx-xml-text", fileSizeBytes: stat.size, issues };
    }

    const raw = await fs.readFile(filePath);
    let text = raw.toString("utf8");
    let encoding = "utf8";
    if (text.includes("\uFFFD")) {
      text = raw.toString("latin1");
      encoding = "latin1";
      issues.push("Fell back to latin1 decoding for non-UTF8 content.");
    }

    if (format === "json") {
      try {
        const parsed = JSON.parse(text);
        text = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
      } catch {
        issues.push("JSON parse failed; raw text retained for analysis.");
      }
    }

    return { format, text, encoding, fileSizeBytes: stat.size, issues };
  }
}

/** Lightweight PDF text extraction from literal strings — no external dependency. */
function extractPdfTextLayer(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const parts: string[] = [];
  const paren = /\((?:\\.|[^\\)]){2,}\)/g;
  let match: RegExpExecArray | null;
  while ((match = paren.exec(latin1))) {
    const raw = match[0].slice(1, -1);
    const decoded = raw
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z]{3,}/.test(decoded)) parts.push(decoded);
  }
  const tj = /\[(.*?)\]\s*TJ/gs;
  while ((match = tj.exec(latin1))) {
    const inner = match[1];
    const strings = inner.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    for (const item of strings) {
      const decoded = item.slice(1, -1).replace(/\\n/g, "\n").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
      if (/[A-Za-z]{3,}/.test(decoded)) parts.push(decoded);
    }
  }
  return parts.join("\n");
}

/** Approximate DOCX text by scanning UTF8/XML-looking regions for <w:t> content. */
function extractDocxApproximateText(buffer: Buffer): string {
  const asLatin = buffer.toString("latin1");
  const parts: string[] = [];
  const tag = /<w:t[^>]*>([^<]{2,})<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(asLatin))) {
    parts.push(decodeXmlEntities(match[1]));
  }
  if (parts.length) return parts.join(" ");
  // Fallback: readable ASCII runs
  return (asLatin.match(/[A-Za-z0-9 ,.;:()\-]{6,}/g) ?? []).join("\n");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
