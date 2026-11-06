/**
 * Stage 3 — proposed-order margin attestation.
 * Distinguishes account usable margin from proposed-order required margin.
 * Never fabricates MMR; only multiplies verified mmrPerLot × verified lots.
 */
import type { ProposedOrderMarginAttestation } from "./types.js";
import { finitePositive } from "./validate.js";

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export interface AttestProposedOrderMarginInput {
  usableMargin: number | null | undefined;
  proposalEstimatedMargin?: number | null;
  handoffRequiredMargin?: number | null;
  mmrPerLot?: number | null;
  lots?: number | null;
  contractVerified?: boolean | null;
  baseUnitSize?: number | null;
}

/**
 * Attest whether usable margin covers the proposed order.
 * Required margin priority:
 * 1) proposal.estimatedMargin (already sized from verified MMR path)
 * 2) handoff.riskCapital.requiredMargin
 * 3) mmrPerLot × lots only when contractVerified and both finite positive
 */
export function attestProposedOrderMargin(
  input: AttestProposedOrderMarginInput,
): ProposedOrderMarginAttestation {
  const contractVerified = input.contractVerified === true;
  const baseUnitSize = finitePositive(input.baseUnitSize) ? input.baseUnitSize : null;
  const mmrPerLot = finitePositive(input.mmrPerLot) ? input.mmrPerLot : null;
  const lots = finitePositive(input.lots) ? input.lots : null;
  const usable = finiteNonNeg(input.usableMargin) ? input.usableMargin : null;

  let required: number | null = null;
  let source: ProposedOrderMarginAttestation["requiredMarginSource"] = null;

  if (finiteNonNeg(input.proposalEstimatedMargin) && (input.proposalEstimatedMargin as number) > 0) {
    required = input.proposalEstimatedMargin as number;
    source = "proposal.estimatedMargin";
  } else if (finiteNonNeg(input.handoffRequiredMargin) && (input.handoffRequiredMargin as number) > 0) {
    required = input.handoffRequiredMargin as number;
    source = "handoff.requiredMargin";
  } else if (contractVerified && mmrPerLot != null && lots != null) {
    required = mmrPerLot * lots;
    source = "mmr_per_lot_x_lots";
  }

  if (!contractVerified && source === null) {
    return {
      status: "UNAVAILABLE",
      reason:
        "Instrument contract not verified — cannot attest proposed-order margin "
        + "(refuse fabricated MMR).",
      usableMargin: usable,
      requiredMargin: null,
      requiredMarginSource: null,
      mmrPerLot,
      lots,
      contractVerified: false,
      baseUnitSize,
    };
  }

  if (mmrPerLot == null && source === null) {
    return {
      status: "UNAVAILABLE",
      reason:
        "MISSING_MARGIN_DATA — no proposal/handoff required margin and mmrPerLot unavailable. "
        + "ForexConnect TradingSettings/Offers MMR must be present and verified.",
      usableMargin: usable,
      requiredMargin: null,
      requiredMarginSource: null,
      mmrPerLot: null,
      lots,
      contractVerified,
      baseUnitSize,
    };
  }

  if (lots == null && source === null) {
    return {
      status: "UNAVAILABLE",
      reason: "Proposed order lots missing — cannot compute required margin.",
      usableMargin: usable,
      requiredMargin: null,
      requiredMarginSource: null,
      mmrPerLot,
      lots: null,
      contractVerified,
      baseUnitSize,
    };
  }

  if (required == null || !Number.isFinite(required) || !(required > 0)) {
    return {
      status: "INVALID",
      reason: "Required margin computed/supplied value is invalid.",
      usableMargin: usable,
      requiredMargin: required,
      requiredMarginSource: source,
      mmrPerLot,
      lots,
      contractVerified,
      baseUnitSize,
    };
  }

  if (usable == null) {
    return {
      status: "UNAVAILABLE",
      reason: "Account usableMargin missing — cannot compare to proposed-order required margin.",
      usableMargin: null,
      requiredMargin: required,
      requiredMarginSource: source,
      mmrPerLot,
      lots,
      contractVerified,
      baseUnitSize,
    };
  }

  if (usable + 1e-9 < required) {
    return {
      status: "INSUFFICIENT",
      reason: `Usable margin ${usable} < required ${required} (source=${source}).`,
      usableMargin: usable,
      requiredMargin: required,
      requiredMarginSource: source,
      mmrPerLot,
      lots,
      contractVerified,
      baseUnitSize,
    };
  }

  return {
    status: "VERIFIED",
    reason: `Usable margin ${usable} covers required ${required} (source=${source}).`,
    usableMargin: usable,
    requiredMargin: required,
    requiredMarginSource: source,
    mmrPerLot,
    lots,
    contractVerified,
    baseUnitSize,
  };
}
