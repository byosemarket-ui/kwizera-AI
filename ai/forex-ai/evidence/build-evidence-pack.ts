/**
 * Build a compact Forex AI evidence pack from detector outputs + knowledge hits.
 */
import { createHash } from "node:crypto";
import {
  detectCandlestickPatterns,
  fromUnifiedCandles as patternsFromUnified,
  RULE_VERSION as PATTERN_RULE_VERSION,
  type PatternAnalysisResult,
  type PatternCandle,
  type UnifiedCandleLike,
} from "../../forex-patterns/index.js";
import {
  detectMarketStructure,
  fromUnifiedCandles as structureFromUnified,
  RULE_VERSION as STRUCTURE_RULE_VERSION,
  type MarketStructureAnalysisResult,
} from "../../forex-structure/index.js";
import type { ForexKnowledgeRetrievalHit } from "../../forex-knowledge/types.js";
import {
  EVIDENCE_SCHEMA_VERSION,
  type CompactCitation,
  type CompactClass,
  type CompactEvent,
  type CompactPattern,
  type CompactZone,
  type EvidenceProviderId,
  type ForexAiEvidencePack,
} from "./types.js";

const MAX_PATTERNS = 5;
const MAX_EVENTS = 5;
const MAX_ZONES = 4;
const MAX_CLASSES = 6;
const MAX_KNOWLEDGE = 2;
const MAX_EVIDENCE_LINES = 2;

export interface BuildForexAiEvidencePackInput {
  provider: EvidenceProviderId | string;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  candles: UnifiedCandleLike[] | PatternCandle[];
  priceBasis?: string | null;
  knowledgeHits?: ForexKnowledgeRetrievalHit[];
  patternResult?: PatternAnalysisResult | null;
  structureResult?: MarketStructureAnalysisResult | null;
}

function asProvider(raw: string): EvidenceProviderId {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "FXCM") return "FXCM";
  if (v === "FOREXCONNECT") return "FOREXCONNECT";
  return "BINANCE";
}

function shortHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function compactPatterns(result: PatternAnalysisResult): CompactPattern[] {
  return result.detections.slice(0, MAX_PATTERNS).map((d) => ({
    id: d.patternId,
    name: d.patternName,
    direction: d.direction,
    status: d.status,
    candleEndTime: d.candleEndTime,
    evidenceLines: d.evidence.slice(0, MAX_EVIDENCE_LINES),
  }));
}

function compactEvents(result: MarketStructureAnalysisResult): CompactEvent[] {
  return result.events.slice(0, MAX_EVENTS).map((e) => ({
    type: e.type,
    direction: e.direction,
    status: e.status,
    level: e.level,
    breakTime: e.breakCandleTime,
    evidence: e.evidence.slice(0, MAX_EVIDENCE_LINES),
  }));
}

function compactZones(result: MarketStructureAnalysisResult): CompactZone[] {
  return result.zones.slice(0, MAX_ZONES).map((z) => ({
    side: z.kind,
    low: z.low,
    high: z.high,
    status: z.status,
    touches: z.touchCount,
  }));
}

function compactClasses(result: MarketStructureAnalysisResult): CompactClass[] {
  return result.classifications.slice(-MAX_CLASSES).map((c) => ({
    label: c.label,
    kind: c.kind,
    price: c.price,
    time: c.time,
  }));
}

