/**
 * Phase 3.1 — symbol digits / tick-size validation for BUY/SELL trade plans.
 * Uses trusted HFM catalog metadata only (never browser-supplied).
 */
import { precisionOk, tickAligned } from "../../quote-validation.js";

export interface HfmReasoningInstrumentMeta {
  symbol: string;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  source: "HFM_CATALOG";
}

export interface HfmReasoningPricePrecisionResult {
  verified: boolean;
  digits: number | null;
  tickSize: number | null;
  point: number | null;
  source: "HFM_CATALOG" | "UNAVAILABLE";
  reason: string | null;
}

export function buildUnavailablePricePrecision(reason: string): HfmReasoningPricePrecisionResult {
  return {
    verified: false,
    digits: null,
    tickSize: null,
    point: null,
    source: "UNAVAILABLE",
    reason,
  };
}

export function validateTradePlanPricesAgainstInstrument(input: {
  symbol: string;
  instrument: HfmReasoningInstrumentMeta | null;
  prices: Array<{ label: string; value: number | null | undefined; required: boolean }>;
}): { ok: true; precision: HfmReasoningPricePrecisionResult } | { ok: false; error: string; precision: HfmReasoningPricePrecisionResult } {
  if (!input.instrument) {
    const precision = buildUnavailablePricePrecision("Trusted HFM catalog metadata unavailable");
    return { ok: false, error: "instrument metadata unavailable for price precision", precision };
  }
  if (input.instrument.symbol.toUpperCase() !== input.symbol.toUpperCase()) {
    const precision = buildUnavailablePricePrecision("Instrument metadata symbol mismatch");
    return { ok: false, error: "instrument metadata symbol mismatch", precision };
  }
  const digits = input.instrument.digits;
  const tickSize = input.instrument.tickSize;
  const hasDigits = typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 12;
  const hasTick = typeof tickSize === "number" && tickSize > 0;
  if (!hasDigits && !hasTick) {
    const precision = buildUnavailablePricePrecision("Catalog missing digits and tickSize");
    return { ok: false, error: "instrument digits/tickSize unavailable", precision };
  }

  for (const p of input.prices) {
    if (p.value == null) {
      if (p.required) {
        return {
          ok: false,
          error: `${p.label} missing`,
          precision: buildUnavailablePricePrecision("required price missing"),
        };
      }
      continue;
    }
    if (!Number.isFinite(p.value) || p.value <= 0) {
      return {
        ok: false,
        error: `${p.label} not a positive finite price`,
        precision: {
          verified: false,
          digits,
          tickSize,
          point: input.instrument.point,
          source: "HFM_CATALOG",
          reason: `${p.label} invalid`,
        },
      };
    }
    if (hasDigits && !precisionOk(p.value, digits)) {
      return {
        ok: false,
        error: `${p.label} exceeds symbol digits=${digits}`,
        precision: {
          verified: false,
          digits,
          tickSize,
          point: input.instrument.point,
          source: "HFM_CATALOG",
          reason: `${p.label} digits mismatch`,
        },
      };
    }
    if (hasTick && !tickAligned(p.value, tickSize)) {
      return {
        ok: false,
        error: `${p.label} not aligned to tickSize=${tickSize}`,
        precision: {
          verified: false,
          digits,
          tickSize,
          point: input.instrument.point,
          source: "HFM_CATALOG",
          reason: `${p.label} tick mismatch`,
        },
      };
    }
  }

  return {
    ok: true,
    precision: {
      verified: true,
      digits,
      tickSize,
      point: input.instrument.point,
      source: "HFM_CATALOG",
      reason: null,
    },
  };
}
