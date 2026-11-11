/**
 * Stage 3/4 — resolve spread/slippage limits for precheck.
 * Only APPROVED active values from instrument policy are used (pending/rejected ignored).
 *
 * For ACTIVE Automated Trading instruments (XAU/USD), fixed maxSpreadAbsolute is an
 * optional legacy emergency ceiling only — per-trade economic feasibility is primary.
 * Historical proposals/evidence remain; pending 0.30 is never auto-activated.
 */
import { readConfiguredMaxSpreadAbsolute } from "../risk-intelligence/gather.js";
import { getAtRiskPolicyStore } from "./store.js";
import type {
  ResolvedSlippageLimit,
  ResolvedSpreadLimit,
  SpreadEligibilityMode,
} from "./types.js";
import { usesDynamicPerTradeSpreadEligibility } from "./types.js";
import { normalizeInstrumentSymbol, validateAbsolutePriceLimit } from "./validate.js";

function withSpreadEligibility(
  instrument: string | null,
  base: Omit<ResolvedSpreadLimit, "eligibilityMode" | "fixedCeilingRequiredForTradeEligibility">,
): ResolvedSpreadLimit {
  const dynamic = usesDynamicPerTradeSpreadEligibility(instrument);
  const eligibilityMode: SpreadEligibilityMode = dynamic
    ? "DYNAMIC_PER_TRADE"
    : "LEGACY_EMERGENCY_CEILING";
  const reason = dynamic && base.value == null
    ? (base.reason
      ? `${base.reason} Primary eligibility=DYNAMIC_PER_TRADE (fixed ceiling optional).`
      : "No active legacy emergency ceiling — primary eligibility is DYNAMIC_PER_TRADE economic feasibility.")
    : base.reason;
  return {
    ...base,
    reason,
    eligibilityMode,
    fixedCeilingRequiredForTradeEligibility: !dynamic,
  };
}

