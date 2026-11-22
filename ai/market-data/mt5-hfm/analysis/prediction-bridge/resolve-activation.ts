/**
 * P8.A — resolve authoritative activation candle open-time from Charts context.
 * Prefer last CLOSED (non-current) candle on the chart/primary timeframe.
 */
import type {
  HfmAnalysisContextResult,
  HfmAnalysisMultiTfSnapshot,
  HfmAnalysisNormalizedCandle,
} from "../types.js";
import type { HfmChartsActivationBoundary } from "./types.js";

const TF_PRIORITY = ["H1", "H4", "M30", "M15", "M5"] as const;

function pickTimeframe(snapshot: HfmAnalysisMultiTfSnapshot): string {
  const chart = String(snapshot.chartTimeframeAtStart || "").trim().toUpperCase();
  if (chart && snapshot.timeframes[chart]) return chart;
  for (const tf of TF_PRIORITY) {
    if (snapshot.timeframes[tf]) return tf;
  }
  const keys = Object.keys(snapshot.timeframes || {});
  return keys[0] ? String(keys[0]).toUpperCase() : "";
}

function lastClosedCandle(
  dataset: { historical?: HfmAnalysisNormalizedCandle[]; current?: HfmAnalysisNormalizedCandle | null } | null | undefined,
): HfmAnalysisNormalizedCandle | null {
  if (!dataset) return null;
  const closed = (dataset.historical ?? []).filter(
    (c) => c && Number.isFinite(c.timestamp) && c.timestamp > 0 && c.isCurrent !== true,
  );
  if (closed.length) {
    return closed.reduce((a, b) => (b.timestamp >= a.timestamp ? b : a));
  }
  // Fall back to newest historical bar even if tip-marked, then current.
  const hist = (dataset.historical ?? []).filter(
    (c) => c && Number.isFinite(c.timestamp) && c.timestamp > 0,
  );
  if (hist.length) {
    return hist.reduce((a, b) => (b.timestamp >= a.timestamp ? b : a));
  }
  const cur = dataset.current;
  if (cur && Number.isFinite(cur.timestamp) && cur.timestamp > 0) return cur;
  return null;
}

export function resolveActivationFromContext(
  context: HfmAnalysisContextResult | null | undefined,
  symbolFallback: string,
):
  | { ok: true; activation: HfmChartsActivationBoundary }
  | { ok: false; code: "MISSING_ACTIVATION"; message: string } {
  const snapshot = context?.snapshot ?? null;
  if (!snapshot) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION",
      message: "analysis context snapshot missing",
    };
  }
  const timeframe = pickTimeframe(snapshot);
  if (!timeframe) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION",
      message: "no timeframe datasets on snapshot",
    };
  }
  const dataset = snapshot.timeframes[timeframe];
  const candle = lastClosedCandle(dataset);
  if (!candle || !Number.isFinite(candle.timestamp) || candle.timestamp <= 0) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION",
      message: `no activation candle on ${timeframe}`,
    };
  }
  const providerSymbol = String(snapshot.symbol || symbolFallback || "")
    .trim()
    .toUpperCase();
  if (!providerSymbol) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION",
      message: "missing instrument symbol",
    };
  }
  return {
    ok: true,
    activation: {
      activationOpenTimeSec: Math.floor(candle.timestamp),
      timeframe,
      close: Number.isFinite(candle.close) ? candle.close : null,
      providerSymbol,
    },
  };
}
