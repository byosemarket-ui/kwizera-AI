/**
 * Phase 5B.1 — UnifiedCandle (HFM historical only) → MifCanonicalCandle.
 *
 * Does NOT support HFM live subscription via MarketDataService.
 * Live forming must use adaptHfmFormingCandle / dedicated HFM live path.
 */
import type { UnifiedCandle, UnifiedCandleSeries } from "../../../providers/contracts.js";
import {
  baseCanonicalCandle,
  deriveCloseTimeSec,
  isFiniteOhlc,
  type MifCanonicalCandle,
} from "../canonical/candle.js";
import {
  buildMifInstrumentStub,
  type MifCanonicalInstrument,
} from "../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import { mifFail, mifOk, type MifAdapterResult } from "./adapter-errors.js";

const HFM = MIF_PROVIDER_ID;

function assertHfmIdentity(c: UnifiedCandle): MifAdapterResult<true> {
  if (c.provider !== HFM || c.source !== HFM) {
    return mifFail(
      "UNSUPPORTED_PROVIDER",
      `UnifiedCandle provider/source must be HFM_MT5 (got provider=${String(c.provider)} source=${String(c.source)})`,
      { provider: c.provider, source: c.source },
    );
  }
  return mifOk(true);
}

/**
 * Map a single UnifiedCandle from the HFM historical unification path.
 * Volume is a single field → volumeType unknown_collapsed (tick vs real not recoverable).
 */
export function adaptUnifiedHfmHistoricalCandle(
  candle: UnifiedCandle,
  opts?: { instrument?: MifCanonicalInstrument | null },
): MifAdapterResult<MifCanonicalCandle> {
  if (!candle || typeof candle !== "object") {
    return mifFail("INVALID_SOURCE_CONTRACT", "UnifiedCandle is required");
  }

  const idCheck = assertHfmIdentity(candle);
  if (!idCheck.ok) return idCheck;

  // Live subscription / live-mode candles are out of scope for this adapter.
  if (candle.sourceMode === "LIVE") {
    return mifFail(
      "LIVE_SUBSCRIPTION_UNSUPPORTED",
      "Unified HFM adapter accepts historical records only; HFM live must use dedicated live/SSE path",
      { sourceMode: candle.sourceMode },
    );
  }
  if (candle.isClosed !== true) {
    return mifFail(
      "UNSUPPORTED_SOURCE_SEMANTICS",
      "Unified HFM historical adapter requires isClosed=true; forming/live tips are not accepted here",
      { isClosed: candle.isClosed },
    );
  }

  const symbol = String(candle.providerSymbol || candle.canonicalSymbol || "").trim().toUpperCase();
  if (!symbol) {
    return mifFail("MISSING_IDENTITY", "UnifiedCandle providerSymbol/canonicalSymbol required");
  }
  const timeframe = String(candle.timeframe || "").trim();
  if (!timeframe) {
    return mifFail("INVALID_TIMEFRAME", "UnifiedCandle timeframe is required");
  }

  const openTimeSec = candle.time;
  if (!isFiniteOhlc({
    openTimeSec,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  })) {
    return mifFail("INVALID_OHLC", "UnifiedCandle OHLC/time invalid", { symbol, timeframe });
  }

  // Single volume field — do not invent tick vs real; never coerce null → 0.
  const collapsed =
    typeof candle.volume === "number" && Number.isFinite(candle.volume) ? candle.volume : null;

  const instrument = opts?.instrument ?? buildMifInstrumentStub({
    providerSymbol: symbol,
    canonicalSymbol: candle.canonicalSymbol,
    displaySymbol: candle.displaySymbol,
  });

  // UnifiedCandle JSDoc claims UTC; HFM CopyRates are broker-server. Preserve uncertainty:
  // timebase UNKNOWN (not silent UTC), offset null.
  // Collapsed volume lives in collapsedVolume only — tickVolume/realVolume stay null
  // so consumers never mistake ambiguity for true tick/real source fields.
  const mapped = baseCanonicalCandle({
    providerSymbol: symbol,
    timeframe: String(candle.timeframe),
    openTimeSec,
    closeTimeSec: deriveCloseTimeSec(openTimeSec, String(candle.timeframe)),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    tickVolume: null,
    realVolume: null,
    collapsedVolume: collapsed,
    volumeType: collapsed == null ? "none" : "unknown_collapsed",
    spread: null,
    candleState: "CLOSED",
    priceBasis: "unspecified",
    timebase: "UNKNOWN",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "UNKNOWN",
    sourceDialect: "unified.candle",
    sourceProvenance: `unified:${candle.source}:${candle.sourceMode}`,
    sourceMode: candle.sourceMode,
    sourceDataQuality: candle.dataQuality,
    validation: {
      status: candle.dataQuality === "INVALID" || candle.dataQuality === "ERROR" ? "rejected" : "ok",
      errors: [],
      warnings: collapsed != null ? ["volume_type_unknown_collapsed"] : [],
    },
    instrument,
  });

  return mifOk(mapped);
}

export function adaptUnifiedHfmHistoricalSeries(
  series: UnifiedCandleSeries,
  opts?: { instrument?: MifCanonicalInstrument | null },
): MifAdapterResult<{
  candles: MifCanonicalCandle[];
  failures: Array<{ index: number; code: string; message: string }>;
  claimsLiveSubscription: false;
  note: string;
}> {
  if (!series || typeof series !== "object") {
    return mifFail("INVALID_SOURCE_CONTRACT", "UnifiedCandleSeries is required");
  }
  if (series.source !== HFM) {
    return mifFail("UNSUPPORTED_PROVIDER", `Series source must be HFM_MT5 (got ${String(series.source)})`, {
      source: series.source,
    });
  }
  if (series.sourceMode === "LIVE") {
    return mifFail(
      "LIVE_SUBSCRIPTION_UNSUPPORTED",
      "Unified HFM series adapter does not support LIVE sourceMode; use dedicated HFM live path",
      { sourceMode: series.sourceMode },
    );
  }
  // Explicitly ignore series.forming — must not treat as historical CLOSED via this adapter.
  const failures: Array<{ index: number; code: string; message: string }> = [];
  const candles: MifCanonicalCandle[] = [];
  (series.candles ?? []).forEach((c, index) => {
    const result = adaptUnifiedHfmHistoricalCandle(c, opts);
    if (result.ok) candles.push(result.value);
    else failures.push({ index, code: result.error.code, message: result.error.message });
  });

  return mifOk({
    candles,
    failures,
    claimsLiveSubscription: false,
    note: series.forming
      ? "Series.forming ignored by historical unified adapter (use live-forming adapter)."
      : (series.note || "HFM unified historical adaptation"),
  });
}
