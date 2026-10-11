/**
 * Candle / feed freshness for continuous monitoring.
 * Historical-only snapshots are never treated as live FRESH.
 */
import { staleLimitMs } from "../forex-market-state/classifications.js";
import type { MarketProviderId } from "../market-data/providers/types.js";
import type { FreshnessState } from "./types.js";

export interface CandleFreshnessInput {
  provider: MarketProviderId | string;
  timeframe: string;
  lastClosedTime: number | null;
  lastUpdateAt: string | null;
  nowMs?: number;
  sourceMode?: "HISTORICAL" | "LIVE" | "HISTORICAL_LIVE" | null;
  connectionState?: string | null;
  fcDiagnostics?: {
    updateCount?: number;
    pollChanges?: number;
    marketInactive?: boolean;
  } | null;
}

export interface CandleFreshnessResult {
  state: FreshnessState;
  dataAgeMs: number | null;
  warnings: string[];
  liveCapable: boolean;
}

function timeframeMinutes(timeframe: string): number {
  const m = timeframe.trim().toLowerCase().match(/^(\d+)(m|h|d|w)$/);
  if (!m) return 15;
  const n = Number(m[1]);
  const u = m[2];
  if (u === "m") return n;
  if (u === "h") return n * 60;
  if (u === "d") return n * 1440;
  return n * 10080;
}

function parseUpdateMs(lastUpdateAt: string | null): number | null {
  if (!lastUpdateAt) return null;
  const t = Date.parse(lastUpdateAt);
  return Number.isFinite(t) ? t : null;
}

export function assessCandleFreshness(
  provider: MarketProviderId | string,
  timeframe: string,
  lastClosedTime: number | null,
  lastUpdateAt: string | null,
  nowMs = Date.now(),
  fcDiagnostics?: CandleFreshnessInput["fcDiagnostics"],
): CandleFreshnessResult {
  return assessCandleFreshnessDetailed({
    provider,
    timeframe,
    lastClosedTime,
    lastUpdateAt,
    nowMs,
    fcDiagnostics,
  });
}

export function assessCandleFreshnessDetailed(input: CandleFreshnessInput): CandleFreshnessResult {
  const {
    provider,
    timeframe,
    lastClosedTime,
    lastUpdateAt,
    nowMs = Date.now(),
    sourceMode,
    connectionState,
    fcDiagnostics,
  } = input;

  const warnings: string[] = [];
  const providerId = String(provider ?? "").trim().toUpperCase();
  const updateMs = parseUpdateMs(lastUpdateAt);
  const dataAgeMs = updateMs == null ? null : Math.max(0, nowMs - updateMs);

  if (lastClosedTime == null) {
    warnings.push("No closed candle timestamp available.");
    return { state: "UNAVAILABLE", dataAgeMs, warnings, liveCapable: false };
  }

  const conn = String(connectionState ?? "").toUpperCase();
  if (conn === "DISCONNECTED" || conn === "ERROR" || conn === "NO_DATA") {
    warnings.push(`Connection state ${conn || "UNKNOWN"} — data unavailable.`);
    return { state: "UNAVAILABLE", dataAgeMs, warnings, liveCapable: false };
  }

  if (fcDiagnostics?.marketInactive) {
    warnings.push("Market marked inactive by provider diagnostics.");
    return { state: "INACTIVE", dataAgeMs, warnings, liveCapable: false };
  }

  if (conn === "MARKET_INACTIVE") {
    warnings.push("Unified connection MARKET_INACTIVE.");
    return { state: "INACTIVE", dataAgeMs, warnings, liveCapable: false };
  }

  const minutes = timeframeMinutes(timeframe);
  const intervalMs = minutes * 60 * 1000;
  const ageLimit = intervalMs + staleLimitMs(minutes);

  const historicalOnly =
    sourceMode === "HISTORICAL"
    || (sourceMode == null && conn !== "LIVE" && conn !== "CONNECTED" && conn !== "SUBSCRIBED_WAITING");

  if (providerId === "FOREXCONNECT") {
    const updates = fcDiagnostics?.updateCount ?? 0;
    const pollChanges = fcDiagnostics?.pollChanges ?? 0;
    if (updates === 0 && pollChanges === 0) {
      warnings.push("ForexConnect stream has zero updates — historical candles alone are not LIVE.");
      if (historicalOnly || dataAgeMs == null || dataAgeMs > ageLimit) {
        return { state: dataAgeMs != null && dataAgeMs > ageLimit ? "STALE" : "STALE", dataAgeMs, warnings, liveCapable: false };
      }
      return { state: "STALE", dataAgeMs, warnings, liveCapable: false };
    }
  }

  if (historicalOnly) {
    warnings.push("Series sourceMode is HISTORICAL — not live FRESH.");
    if (dataAgeMs != null && dataAgeMs > ageLimit) {
      return { state: "STALE", dataAgeMs, warnings, liveCapable: false };
    }
    return { state: "STALE", dataAgeMs, warnings, liveCapable: false };
  }

  if (dataAgeMs == null || !Number.isFinite(dataAgeMs)) {
    warnings.push("Missing last data update timestamp.");
    return { state: "UNKNOWN", dataAgeMs, warnings, liveCapable: true };
  }

  if (dataAgeMs > ageLimit) {
    warnings.push(`Data age ${dataAgeMs}ms exceeds limit ${ageLimit}ms for ${timeframe}.`);
    return { state: "STALE", dataAgeMs, warnings, liveCapable: true };
  }

  const liveConn = conn === "LIVE" || sourceMode === "LIVE" || sourceMode === "HISTORICAL_LIVE";
  if (!liveConn && providerId !== "BINANCE") {
    warnings.push("Feed connected but not LIVE — monitoring uses closed candles only.");
  }

  return { state: "FRESH", dataAgeMs, warnings, liveCapable: liveConn || providerId === "BINANCE" };
}
