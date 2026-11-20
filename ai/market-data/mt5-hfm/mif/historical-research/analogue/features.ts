/**
 * Phase 5F STEP 2 — deterministic price-action feature extraction (v1).
 * Tip-clipped CLOSED bars only. Missing features stay unavailable (not silent zeros).
 */
import type { MifResearchStoredBar } from "../types.js";
import {
  MIF_ANALOGUE_FEATURE_SET_ID,
  MIF_ANALOGUE_FEATURE_SET_VERSION,
} from "./contracts.js";
import type { MifAnalogueFeatureSlot, MifAnalogueFeatureVector } from "./types.js";

const FEAT_VER = "1.0.0";

function isValidPrice(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function safeLogReturn(prev: number, next: number): number | null {
  if (!isValidPrice(prev) || !isValidPrice(next)) return null;
  return Math.log(next / prev);
}

/** Wilder-style ATR over prior `period` true ranges ending at last bar. */
export function computeAtr(
  bars: readonly MifResearchStoredBar[],
  period: number,
): number | null {
  if (bars.length < period + 1 || period < 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]!;
    const prev = bars[i - 1]!;
    if (![b.high, b.low, b.close, prev.close].every(isValidPrice)) return null;
    const tr = Math.max(
      b.high - b.low,
      Math.abs(b.high - prev.close),
      Math.abs(b.low - prev.close),
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const window = trs.slice(trs.length - period);
  const sum = window.reduce((a, b) => a + b, 0);
  const atr = sum / period;
  return atr > 0 && Number.isFinite(atr) ? atr : null;
}

function candleShape(bar: MifResearchStoredBar): {
  bodyRatio: number | null;
  upperWickRatio: number | null;
  lowerWickRatio: number | null;
  closeLoc: number | null;
  direction: number | null;
  relativeRange: number | null;
} {
  const range = bar.high - bar.low;
  if (![bar.open, bar.high, bar.low, bar.close].every((x) => Number.isFinite(x))) {
    return {
      bodyRatio: null,
      upperWickRatio: null,
      lowerWickRatio: null,
      closeLoc: null,
      direction: null,
      relativeRange: null,
    };
  }
  if (range <= 0) {
    // Zero-range: direction known; ratios unavailable (do not invent).
    return {
      bodyRatio: null,
      upperWickRatio: null,
      lowerWickRatio: null,
      closeLoc: null,
      direction: bar.close >= bar.open ? 1 : -1,
      relativeRange: 0,
    };
  }
  const body = Math.abs(bar.close - bar.open);
  const upper = bar.high - Math.max(bar.open, bar.close);
  const lower = Math.min(bar.open, bar.close) - bar.low;
  return {
    bodyRatio: body / range,
    upperWickRatio: upper / range,
    lowerWickRatio: lower / range,
    closeLoc: (bar.close - bar.low) / range,
    direction: bar.close >= bar.open ? 1 : -1,
    relativeRange: range,
  };
}

function slot(
  name: string,
  group: MifAnalogueFeatureSlot["group"],
  value: number | null,
  normalization: string,
  inputWindowBars: number,
  unavailableReason: string | null = null,
): MifAnalogueFeatureSlot {
  const available = value != null && Number.isFinite(value);
  return {
    name,
    group,
    version: FEAT_VER,
    value: available ? value : null,
    available,
    unavailableReason: available ? null : unavailableReason ?? "UNAVAILABLE",
    normalization,
    inputWindowBars,
  };
}

/**
 * Extract features from bars clipped so last bar is tip (CLOSED).
 * `warmupBars` prior bars may precede the lookback for ATR/momentum.
 * Layout: [...warmup..., ...lookback including tip]
 */
export function extractAnalogueFeatures(input: {
  barsThroughTip: readonly MifResearchStoredBar[];
  lookbackBars: number;
  warmupBars: number;
}): MifAnalogueFeatureVector {
  const lookback = input.lookbackBars;
  const warmup = input.warmupBars;
  const need = lookback + warmup;
  const continuous: MifAnalogueFeatureSlot[] = [];
  const categorical: MifAnalogueFeatureSlot[] = [];
  const unavailable: string[] = [];

  if (input.barsThroughTip.length < lookback) {
    return {
      featureSetId: MIF_ANALOGUE_FEATURE_SET_ID,
      featureSetVersion: MIF_ANALOGUE_FEATURE_SET_VERSION,
      continuous: [],
      categorical: [],
      unavailableFeatures: ["INSUFFICIENT_HISTORY"],
      atr: null,
      lookbackBars: lookback,
      warmupBars: warmup,
    };
  }

  const bars = input.barsThroughTip;
  const tipIdx = bars.length - 1;
  const lookStart = tipIdx - lookback + 1;
  const atrStart = Math.max(0, tipIdx - need + 1);
  const atrBars = bars.slice(atrStart, tipIdx + 1);
  const atrPeriod = Math.min(14, warmup);
  const atr =
    atrBars.length >= atrPeriod + 1 ? computeAtr(atrBars, atrPeriod) : null;

  if (atr == null) unavailable.push("atr");

  const lookBars = bars.slice(lookStart, tipIdx + 1);
  // Aggregate shape means over lookback (fixed-length vector, instrument-scale free).
  let bodySum = 0;
  let upperSum = 0;
  let lowerSum = 0;
  let closeLocSum = 0;
  let dirSum = 0;
  let rangeSum = 0;
  let shapeN = 0;
  let rangeN = 0;

  for (const b of lookBars) {
    const s = candleShape(b);
    if (s.bodyRatio != null) {
      bodySum += s.bodyRatio;
      upperSum += s.upperWickRatio!;
      lowerSum += s.lowerWickRatio!;
      closeLocSum += s.closeLoc!;
      shapeN += 1;
    }
    if (s.direction != null) dirSum += s.direction;
    if (s.relativeRange != null && atr != null && atr > 0) {
      rangeSum += s.relativeRange / atr;
      rangeN += 1;
    }
  }

  const pushC = (s: MifAnalogueFeatureSlot) => {
    continuous.push(s);
    if (!s.available) unavailable.push(s.name);
  };
  const pushCat = (s: MifAnalogueFeatureSlot) => {
    categorical.push(s);
    if (!s.available) unavailable.push(s.name);
  };

  pushC(
    slot(
      "mean_body_ratio",
      "SHAPE",
      shapeN > 0 ? bodySum / shapeN : null,
      "ratio-0-1",
      lookback,
      "ZERO_OR_INVALID_RANGE",
    ),
  );
  pushC(
    slot(
      "mean_upper_wick_ratio",
      "SHAPE",
      shapeN > 0 ? upperSum / shapeN : null,
      "ratio-0-1",
      lookback,
      "ZERO_OR_INVALID_RANGE",
    ),
  );
  pushC(
    slot(
      "mean_lower_wick_ratio",
      "SHAPE",
      shapeN > 0 ? lowerSum / shapeN : null,
      "ratio-0-1",
      lookback,
      "ZERO_OR_INVALID_RANGE",
    ),
  );
  pushC(
    slot(
      "mean_close_location",
      "SHAPE",
      shapeN > 0 ? closeLocSum / shapeN : null,
      "ratio-0-1",
      lookback,
      "ZERO_OR_INVALID_RANGE",
    ),
  );
  pushC(
    slot(
      "mean_direction",
      "SHAPE",
      lookBars.length ? dirSum / lookBars.length : null,
      "signed-mean",
      lookback,
    ),
  );
  pushC(
    slot(
      "mean_range_atr",
      "VOLATILITY",
      rangeN > 0 ? rangeSum / rangeN : null,
      "atr-normalized",
      lookback,
      atr == null ? "ATR_UNAVAILABLE" : "NO_VALID_RANGES",
    ),
  );

  // Log returns: last min(8, lookback-1) returns, z-scored within window later at similarity time;
  // store raw returns here (finite).
  const maxRet = Math.min(8, Math.max(0, lookback - 1));
  for (let k = 0; k < maxRet; k++) {
    const i = lookBars.length - maxRet + k;
    if (i <= 0 || i >= lookBars.length) {
      pushC(slot(`log_return_${k}`, "RETURNS", null, "log-return", 2, "INSUFFICIENT_HISTORY"));
      continue;
    }
    const r = safeLogReturn(lookBars[i - 1]!.close, lookBars[i]!.close);
    pushC(
      slot(
        `log_return_${k}`,
        "RETURNS",
        r,
        "log-return",
        2,
        r == null ? "INVALID_PRICE" : null,
      ),
    );
  }

  // Volatility change: second half mean range/ATR vs first half.
  let volChange: number | null = null;
  if (atr != null && lookBars.length >= 4) {
    const mid = Math.floor(lookBars.length / 2);
    const half = (from: number, to: number) => {
      let s = 0;
      let n = 0;
      for (let i = from; i < to; i++) {
        const rng = lookBars[i]!.high - lookBars[i]!.low;
        if (Number.isFinite(rng) && rng >= 0) {
          s += rng / atr;
          n += 1;
        }
      }
      return n > 0 ? s / n : null;
    };
    const a = half(0, mid);
    const b = half(mid, lookBars.length);
    if (a != null && b != null) volChange = b - a;
  }
  pushC(
    slot(
      "vol_change_atr",
      "VOLATILITY",
      volChange,
      "atr-normalized-delta",
      lookback,
      atr == null ? "ATR_UNAVAILABLE" : "INSUFFICIENT_HISTORY",
    ),
  );

  // Momentum: (close_tip - close_lookStart) / ATR
  let momentum: number | null = null;
  if (atr != null && atr > 0) {
    const c0 = lookBars[0]!.close;
    const c1 = lookBars[lookBars.length - 1]!.close;
    if (isValidPrice(c0) && isValidPrice(c1)) momentum = (c1 - c0) / atr;
  }
  pushC(
    slot(
      "momentum_atr",
      "MOMENTUM",
      momentum,
      "atr-normalized",
      lookback,
      atr == null ? "ATR_UNAVAILABLE" : "INVALID_PRICE",
    ),
  );

  // Tip direction categorical
  const tip = lookBars[lookBars.length - 1]!;
  pushCat(
    slot(
      "tip_direction",
      "CATEGORICAL",
      tip.close >= tip.open ? 1 : 0,
      "binary",
      1,
    ),
  );

  return {
    featureSetId: MIF_ANALOGUE_FEATURE_SET_ID,
    featureSetVersion: MIF_ANALOGUE_FEATURE_SET_VERSION,
    continuous,
    categorical,
    unavailableFeatures: [...new Set(unavailable)],
    atr,
    lookbackBars: lookback,
    warmupBars: warmup,
  };
}
