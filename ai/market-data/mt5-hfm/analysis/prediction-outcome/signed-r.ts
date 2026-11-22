/**
 * P8.C — direction-aware signed realized R.
 *
 * R = ((exitPrice - entryPrice) * directionSign) / abs(entryPrice - invalidationPrice)
 * BUY = +1, SELL = -1.
 *
 * Only for decisive TARGET_REACHED / INVALIDATION_REACHED.
 * Ambiguous / untriggered / expired → null.
 * Does not rewrite historical MIF 1.0.0 unsigned R records.
 */
import {
  HFM_CHARTS_SIGNED_R_DEFINITION,
  HFM_CHARTS_SIGNED_R_POLICY_ID,
  HFM_CHARTS_SIGNED_R_POLICY_VERSION,
} from "./contracts.js";

export type SignedRDirection = "BUY" | "SELL";

export type SignedREligibleKind = "TARGET_REACHED" | "INVALIDATION_REACHED";

export interface ComputeSignedRealizedRInput {
  direction: string;
  entryPrice: number | null | undefined;
  invalidationPrice: number | null | undefined;
  exitPrice: number | null | undefined;
  resultKind: string;
}

export type ComputeSignedRealizedRResult =
  | {
      ok: true;
      realizedSignedRMultiple: number;
      directionSign: 1 | -1;
      riskDistance: number;
      policyId: typeof HFM_CHARTS_SIGNED_R_POLICY_ID;
      policyVersion: typeof HFM_CHARTS_SIGNED_R_POLICY_VERSION;
      definition: typeof HFM_CHARTS_SIGNED_R_DEFINITION;
    }
  | {
      ok: false;
      realizedSignedRMultiple: null;
      code: string;
      message: string;
      policyId: typeof HFM_CHARTS_SIGNED_R_POLICY_ID;
      policyVersion: typeof HFM_CHARTS_SIGNED_R_POLICY_VERSION;
      definition: typeof HFM_CHARTS_SIGNED_R_DEFINITION;
    };

function directionSign(direction: string): 1 | -1 | null {
  const d = String(direction || "").toUpperCase();
  if (d === "BUY") return 1;
  if (d === "SELL") return -1;
  return null;
}

export function computeSignedRealizedR(
  input: ComputeSignedRealizedRInput,
): ComputeSignedRealizedRResult {
  const base = {
    policyId: HFM_CHARTS_SIGNED_R_POLICY_ID,
    policyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
    definition: HFM_CHARTS_SIGNED_R_DEFINITION,
  } as const;

  const kind = String(input.resultKind || "").toUpperCase();
  if (kind === "BOTH_AMBIGUOUS_SAME_CANDLE" || kind === "AMBIGUOUS_OUTCOME") {
    return {
      ok: false,
      realizedSignedRMultiple: null,
      code: "AMBIGUOUS_NO_R",
      message: "ambiguous outcomes must not invent realized R",
      ...base,
    };
  }
  if (kind !== "TARGET_REACHED" && kind !== "INVALIDATION_REACHED") {
    return {
      ok: false,
      realizedSignedRMultiple: null,
      code: "NON_DECISIVE",
      message: `resultKind ${kind} is not eligible for signed R`,
      ...base,
    };
  }

  const sign = directionSign(input.direction);
  if (sign == null) {
    return {
      ok: false,
      realizedSignedRMultiple: null,
      code: "UNSUPPORTED_DIRECTION",
      message: `direction ${input.direction} has no signed-R policy`,
      ...base,
    };
  }

  const entry = input.entryPrice;
  const inv = input.invalidationPrice;
  const exit = input.exitPrice;
  if (
    entry == null
    || inv == null
    || exit == null
    || !Number.isFinite(entry)
    || !Number.isFinite(inv)
    || !Number.isFinite(exit)
  ) {
    return {
      ok: false,
      realizedSignedRMultiple: null,
      code: "MISSING_PRICES",
      message: "entry, invalidation, and exit prices are required for signed R",
      ...base,
    };
  }

  const risk = Math.abs(entry - inv);
  if (!(risk > 0)) {
    return {
      ok: false,
      realizedSignedRMultiple: null,
      code: "INVALID_RISK_DISTANCE",
      message: "abs(entryPrice - invalidationPrice) must be > 0",
      ...base,
    };
  }

  const r = ((exit - entry) * sign) / risk;
  if (!Number.isFinite(r)) {
    return {
      ok: false,
      realizedSignedRMultiple: null,
      code: "NON_FINITE_R",
      message: "signed R computation produced a non-finite value",
      ...base,
    };
  }

  return {
    ok: true,
    realizedSignedRMultiple: r,
    directionSign: sign,
    riskDistance: risk,
    ...base,
  };
}
