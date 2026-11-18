/**
 * Phase 5B.2 Step 2 — forming/closed candle-state policy evaluation.
 */
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCandleState } from "../../canonical/types.js";
import {
  MIF_QI_CANDLE_STATE_POLICY_VIOLATION,
  MIF_QI_NO_CANDLE_STATE_POLICY,
} from "../codes.js";
import type { MifQualityFinding } from "../types.js";
import type { MifCandleStatePolicy } from "./requirements.js";

export function resolveAllowedStates(policy: MifCandleStatePolicy | null | undefined): {
  allowed: ReadonlySet<MifCandleState> | null;
  findings: MifQualityFinding[];
} {
  if (!policy) {
    return {
      allowed: null,
      findings: [
        {
          code: MIF_QI_NO_CANDLE_STATE_POLICY,
          severity: "warning",
          message:
            "no candle-state policy supplied; unrestricted acceptance is not assumed — tip states reported only",
        },
      ],
    };
  }
  if (policy.mode === "closed_only") {
    return { allowed: new Set<MifCandleState>(["CLOSED"]), findings: [] };
  }
  if (policy.mode === "allow_forming") {
    return { allowed: new Set<MifCandleState>(["CLOSED", "FORMING"]), findings: [] };
  }
  const allowed = new Set<MifCandleState>(policy.allowedStates ?? []);
  return { allowed, findings: [] };
}

export function evaluateTipCandleStatePolicy(input: {
  timeframe: string;
  tip: MifCanonicalCandle | null;
  policy: MifCandleStatePolicy | null | undefined;
}): MifQualityFinding[] {
  const { allowed, findings } = resolveAllowedStates(input.policy);
  if (!input.tip) return findings;
  if (!allowed) return findings;

  const state = input.tip.candleState;
  if (!allowed.has(state)) {
    findings.push({
      code: MIF_QI_CANDLE_STATE_POLICY_VIOLATION,
      severity: "blocking",
      message: `timeframe ${input.timeframe} tip state ${state} not allowed by candle-state policy`,
      candleState: state,
      openTimeSec: input.tip.openTimeSec,
      evidence: { timeframe: input.timeframe, state },
    });
  }
  // STALE/MISSING/INVALID never treated as fresh even if somehow listed — reinforce.
  if (state === "STALE" || state === "MISSING" || state === "INVALID") {
    if (!allowed.has(state)) {
      // already reported
    } else {
      // Explicit allow of STALE/MISSING/INVALID is unusual; still emit warning.
      findings.push({
        code: MIF_QI_CANDLE_STATE_POLICY_VIOLATION,
        severity: "warning",
        message: `tip state ${state} is explicitly allowed but is not a fresh market tip`,
        candleState: state,
        evidence: { timeframe: input.timeframe },
      });
    }
  }
  return findings;
}
