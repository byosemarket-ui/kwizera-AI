/**
 * Phase 5D Step 2 — map detection context evidence → strategy eligibility summary.
 */
import type { MifStrategyEvidenceSummary } from "../strategy-intelligence/types.js";
import type { MifOpportunityDetectionContext } from "./types.js";

export function buildStrategyEvidenceSummaryFromContext(
  ctx: MifOpportunityDetectionContext,
): MifStrategyEvidenceSummary {
  if (ctx.evidenceSummary) {
    return {
      ...ctx.evidenceSummary,
      providerSymbol: ctx.evidenceSummary.providerSymbol || ctx.providerSymbol,
      dataQualityStatus: ctx.evidenceSummary.dataQualityStatus || ctx.dataQualityStatus,
    };
  }

  return {
    providerSymbol: String(ctx.providerSymbol || "").trim().toUpperCase(),
    dataQualityStatus: ctx.dataQualityStatus,
    regimeDirection: ctx.regime?.direction ?? null,
    regimeStructure: ctx.regime?.structure ?? null,
    regimeVolatility: ctx.regime?.volatility ?? null,
    availableTimeframeRoles: ctx.availableTimeframeRoles,
    evidence: ctx.evidence.map((e) => ({
      evidenceId: e.evidenceId,
      family: e.family,
      presence: e.presence,
      qualityStatus: e.qualityStatus,
      closedCandleSatisfied:
        e.candleState == null
          ? null
          : e.candleState === "CLOSED"
            ? true
            : e.candleState === "FORMING"
              ? false
              : null,
      sourceAssessmentId: e.sourceAssessmentId,
      sourceContractId: e.sourceContractId,
      notes: e.notes,
    })),
  };
}
