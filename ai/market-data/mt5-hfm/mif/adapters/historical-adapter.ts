/**
 * Phase 5B.1 — HfmHistoricalBar → MifCanonicalCandle (CLOSED when validation ok).
 */
import type { HfmHistoricalBar } from "../../historical-engine.js";
import {
  baseCanonicalCandle,
  classifyVolumeType,
  deriveCloseTimeSec,
  isFiniteOhlc,
  type MifCanonicalCandle,
} from "../canonical/candle.js";
import {
  buildMifInstrumentStub,
  type MifCanonicalInstrument,
} from "../canonical/instrument.js";
import { mifFail, mifOk, type MifAdapterResult } from "./adapter-errors.js";

export interface AdaptHfmHistoricalBarInput {
  bar: HfmHistoricalBar;
  symbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
}

export function adaptHfmHistoricalBar(
  input: AdaptHfmHistoricalBarInput,
): MifAdapterResult<MifCanonicalCandle> {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  if (!symbol) {
    return mifFail("MISSING_IDENTITY", "providerSymbol is required");
  }
  if (!timeframe) {
    return mifFail("INVALID_TIMEFRAME", "timeframe is required");
  }
  const bar = input.bar;
  if (!bar || typeof bar !== "object") {
    return mifFail("INVALID_SOURCE_CONTRACT", "HfmHistoricalBar is required");
  }

  const openTimeSec = bar.time;
  const ohlc = {
    openTimeSec,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
  if (!isFiniteOhlc(ohlc)) {
    return mifFail("INVALID_OHLC", "Historical bar OHLC/openTime invalid", { symbol, timeframe, openTimeSec });
  }

  const tickVolume =
    typeof bar.tickVolume === "number" && Number.isFinite(bar.tickVolume) ? bar.tickVolume : null;
  const realVolume =
    typeof bar.realVolume === "number" && Number.isFinite(bar.realVolume) ? bar.realVolume : null;
  // Never coerce null → 0.
  const volumeType = classifyVolumeType(tickVolume, realVolume);
  const validationStatus = bar.validationStatus === "ok" || bar.validationStatus === "rejected"
    ? bar.validationStatus
    : "unknown";

  // Completed historical CopyRates bars with ok validation → CLOSED.
  // Rejected validation → INVALID state (still returned only if OHLC finite; callers may discard).
  const candleState = validationStatus === "rejected" ? "INVALID" : "CLOSED";

  const instrument = input.instrument ?? buildMifInstrumentStub({ providerSymbol: symbol });

  const candle = baseCanonicalCandle({
    providerSymbol: symbol,
    timeframe,
    openTimeSec,
    closeTimeSec: deriveCloseTimeSec(openTimeSec, timeframe),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    tickVolume,
    realVolume,
    collapsedVolume: null,
    volumeType,
    spread: typeof bar.spread === "number" && Number.isFinite(bar.spread) ? bar.spread : null,
    candleState,
    priceBasis: "unspecified",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "UNKNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: bar.provenance,
    sourceMode: "HISTORICAL",
    sourceDataQuality: validationStatus,
    validation: {
      status: validationStatus === "ok" ? "ok" : validationStatus === "rejected" ? "rejected" : "unknown",
      errors: validationStatus === "rejected" ? ["source_validation_rejected"] : [],
      warnings: [],
    },
    instrument,
  });

  return mifOk(candle);
}

export function adaptHfmHistoricalBars(
  bars: HfmHistoricalBar[],
  opts: { symbol: string; timeframe: string; instrument?: MifCanonicalInstrument | null },
): { candles: MifCanonicalCandle[]; failures: Array<{ index: number; code: string; message: string }> } {
  const candles: MifCanonicalCandle[] = [];
  const failures: Array<{ index: number; code: string; message: string }> = [];
  bars.forEach((bar, index) => {
    const result = adaptHfmHistoricalBar({
      bar,
      symbol: opts.symbol,
      timeframe: opts.timeframe,
      instrument: opts.instrument,
    });
    if (result.ok) candles.push(result.value);
    else failures.push({ index, code: result.error.code, message: result.error.message });
  });
  return { candles, failures };
}