export function resolveSpreadLimit(input: {
  instrument?: string | null;
  requestOverride?: number | null;
  store?: { getInstrument: (instrument: string | null | undefined) => ReturnType<ReturnType<typeof getAtRiskPolicyStore>["getInstrument"]> };
}): ResolvedSpreadLimit {
  const instrument = normalizeInstrumentSymbol(input.instrument);

  if (input.requestOverride !== undefined) {
    const fromReq = readConfiguredMaxSpreadAbsolute(input.requestOverride);
    if (fromReq.source === "request" && fromReq.value != null) {
      return withSpreadEligibility(instrument, {
        value: fromReq.value,
        source: "request",
        status: "VERIFIED",
        approvalState: "APPROVED",
        reason: "Request override (explicit for this call only).",
        instrument,
        configVersion: null,
      });
    }
    if (input.requestOverride === null) {
      return withSpreadEligibility(instrument, {
        value: null,
        source: null,
        status: "NOT_CONFIGURED",
        approvalState: "NOT_CONFIGURED",
        reason: fromReq.reason,
        instrument,
        configVersion: null,
      });
    }
  }

  if (instrument) {
    const store = input.store ?? getAtRiskPolicyStore();
    const pol = store.getInstrument(instrument);
    if (pol?.spread) {
      if (pol.spread.approvalState === "PENDING_APPROVAL") {
        // Pending must not activate; fall through to active approved if any.
        if (pol.spread.status === "VERIFIED" && pol.spread.maxSpreadAbsolute != null) {
          const v = validateAbsolutePriceLimit(pol.spread.maxSpreadAbsolute);
          if (v.ok) {
            return withSpreadEligibility(instrument, {
              value: v.value,
              source: "instrument_policy",
              status: "VERIFIED",
              approvalState: "APPROVED",
              reason: "Active approved spread remains in force while a new proposal is pending.",
              instrument,
              configVersion: pol.spread.configVersion,
            });
          }
        }
        return withSpreadEligibility(instrument, {
          value: null,
          source: "instrument_policy",
          status: "NOT_CONFIGURED",
          approvalState: "PENDING_APPROVAL",
          reason:
            "PENDING_APPROVAL — proposed legacy emergency ceiling is not active. "
            + "Historical proposal preserved; not auto-approved.",
          instrument,
          configVersion: pol.spread.configVersion,
        });
      }
      if (pol.spread.approvalState === "REJECTED") {
        return withSpreadEligibility(instrument, {
          value: null,
          source: "instrument_policy",
          status: "NOT_CONFIGURED",
          approvalState: "REJECTED",
          reason: pol.spread.reason || "Rejected spread proposal — no active approved limit.",
          instrument,
          configVersion: pol.spread.configVersion,
        });
      }
      if (pol.spread.approvalState === "INVALID" || pol.spread.status === "INVALID") {
        return withSpreadEligibility(instrument, {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          approvalState: "INVALID",
          reason: pol.spread.reason || "Spread policy invalid.",
          instrument,
          configVersion: pol.spread.configVersion,
        });
      }
      if (
        pol.spread.approvalState === "APPROVED"
        && pol.spread.status === "VERIFIED"
        && pol.spread.maxSpreadAbsolute != null
      ) {
        const v = validateAbsolutePriceLimit(pol.spread.maxSpreadAbsolute);
        if (v.ok) {
          return withSpreadEligibility(instrument, {
            value: v.value,
            source: "instrument_policy",
            status: "VERIFIED",
            approvalState: "APPROVED",
            reason: usesDynamicPerTradeSpreadEligibility(instrument)
              ? "Optional legacy emergency ceiling APPROVED — primary eligibility remains DYNAMIC_PER_TRADE."
              : null,
            instrument,
            configVersion: pol.spread.configVersion,
          });
        }
        return withSpreadEligibility(instrument, {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          approvalState: "INVALID",
          reason: v.reason,
          instrument,
          configVersion: pol.spread.configVersion,
        });
      }
    }
  }

  const fromEnv = readConfiguredMaxSpreadAbsolute(undefined);
  if (fromEnv.source === "env" && fromEnv.value != null) {
    return withSpreadEligibility(instrument, {
      value: fromEnv.value,
      source: "env",
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: "Global KWIZERA_AT_MAX_SPREAD_ABSOLUTE (not instrument-specific).",
      instrument,
      configVersion: null,
    });
  }
  if (fromEnv.reason && String(process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE ?? "").trim()) {
    return withSpreadEligibility(instrument, {
      value: null,
      source: "env",
      status: "INVALID",
      approvalState: "INVALID",
      reason: fromEnv.reason,
      instrument,
      configVersion: null,
    });
  }

  return withSpreadEligibility(instrument, {
    value: null,
    source: null,
    status: "NOT_CONFIGURED",
    approvalState: "NOT_CONFIGURED",
    reason:
      instrument
        ? `No active legacy emergency ceiling for ${instrument}.`
        : "No active legacy emergency ceiling — instrument unknown and no request/env override.",
    instrument,
    configVersion: null,
  });
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
        approvalState: "NOT_CONFIGURED",
        reason: "Request explicitly cleared maxSlippageAbsolute.",
        instrument,
        basis,
        configVersion: null,
      };
    }
    const v = validateAbsolutePriceLimit(input.requestOverride);
    if (v.ok) {
      return {
        value: v.value,
        source: "request",
        status: "VERIFIED",
        approvalState: "APPROVED",
        reason: "Request override (explicit for this call only).",
        instrument,
        basis,
        configVersion: null,
      };
    }
    return {
      value: null,
      source: "request",
      status: v.status,
      approvalState: v.status === "INVALID" ? "INVALID" : "NOT_CONFIGURED",
      reason: v.reason,
      instrument,
      basis,
      configVersion: null,
    };
  }

  if (instrument) {
    const store = input.store ?? getAtRiskPolicyStore();
    const pol = store.getInstrument(instrument);
    if (pol?.slippage) {
      if (pol.slippage.approvalState === "PENDING_APPROVAL") {
        if (pol.slippage.status === "VERIFIED" && pol.slippage.maxSlippageAbsolute != null) {
          const v = validateAbsolutePriceLimit(pol.slippage.maxSlippageAbsolute);
          if (v.ok) {
            return {
              value: v.value,
              source: "instrument_policy",
              status: "VERIFIED",
              approvalState: "APPROVED",
              reason: "Active approved slippage remains in force while a new proposal is pending.",
              instrument,
              basis,
              configVersion: pol.slippage.configVersion,
            };
          }
        }
        return {
          value: null,
          source: "instrument_policy",
          status: "NOT_CONFIGURED",
          approvalState: "PENDING_APPROVAL",
          reason: "PENDING_APPROVAL — proposed slippage is not active until approved.",
          instrument,
          basis,
          configVersion: pol.slippage.configVersion,
        };
      }
      if (pol.slippage.approvalState === "REJECTED") {
        return {
          value: null,
          source: "instrument_policy",
          status: "NOT_CONFIGURED",
          approvalState: "REJECTED",
          reason: pol.slippage.reason || "Rejected slippage proposal — no active approved limit.",
          instrument,
          basis,
          configVersion: pol.slippage.configVersion,
        };
      }
      if (pol.slippage.approvalState === "INVALID" || pol.slippage.status === "INVALID") {
        return {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          approvalState: "INVALID",
          reason: pol.slippage.reason || "Slippage policy invalid.",
          instrument,
          basis,
          configVersion: pol.slippage.configVersion,
        };
      }
      if (
        pol.slippage.approvalState === "APPROVED"
        && pol.slippage.status === "VERIFIED"
        && pol.slippage.maxSlippageAbsolute != null
      ) {
        const v = validateAbsolutePriceLimit(pol.slippage.maxSlippageAbsolute);
        if (v.ok) {
          return {
            value: v.value,
            source: "instrument_policy",
            status: "VERIFIED",
            approvalState: "APPROVED",
            reason: null,
            instrument,
            basis,
            configVersion: pol.slippage.configVersion,
          };
        }
        return {
          value: null,
          source: "instrument_policy",
          status: "INVALID",
          approvalState: "INVALID",
          reason: v.reason,
          instrument,
          basis,
          configVersion: pol.slippage.configVersion,
        };
      }
    }
  }

  return {
    value: null,
    source: null,
    status: "NOT_CONFIGURED",
    approvalState: "NOT_CONFIGURED",
    reason:
      instrument
        ? `SLIPPAGE_LIMIT_NOT_CONFIGURED for ${instrument} — propose then approve via risk-policy API.`
        : "SLIPPAGE_LIMIT_NOT_CONFIGURED — instrument unknown and no request override.",
    instrument,
    basis,
    configVersion: null,
  };
}
