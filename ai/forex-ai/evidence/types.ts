/**
 * Phase 38E — Compact detector evidence for Forex AI reasoning.
 * Authoritative facts from 38C patterns + 38D structure + 38B knowledge IDs.
 * Never send full candle history to the LLM.
 */

export const EVIDENCE_SCHEMA_VERSION = "forex-ai-evidence-v1" as const;

export type EvidenceProviderId = "BINANCE" | "FXCM" | "FOREXCONNECT";

export interface CompactPattern {
  id: string;
  name: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  status: "CANDIDATE" | "CONFIRMED" | "INVALID";
  candleEndTime: number;
  evidenceLines: string[];
}

export interface CompactClass {
  label: string;
  kind: string;
  price: number;
  time: number;
}

export interface CompactEvent {
  type: "BOS" | "CHOCH";
  direction: "BULLISH" | "BEARISH";
  status: "CANDIDATE" | "CONFIRMED";
  level: number;
  breakTime: number;
  evidence: string[];
}

export interface CompactZone {
  side: "SUPPORT" | "RESISTANCE" | "PIVOT";
  low: number;
  high: number;
  status: "ACTIVE" | "BROKEN" | "STALE";
  touches: number;
}

export interface CompactCitation {
  documentId: string;
  chunkId: string;
  title: string;
  sourceName: string;
  version: number;
  pageNumber?: number | null;
  relevanceScore: number;
  excerptHash?: string;
  excerpt?: string;
}

export interface CompactSwingSummary {
  confirmedCount: number;
  provisionalCount: number;
  lastHigh: number | null;
  lastLow: number | null;
}

export interface ForexAiEvidencePack {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  provider: EvidenceProviderId;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  priceBasis?: string | null;
  candleCount: number;
  lastClosedTime: number | null;
  formingExcluded: boolean;
  patterns: {
    ruleVersion: string;
    detections: CompactPattern[];
  };
  structure: {
    ruleVersion: string;
    trendState: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
    classifications: CompactClass[];
    events: CompactEvent[];
    zones: CompactZone[];
    swingSummary: CompactSwingSummary;
  };
  knowledge: CompactCitation[];
  warnings: string[];
  insufficientHistory: boolean;
  /** Stable ids for validation, e.g. pattern:doji:time, event:BOS:..., knowledge:doc:chunk */
  evidenceIds: string[];
}

export type ForexAiInferenceStatus =
  | "OK"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "FORMAT_ERROR"
  | "SKIPPED";
