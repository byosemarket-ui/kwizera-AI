/**
 * Phase 20 — decide whether Market State is usable for AI analysis.
 * REST snapshots use connection=CONNECTED (not LIVE); that alone must not block analysis.
 * True staleness is judged by candle/update age vs timeframe limits.
 */
import { staleLimitMs } from "../forex-market-state/classifications.js";
import type { ForexBinanceMarketState } from "../forex-market-state/types.js";
import type { ForexAiDataQualityStatus, ForexAiErrorCode } from "./types.js";

export interface MarketDataQualityAssessment {
  ok: boolean;
  code: "OK" | Extract<ForexAiErrorCode, "DATA_UNAVAILABLE" | "STALE_DATA" | "DISCONNECTED" | "INSUFFICIENT_MARKET_DATA">;
  status: ForexAiDataQualityStatus;
  stale: boolean;
  marketTimestamp: string | null;
  reason?: string;
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

export function assessMarketStateForAnalysis(
  state: ForexBinanceMarketState,
  nowMs = Date.now(),
): MarketDataQualityAssessment {
  const marketTimestamp = state.lastMarketUpdate != null
    ? new Date(state.lastMarketUpdate).toISOString()
    : null;

  const connection = state.dataQuality.connection;

  if (connection === "DISCONNECTED") {
    return {
      ok: false,
      code: "DISCONNECTED",
      status: "DISCONNECTED",
      stale: true,
      marketTimestamp,
      reason: state.dataQuality.reason ?? "Market feed is disconnected.",
    };
  }

  if (connection === "ERROR" || connection === "NO_DATA" || connection === "CONNECTING") {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      status: "DATA_UNAVAILABLE",
      stale: true,
      marketTimestamp,
      reason: state.dataQuality.reason ?? `Market data unavailable (${connection}).`,
    };
  }

  if (!state.dataQuality.valid || !state.candle || state.price == null) {
    return {
      ok: false,
      code: "INSUFFICIENT_MARKET_DATA",
      status: "DATA_UNAVAILABLE",
      stale: true,
      marketTimestamp,
      reason: state.dataQuality.reason ?? "Market state has no valid candle/price facts.",
    };
  }

  const minutes = timeframeMinutes(state.timeframe);
  // REST kline snapshots often stamp lastMarketUpdate as the forming candle open.
  // That open can be almost one full interval old while the candle is still valid.
  // Age limit must cover the interval itself plus a small grace — not a flat cap that
  // falsely marks 1h/4h/1d states STALE mid-candle (breaks MTF required HTF slots).
  const intervalMs = minutes * 60 * 1000;
  const ageLimit = intervalMs + staleLimitMs(minutes);
  const lastUpdate = state.lastMarketUpdate;
  const ageMs = lastUpdate == null ? Number.POSITIVE_INFINITY : nowMs - lastUpdate;
  const ageStale = !Number.isFinite(ageMs) || ageMs > ageLimit;

  if (ageStale) {
    return {
      ok: false,
      code: "STALE_DATA",
      status: "STALE_DATA",
      stale: true,
      marketTimestamp,
      reason: `Market update is too old for ${state.timeframe} analysis.`,
    };
  }

  const status: ForexAiDataQualityStatus =
    connection === "LIVE" && !state.dataQuality.stale ? "LIVE" : "CONNECTED";

  return {
    ok: true,
    code: "OK",
    status,
    stale: false,
    marketTimestamp,
  };
}

export function formatDisplaySymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  const quotes = ["USDT", "USDC", "BUSD", "FDUSD", "BTC", "ETH", "BNB", "EUR", "TRY"];
  for (const q of quotes) {
    if (s.endsWith(q) && s.length > q.length) {
      return `${s.slice(0, -q.length)}/${q}`;
    }
  }
  return s;
}
