/**
 * Phase 5C Step 1A — MIF canonical candles → forex-structure StructureCandle.
 * Does not fork the swing engine. Does not mutate inputs. Does not silently repair.
 */
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import { isFiniteOhlc } from "../../canonical/candle.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { StructureCandle } from "../../../../../forex-structure/types.js";

export type MifStructureAdapterIssueCode =
  | "EMPTY_INPUT"
  | "PROVIDER_MISMATCH"
  | "SYMBOL_MISMATCH"
  | "TIMEFRAME_MISMATCH"
  | "INVALID_OHLC"
  | "INVALID_STATE"
  | "DUPLICATE_OPEN_TIME"
  | "OUT_OF_ORDER"
  | "UNSUPPORTED_CANDLE_STATE";

export interface MifStructureAdapterIssue {
  code: MifStructureAdapterIssueCode;
  message: string;
  index?: number;
  openTimeSec?: number | null;
}

export interface MifToStructureCandleResult {
  /** Structure candles suitable for detectSwings — only structurally usable rows. */
  structureCandles: StructureCandle[];
  /** Count of leading closed candles in structureCandles (forming may trail). */
  closedCount: number;
  /** True when series was accepted for swing detection (may still have warnings). */
  ok: boolean;
  /** Blocking issues prevent swing detection. */
  blocking: boolean;
  issues: MifStructureAdapterIssue[];
  /** HFM_MT5 provenance retained on the MIF adapter result (not StructureProviderId). */
  providerId: typeof MIF_PROVIDER_ID;
  providerSymbol: string;
  timeframe: string;
  /** Indices into the original input that were skipped (invalid / duplicate / wrong state). */
  skippedInputIndexes: number[];
}

function isClosedState(state: MifCanonicalCandle["candleState"]): boolean {
  return state === "CLOSED";
}

function isFormingState(state: MifCanonicalCandle["candleState"]): boolean {
  return state === "FORMING";
}

function isUsableState(state: MifCanonicalCandle["candleState"]): boolean {
  return isClosedState(state) || isFormingState(state);
}

/**
 * Convert MIF candles to StructureCandle without mutating the input array or objects.
 * Invalid / duplicate / out-of-order handling:
 * - Reports issues explicitly.
 * - Does not reorder or invent prices.
 * - Skips invalid candles; if any OUT_OF_ORDER among kept usable candles → blocking.
 * - FORMING candles after CLOSED are allowed; CLOSED after FORMING in input order → OUT_OF_ORDER blocking.
 */
export function mifCandlesToStructureCandles(input: {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  /** When false (default), FORMING candles are excluded from structure series. */
  includeForming?: boolean;
}): MifToStructureCandleResult {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim();
  const includeForming = input.includeForming === true;
  const issues: MifStructureAdapterIssue[] = [];
  const skippedInputIndexes: number[] = [];

  if (!input.candles || input.candles.length === 0) {
    return {
      structureCandles: [],
      closedCount: 0,
      ok: false,
      blocking: true,
      issues: [{ code: "EMPTY_INPUT", message: "no candles supplied" }],
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      skippedInputIndexes: [],
    };
  }

  const structureCandles: StructureCandle[] = [];
  let seenForming = false;
  let lastOpenTime: number | null = null;
  const seenTimes = new Set<number>();

  for (let i = 0; i < input.candles.length; i += 1) {
    const c = input.candles[i]!;

    if (c.providerId !== MIF_PROVIDER_ID) {
      issues.push({
        code: "PROVIDER_MISMATCH",
        message: `candle providerId ${c.providerId} is not HFM_MT5`,
        index: i,
        openTimeSec: c.openTimeSec,
      });
      skippedInputIndexes.push(i);
      continue;
    }

    const sym = String(c.providerSymbol || "").trim().toUpperCase();
    if (sym !== providerSymbol) {
      issues.push({
        code: "SYMBOL_MISMATCH",
        message: `candle symbol ${sym} != expected ${providerSymbol}`,
        index: i,
        openTimeSec: c.openTimeSec,
      });
      skippedInputIndexes.push(i);
      continue;
    }

    if (String(c.timeframe || "").trim() !== timeframe) {
      issues.push({
        code: "TIMEFRAME_MISMATCH",
        message: `candle timeframe ${c.timeframe} != expected ${timeframe}`,
        index: i,
        openTimeSec: c.openTimeSec,
      });
      skippedInputIndexes.push(i);
      continue;
    }

    if (!isFiniteOhlc({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      openTimeSec: c.openTimeSec,
    })) {
      issues.push({
        code: "INVALID_OHLC",
        message: "invalid OHLC or openTimeSec",
        index: i,
        openTimeSec: c.openTimeSec,
      });
      skippedInputIndexes.push(i);
      continue;
    }

    if (!isUsableState(c.candleState)) {
      issues.push({
        code: "UNSUPPORTED_CANDLE_STATE",
        message: `candleState ${c.candleState} not usable for structure conversion`,
        index: i,
        openTimeSec: c.openTimeSec,
      });
      skippedInputIndexes.push(i);
      continue;
    }

    const closed = isClosedState(c.candleState);
    if (!closed && !includeForming) {
      skippedInputIndexes.push(i);
      continue;
    }

    if (seenTimes.has(c.openTimeSec)) {
      issues.push({
        code: "DUPLICATE_OPEN_TIME",
        message: `duplicate openTimeSec ${c.openTimeSec}`,
        index: i,
        openTimeSec: c.openTimeSec,
      });
      skippedInputIndexes.push(i);
      continue;
    }

    if (lastOpenTime != null && c.openTimeSec < lastOpenTime) {
      issues.push({
        code: "OUT_OF_ORDER",
        message: `openTimeSec ${c.openTimeSec} precedes prior ${lastOpenTime}`,
        index: i,
        openTimeSec: c.openTimeSec,
      });
      // Fail closed: do not keep a reordered series.
      return {
        structureCandles: [],
        closedCount: 0,
        ok: false,
        blocking: true,
        issues,
        providerId: MIF_PROVIDER_ID,
        providerSymbol,
        timeframe,
        skippedInputIndexes: [...skippedInputIndexes, i],
      };
    }

    if (closed && seenForming) {
      issues.push({
        code: "OUT_OF_ORDER",
        message: "CLOSED candle after FORMING candle in series",
        index: i,
        openTimeSec: c.openTimeSec,
      });
      return {
        structureCandles: [],
        closedCount: 0,
        ok: false,
        blocking: true,
        issues,
        providerId: MIF_PROVIDER_ID,
        providerSymbol,
        timeframe,
        skippedInputIndexes: [...skippedInputIndexes, i],
      };
    }

    if (!closed) seenForming = true;
    seenTimes.add(c.openTimeSec);
    lastOpenTime = c.openTimeSec;

    structureCandles.push({
      time: c.openTimeSec,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      isClosed: closed,
      closed,
    });
  }

  const closedCount = structureCandles.filter((c) => c.isClosed === true || c.closed === true).length;
  const hasBlockingProviderOrEmpty = structureCandles.length === 0;
  const blockingCodes = new Set(issues.map((x) => x.code));
  const blocking =
    hasBlockingProviderOrEmpty
    || blockingCodes.has("PROVIDER_MISMATCH")
    || blockingCodes.has("OUT_OF_ORDER");

  // Symbol/timeframe mismatches on some rows are non-fatal if others remain, but empty → blocking.
  return {
    structureCandles,
    closedCount,
    ok: !blocking && structureCandles.length > 0,
    blocking,
    issues,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    skippedInputIndexes,
  };
}
