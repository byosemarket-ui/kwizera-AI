/**
 * Phase 53.1 / 53.3 — Persistent AT live monitoring contracts.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtMonitorTimeframe } from "./timeframes.js";

export const AT_MONITOR_SCHEMA = "at-live-monitor-v1";
export const AT_MONITOR_PHASE = "53.3";

export type AtMonitorWorkerState =
  | "STOPPED"
  | "CONNECTING"
  | "MONITORING_LIVE"
  | "STALE_QUOTES"
  | "WAITING_CANDLE_CLOSE"
  | "ANALYSIS_IN_PROGRESS"
  | "ANALYSIS_SUCCESS"
  | "DATA_INSUFFICIENT"
  | "PROVIDER_ERROR"
  | "PAUSED_SAFETY"
  | "VERIFICATION_REQUIRED"
  | "DISCONNECTED"
  | "IMAGE_UNAVAILABLE";

export interface AtMonitorConfig {
  enabled: boolean;
  environment: AutomatedTradingEnvironment;
  instrument: string;
  timeframe: AtMonitorTimeframe;
  /** Bumped on every start/change to invalidate in-flight work. */
  configEpoch: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  pollIntervalMs: number;
}

export interface AtMonitorHealth {
  workerState: AtMonitorWorkerState;
  workerActive: boolean;
  lastQuoteChangeAtUtc: string | null;
  lastCandleUpdateAtUtc: string | null;
  lastClosedCandleOpenSec: number | null;
  lastScreenshotAtUtc: string | null;
  lastScreenshotImageHash: string | null;
  lastAnalysisAtUtc: string | null;
  lastAnalysisId: string | null;
  nextScheduledAnalysisAtUtc: string | null;
  lastDedupeKey: string | null;
  lastError: string | null;
  lastBlockerCode: string | null;
  lastObservationAtUtc: string | null;
  quoteFresh: boolean | null;
  feedStatus: string | null;
  analysisInFlight: boolean;
  consecutiveFailures: number;
}

export interface AtMonitorPersistedState {
  schemaVersion: typeof AT_MONITOR_SCHEMA;
  phase: typeof AT_MONITOR_PHASE;
  config: AtMonitorConfig | null;
  health: AtMonitorHealth;
  /** Survives restart — prevents duplicate scheduled analyses for same closed candle. */
  completedDedupeKeys: string[];
}

export interface AtMonitorPublicStatus {
  schemaVersion: typeof AT_MONITOR_SCHEMA;
  phase: typeof AT_MONITOR_PHASE;
  supportedTimeframes: AtMonitorTimeframe[];
  unsupportedNote: string;
  chartImageSource: "server-ohlc-render";
  requiresBrowserOpen: false;
  persistsAcrossAppRestart: true;
  persistsAcrossVpsReboot: "NOT_CLAIMED";
  config: AtMonitorConfig | null;
  health: AtMonitorHealth;
  placesOrders: false;
}

export function defaultMonitorHealth(): AtMonitorHealth {
  return {
    workerState: "STOPPED",
    workerActive: false,
    lastQuoteChangeAtUtc: null,
    lastCandleUpdateAtUtc: null,
    lastClosedCandleOpenSec: null,
    lastScreenshotAtUtc: null,
    lastScreenshotImageHash: null,
    lastAnalysisAtUtc: null,
    lastAnalysisId: null,
    nextScheduledAnalysisAtUtc: null,
    lastDedupeKey: null,
    lastError: null,
    lastBlockerCode: null,
    lastObservationAtUtc: null,
    quoteFresh: null,
    feedStatus: null,
    analysisInFlight: false,
    consecutiveFailures: 0,
  };
}

export function defaultMonitorPersisted(): AtMonitorPersistedState {
  return {
    schemaVersion: AT_MONITOR_SCHEMA,
    phase: AT_MONITOR_PHASE,
    config: null,
    health: defaultMonitorHealth(),
    completedDedupeKeys: [],
  };
}
