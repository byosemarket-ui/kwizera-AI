/**
 * Phase 38F — Continuous Forex market monitoring contracts.
 * Deterministic setup detection; narrative is optional and non-blocking.
 */
import type { MarketProviderId } from "../market-data/providers/types.js";
import type { ForexAiEvidencePack } from "../forex-ai/evidence/types.js";

export const FOREX_MONITOR_SCHEMA_VERSION = "forex-monitor-v1" as const;

export type ForexMonitorLifecycleState =
  | "STOPPED"
  | "STARTING"
  | "WATCHING"
  | "SETUP_DETECTED"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "INVALIDATED"
  | "PAUSED"
  | "STALE"
  | "ERROR";

/** Analytical setup evaluation state (mirrors lifecycle analytical states). */
export type SetupEvalState = Exclude<
  ForexMonitorLifecycleState,
  "STOPPED" | "STARTING" | "PAUSED" | "STALE" | "ERROR"
>;

export type FreshnessState = "FRESH" | "STALE" | "INACTIVE" | "UNAVAILABLE" | "UNKNOWN";

export type NarrativeStatus = "NONE" | "PENDING" | "COMPLETED" | "TIMEOUT" | "FAILED" | "SKIPPED";

export interface ForexMonitorConfig {
  /** Request optional LLM narrative on key setup transitions. */
  narrativeEnabled: boolean;
  marketType?: string | null;
  environment?: string | null;
}

export const DEFAULT_FOREX_MONITOR_CONFIG: ForexMonitorConfig = {
  narrativeEnabled: true,
  marketType: null,
  environment: null,
};

export interface SetupConfirmationRequirement {
  id: string;
  description: string;
  met: boolean;
}

export interface SetupInvalidationCondition {
  id: string;
  description: string;
  triggered: boolean;
}

export interface SetupRecord {
  setupId: string;
  ruleId: string;
  ruleVersion: string;
  state: SetupEvalState;
  direction: "BULLISH" | "BEARISH";
  detectedAt: string;
  confirmedAt?: string | null;
  invalidatedAt?: string | null;
  patternRefs: string[];
  structureRefs: string[];
  confirmationRequirements: SetupConfirmationRequirement[];
  invalidationConditions: SetupInvalidationCondition[];
  candleTimes: number[];
  evidenceLines: string[];
  provider: string;
  symbol: string;
  timeframe: string;
}

export interface ForexMonitorNarrative {
  status: NarrativeStatus;
  analysisId?: string | null;
  summary?: string | null;
  latencyMs?: number | null;
  error?: string | null;
  eventId?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  /** Bumped when a new narrative is requested; stale completions are ignored. */
  generation?: number;
}

export interface ForexMonitorSession {
  sessionId: string;
  ownerKey: string;
  provider: MarketProviderId | string;
  environment: string;
  symbol: string;
  timeframe: string;
  config: ForexMonitorConfig;
  lifecycleState: ForexMonitorLifecycleState;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  lastEvaluationAt: string | null;
  lastValidCandleTime: number | null;
  lastDataUpdateAt: string | null;
  dataAgeMs: number | null;
  freshnessState: FreshnessState;
  lastError: string | null;
  evaluationCount: number;
  lastSetupEventId: string | null;
  lastClosedCandleTimeEvaluated: number | null;
  currentSetup: SetupRecord | null;
  lastEvidenceSummary: string | null;
  narrative: ForexMonitorNarrative;
  /** Runtime-only worker claim; stripped on persist when possible. */
  workerActive?: boolean;
  /** Per-session error backoff (ms until next eval attempt). */
  nextEvalAfterMs?: number;
  failureBackoffMs?: number;
  narrativeGeneration?: number;
}

export type ForexMonitorEventType =
  | "SESSION_STARTED"
  | "SESSION_STOPPED"
  | "SESSION_PAUSED"
  | "SESSION_RESUMED"
  | "LIFECYCLE_TRANSITION"
  | "SETUP_CHANGED"
  | "DATA_FRESHNESS"
  | "EVAL_ERROR"
  | "NARRATIVE_REQUESTED"
  | "NARRATIVE_COMPLETED";

export interface ForexMonitorEvent {
  eventId: string;
  sessionId: string;
  type: ForexMonitorEventType;
  at: string;
  fromState: ForexMonitorLifecycleState | null;
  toState: ForexMonitorLifecycleState | null;
  message: string;
  setupId?: string | null;
  evidenceRefs?: string[] | null;
  dataFreshness?: FreshnessState | null;
}

export interface ForexMonitorStoreFile {
  version: 1;
  schemaVersion: typeof FOREX_MONITOR_SCHEMA_VERSION;
  sessions: ForexMonitorSession[];
}

export interface SetupEvaluation {
  state: SetupEvalState;
  setup: SetupRecord | null;
  transitionReason: string;
}

export interface MonitorEvidenceSummary {
  pack: ForexAiEvidencePack;
  headline: string;
}

export interface StartForexMonitorRequest {
  provider: MarketProviderId | string;
  environment?: string | null;
  symbol: string;
  timeframe: string;
  ownerKey?: string;
  config?: Partial<ForexMonitorConfig>;
}

export interface EvaluateMonitorTickInput {
  session: ForexMonitorSession;
  nowMs?: number;
  candles?: import("../market-data/providers/contracts.js").UnifiedCandleSeries | null;
  fcDiagnostics?: {
    updateCount?: number;
    pollChanges?: number;
    marketInactive?: boolean;
  } | null;
}

export interface EvaluateMonitorTickResult {
  skipped?: boolean;
  session: ForexMonitorSession;
  setupEval: SetupEvaluation;
  evidenceSummary: MonitorEvidenceSummary | null;
  freshnessState: FreshnessState;
  freshnessWarnings: string[];
  lastClosedCandleTime: number | null;
  error?: string;
}
