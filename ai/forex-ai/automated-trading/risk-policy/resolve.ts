/**
 * Stage 3 — resolve spread/slippage limits for precheck (fail-closed; no invented values).
 */
import { readConfiguredMaxSpreadAbsolute } from "../risk-intelligence/gather.js";
import { getAtRiskPolicyStore } from "./store.js";
import type { ResolvedSlippageLimit, ResolvedSpreadLimit } from "./types.js";
import { normalizeInstrumentSymbol, validateAbsolutePriceLimit } from "./validate.js";

export function resolveSpreadLimit(input: {
  instrument?: string | null;
  requestOverride?: number | null;
  /** Injectable store for tests. */
  store?: { getInstrument: (instrument: string | null | undefined) => ReturnType<ReturnType<typeof getAtRiskPolicyStore>["getInstrument"]> };
}): ResolvedSpreadLimit {
  const instrument = normalizeInstrumentSymbol(input.instrument);

  // 1) Explicit request override (precheck/risk-intel query/body).
  if (input.requestOverride !== undefined) {
    const fromReq = readConfiguredMaxSpreadAbsolute(input.requestOverride);
    if (fromReq.source === "request" && fromReq.value != null) {
      return {
        value: fromReq.value,
        source: "request",
        status: "VERIFIED",
        reason: null,
        instrument,
      };
    }
    if (input.requestOverride === null) {
      return {
        value: null,
        source: null,
        status: "NOT_CONFIGURED",
        reason: fromReq.reason,
        instrument,
      };
    }
  }

  // 2) Instrument-specific persisted policy (owner-approved).
  if (instrument) {
    const store = input.store ?? getAtRiskPolicyStore();
    const pol = store.getInstrument(instrument);
    if (pol?.spread) {
      if (pol.spread.status === "VERIFIED" && pol.spread.maxSpreadAbsolute != null) {
        const v = validateAbsolutePriceLimit(pol.spread.maxSpreadAbsolute);
        if (v.ok) {
          return {
            value: v.value,
            source: "instrument_policy",
            status: "VERIFIED",
            reason: null,
            instrument,
          };
        }
        return {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          reason: v.reason,
          instrument,
        };
      }
      if (pol.spread.status === "INVALID") {
        return {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          reason: pol.spread.reason,
          instrument,
        };
      }
    }
  }

  // 3) Global env fallback (non-instrument-specific; still explicit owner/ops config).
  const fromEnv = readConfiguredMaxSpreadAbsolute(undefined);
  if (fromEnv.source === "env" && fromEnv.value != null) {
    return {
      value: fromEnv.value,
      source: "env",
      status: "VERIFIED",
      reason: "Global KWIZERA_AT_MAX_SPREAD_ABSOLUTE (not instrument-specific).",
      instrument,
    };
  }
  if (fromEnv.reason && String(process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE ?? "").trim()) {
    return {
      value: null,
      source: "env",
      status: "INVALID",
      reason: fromEnv.reason,
      instrument,
    };
  }

  return {
    value: null,
    source: null,
    status: "NOT_CONFIGURED",
    reason:
      instrument
        ? `SPREAD_LIMIT_NOT_CONFIGURED for ${instrument} — approve instrument maxSpreadAbsolute `
          + "(absolute price units) via risk-policy API, or set request/env override."
        : "SPREAD_LIMIT_NOT_CONFIGURED — instrument unknown and no request/env override.",
    instrument,
  };
}

export function resolveSlippageLimit(input: {
  instrument?: string | null;
  requestOverride?: number | null;
  store?: { getInstrument: (instrument: string | null | undefined) => ReturnType<ReturnType<typeof getAtRiskPolicyStore>["getInstrument"]> };
}): ResolvedSlippageLimit {
  const instrument = normalizeInstrumentSymbol(input.instrument);
  const basis = "entry_vs_executable" as const;

  if (input.requestOverride !== undefined) {
    if (input.requestOverride === null) {
      return {
        value: null,
        source: null,
        status: "NOT_CONFIGURED",
        reason: "Request explicitly cleared maxSlippageAbsolute.",
        instrument,
        basis,
      };
    }
    const v = validateAbsolutePriceLimit(input.requestOverride);
    if (v.ok) {
      return {
        value: v.value,
        source: "request",
        status: "VERIFIED",
        reason: null,
        instrument,
        basis,
      };
    }
    return {
      value: null,
      source: "request",
      status: v.status,
      reason: v.reason,
      instrument,
      basis,
    };
  }

  if (instrument) {
    const store = input.store ?? getAtRiskPolicyStore();
    const pol = store.getInstrument(instrument);
    if (pol?.slippage) {
      if (pol.slippage.status === "VERIFIED" && pol.slippage.maxSlippageAbsolute != null) {
        const v = validateAbsolutePriceLimit(pol.slippage.maxSlippageAbsolute);
        if (v.ok) {
          return {
            value: v.value,
            source: "instrument_policy",
            status: "VERIFIED",
            reason: null,
            instrument,
            basis,
          };
        }
        return {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          reason: v.reason,
          instrument,
          basis,
        };
      }
      if (pol.slippage.status === "INVALID") {
        return {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          reason: pol.slippage.reason,
          instrument,
          basis,
        };
      }
    }
  }

  return {
    value: null,
    source: null,
    status: "NOT_CONFIGURED",
    reason:
      instrument
        ? `SLIPPAGE_LIMIT_NOT_CONFIGURED for ${instrument} — approve maxSlippageAbsolute `
          + "(absolute |entry−executable|; BUY→ask, SELL→bid)."
        : "SLIPPAGE_LIMIT_NOT_CONFIGURED — instrument unknown and no request override.",
    instrument,
    basis,
  };
}
