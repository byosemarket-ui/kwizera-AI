/**
 * Phase 5F STEP 3 — LIVE_COPYRATES source adapter (HFM_MT5 CopyRates only).
 * Does not treat the live bid-forming candle engine as authoritative outcome evidence.
 * Weekend-safe: accepts explicitly supplied validated CopyRates series for contract tests.
 */
import { adaptHfmHistoricalBar } from "../adapters/historical-adapter.js";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import type { HfmHistoricalBar } from "../../historical-engine.js";
import { MIF_PREDICTION_MAX_OBSERVATION_BARS } from "./contracts.js";
import {
  selectFutureBarsAfterActivation,
  validateOutcomeCandleSeries,
} from "./closed-candle.js";
import type { MifPredictionDataQuality, MifPredictionLiveProvenance } from "./types.js";

export interface LiveCopyRatesBarInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume?: number | null;
  realVolume?: number | null;
  spread?: number | null;
  /** Must be false/absent for forming; true only when broker-closed. */
  isClosed?: boolean;
  candleState?: "CLOSED" | "FORMING" | "INVALID" | "UNKNOWN";
  validationStatus?: "ok" | "rejected" | "unknown";
  provenance?: string;
}

export interface LiveCopyRatesSourceInput {
  instrument: string;
  timeframe: string;
  bars: readonly LiveCopyRatesBarInput[];
  activationOpenTimeSec: number;
  /** Broker-server time for closure verification. Required for live authority. */
  brokerNowSec: number;
  sourceProvenance?: string;
  snapshotId?: string | null;
  sequenceId?: string | null;
  sourceMode?: string | null;
  maxBars?: number;
  maxStaleSec?: number | null;
}

export interface LiveCopyRatesSourceResult {
  ok: true;
  provenance: MifPredictionLiveProvenance;
  allClosed: MifCanonicalCandle[];
  futureClosed: MifCanonicalCandle[];
  activationCandle: MifCanonicalCandle | null;
  activationClose: number | null;
  dataQuality: MifPredictionDataQuality;
}

export interface LiveCopyRatesSourceError {
  ok: false;
  code: string;
  message: string;
}

/**
 * Validate an explicitly supplied HFM_MT5 CopyRates series for outcome evaluation.
 * Rejects forming/stale/unverified closure. Never uses forming engine as authority.
 */
export function loadLiveCopyRatesForOutcome(
  input: LiveCopyRatesSourceInput,
): LiveCopyRatesSourceResult | LiveCopyRatesSourceError {
  const instrument = String(input.instrument || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  if (!instrument || !timeframe) {
    return {
      ok: false,
      code: "MISSING_IDENTITY",
      message: "instrument and timeframe required",
    };
  }
  if (
    !Number.isFinite(input.activationOpenTimeSec)
    || input.activationOpenTimeSec <= 0
  ) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION_CUTOFF",
      message: "activationOpenTimeSec required; now() substitution forbidden",
    };
  }
  if (!Number.isFinite(input.brokerNowSec) || input.brokerNowSec <= 0) {
    return {
      ok: false,
      code: "MISSING_BROKER_NOW",
      message: "brokerNowSec required for live CopyRates closure verification",
    };
  }

  const maxBars = Math.min(
    input.maxBars ?? MIF_PREDICTION_MAX_OBSERVATION_BARS,
    MIF_PREDICTION_MAX_OBSERVATION_BARS,
  );
  if (input.bars.length > maxBars) {
    return {
      ok: false,
      code: "BAR_LIMIT_EXCEEDED",
      message: `live series has ${input.bars.length} bars; max ${maxBars}`,
    };
  }

  const candles: MifCanonicalCandle[] = [];
  let formingRejectedEarly = 0;
  for (const bar of input.bars) {
    if (bar.candleState === "FORMING" || bar.isClosed === false) {
      formingRejectedEarly += 1;
      continue;
    }
    const hfm: HfmHistoricalBar = {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      tickVolume: bar.tickVolume ?? null,
      realVolume: bar.realVolume ?? null,
      spread: bar.spread ?? null,
      validationStatus: bar.validationStatus ?? "ok",
      provenance: "native",
    };
    const adapted = adaptHfmHistoricalBar({
      bar: hfm,
      symbol: instrument,
      timeframe,
    });
    if (!adapted.ok) continue;
    // Force live dialect provenance markers without changing OHLC.
    candles.push({
      ...adapted.value,
      sourceDialect: "hfm.historical-bar",
      sourceProvenance: input.sourceProvenance ?? bar.provenance ?? "copyrates",
      sourceMode: input.sourceMode ?? "LIVE_COPYRATES",
    });
  }

  const validated = validateOutcomeCandleSeries({
    candles,
    timeframe,
    brokerNowSec: input.brokerNowSec,
    rejectStaleTip: true,
    maxStaleSec: input.maxStaleSec ?? null,
  });

  const { future, activationCandle } = selectFutureBarsAfterActivation(
    validated.accepted,
    input.activationOpenTimeSec,
  );

  const provenance: MifPredictionLiveProvenance = {
    mode: "LIVE_COPYRATES",
    providerId: "HFM_MT5",
    sourceProvenance: input.sourceProvenance ?? "copyrates",
    snapshotId: input.snapshotId ?? null,
    sequenceId: input.sequenceId ?? null,
    sourceMode: input.sourceMode ?? "LIVE_COPYRATES",
  };

  const dataQuality: MifPredictionDataQuality = {
    closedOnly: true,
    activationExcluded: true,
    gapDetected: validated.gapFlags.length > 0,
    gapFlags: validated.gapFlags,
    duplicateBarsRejected: validated.duplicateBarsRejected,
    outOfOrderRejected: validated.outOfOrderRejected,
    formingRejected: validated.formingRejected + formingRejectedEarly,
    staleRejected: validated.staleRejected,
    closureUnverifiedRejected: validated.closureUnverifiedRejected,
    missingIntervals: validated.missingIntervals,
    tipClipped: true,
    futureBarsExcluded: 0,
  };

  return {
    ok: true,
    provenance,
    allClosed: validated.accepted,
    futureClosed: future,
    activationCandle,
    activationClose: activationCandle?.close ?? null,
    dataQuality,
  };
}
