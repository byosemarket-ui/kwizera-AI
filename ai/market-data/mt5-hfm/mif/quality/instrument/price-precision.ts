/**
 * Phase 5B.2 Step 2 — price precision using existing Phase 3.1 shared helpers.
 * Reuses precisionOk / tickAligned from quote-validation — does not round prices.
 */
import { precisionOk, tickAligned } from "../../../quote-validation.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import {
  MIF_QI_PRICE_DIGITS_MISMATCH,
  MIF_QI_PRICE_INVALID,
  MIF_QI_PRICE_PRECISION_UNAVAILABLE,
  MIF_QI_PRICE_TICK_MISMATCH,
} from "../codes.js";
import type { MifQualityFinding } from "../types.js";

export interface PriceCheckInput {
  label: string;
  value: number | null | undefined;
  required?: boolean;
  /** When false, skip positivity check (canonical prices are not universally >0). Default true for FX-style checks when metadata implies FX. */
  requirePositive?: boolean;
}

export interface PricePrecisionCheckResult {
  findings: MifQualityFinding[];
  verified: boolean;
  digitsUsed: number | null;
  tickSizeUsed: number | null;
  pointUsed: number | null;
  metadataSource: "instrument" | "unavailable";
}

/**
 * Validate prices against trusted instrument digits/tickSize.
 * Aligns with Phase 3.1 validateTradePlanPricesAgainstInstrument rules via shared helpers,
 * but does not invent a universal requirePositive=true for all instruments unless requested.
 */
export function checkPricesAgainstInstrument(input: {
  instrument: MifCanonicalInstrument | null;
  expectedSymbol: string;
  prices: PriceCheckInput[];
  requirePositive?: boolean;
}): PricePrecisionCheckResult {
  const findings: MifQualityFinding[] = [];
  if (!input.instrument) {
    findings.push({
      code: MIF_QI_PRICE_PRECISION_UNAVAILABLE,
      severity: "degraded",
      message: "instrument metadata unavailable for price precision",
    });
    return {
      findings,
      verified: false,
      digitsUsed: null,
      tickSizeUsed: null,
      pointUsed: null,
      metadataSource: "unavailable",
    };
  }

  if (input.instrument.providerSymbol.toUpperCase() !== input.expectedSymbol.toUpperCase()) {
    findings.push({
      code: MIF_QI_PRICE_PRECISION_UNAVAILABLE,
      severity: "blocking",
      message: "instrument symbol mismatch for price precision",
      evidence: {
        instrumentSymbol: input.instrument.providerSymbol,
        expectedSymbol: input.expectedSymbol,
      },
    });
    return {
      findings,
      verified: false,
      digitsUsed: null,
      tickSizeUsed: null,
      pointUsed: null,
      metadataSource: "unavailable",
    };
  }

  const digits = input.instrument.digits;
  const tickSize = input.instrument.tickSize;
  const point = input.instrument.point;
  const hasDigits = typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 12;
  const hasTick = typeof tickSize === "number" && tickSize > 0;

  if (!hasDigits && !hasTick) {
    findings.push({
      code: MIF_QI_PRICE_PRECISION_UNAVAILABLE,
      severity: "degraded",
      message: "digits and tickSize unavailable; precision cannot be established",
      evidence: {
        digits: digits,
        tickSize: tickSize,
        catalogVersion: input.instrument.catalogVersion,
      },
    });
    return {
      findings,
      verified: false,
      digitsUsed: hasDigits ? digits : null,
      tickSizeUsed: hasTick ? tickSize : null,
      pointUsed: typeof point === "number" && Number.isFinite(point) ? point : null,
      metadataSource: "instrument",
    };
  }

  const requirePositive = input.requirePositive === true;
  let ok = true;
  for (const p of input.prices) {
    if (p.value == null) {
      if (p.required) {
        ok = false;
        findings.push({
          code: MIF_QI_PRICE_INVALID,
          severity: "blocking",
          message: `${p.label} missing`,
          evidence: { label: p.label },
        });
      }
      continue;
    }
    if (!Number.isFinite(p.value)) {
      ok = false;
      findings.push({
        code: MIF_QI_PRICE_INVALID,
        severity: "blocking",
        message: `${p.label} is not finite`,
        evidence: { label: p.label },
      });
      continue;
    }
    if ((p.requirePositive ?? requirePositive) && !(p.value > 0)) {
      ok = false;
      findings.push({
        code: MIF_QI_PRICE_INVALID,
        severity: "blocking",
        message: `${p.label} not positive under requirePositive policy`,
        evidence: { label: p.label, value: p.value },
      });
      continue;
    }
    // Do not round — only check.
    if (hasDigits && !precisionOk(p.value, digits)) {
      ok = false;
      findings.push({
        code: MIF_QI_PRICE_DIGITS_MISMATCH,
        severity: "blocking",
        message: `${p.label} exceeds digits=${digits}`,
        evidence: { label: p.label, value: p.value, digits },
      });
    }
    if (hasTick && !tickAligned(p.value, tickSize)) {
      ok = false;
      findings.push({
        code: MIF_QI_PRICE_TICK_MISMATCH,
        severity: "blocking",
        message: `${p.label} not aligned to tickSize=${tickSize}`,
        evidence: { label: p.label, value: p.value, tickSize },
      });
    }
  }

  return {
    findings,
    verified: ok,
    digitsUsed: hasDigits ? digits! : null,
    tickSizeUsed: hasTick ? tickSize! : null,
    pointUsed: typeof point === "number" && Number.isFinite(point) ? point : null,
    metadataSource: "instrument",
  };
}
