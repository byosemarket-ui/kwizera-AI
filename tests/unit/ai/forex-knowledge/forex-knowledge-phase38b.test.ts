import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FOREX_PDF_MAX_BYTES,
  createForexKnowledgeService,
} from "../../../../ai/forex-knowledge/index.js";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-kb-38b-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function buildTextPdf(lines: string[]): Uint8Array {
  const stream = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 72 ${720 - i * 28} Td (${line.replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

function buildEmptyTextPdf(): Uint8Array {
  const stream = "BT ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

describe("Phase 38B Forex Knowledge — CRUD / PDF / citations", () => {
  it("supports draft publish retrieve unpublish and delete", async () => {
    const root = tempRoot();
    const service = createForexKnowledgeService(root);
    await service.ensureReady();

    const draft = await service.createDocument({
      title: "Liquidity Sweep Concept",
      content: "A liquidity sweep takes out resting stops beyond a swing before reversing toward the intended direction.",
      knowledgeType: "CONCEPT",
      tags: ["liquidity", "sweep"],
      status: "DRAFT",
    });
    expect(draft.status).toBe("DRAFT");

    let hits = await service.retrieveRelevantForexKnowledge({ query: "liquidity sweep", limit: 5 });
    expect(hits.every((h) => h.documentId !== draft.id)).toBe(true);

    const published = await service.publishDocument(draft.id);
    expect(published.status).toBe("PUBLISHED");
    expect(published.indexingStatus).toBe("INDEXED");

    hits = await service.retrieveRelevantForexKnowledge({ query: "liquidity sweep", limit: 5 });
    expect(hits.some((h) => h.documentId === published.id)).toBe(true);
    expect(hits[0]!.documentTitle).toBeTruthy();
    expect(hits[0]!.chunkId).toBeTruthy();

    const unpublished = await service.unpublishDocument(published.id);
    expect(unpublished.status).toBe("DRAFT");
    hits = await service.retrieveRelevantForexKnowledge({ query: "liquidity sweep", limit: 5 });
    expect(hits.every((h) => h.documentId !== unpublished.id)).toBe(true);

    await service.deleteDocument(unpublished.id);
    expect(await service.getDocument(unpublished.id)).toBeNull();
    expect((await service.listChunks(unpublished.id)).length).toBe(0);
  });

  it("ingests a text PDF, rejects non-PDF and oversized, fails textless, dedups by hash", async () => {
    const root = tempRoot();
    const service = createForexKnowledgeService(root);
    await service.ensureReady();

    const pdf = buildTextPdf([
      "Forex Risk Education Manual",
      "Position sizing must always respect a fixed risk percentage of account equity.",
      "Never increase size after a losing streak without a written risk rule review.",
      "Educational material only — not live trading advice or signal generation.",
    ]);

    const doc = await service.ingestPdf({
      bytes: pdf,
      fileName: "risk-education.pdf",
      mimeType: "application/pdf",
      publish: true,
    });
    expect(doc.sourceType).toBe("PDF");
    expect(doc.metadata.ingestionState).toBe("INDEXED");
    expect(doc.status).toBe("PUBLISHED");
    expect(doc.indexingStatus).toBe("INDEXED");
    expect(doc.content.length).toBeGreaterThan(40);
    expect(typeof doc.metadata.contentHash).toBe("string");
    expect(fs.existsSync(path.join(root, "forex-knowledge", "uploads", `${doc.metadata.contentHash}.pdf`))).toBe(true);

    const hits = await service.retrieveRelevantForexKnowledge({ query: "position sizing risk percentage", limit: 5 });
    expect(hits.some((h) => h.documentId === doc.id)).toBe(true);
    const hit = hits.find((h) => h.documentId === doc.id)!;
    expect(hit.documentTitle).toBe(doc.title);
    expect(hit.contentHash).toBe(doc.metadata.contentHash);
    expect(hit.sourceName).toBeTruthy();

    const dup = await service.ingestPdf({
      bytes: pdf,
      fileName: "risk-education-copy.pdf",
      publish: true,
    });
    expect(dup.id).toBe(doc.id);
    const overview = await service.getOverview();
    expect(overview.documents).toBe(1);

    await expect(
      service.ingestPdf({
        bytes: new TextEncoder().encode("not a pdf at all"),
        fileName: "fake.pdf",
      }),
    ).rejects.toThrow(/not a valid PDF|Invalid|filename|mime/i);

    // Signature check happens after size — oversized must reject even with PDF header.
    const oversized = new Uint8Array(FOREX_PDF_MAX_BYTES + 10);
    oversized[0] = 0x25;
    oversized[1] = 0x50;
    oversized[2] = 0x44;
    oversized[3] = 0x46;
    oversized[4] = 0x2d;
    await expect(
      service.ingestPdf({ bytes: oversized, fileName: "huge.pdf" }),
    ).rejects.toThrow(/15 MB|exceeds/i);

    const textless = await service.ingestPdf({
      bytes: buildEmptyTextPdf(),
      fileName: "scanned.pdf",
      publish: false,
    });
    expect(textless.metadata.ingestionState).toBe("FAILED");
    expect(textless.indexingStatus).toBe("FAILED");
    expect(textless.content).toBe("");
    expect(textless.status).toBe("DRAFT");

    const ov2 = await service.getOverview();
    expect(ov2.failedIngestion).toBeGreaterThanOrEqual(1);
  });

  it("persists store across service re-init on the same storage root", async () => {
    const root = tempRoot();
    const a = createForexKnowledgeService(root);
    await a.ensureReady();
    const created = await a.createDocument({
      title: "Persistence Check",
      content: "Harmonic pattern ratios are educational reference values for study.",
      status: "DRAFT",
    });

    const b = createForexKnowledgeService(root);
    await b.ensureReady();
    const loaded = await b.getDocument(created.id);
    expect(loaded?.title).toBe("Persistence Check");
    expect(loaded?.content).toContain("Harmonic pattern");
  });

  it("attaches citation fields on reindexed PDF chunks", async () => {
    const root = tempRoot();
    const service = createForexKnowledgeService(root);
    await service.ensureReady();
    const pdf = buildTextPdf([
      "Page Marker Education",
      "Candlestick education covers rising three methods as a continuation idea.",
      "Study confirmation with structure rather than treating patterns as signals.",
    ]);
    const doc = await service.ingestPdf({
      bytes: pdf,
      fileName: "candles.pdf",
      title: "Candlestick Education Pack",
      publish: true,
    });
    const chunks = await service.listChunks(doc.id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.documentTitle).toBe("Candlestick Education Pack");
    expect(chunks[0]!.contentHash).toBe(doc.metadata.contentHash);
    expect(chunks[0]!.sourceName).toBe("candles.pdf");
    // extractPdfText prefixes pages with ## Page N — chunk should parse pageNumber when present
    const withPage = chunks.find((c) => /##\s*Page\s+\d+/i.test(c.text));
    if (withPage) {
      expect(withPage.pageNumber).toBe(1);
    }
  });
});
