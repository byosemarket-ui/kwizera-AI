/**
 * Phase 5 — evidence / scenario / price grounding for Charts AI output.
 * Patterns aligned with MIF Admin AI grounding; Charts remains the product path.
 */
import type { HfmUnifiedAiGroundingAllowlist } from "./unified-input.js";

export interface HfmReasoningGroundingContext {
  analysisId: string;
  allowedEvidenceIds: ReadonlySet<string>;
  allowedScenarioIds: ReadonlySet<string>;
  allowedPrices: ReadonlySet<number>;
  formingOnlyConfirmationBlocked: boolean;
  scenarioOutcome: string | null;
  inputCompleteness: "COMPLETE" | "PARTIAL";
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  unifiedInputIdentity: string;
  tickSize?: number | null;
}

export function groundingFromUnifiedAllowlist(input: {
  analysisId: string;
  grounding: HfmUnifiedAiGroundingAllowlist;
  inputCompleteness: "COMPLETE" | "PARTIAL";
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  unifiedInputIdentity: string;
  tickSize?: number | null;
}): HfmReasoningGroundingContext {
  return {
    analysisId: input.analysisId,
    allowedEvidenceIds: new Set(input.grounding.allowedEvidenceIds),
    allowedScenarioIds: new Set(input.grounding.allowedScenarioIds),
    allowedPrices: new Set(input.grounding.allowedPrices),
    formingOnlyConfirmationBlocked: input.grounding.formingOnlyConfirmationBlocked,
    scenarioOutcome: input.grounding.scenarioOutcome,
    inputCompleteness: input.inputCompleteness,
    evidencePackageId: input.evidencePackageId,
    scenarioPackageId: input.scenarioPackageId,
    unifiedInputIdentity: input.unifiedInputIdentity,
    tickSize: input.tickSize ?? null,
  };
}

export function isPriceGrounded(
  price: number,
  allowed: ReadonlySet<number>,
  tickSize?: number | null,
): boolean {
  if (!Number.isFinite(price)) return false;
  if (allowed.has(price)) return true;
  const tol = typeof tickSize === "number" && tickSize > 0 ? tickSize * 0.51 : 1e-9;
  for (const a of allowed) {
    if (Math.abs(a - price) <= tol) return true;
  }
  return false;
}

export function filterEvidenceIds(
  ids: readonly string[],
  allowed: ReadonlySet<string>,
): { kept: string[]; unknown: string[] } {
  const kept: string[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const t = String(id ?? "").trim();
    if (!t) continue;
    if (allowed.has(t)) kept.push(t);
    else unknown.push(t);
  }
  return { kept, unknown };
}

export function collectGroundingErrors(input: {
  supportingEvidenceIds: readonly string[];
  conflictingEvidenceIds: readonly string[];
  alternativeEvidenceIds: readonly string[];
  selectedScenarioId: string | null;
  entryLow: number | null;
  entryHigh: number | null;
  stopLoss: number | null;
  takeProfitTargets: readonly number[];
  invalidationPrice: number | null;
  riskRewardEstimate: number | null;
  decisionAction: string;
  decisionStatus: string;
  ctx: HfmReasoningGroundingContext;
}): { errors: string[]; code: string | null } {
  const errors: string[] = [];
  const ctx = input.ctx;

  const allCited = [
    ...input.supportingEvidenceIds,
    ...input.conflictingEvidenceIds,
    ...input.alternativeEvidenceIds,
  ];
  const { unknown } = filterEvidenceIds(allCited, ctx.allowedEvidenceIds);
  for (const id of unknown) {
    errors.push(`unknown_evidence_id=${id}`);
  }

  if (input.selectedScenarioId != null && input.selectedScenarioId !== "") {
    if (!ctx.allowedScenarioIds.has(input.selectedScenarioId)) {
      errors.push(`unknown_scenario_id=${input.selectedScenarioId}`);
    }
  }

  const pricesToCheck: Array<{ label: string; value: number | null }> = [
    { label: "entryLow", value: input.entryLow },
    { label: "entryHigh", value: input.entryHigh },
    { label: "stopLoss", value: input.stopLoss },
    { label: "invalidationPrice", value: input.invalidationPrice },
    ...input.takeProfitTargets.map((v, i) => ({ label: `takeProfit[${i}]`, value: v as number | null })),
  ];

  // Level grounding applies when prices are present OR when the setup claims CONFIRMED.
  // Primary BUY/SELL without READY/CONFIRMED is directional bias and may omit entries.
  const claimsConfirmedSetup = input.decisionStatus === "CONFIRMED";
  const hasAnyLevel =
    input.entryLow != null
    || input.entryHigh != null
    || input.stopLoss != null
    || input.invalidationPrice != null
    || input.takeProfitTargets.length > 0;
  const requiresLevels = claimsConfirmedSetup || hasAnyLevel;
  if (requiresLevels && hasAnyLevel) {
    if (ctx.allowedPrices.size === 0) {
      errors.push("invented_price_no_source_levels_available");
    }
    for (const p of pricesToCheck) {
      if (p.value == null) continue;
      if (!isPriceGrounded(p.value, ctx.allowedPrices, ctx.tickSize)) {
        errors.push(`invented_price=${p.label}:${p.value}`);
      }
    }
    // RR only when entry + invalidation + ≥1 target present and grounded
    if (input.riskRewardEstimate != null) {
      const hasEntry = input.entryLow != null || input.entryHigh != null;
      const hasInv = input.invalidationPrice != null || input.stopLoss != null;
      const hasTp = input.takeProfitTargets.length > 0;
      if (!hasEntry || !hasInv || !hasTp) {
        errors.push("risk_reward_without_complete_levels");
      }
    }
  } else if (
    input.riskRewardEstimate != null
    && !(input.decisionAction === "BUY" || input.decisionAction === "SELL")
  ) {
    // Non-directional decisions should not claim RR
    errors.push("risk_reward_on_non_trade_decision");
  }

  // FORMING tips block confirmation — not directional BUY/SELL bias itself.
  if (claimsConfirmedSetup && ctx.formingOnlyConfirmationBlocked) {
    errors.push("forming_only_cannot_confirm");
  }

  if (
    claimsConfirmedSetup
    && (input.decisionAction === "BUY" || input.decisionAction === "SELL")
    && ctx.inputCompleteness === "PARTIAL"
    && ctx.allowedEvidenceIds.size === 0
  ) {
    errors.push("buy_sell_with_empty_partial_evidence");
  }

  let code: string | null = null;
  if (errors.some((e) => e.startsWith("unknown_evidence"))) code = "EVIDENCE_GROUNDING_FAILED";
  else if (errors.some((e) => e.startsWith("unknown_scenario"))) code = "SCENARIO_GROUNDING_FAILED";
  else if (errors.some((e) => /invented_price|risk_reward/.test(e))) code = "INVENTED_PRICE_REJECTED";
  else if (errors.length) code = "EVIDENCE_GROUNDING_FAILED";

  return { errors, code };
}
