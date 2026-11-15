/**
 * HFM MT5 Phase 1 freshness policy (Demo read-only feed).
 *
 * LIVE requires a recent broker-originated acquisition.
 * Unchanged prices alone do not imply STALE — use acquisition age + connectivity.
 */

export const MT5_HFM_FRESHNESS_STATUSES = [
  "LIVE",
  "STALE",
  "WAITING_FOR_DATA",
  "DISCONNECTED",
  "MARKET_CLOSED",
  "DATA_UNAVAILABLE",
] as const;

export type Mt5HfmFreshness = (typeof MT5_HFM_FRESHNESS_STATUSES)[number];

export interface Mt5HfmFreshnessPolicy {
  /** Max age (sec) of acquisition file/agent result to label LIVE. */
  liveMaxAgeSec: number;
  /** Max age before DISCONNECTED (beyond this, STALE window ends). */
  staleMaxAgeSec: number;
  /** Heartbeat interval for SSE clients. */
  heartbeatSec: number;
  /** Hub poll interval against the Demo agent. */
  pollIntervalMs: number;
}

export const DEFAULT_MT5_HFM_FRESHNESS_POLICY: Mt5HfmFreshnessPolicy = {
  liveMaxAgeSec: 15,
  staleMaxAgeSec: 180,
  heartbeatSec: 15,
  pollIntervalMs: 3000,
};

/**
 * Infer FX session closed when MT5 broker time lags GMT while the terminal is up.
 * Unchanged prices alone must not imply STALE or MARKET_CLOSED.
 */
export function inferMarketClosed(
  brokerTime: number | null | undefined,
  gmtTime: number | null | undefined,
  opts?: { terminalRunning?: boolean; lagSec?: number },
): boolean {
  if (opts?.terminalRunning === false) return false;
  if (typeof brokerTime !== "number" || typeof gmtTime !== "number") return false;
  if (!Number.isFinite(brokerTime) || !Number.isFinite(gmtTime)) return false;
  if (brokerTime <= 0 || gmtTime <= 0) return false;
  const lagSec = opts?.lagSec ?? 3600;
  return gmtTime - brokerTime >= lagSec;
}

export function freshnessFromAgeSec(
  ageSec: number | null | undefined,
  policy: Mt5HfmFreshnessPolicy = DEFAULT_MT5_HFM_FRESHNESS_POLICY,
  opts?: { terminalRunning?: boolean; marketClosed?: boolean },
): Mt5HfmFreshness {
  if (opts?.terminalRunning === false) return "DISCONNECTED";
  if (ageSec == null || !Number.isFinite(ageSec)) return "WAITING_FOR_DATA";
  if (ageSec <= policy.liveMaxAgeSec) {
    return opts?.marketClosed ? "MARKET_CLOSED" : "LIVE";
  }
  if (ageSec <= policy.staleMaxAgeSec) return "STALE";
  return "DISCONNECTED";
}

/** Reject incomplete tick records (never invent prices). */
export function isValidQuoteTick(q: {
  symbol?: unknown;
  bid?: unknown;
  ask?: unknown;
}): boolean {
  const symbol = typeof q.symbol === "string" ? q.symbol.trim() : "";
  if (!symbol) return false;
  if (typeof q.bid !== "number" || typeof q.ask !== "number") return false;
  if (!Number.isFinite(q.bid) || !Number.isFinite(q.ask)) return false;
  if (q.bid <= 0 || q.ask <= 0 || q.ask < q.bid) return false;
  return true;
}

/** OHLC consistency check for broker candles. */
export function isValidOhlcCandle(c: {
  time?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
}): boolean {
  if (typeof c.time !== "number" || !Number.isFinite(c.time) || c.time <= 0) return false;
  const o = c.open;
  const h = c.high;
  const l = c.low;
  const cl = c.close;
  if (
    typeof o !== "number" ||
    typeof h !== "number" ||
    typeof l !== "number" ||
    typeof cl !== "number"
  ) {
    return false;
  }
  if (![o, h, l, cl].every((n) => Number.isFinite(n) && n > 0)) return false;
  if (h < Math.max(o, cl) || l > Math.min(o, cl) || h < l) return false;
  return true;
}