function compactKnowledge(hits: ForexKnowledgeRetrievalHit[]): CompactCitation[] {
  return hits.slice(0, MAX_KNOWLEDGE).map((h) => {
    const excerpt = String(h.content ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    return {
      documentId: h.documentId,
      chunkId: h.chunkId,
      title: h.title || h.documentTitle || h.documentId,
      sourceName: h.sourceName || "",
      version: h.version,
      pageNumber: h.pageNumber ?? null,
      relevanceScore: h.relevanceScore,
      excerptHash: excerpt ? shortHash(excerpt) : undefined,
      excerpt: excerpt || undefined,
    };
  });
}

function buildEvidenceIds(pack: {
  patterns: CompactPattern[];
  events: CompactEvent[];
  knowledge: CompactCitation[];
}): string[] {
  const ids: string[] = [];
  for (const p of pack.patterns) {
    ids.push(`pattern:${p.id}:${p.candleEndTime}`);
  }
  for (const e of pack.events) {
    ids.push(`event:${e.type}:${e.direction}:${e.breakTime}`);
  }
  for (const k of pack.knowledge) {
    ids.push(`knowledge:${k.documentId}:${k.chunkId}`);
  }
  return ids;
}

/** Build evidence-aware knowledge retrieval query (append detector tokens). */
export function buildEvidenceAwareKnowledgeQuery(
  baseQuery: string,
  pack: Pick<ForexAiEvidencePack, "patterns" | "structure">,
): string {
  const tokens: string[] = [];
  for (const p of pack.patterns.detections.slice(0, 3)) {
    tokens.push(p.name);
  }
  if (pack.structure.trendState && pack.structure.trendState !== "UNKNOWN") {
    tokens.push(`${pack.structure.trendState} structure`);
  }
  for (const e of pack.structure.events.slice(0, 2)) {
    tokens.push(e.type);
  }
  const base = String(baseQuery ?? "").trim().slice(0, 180);
  const extra = tokens.filter(Boolean).join(" ").slice(0, 80);
  return `${base} ${extra}`.trim().slice(0, 220);
}

/** Attach retrieval hits without re-running pattern/structure detectors. */
export function enrichEvidencePackKnowledge(
  pack: ForexAiEvidencePack,
  knowledgeHits: ForexKnowledgeRetrievalHit[],
): ForexAiEvidencePack {
  const knowledge = compactKnowledge(knowledgeHits);
  const evidenceIds = buildEvidenceIds({
    patterns: pack.patterns.detections,
    events: pack.structure.events,
    knowledge,
  });
  return { ...pack, knowledge, evidenceIds };
}

export function buildForexAiEvidencePack(
  input: BuildForexAiEvidencePackInput,
): ForexAiEvidencePack {
  const provider = asProvider(String(input.provider));
  const candles = patternsFromUnified(input.candles as UnifiedCandleLike[]);
  const structureCandles = structureFromUnified(input.candles as UnifiedCandleLike[]);

  const patternResult = input.patternResult ?? detectCandlestickPatterns({
    provider,
    environment: input.environment,
    symbol: input.symbol,
    timeframe: input.timeframe,
    candles,
    includeForming: false,
    priceBasis: input.priceBasis,
  });

  const structureResult = input.structureResult ?? detectMarketStructure({
    provider,
    environment: input.environment,
    symbol: input.symbol,
    timeframe: input.timeframe,
    candles: structureCandles,
    includeForming: false,
    priceBasis: input.priceBasis,
  });

  const detections = compactPatterns(patternResult);
  const events = compactEvents(structureResult);
  const zones = compactZones(structureResult);
  const classifications = compactClasses(structureResult);
  const knowledge = compactKnowledge(input.knowledgeHits ?? []);

  const confirmed = structureResult.swings.filter((s) => s.status === "CONFIRMED");
  const provisional = structureResult.swings.filter((s) => s.status === "PROVISIONAL");
  const lastHigh = [...confirmed].reverse().find((s) => s.kind === "HIGH");
  const lastLow = [...confirmed].reverse().find((s) => s.kind === "LOW");

  const closed = candles.filter((c) => c.isClosed !== false && c.closed !== false);
  const lastClosedTime = closed.length ? closed[closed.length - 1]!.time : null;

  const warnings = [
    ...patternResult.validation.warnings,
    ...structureResult.validation.warnings,
    ...structureResult.warnings,
  ].filter((w, i, arr) => arr.indexOf(w) === i).slice(0, 8);

  const insufficientHistory =
    patternResult.validation.insufficientHistory
    || structureResult.validation.insufficientHistory
    || closed.length < 1;

  if (insufficientHistory) {
    warnings.push("Insufficient closed candle history for full detector evidence.");
  }
  if (structureResult.trendState === "UNKNOWN") {
    warnings.push("Structure trendState is UNKNOWN — do not invent bullish/bearish structure.");
  }

  // Phase 47A — opposing CONFIRMED patterns are historical multi-end detections, not
  // simultaneous current triggers. Disclose timestamps; do not drop valid detector hits.
  const confirmedPatterns = patternResult.detections.filter((d) => d.status === "CONFIRMED");
  const newestBull = confirmedPatterns.find((d) => d.direction === "BULLISH");
  const newestBear = confirmedPatterns.find((d) => d.direction === "BEARISH");
  if (newestBull && newestBear) {
    const fmt = (t: number) => new Date(t * 1000).toISOString().replace(".000Z", "Z");
    warnings.push(
      `Opposing CONFIRMED patterns in scan window: `
        + `${newestBull.patternName}@${fmt(newestBull.candleEndTime)} vs `
        + `${newestBear.patternName}@${fmt(newestBear.candleEndTime)} `
        + `(tf=${input.timeframe}). Historical evidence at different endings — `
        + "not simultaneous current triggers; prefer WAIT unless one is clearly current.",
    );
  }

  const packCore = {
    patterns: detections,
    events,
    knowledge,
  };

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    provider,
    environment: input.environment ?? null,
    symbol: input.symbol,
    timeframe: input.timeframe,
    priceBasis: input.priceBasis ?? null,
    candleCount: candles.length,
    lastClosedTime,
    formingExcluded: patternResult.formingExcluded || structureResult.formingExcluded,
    patterns: {
      ruleVersion: patternResult.ruleVersion || PATTERN_RULE_VERSION,
      detections,
    },
    structure: {
      ruleVersion: structureResult.ruleVersion || STRUCTURE_RULE_VERSION,
      trendState: structureResult.trendState,
      classifications,
      events,
      zones,
      swingSummary: {
        confirmedCount: confirmed.length,
        provisionalCount: provisional.length,
        lastHigh: lastHigh?.price ?? null,
        lastLow: lastLow?.price ?? null,
      },
    },
    knowledge,
    warnings,
    insufficientHistory,
    evidenceIds: buildEvidenceIds(packCore),
  };
}
