/**
 * Compact Local AI prompts for snapshot analysis (llama3.2:1b friendly).
 */
import type { LocalSnapshotEvidencePackage } from "./types.js";
import { formatLocalEvidenceForPrompt } from "./evidence-from-snapshot.js";

export function buildLocalSnapshotAnalysisPrompt(evidence: LocalSnapshotEvidencePackage): string {
  const block = formatLocalEvidenceForPrompt(evidence);
  return [
    "You are KWIZERA Forex Local AI. Analyze ONLY the SNAPSHOT_EVIDENCE.",
    "Return JSON only. No markdown. No extra keys.",
    "decision must be exactly one of: BUY | SELL | WAIT | NO_TRADE.",
    "BUY/SELL are analytical scenarios, NOT broker orders.",
    "Prefer WAIT when evidence is conflicting, stale, or incomplete.",
    "Use NO_TRADE when the snapshot is unsuitable.",
    "Do not invent prices, volume, news, indicators, or change instrument/time window.",
    "Do not invent entry/SL/TP. confidence must be a short qualitative phrase or null.",
    "decisionRationale is required and must be a non-empty string explaining the decision.",
    "Schema:",
    '{"dataQuality":"string","marketBias":"BULLISH|BEARISH|NEUTRAL|UNCERTAIN","marketStructureSummary":"string","keyEvidence":["string"],"bullishScenario":"string","bearishScenario":"string","decision":"BUY|SELL|WAIT|NO_TRADE","decisionRationale":"string","invalidationConditions":["string"],"confidence":null,"limitations":["string"]}',
    block,
  ].join("\n");
}

export function buildLocalSnapshotRepairPrompt(evidence: LocalSnapshotEvidencePackage): string {
  return [
    "Repair: return ONLY valid JSON matching the schema.",
    "Required keys: decision, decisionRationale, marketBias, bullishScenario, bearishScenario, keyEvidence, invalidationConditions, limitations.",
    "decision must be BUY, SELL, WAIT, or NO_TRADE.",
    "decisionRationale must be a non-empty string.",
    `Instrument=${evidence.instrument.displaySymbol} tf=${evidence.candleTimeframe} period=${evidence.analysisPeriod}.`,
    `validation=${evidence.validationStatus} quote=${evidence.quoteFreshness}.`,
    "If unsure use WAIT or NO_TRADE. No markdown.",
  ].join("\n");
}
