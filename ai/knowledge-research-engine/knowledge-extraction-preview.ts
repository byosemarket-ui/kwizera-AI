/**
 * Offline knowledge extraction preview for researched documents.
 * Extracts concepts/rules/practices for AI Me — does NOT import into Knowledge Foundation.
 */

import fs from "node:fs/promises";
import type { KnowledgeExtractionPreview, KnowledgeExtractionPreviewItem } from "./types.js";

const AD_MARKERS = ["buy now", "limited offer", "click here", "subscribe today", "sponsored"];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function lineKind(line: string): KnowledgeExtractionPreviewItem["kind"] | null {
  const lower = line.toLowerCase();
  if (AD_MARKERS.some((marker) => lower.includes(marker))) return null;
  if (/^(definition|define|means)\b/i.test(line) || /\bis defined as\b/i.test(line)) return "definition";
  if (/^(rule|always|never|must|should)\b/i.test(line)) return "rule";
  if (/^(best practice|practice|tip)\b/i.test(line) || /\bbest practice\b/i.test(line)) return "best-practice";
  if (/^(workflow|pipeline|step\s*\d+)\b/i.test(line)) return "workflow";
  if (/^(example|e\.g\.|for example)\b/i.test(line)) return "example";
  if (/^(recommend|recommendation|prefer)\b/i.test(line)) return "technical-recommendation";
  if (/^(concept|principle)\b/i.test(line)) return "concept";
  if (line.length > 40 && line.length < 220) return "concept";
  return null;
}

/** Extracts professional learning signals from staged research content without KF import. */
export class KnowledgeExtractionPreviewEngine {
  async extractFromFile(input: {
    downloadId: string;
    topic: string;
    filePath: string;
  }): Promise<KnowledgeExtractionPreview> {
    let text = "";
    try {
      text = await fs.readFile(input.filePath, "utf8");
    } catch {
      text = "";
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .filter((line) => line.length > 12);

    const items: KnowledgeExtractionPreviewItem[] = [];
    const rejected: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const kind = lineKind(line);
      if (!kind) {
        if (AD_MARKERS.some((marker) => line.toLowerCase().includes(marker))) {
          rejected.push(`Rejected advertisement/unrelated line: ${line.slice(0, 80)}`);
        }
        continue;
      }
      const fingerprint = `${kind}:${line.toLowerCase()}`;
      if (seen.has(fingerprint)) {
        rejected.push(`Rejected duplicate: ${line.slice(0, 80)}`);
        continue;
      }
      seen.add(fingerprint);
      items.push({ kind, text: line.slice(0, 280), sourceDownloadId: input.downloadId });
    }

    const byKind = (kind: KnowledgeExtractionPreviewItem["kind"]) =>
      items.filter((item) => item.kind === kind).map((item) => item.text);

    return {
      downloadId: input.downloadId,
      topic: input.topic,
      extractedAt: new Date().toISOString(),
      concepts: unique(byKind("concept")),
      rules: unique(byKind("rule")),
      bestPractices: unique(byKind("best-practice")),
      workflows: unique(byKind("workflow")),
      definitions: unique(byKind("definition")),
      examples: unique(byKind("example")),
      technicalRecommendations: unique(byKind("technical-recommendation")),
      rejectedSignals: unique(rejected).slice(0, 20),
      qualityScore: Math.min(100, items.length * 8 + (text.length > 200 ? 20 : 0)),
      importedToKnowledgeFoundation: false,
      summary:
        items.length > 0
          ? `Extracted ${items.length} learning signal(s) for review. Knowledge Foundation was not modified.`
          : "No high-quality learning signals extracted. Knowledge Foundation was not modified.",
    };
  }
}
