/**
 * Phase 49B–50B — Multi-image OpenAI prompts with MTF + binary BUY/SELL classification.
 */
import type { LocalSnapshotEvidencePackage } from "../snapshot-local/types.js";
import { formatLocalEvidenceForPrompt } from "../snapshot-local/evidence-from-snapshot.js";
import { formatMtfRosterForPrompt } from "./mtf-summary.js";
import type { MultiImageCaptureRef, MultiImageDataProvenance, MultiImageMtfRoster } from "./types.js";

export function buildMultiImageSystemPrompt(): string {
  return [
    "You are KWIZERA Forex OpenAI multi-image multi-timeframe chart analyst (Phase 50B binary BUY/SELL).",
    "You receive (1) chart screenshot images with CAPTURE_TIME metadata, (2) a deterministic MTF_ROSTER, and (3) ANALYSIS_TIME structured market evidence when available.",
    "Never invent prices, candles, news, URLs, snapshot IDs, or missing timeframe screenshots.",
    "Never treat ANALYSIS_TIME prices as the exact prices visible at capture time unless capture metadata lists the same snapshotId.",
    "For each observation, label: VISIBLE_IN_IMAGE | CONFIRMED_BY_DATA | INFERENCE | UNKNOWN.",
    "Organize reasoning using only timeframes present in MTF_ROSTER: higher (longer), intermediate, lower (shorter).",
    "Phase 50B: compare bullish vs bearish evidence and set decision to exactly BUY or SELL — the direction better supported by available evidence.",
    "Do not return WAIT, UNCERTAIN, or NO_TRADE as decision for a completed analysis. Entry readiness and data quality are separate fields/disclosures.",
    "Do not require every timeframe to agree. Explain MIXED/CONFLICTING disagreement in mtfReasoning; still pick the stronger directional lean.",
    "Do not require one mandatory final candle confirmation when cumulative evidence already supports a lean.",
    "Never force BUY or SELL merely because images were supplied. Do not invent evidence.",
    "If only one timeframe is present, set timeframeAgreement=SINGLE_TIMEFRAME and do not invent higher/lower confirmation.",
    "Multiple images of the same timeframe are NOT independent multi-timeframe confirmation.",
    "Use structured candle/quote data for exact prices when present; do not invent numeric precision from pixels.",
    "Include directionalConfidencePercent as an integer 0-100 model estimate — the server recomputes confidence with a deterministic method; do not treat your percent as a win probability.",
    "Optional bullishProjection: only when decision leans BUY and numeric targets are supported by CONFIRMED_BY_DATA or clearly VISIBLE_IN_IMAGE levels — never invent prices.",
    "bullishProjection fields must match the analyzed instrument price scale. Do not copy directionalConfidencePercent into a target-hit probability.",
    "decision must be exactly BUY | SELL.",
    "BUY/SELL are analytical directional leans, NOT broker orders.",
    "Return JSON only. Include top-level analysis keys plus mtfReasoning object.",
  ].join(" ");
}

export function buildMultiImageUserText(input: {
  captures: MultiImageCaptureRef[];
  provenance: MultiImageDataProvenance;
  evidence: LocalSnapshotEvidencePackage | null;
  mtfRoster: MultiImageMtfRoster;
}): string {
  const captureBlocks = input.captures.map((c, i) => [
    `IMAGE_${i + 1}:`,
    `captureId=${c.captureId}`,
    `instrument=${c.instrument.displaySymbol} provider=${c.instrument.provider}`,
    `timeframe=${c.timeframe} mode=${c.mode}`,
    `capturedAtUtc=${c.capturedAtUtc} local=${c.capturedAtLocal}`,
    `captureFeed=${c.quote.feedHealth} bid=${c.quote.bid ?? "null"} ask=${c.quote.ask ?? "null"} last=${c.quote.lastPrice ?? "null"}`,
    `lastGenuinePriceChangeAt=${c.quote.lastGenuinePriceChangeAt ?? "null"} ageMs=${c.quote.lastGenuinePriceChangeAgeMs ?? "null"}`,
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
    : "SNAPSHOT_EVIDENCE: unavailable — rely on capture metadata and images; do not fabricate OHLC series. Still choose BUY or SELL as the stronger lean; disclose weak evidence in limitations.";

  const mtfSchema = [
    '"mtfReasoning":{',
    '"timeframeAgreement":"ALIGNED|MIXED|CONFLICTING|SINGLE_TIMEFRAME|INSUFFICIENT",',
    '"higherTimeframeContext":"string|null",',
    '"intermediateStructure":"string|null",',
    '"lowerTimeframeSetup":"string|null",',
    '"agreementSummary":"string|null",',
    '"conflictSummary":"string|null",',
    '"bullishScenario":"string|null",',
    '"bearishScenario":"string|null",',
    '"keyLevels":[{"level":"string","provenance":"VISIBLE_IN_IMAGE|CONFIRMED_BY_DATA|INFERENCE|UNKNOWN","captureId":"string|null","timeframe":"string|null"}],',
    '"confirmationConditions":["string"],',
    '"invalidationConditions":["string"],',
    '"missingEvidence":["string"]',
    "}",
  ].join("");

  const projectionSchema = [
    '"bullishProjection":{',
    '"targetPrice":"number|null",',
    '"targetZoneLow":"number|null",',
    '"targetZoneHigh":"number|null",',
    '"invalidationPrice":"number|null",',
    '"forecastHorizon":"string|null",',
    '"evidence":["string"]',
    "}|null",
  ].join("");

  return [
    "Schema:",
    "{"
    + '"dataQuality":"string","marketBias":"BULLISH|BEARISH|NEUTRAL|UNCERTAIN",'
    + '"marketStructureSummary":"string","keyEvidence":["string"],'
    + '"bullishScenario":"string","bearishScenario":"string",'
    + '"decision":"BUY|SELL","decisionRationale":"string",'
    + '"invalidationConditions":["string"],'
    + '"directionalConfidencePercent":0,'
    + '"confidence":"string|null","limitations":["string"],'
    + mtfSchema + ","
    + projectionSchema
    + "}",
    "Online web/news research is NOT included — do not fabricate it.",
    "directionalConfidencePercent is a bullish directional estimate only — never claim it is a verified win probability or target-hit probability.",
    "Omit bullishProjection or set null fields when numeric targets cannot be supported by actual levels/data.",
    formatMtfRosterForPrompt(input.mtfRoster),
    "CAPTURE_TIME_IMAGES:",
    captureBlocks,
    analysisBlock,
    evidenceBlock,
    "Images follow this text in order IMAGE_1 … IMAGE_N as image_url inputs.",
  ].join("\n\n");
}
