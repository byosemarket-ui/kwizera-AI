/**
 * Parses document text into structural understanding (headings, sections, tables, media, references).
 */

import type {
  DocumentHeading,
  DocumentMediaRef,
  DocumentReference,
  DocumentSection,
  DocumentStructure,
  DocumentTableRef,
  SupportedDocumentFormat,
} from "./document-understanding-types.js";

export class DocumentStructureParser {
  parse(text: string, format: SupportedDocumentFormat, fallbackTitle: string): DocumentStructure {
    const normalized = text.replace(/\r\n/g, "\n");
    const headings = this.extractHeadings(normalized, format);
    const chapters = headings.filter((heading) => heading.level <= 2).map((heading) => heading.text);
    const subHeadings = headings.filter((heading) => heading.level >= 3);
    const sections = this.buildSections(normalized, headings);
    const tables = this.extractTables(normalized, format);
    const images = this.extractMedia(normalized, "image");
    const diagrams = this.extractMedia(normalized, "diagram");
    const references = this.extractReferences(normalized);
    const title =
      headings.find((heading) => heading.level === 1)?.text ||
      this.extractHtmlTitle(normalized) ||
      this.extractJsonTitle(normalized, format) ||
      fallbackTitle;

    return {
      title,
      chapters: unique(chapters.length ? chapters : title ? [title] : []),
      sections,
      headings,
      subHeadings,
      tables,
      images,
      diagrams,
      references,
    };
  }

  private extractHeadings(text: string, format: SupportedDocumentFormat): DocumentHeading[] {
    const lines = text.split("\n");
    const headings: DocumentHeading[] = [];

    if (format === "markdown" || format === "txt" || format === "technical-manual" || format === "user-guide" || format === "company-documentation" || format === "research-paper" || format === "unknown" || format === "pdf" || format === "docx") {
      lines.forEach((line, index) => {
        const md = /^(#{1,6})\s+(.+)$/.exec(line.trim());
        if (md) {
          headings.push({ level: md[1].length, text: md[2].trim(), line: index + 1 });
          return;
        }
        const numbered = /^(\d+(?:\.\d+){0,3})\s+([A-Z][\w\s\-:]{3,80})$/.exec(line.trim());
        if (numbered) {
          const depth = numbered[1].split(".").length;
          headings.push({ level: Math.min(6, depth), text: numbered[2].trim(), line: index + 1 });
        }
      });
    }

    if (format === "html" || format === "api-documentation") {
      const htmlHeading = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
      let match: RegExpExecArray | null;
      let line = 1;
      while ((match = htmlHeading.exec(text))) {
        headings.push({
          level: Number(match[1]),
          text: stripTags(match[2]).trim(),
          line: line++,
        });
      }
    }

    if (format === "xml") {
      const xmlTitle = /<(?:title|heading|chapter|section)[^>]*>([^<]{2,})<\/(?:title|heading|chapter|section)>/gi;
      let match: RegExpExecArray | null;
      let line = 1;
      while ((match = xmlTitle.exec(text))) {
        headings.push({ level: 2, text: match[1].trim(), line: line++ });
      }
    }

    if (format === "json") {
      try {
        const parsed = JSON.parse(text);
        collectJsonKeys(parsed, headings, 1);
      } catch {
        // ignore
      }
    }

    if (format === "csv") {
      const header = text.split("\n")[0];
      if (header) headings.push({ level: 1, text: `Columns: ${header.split(",").slice(0, 8).join(", ")}`, line: 1 });
    }

    return headings;
  }

  private buildSections(text: string, headings: DocumentHeading[]): DocumentSection[] {
    if (!headings.length) {
      const preview = text.trim().slice(0, 280);
      return preview
        ? [{ title: "Body", level: 1, contentPreview: preview, startLine: 1, endLine: text.split("\n").length }]
        : [];
    }
    const lines = text.split("\n");
    return headings.map((heading, index) => {
      const next = headings[index + 1];
      const startLine = heading.line;
      const endLine = next ? next.line - 1 : lines.length;
      const contentPreview = lines.slice(startLine, Math.min(endLine, startLine + 8)).join(" ").trim().slice(0, 280);
      return {
        title: heading.text,
        level: heading.level,
        contentPreview,
        startLine,
        endLine,
      };
    });
  }

  private extractTables(text: string, format: SupportedDocumentFormat): DocumentTableRef[] {
    const tables: DocumentTableRef[] = [];
    if (format === "markdown" || format === "txt" || format === "pdf" || format === "docx") {
      const blocks = text.split(/\n{2,}/);
      let i = 0;
      for (const block of blocks) {
        const rows = block.split("\n").filter((line) => line.includes("|"));
        if (rows.length >= 2) {
          tables.push({
            id: `table-${++i}`,
            rowEstimate: rows.length,
            preview: rows.slice(0, 3).join(" | ").slice(0, 160),
          });
        }
      }
    }
    if (format === "html") {
      const htmlTables = text.match(/<table[\s\S]*?<\/table>/gi) ?? [];
      htmlTables.forEach((table, index) => {
        const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).length;
        tables.push({ id: `table-${index + 1}`, rowEstimate: rows, preview: stripTags(table).slice(0, 160) });
      });
    }
    if (format === "csv") {
      const rows = text.trim().split("\n");
      if (rows.length) {
        tables.push({ id: "table-1", caption: "CSV data", rowEstimate: rows.length, preview: rows.slice(0, 3).join(" | ").slice(0, 160) });
      }
    }
    return tables;
  }

