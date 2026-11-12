/**
 * Phase 53.1 / 53.3 — Persistent AT live monitoring contracts.
 */
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AtMonitorTimeframe } from "./timeframes.js";

export const AT_MONITOR_SCHEMA = "at-live-monitor-v1";
/** Phase 4.18F.8 — automatic 5-minute wall-clock analysis schedule (extends F.7). */
export const AT_MONITOR_PHASE = "4.18F.8";

export type AtAutomaticAnalysisStatus =
  | "ACTIVE"
  | "STOPPED"
  | "BLOCKED"
  | "WAITING"
  | "ANALYSIS_RUNNING"
  | "ANALYSIS_SUCCEEDED"
  | "ANALYSIS_FAILED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_BILLING_BLOCKED"
  | "STALE_MARKET_DATA"
  | "LAST_SUCCESS_STALE";

export const AT_AUTOMATIC_ANALYSIS_STATUSES: AtAutomaticAnalysisStatus[] = [
  "ACTIVE",
  "STOPPED",
  "BLOCKED",
  "WAITING",
  "ANALYSIS_RUNNING",
  "ANALYSIS_SUCCEEDED",
  "ANALYSIS_FAILED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_AUTH_FAILED",
  "PROVIDER_BILLING_BLOCKED",
  "STALE_MARKET_DATA",
  "LAST_SUCCESS_STALE",
];

/** Terminal status for one UTC five-minute schedule slot (never mid-flight). */
export type AtMonitorCycleTerminalStatus =
  | "ANALYSIS_VALID"
  | "ANALYSIS_SEMANTIC_REJECTED"
  | "BLOCKED_STALE_QUOTES"
  | "BLOCKED_VERIFICATION"
  | "BLOCKED_DATA_INSUFFICIENT"
  | "BLOCKED_IMAGE"
  | "SCHEDULE_SLOT_MISSED"
  | "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT"
  | "ANALYSIS_FAILED"
  | "PROVIDER_ERROR"
  | "CONFIG_CHANGED"
  | "CANCELLED";

export interface AtMonitorCycleTerminal {
  slotSec: number;
  scheduledAtUtc: string;
  startedAtUtc: string | null;
  completedAtUtc: string;
  durationMs: number | null;
  terminalStatus: AtMonitorCycleTerminalStatus;
  trigger: "scheduled" | "manual";
  analysisId: string | null;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  lifecycle: string | null;
  canonicalFinalOutcome: string | null;
  blockerCode: string | null;
  includedImageBytesInRequest: boolean | null;
}

export type AtMonitorWorkerState =
  | "STOPPED"
  | "CONNECTING"
  | "MONITORING_LIVE"
  | "STALE_QUOTES"
  | "WAITING_CANDLE_CLOSE"
  | "ANALYSIS_IN_PROGRESS"
  | "ANALYSIS_SUCCESS"
  /** OpenAI/delivery completed but semantic lifecycle was not ANALYSIS_VALID. */
  | "ANALYSIS_SEMANTIC_REJECTED"
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
  /** OpenAI analysis lifecycle from last completed run (may differ from workerState). */
  lastAnalysisLifecycle: string | null;
  /** Canonical reconciler finalOutcome from last integrated run. */
  lastCanonicalFinalOutcome: string | null;
  lastCanonicalDirection: "BUY" | "SELL" | "NO_TRADE" | null;
  lastCanonicalConfidencePct: number | null;
  lastEvidenceIntegrityStatus: string | null;
  /** Phase 4.18F.8 — automatic 5-minute schedule telemetry (UTC). */
  automaticAnalysisStatus: AtAutomaticAnalysisStatus;
  scheduleIntervalMs: number;
  lastScheduledAtUtc: string | null;
  lastCycleStartedAtUtc: string | null;
  lastCycleCompletedAtUtc: string | null;
  lastCycleDurationMs: number | null;
  lastScheduleSlotSec: number | null;
  missedCycles: number;
  delayedCycles: number;
  lastSuccessfulAnalysisAtUtc: string | null;
  /** Bounded ring of terminal scheduled-cycle records (evidence; never mid-flight). */
  recentCycleTerminals: AtMonitorCycleTerminal[];
  lastCycleTerminalStatus: AtMonitorCycleTerminalStatus | null;
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
  /** Analysis schedule is server-side; dashboard clicks are not required. */
  requiresDashboardClick: false;
  scheduleMode: "five_minute_wall_utc";
  scheduleIntervalMs: number;
  automaticAnalysisStatus: AtAutomaticAnalysisStatus;
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
    lastAnalysisLifecycle: null,
    lastCanonicalFinalOutcome: null,
    lastCanonicalDirection: null,
    lastCanonicalConfidencePct: null,
    lastEvidenceIntegrityStatus: null,
    automaticAnalysisStatus: "STOPPED",
    scheduleIntervalMs: 300_000,
    lastScheduledAtUtc: null,
    lastCycleStartedAtUtc: null,
    lastCycleCompletedAtUtc: null,
    lastCycleDurationMs: null,
    lastScheduleSlotSec: null,
    missedCycles: 0,
    delayedCycles: 0,
    lastSuccessfulAnalysisAtUtc: null,
    recentCycleTerminals: [],
    lastCycleTerminalStatus: null,
    analysisInFlight: false,
    consecutiveFailures: 0,
  };
}

export const AT_MONITOR_CYCLE_TERMINAL_MAX = 24;

export function isTerminalCycleStatus(code: string | null | undefined): boolean {
  if (!code) return false;
  return [
    "ANALYSIS_VALID",
    "ANALYSIS_SEMANTIC_REJECTED",
    "BLOCKED_STALE_QUOTES",
    "BLOCKED_VERIFICATION",
    "BLOCKED_DATA_INSUFFICIENT",
    "BLOCKED_IMAGE",
    "SCHEDULE_SLOT_MISSED",
    "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT",
    "ANALYSIS_FAILED",
    "PROVIDER_ERROR",
    "CONFIG_CHANGED",
    "CANCELLED",
    "STALE_QUOTES",
    "VERIFICATION_REQUIRED",
    "DATA_INSUFFICIENT",
    "IMAGE_UNAVAILABLE",
  ].includes(code);
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
