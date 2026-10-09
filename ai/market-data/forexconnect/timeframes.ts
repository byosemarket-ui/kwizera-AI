/**
 * Phase 34 — Project timeframe ↔ ForexConnect SDK period identifiers.
 * Official Python ForexConnect.get_history timeframe strings (e.g. m1, H1, D1).
 * Only exact 1:1 mappings — never approximate/substitute.
 */
import type { CanonicalTimeframeId } from "../providers/contracts.js";

export type ForexConnectPeriodId =
  | "m1" | "m5" | "m15" | "m30"
  | "H1" | "H4"
  | "D1" | "W1";

export const FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES = [
  "1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w",
] as const satisfies readonly CanonicalTimeframeId[];

export type ForexConnectSupportedTimeframe =
  (typeof FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES)[number];

const PROJECT_TO_FC: Record<ForexConnectSupportedTimeframe, ForexConnectPeriodId> = {
  "1m": "m1",
  "5m": "m5",
  "15m": "m15",
  "30m": "m30",
  "1h": "H1",
  "4h": "H4",
  "1d": "D1",
  "1w": "W1",
};

export const FOREXCONNECT_TIMEFRAME_MS: Record<ForexConnectSupportedTimeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

/** SDK default / practical bound for quotes_count. */
export const FOREXCONNECT_MAX_CANDLES = 300;

export function isForexConnectSupportedTimeframe(
  value: string,
): value is ForexConnectSupportedTimeframe {
  return (FOREXCONNECT_SUPPORTED_PROJECT_TIMEFRAMES as readonly string[]).includes(value);
}

export function toForexConnectPeriodId(timeframe: string): ForexConnectPeriodId | null {
  if (!isForexConnectSupportedTimeframe(timeframe)) return null;
  return PROJECT_TO_FC[timeframe];
}

export function fromForexConnectPeriodId(period: string): ForexConnectSupportedTimeframe | null {
  const normalized = String(period ?? "").trim();
  const entry = Object.entries(PROJECT_TO_FC).find(
    ([, p]) => p.toLowerCase() === normalized.toLowerCase(),
  );
  return (entry?.[0] as ForexConnectSupportedTimeframe | undefined) ?? null;
}
