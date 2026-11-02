/**
 * Phase 53.1 / 53.3 — Persistent AT live monitoring contracts.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtMonitorTimeframe } from "./timeframes.js";

export const AT_MONITOR_SCHEMA = "at-live-monitor-v1";
/** Phase 4.18F.7 extends 53.3 monitor contracts (image provenance + freshness fields). */
export const AT_MONITOR_PHASE = "4.18F.7";

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
  /** Canonical freshness reason (bounded diagnostics). */
  freshnessReasonCode: string | null;
  freshnessThresholdMs: number | null;
  verificationAgeMs: number | null;
  effectivePriceChangeAgeMs: number | null;
  effectiveReceiptAgeMs: number | null;
  verificationSnapshotAtUtc: string | null;
  freshnessEvaluatedAtUtc: string | null;
  quoteSnapshotFingerprint: string | null;
  quoteSourceTimestampMs: number | null;
  quoteReceivedAtMs: number | null;
  analysisInFlight: boolean;
  consecutiveFailures: number;
  /** Phase 4.18F.7 — independent freshness + image provenance (dashboard observability). */
  tickFresh: boolean | null;
  candleFresh: boolean | null;
  imageFresh: boolean | null;
  lastObservationId: string | null;
  lastImageId: string | null;
  lastImageSourceLabel: "SERVER_OHLC_RENDER" | "PLATFORM_SCREENSHOT" | null;
  lastMtfAlignment: string | null;
  lastImageDeliveryLifecycle: string | null;
  lastIncludedImageBytesInRequest: boolean | null;
  storageHealth: "OK" | "DEGRADED" | "UNKNOWN" | null;
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
  /** Explicit label — never claim Trading Station screenshot for server OHLC. */
  chartImageSourceLabel: "SERVER_OHLC_RENDER";
  platformScreenshotAvailable: false;
  platformScreenshotBlocker: string;
  requiresBrowserOpen: false;
  persistsAcrossAppRestart: true;
  persistsAcrossVpsReboot: "NOT_CLAIMED";
  config: AtMonitorConfig | null;
  health: AtMonitorHealth;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
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
    freshnessReasonCode: null,
    freshnessThresholdMs: null,
    verificationAgeMs: null,
    effectivePriceChangeAgeMs: null,
    effectiveReceiptAgeMs: null,
    verificationSnapshotAtUtc: null,
    freshnessEvaluatedAtUtc: null,
    quoteSnapshotFingerprint: null,
    quoteSourceTimestampMs: null,
    quoteReceivedAtMs: null,
    tickFresh: null,
    candleFresh: null,
    imageFresh: null,
    lastObservationId: null,
    lastImageId: null,
    lastImageSourceLabel: null,
    lastMtfAlignment: null,
    lastImageDeliveryLifecycle: null,
    lastIncludedImageBytesInRequest: null,
    storageHealth: "UNKNOWN",
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
