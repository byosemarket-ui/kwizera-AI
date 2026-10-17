/**
 * Phase 49B — Multi-image OpenAI prompts.
 */
import type { LocalSnapshotEvidencePackage } from "../snapshot-local/types.js";
import { formatLocalEvidenceForPrompt } from "../snapshot-local/evidence-from-snapshot.js";
import type { MultiImageCaptureRef, MultiImageDataProvenance } from "./types.js";

export function buildMultiImageSystemPrompt(): string {
  return [
    "You are KWIZERA Forex OpenAI multi-image chart analyst.",
    "You receive (1) chart screenshot images with CAPTURE_TIME metadata and (2) ANALYSIS_TIME structured market evidence.",
    "Never invent prices, candles, news, URLs, or snapshot IDs.",
    "Never treat ANALYSIS_TIME prices as the exact prices visible at capture time unless capture metadata matches.",
    "For each observation, label: VISIBLE_IN_IMAGE | CONFIRMED_BY_DATA | INFERENCE | UNKNOWN.",
    "Compare shorter vs longer timeframe images when multiple timeframes are present.",
    "Explain agreements and conflicts between images and between images vs ANALYSIS_TIME data.",
    "decision must be exactly BUY | SELL | WAIT | NO_TRADE.",
    "Prefer WAIT when images conflict, structure evidence is insufficient, or data is stale/incomplete.",
    "Do not force BUY/SELL merely because several images were supplied.",
    "BUY/SELL are analytical scenarios, NOT broker orders.",
    "Return JSON only with required keys: dataQuality, marketBias, marketStructureSummary, keyEvidence, bullishScenario, bearishScenario, decision, decisionRationale, invalidationConditions, confidence, limitations.",
  ].join(" ");
}

export function buildMultiImageUserText(input: {
  captures: MultiImageCaptureRef[];
  provenance: MultiImageDataProvenance;
  evidence: LocalSnapshotEvidencePackage | null;
}): string {
  const captureBlocks = input.captures.map((c, i) => [
    `IMAGE_${i + 1}:`,
    `captureId=${c.captureId}`,
    `instrument=${c.instrument.displaySymbol} provider=${c.instrument.provider}`,
    `timeframe=${c.timeframe} mode=${c.mode}`,
    `capturedAtUtc=${c.capturedAtUtc} local=${c.capturedAtLocal}`,
    `captureFeed=${c.quote.feedHealth} bid=${c.quote.bid ?? "null"} ask=${c.quote.ask ?? "null"} last=${c.quote.lastPrice ?? "null"}`,
    `captureCandles closed=${c.candleWindow.closedCount} forming=${c.candleWindow.formingCount} total=${c.candleWindow.totalCount}`,
    `captureSnapshotId=${c.marketSnapshot.snapshotId ?? "null"} fingerprint=${c.marketSnapshot.contentFingerprint ?? "null"}`,
    `image=${c.image.width}x${c.image.height} ${c.image.mimeType} bytes=${c.image.byteLength}`,
  ].join("\n")).join("\n\n");

  const analysis = input.provenance.analysisTime;
  const analysisBlock = [
    "ANALYSIS_TIME_CONTEXT (fetched for this request — NOT capture-time unless IDs match):",
    `snapshotId=${analysis.snapshotId ?? "null"}`,
    `contentFingerprint=${analysis.contentFingerprint ?? "null"}`,
    `provider=${analysis.provider ?? "null"} symbol=${analysis.symbol ?? "null"}`,
    `quoteFreshness=${analysis.quoteFreshness ?? "null"} feedHealth=${analysis.feedHealth ?? "null"}`,
    `bid=${analysis.bid ?? "null"} ask=${analysis.ask ?? "null"} last=${analysis.lastPrice ?? "null"}`,
    `observedAtUtc=${analysis.observedAtUtc ?? "null"}`,
    analysis.note,
  ].join("\n");

  const evidenceBlock = input.evidence
    ? ["SNAPSHOT_EVIDENCE (ANALYSIS_TIME structured):", formatLocalEvidenceForPrompt(input.evidence)].join("\n")
    : "SNAPSHOT_EVIDENCE: unavailable — rely on capture metadata and images; prefer WAIT when uncertain.";

  return [
    "Schema:",
    '{"dataQuality":"string","marketBias":"BULLISH|BEARISH|NEUTRAL|UNCERTAIN","marketStructureSummary":"string","keyEvidence":["string"],"bullishScenario":"string","bearishScenario":"string","decision":"BUY|SELL|WAIT|NO_TRADE","decisionRationale":"string","invalidationConditions":["string"],"confidence":null,"limitations":["string"]}',
    "Online web/news research is NOT included — do not fabricate it.",
    "CAPTURE_TIME_IMAGES:",
    captureBlocks,
    analysisBlock,
    evidenceBlock,
    "Images follow this text in order IMAGE_1 … IMAGE_N.",
  ].join("\n\n");
}
