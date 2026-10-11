/**
 * Compact labeled DETECTOR_EVIDENCE block for llama3.2:1b prompts.
 */
import type { ForexAiEvidencePack } from "./types.js";

export function formatEvidenceForPrompt(
  pack: ForexAiEvidencePack,
  maxChars = 900,
): string {
  const patterns = pack.patterns.detections.length
    ? pack.patterns.detections
      .map((p) => `${p.name}(${p.direction}/${p.status})`)
      .join("; ")
    : "none";

  const swings = `conf=${pack.structure.swingSummary.confirmedCount}`
    + ` prov=${pack.structure.swingSummary.provisionalCount}`
    + (pack.structure.swingSummary.lastHigh != null
      ? ` H=${pack.structure.swingSummary.lastHigh}`
      : "")
    + (pack.structure.swingSummary.lastLow != null
      ? ` L=${pack.structure.swingSummary.lastLow}`
      : "");

  const events = pack.structure.events.length
    ? pack.structure.events
      .map((e) => `${e.type}:${e.direction}/${e.status}@${e.level}`)
      .join("; ")
    : "none";

  const zones = pack.structure.zones.length
    ? pack.structure.zones
      .map((z) => `${z.side}:${z.low}-${z.high}/${z.status}/t${z.touches}`)
      .join("; ")
    : "none";

  const knowledgeIds = pack.knowledge.length
    ? pack.knowledge.map((k) => `${k.documentId}:${k.chunkId}`).join(" ")
    : "none";

  const warnings = pack.warnings.length
    ? pack.warnings.slice(0, 3).join("; ")
    : "none";

  const lines = [
    "DETECTOR_EVIDENCE (authoritative; do not invent):",
    `PATTERNS: ${patterns}`,
    `STRUCTURE: trend=${pack.structure.trendState}; swings=${swings}; events=${events}`,
    `ZONES: ${zones}`,
    `KNOWLEDGE_IDS: ${knowledgeIds}`,
    `WARNINGS: ${warnings}`,
  ];

  if (pack.insufficientHistory) {
    lines.push("INSUFFICIENT_HISTORY: true — do not invent bullish/bearish from empty detectors.");
  }

  let body = lines.join("\n");
  if (body.length > maxChars) {
    body = body.slice(0, maxChars);
  }
  return body;
}
