/**
 * Phase 5B.1 — HfmFormingCandle → MifCanonicalCandle (always FORMING).
 */
import type { HfmFormingCandle } from "../../live-candle-engine.js";
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
import { mifFail, mifOk, type MifAdapterResult } from "./adapter-errors.js";

export interface AdaptHfmFormingCandleInput {
  candle: HfmFormingCandle;
  instrument?: MifCanonicalInstrument | null;
}

export function adaptHfmFormingCandle(
  input: AdaptHfmFormingCandleInput,
): MifAdapterResult<MifCanonicalCandle> {
  const c = input.candle;
  if (!c || typeof c !== "object") {
    return mifFail("INVALID_SOURCE_CONTRACT", "HfmFormingCandle is required");
  }
  if (c.provider != null && c.provider !== "HFM_MT5") {
    return mifFail("UNSUPPORTED_PROVIDER", `Provider ${String(c.provider)} is not HFM_MT5`, {
      provider: c.provider,
    });
  }
  const symbol = String(c.symbol || "").trim().toUpperCase();
  const timeframe = String(c.timeframe || "").trim().toUpperCase();
  if (!symbol) return mifFail("MISSING_IDENTITY", "forming candle symbol is required");
  if (!timeframe) return mifFail("INVALID_TIMEFRAME", "forming candle timeframe is required");

  // Hard rule: source closed must be false; never upgrade to CLOSED.
  if (c.closed !== false) {
    return mifFail(
      "UNSUPPORTED_SOURCE_SEMANTICS",
      "HfmFormingCandle.closed must be false; refusing to map as CLOSED",
      { closed: c.closed },
    );
  }

  const openTimeSec = c.time;
  if (!isFiniteOhlc({
    openTimeSec,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  })) {
    return mifFail("INVALID_OHLC", "Forming candle OHLC/openTime invalid", { symbol, timeframe });
  }

  const tickVolume =
    typeof c.tickVolume === "number" && Number.isFinite(c.tickVolume) ? c.tickVolume : null;
  // Forming engine uses numeric tickVolume; if somehow non-finite → null (never 0 fabrication).
  const receivedAt =
    typeof c.receiveTimestamp === "string" && c.receiveTimestamp.trim()
      ? c.receiveTimestamp
      : null;

  const instrument = input.instrument ?? buildMifInstrumentStub({ providerSymbol: symbol });

  const candle = baseCanonicalCandle({
    providerSymbol: symbol,
    timeframe,
    openTimeSec,
    closeTimeSec: deriveCloseTimeSec(openTimeSec, timeframe),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    tickVolume,
    realVolume: null,
    collapsedVolume: null,
    volumeType: tickVolume != null ? "tick" : "none",
    spread: null,
    candleState: "FORMING",
    priceBasis: c.priceBasis === "bid" ? "bid" : "unknown",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: typeof c.lastTickTime === "number" && Number.isFinite(c.lastTickTime)
      ? c.lastTickTime
      : openTimeSec,
    receivedAt,
    availableAt: receivedAt,
    availabilityStatus: receivedAt ? "KNOWN" : "UNKNOWN",
    sourceDialect: "hfm.forming-candle",
    sourceProvenance: "live_aggregate",
    sourceMode: "LIVE",
    sourceDataQuality: null,
    validation: {
      status: "ok",
      errors: [],
      warnings: [],
    },
    instrument,
  });

  if (candle.candleState !== "FORMING") {
    return mifFail("UNSUPPORTED_SOURCE_SEMANTICS", "Internal error: forming adapter produced non-FORMING state");
  }

  return mifOk(candle);
}
