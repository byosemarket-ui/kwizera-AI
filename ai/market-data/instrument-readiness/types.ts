/**
 * Phase 56.2.8 / 56.3.1 — per-instrument market-data readiness (provider-agnostic).
 * Discovery / live / analysis / simulation are distinct from execution authorization.
 */
import type { MarketAssetType, MarketProviderId } from "../providers/types.js";
import type { UnifiedConnectionState } from "../providers/contracts.js";
import type { LiveFeedDiagnostics } from "./feed-diagnostics.js";

export const INSTRUMENT_READINESS_STATUSES = [
  "READY",
  "STALE",
  "DISCONNECTED",
  "UNAVAILABLE",
  "UNSUPPORTED",
  "PARTIALLY_READY",
  "UNVERIFIED",
  "BLOCKED",
] as const;

export type InstrumentReadinessStatus = (typeof INSTRUMENT_READINESS_STATUSES)[number];

export interface InstrumentReadinessFreshnessPolicy {
  /** Max age of a genuine price change for LIVE/READY quotes. */
  quoteStaleMs: number;
  /** Policy source label (never invents broker semantics). */
  source: string;
  rationale: string;
}

export interface InstrumentReadinessBlocker {
  id: string;
  status: InstrumentReadinessStatus;
  reason: string;
  blocks: string[];
}

export interface InstrumentCapabilityFlags {
  discovered: boolean;
  dataSupported: boolean;
  liveFeedReady: boolean;
  historicalAvailable: boolean;
  analysisReady: boolean;
  simulationReady: boolean;
  /** Always false — market coverage ≠ execution authorization. */
  executionAuthorized: false;
}

export interface InstrumentReadinessSnapshot {
  phase: "56.2.8" | "56.3.1" | "56.3.2";
  provider: MarketProviderId;
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  marketType: MarketAssetType | "UNKNOWN";
  connectionState: UnifiedConnectionState | string;
  quote: {
    bid: number | null;
    ask: number | null;
    feedStatus: string | null;
    freshnessStatus: InstrumentReadinessStatus;
    reasonCode: string | null;
    priceChangeAgeMs: number | null;
    receiptAgeMs: number | null;
    updateCount: number;
    historicalOnly: boolean;
    /** Phase 56.3.1 — precise subscription / freshness diagnostics. */
    diagnostics?: LiveFeedDiagnostics;
  } | null;
  /** Phase 56.3.1 — present even when quote is null (e.g. no_active_session). */
  feedDiagnostics?: LiveFeedDiagnostics;
  overall: InstrumentReadinessStatus;
  capabilities: InstrumentCapabilityFlags;
  freshnessPolicy: InstrumentReadinessFreshnessPolicy;
  blockers: InstrumentReadinessBlocker[];
  evaluatedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
}

export interface InstrumentReadinessCatalogSummary {
  phase: "56.2.8" | "56.3.1" | "56.3.2";
  provider: MarketProviderId | null;
  discoveredCount: number;
  liveFeedReadyCount: number;
  historicalAvailableCount: number;
  blockedOrUnreadyCount: number;
  /** Phase 56.3.2 — explicit per-instrument LIVE list (never a global LIVE claim). */
  liveReadySymbols: string[];
  /** Phase 56.3.2 — symbols that are discovered but not live-ready, with blocker id. */
  blockedSymbols: Array<{ symbol: string; blockerId: string | null }>;
  snapshots: InstrumentReadinessSnapshot[];
  notes: string[];
  placesOrders: false;
  acceptsForExecution: false;
  evaluatedAtUtc: string;
}
