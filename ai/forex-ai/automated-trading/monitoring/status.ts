/**
 * Phase 4.18F.8 — Automatic analysis status model (scheduler accuracy; not false-green ACTIVE).
 */
import type { AtAutomaticAnalysisStatus, AtMonitorCycleTerminalStatus } from "./types.js";

export const AT_AUTOMATIC_ANALYSIS_SUCCESS_RECENCY_MS = 15 * 60 * 1000;

export interface DeriveAtAutomaticAnalysisStatusInput {
  enabled: boolean;
  workerActive: boolean;
  analysisInFlight: boolean;
  lastBlockerCode: string | null;
  lastSuccessfulAnalysisAtUtc: string | null;
  lastCycleTerminalStatus: AtMonitorCycleTerminalStatus | null;
  nowMs?: number;
}

const BLOCKED_CODES = new Set([
  "INSTRUMENT_NOT_CONFIGURED",
  "ENVIRONMENT_MISMATCH",
  "VERIFICATION_REQUIRED",
  "SYSTEM_MASTER_OFF",
]);

const STALE_MARKET_CODES = new Set([
  "STALE_QUOTES",
  "MARKET_CLOSED",
  "QUOTE_AGE_EXCEEDED",
  "LIVE_FEED_MARKET_CLOSED",
  "LIVE_TRADING_STATUS_CLOSED",
  "LIVE_QUOTE_STALE",
  "QUOTE_STALE",
]);

const ANALYSIS_FAILED_CODES = new Set([
  "PROVIDER_ERROR",
  "ANALYSIS_FAILED",
  "IMAGE_UNAVAILABLE",
  "DATA_INSUFFICIENT",
  "SCHEDULE_SLOT_MISSED",
]);

const FAILURE_TERMINALS = new Set<AtMonitorCycleTerminalStatus>([
  "ANALYSIS_FAILED",
  "PROVIDER_ERROR",
  "BLOCKED_IMAGE",
  "ANALYSIS_SEMANTIC_REJECTED",
  "BLOCKED_DATA_INSUFFICIENT",
  "BLOCKED_STALE_QUOTES",
  "BLOCKED_VERIFICATION",
  "SCHEDULE_SLOT_MISSED",
]);

function successAgeMs(lastSuccessfulAnalysisAtUtc: string | null, nowMs: number): number | null {
  if (!lastSuccessfulAnalysisAtUtc) return null;
  const t = Date.parse(lastSuccessfulAnalysisAtUtc);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, nowMs - t);
}

function isRecentSuccess(lastSuccessfulAnalysisAtUtc: string | null, nowMs: number): boolean {
  const age = successAgeMs(lastSuccessfulAnalysisAtUtc, nowMs);
  if (age == null) return false;
  return age <= AT_AUTOMATIC_ANALYSIS_SUCCESS_RECENCY_MS;
}

function isStaleSuccess(lastSuccessfulAnalysisAtUtc: string | null, nowMs: number): boolean {
  const age = successAgeMs(lastSuccessfulAnalysisAtUtc, nowMs);
  if (age == null) return false;
  return age > AT_AUTOMATIC_ANALYSIS_SUCCESS_RECENCY_MS;
}

/**
 * Pure status derivation for automatic 5-minute UTC analysis schedule (dashboard + health persistence).
 */
export function deriveAtAutomaticAnalysisStatus(
  input: DeriveAtAutomaticAnalysisStatusInput,
): AtAutomaticAnalysisStatus {
  const nowMs = input.nowMs ?? Date.now();
  const code = input.lastBlockerCode?.trim().toUpperCase() ?? null;

  if (!input.enabled || !input.workerActive) return "STOPPED";
  if (input.analysisInFlight) return "ANALYSIS_RUNNING";

  if (code === "OPENAI_BILLING_BLOCKED") return "PROVIDER_BILLING_BLOCKED";
  if (code === "OPENAI_AUTH_ERROR") return "PROVIDER_AUTH_FAILED";
  if (code === "OPENAI_RATE_LIMIT") return "PROVIDER_RATE_LIMITED";

  if (code && BLOCKED_CODES.has(code)) return "BLOCKED";

  if (code && STALE_MARKET_CODES.has(code)) return "STALE_MARKET_DATA";
  if (input.lastCycleTerminalStatus === "BLOCKED_STALE_QUOTES") return "STALE_MARKET_DATA";

  if (code && ANALYSIS_FAILED_CODES.has(code)) return "ANALYSIS_FAILED";
  if (
    input.lastCycleTerminalStatus
    && FAILURE_TERMINALS.has(input.lastCycleTerminalStatus)
    && input.lastCycleTerminalStatus !== "BLOCKED_STALE_QUOTES"
    && input.lastCycleTerminalStatus !== "BLOCKED_VERIFICATION"
  ) {
    return "ANALYSIS_FAILED";
  }

  const terminalSuccess = input.lastCycleTerminalStatus === "ANALYSIS_VALID";
  if (terminalSuccess && isRecentSuccess(input.lastSuccessfulAnalysisAtUtc, nowMs)) {
    return "ANALYSIS_SUCCEEDED";
  }

  if (
    terminalSuccess
    && isStaleSuccess(input.lastSuccessfulAnalysisAtUtc, nowMs)
  ) {
    return "LAST_SUCCESS_STALE";
  }

  if (isRecentSuccess(input.lastSuccessfulAnalysisAtUtc, nowMs) && !code) {
    return "ANALYSIS_SUCCEEDED";
  }

  if (isStaleSuccess(input.lastSuccessfulAnalysisAtUtc, nowMs) && !code) {
    return "LAST_SUCCESS_STALE";
  }

  // Scheduler armed — between slots or monitoring live without a dominating failure.
  return "WAITING";
}