  private extractMedia(text: string, kind: "image" | "diagram"): DocumentMediaRef[] {
    const media: DocumentMediaRef[] = [];
    const md = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = md.exec(text))) {
      const alt = match[1];
      const isDiagram = /diagram|flowchart|schema|wireframe|chart/i.test(alt) || /diagram|chart|flow/i.test(match[2]);
      if ((kind === "diagram" && isDiagram) || (kind === "image" && !isDiagram)) {
        media.push({ id: `${kind}-${++i}`, kind, alt, src: match[2] });
      }
    }
    const html = /<img[^>]+>/gi;
    while ((match = html.exec(text))) {
      const alt = /alt=["']([^"']*)["']/i.exec(match[0])?.[1];
      const src = /src=["']([^"']*)["']/i.exec(match[0])?.[1];
      const isDiagram = /diagram|chart|flow/i.test(`${alt ?? ""} ${src ?? ""}`);
      if ((kind === "diagram" && isDiagram) || (kind === "image" && !isDiagram)) {
        media.push({ id: `${kind}-${++i}`, kind, alt, src });
      }
    }
    return media;
  }

  private extractReferences(text: string): DocumentReference[] {
    const refs: DocumentReference[] = [];
    const mdLinks = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = mdLinks.exec(text))) {
      refs.push({ id: `ref-${++i}`, text: match[1], url: match[2] });
    }
    const bare = /https?:\/\/[^\s)>"']+/g;
    while ((match = bare.exec(text))) {
      if (refs.some((ref) => ref.url === match![0])) continue;
      refs.push({ id: `ref-${++i}`, text: match[0], url: match[0] });
    }
    const biblio = /^\[\d+\]\s+.+$/gm;
    while ((match = biblio.exec(text))) {
      refs.push({ id: `ref-${++i}`, text: match[0].trim() });
    }
    return refs.slice(0, 100);
  }

  private extractHtmlTitle(text: string): string | null {
    const match = /<title[^>]*>(.*?)<\/title>/i.exec(text);
    return match ? stripTags(match[1]).trim() : null;
  }

  private extractJsonTitle(text: string, format: SupportedDocumentFormat): string | null {
    if (format !== "json") return null;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      for (const key of ["title", "name", "documentTitle"]) {
        if (typeof parsed[key] === "string") return parsed[key] as string;
      }
    } catch {
      return null;
    }
    return null;
  }
}

function collectJsonKeys(value: unknown, headings: DocumentHeading[], level: number, line = 1): number {
  if (!value || typeof value !== "object") return line;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) line = collectJsonKeys(item, headings, Math.min(6, level + 1), line);
    return line;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    headings.push({ level, text: key, line: line++ });
    line = collectJsonKeys(child, headings, Math.min(6, level + 1), line);
  }
  return line;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
