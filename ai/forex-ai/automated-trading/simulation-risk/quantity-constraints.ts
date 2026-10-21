/**
 * Phase 56.2.5 — Authoritative XAU/USD quantity min/step resolution.
 *
 * Evidence (ForexConnect O2GTradingSettingsProvider):
 * - getMinQuantity: minimum order amount (CFD → contracts)
 * - getBaseUnitSize: size of one lot; order amounts must be multiples of this value
 * There is no separate "lotStep" in the official provider; historical sidecar
 * `lotStep` was filled from getMinQuantity and must not be treated as a fractional step.
 *
 * The observed DEMO pair quantityMin=0.01 vs quantityStep=1 is explained as:
 * - 0.01 = local contract-spec fallback under legacy quantityUnit="lots"
 * - 1 = SDK getMinQuantity (mis-stored as lotStep) and/or BaseUnitSize=1
 * Do not invent a reconciliation that silently picks 0.01.
 */

import type { EvidenceStatus } from "./quantity-semantics.js";

export type QuantityConstraintStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNVERIFIED"
  | "CONTRADICTORY"
  | "NOT_AVAILABLE";

export interface QuantityConstraintsResult {
  status: QuantityConstraintStatus;
  quantityMin: number | null;
  quantityStep: number | null;
  quantityUnit: "contracts" | "unknown";
  /** True when sizing that depends on min/step must block. */
  sizingBlocked: boolean;
  blockCode: string | null;
  blockMessage: string | null;
  sources: {
    quantityMin: string | null;
    quantityStep: string | null;
  };
  notes: string[];
  evidenceStatus: EvidenceStatus;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** True when a candidate looks like the local FX "lots" 0.01 invention. */
export function looksLikeInventedLotsMin(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value - 0.01) < 1e-12;
}

/**
 * Resolve min/step for XAU contracts from SDK-aligned fields.
 * Never replaces step=1 with 0.01, or min=0.01 with 1, without evidence.
 */
export function resolveXauQuantityConstraints(input: {
  quantityUnit: "contracts" | "unknown" | string | null | undefined;
  quantityUnitAmbiguous?: boolean;
  baseUnitSize?: number | null;
  /** Distinct SDK getMinQuantity when available. */
  sdkMinQuantity?: number | null;
  /**
   * Historical sidecar `lotStep` — often getMinQuantity, not an increment.
   * Used only as a candidate for min when sdkMinQuantity is absent.
   */
  legacyLotStep?: number | null;
  /** Caller-supplied quantityStep (may be legacy alias of lotStep). */
  reportedQuantityStep?: number | null;
  /** Caller-supplied quantityMin (may be local 0.01 invention). */
  reportedQuantityMin?: number | null;
}): QuantityConstraintsResult {
  const notes: string[] = [];
  const unitRaw = String(input.quantityUnit ?? "unknown");
  const unit: "contracts" | "unknown" = unitRaw === "contracts" ? "contracts" : "unknown";

  if (input.quantityUnitAmbiguous || unit !== "contracts") {
    return {
      status: "UNVERIFIED",
      quantityMin: null,
      quantityStep: null,
      quantityUnit: "unknown",
      sizingBlocked: true,
      blockCode: "QTY_CONSTRAINTS_UNIT_AMBIGUOUS",
      blockMessage: "Quantity unit is not verified contracts — min/step not applied for sizing.",
      sources: { quantityMin: null, quantityStep: null },
      notes: ["Unit must be VERIFIED contracts before min/step are authoritative."],
      evidenceStatus: "UNVERIFIED",
    };
  }

  if (!finitePositive(input.baseUnitSize)) {
    return {
      status: "UNVERIFIED",
      quantityMin: null,
      quantityStep: null,
      quantityUnit: "contracts",
      sizingBlocked: true,
      blockCode: "QTY_CONSTRAINTS_BASE_UNIT_MISSING",
      blockMessage: "BaseUnitSize missing — ForexConnect requires amounts multiple of BaseUnitSize.",
      sources: { quantityMin: null, quantityStep: null },
      notes: [
        "SDK: getBaseUnitSize defines the lot/trade multiple for the instrument/account.",
      ],
      evidenceStatus: "UNVERIFIED",
    };
  }

  const base = input.baseUnitSize;
  // Authoritative increment for CFD/XAU: BaseUnitSize (official ForexConnect docs).
  const step = base;
  const stepSource = "TradingSettings getBaseUnitSize (order amounts must be multiples)";

  // Prefer distinct SDK min; else legacy lotStep when it is a whole multiple of base
  // and not the local 0.01 invention.
  let min: number | null = null;
  let minSource: string | null = null;

  if (finitePositive(input.sdkMinQuantity)) {
    min = input.sdkMinQuantity;
    minSource = "TradingSettings getMinQuantity";
  } else if (
    finitePositive(input.legacyLotStep)
    && !looksLikeInventedLotsMin(input.legacyLotStep)
  ) {
    min = input.legacyLotStep;
    minSource =
      "TradingSettings lotStep field (historically filled from getMinQuantity — not a fractional step)";
    notes.push(
      "Using legacy lotStep as minQuantity candidate; sidecar now exposes minQuantity separately.",
    );
  } else if (
    finitePositive(input.reportedQuantityMin)
    && !looksLikeInventedLotsMin(input.reportedQuantityMin)
  ) {
    min = input.reportedQuantityMin;
    minSource = "reported quantityMin (non-invented)";
  } else if (looksLikeInventedLotsMin(input.reportedQuantityMin)) {
    notes.push(
      "Discarded reported quantityMin=0.01 — matches local FX lots fallback, not SDK CFD min for XAU contracts.",
    );
  }

  // If reported step contradicts BaseUnitSize and looks like invented 0.01, note and ignore.
  if (
    finitePositive(input.reportedQuantityStep)
    && Math.abs(input.reportedQuantityStep - step) > 1e-12
  ) {
    if (looksLikeInventedLotsMin(input.reportedQuantityStep)) {
      notes.push(
        `Ignored reported quantityStep=${input.reportedQuantityStep} (local 0.01 invention); using BaseUnitSize=${step}.`,
      );
    } else if (
      finitePositive(input.legacyLotStep)
      && Math.abs(input.reportedQuantityStep - input.legacyLotStep) < 1e-12
      && Math.abs(input.legacyLotStep - step) < 1e-12
    ) {
      // reported step equals legacy min and base — consistent
      notes.push("reported quantityStep aligns with BaseUnitSize/min.");
    } else if (Math.abs(input.reportedQuantityStep - (input.legacyLotStep ?? NaN)) < 1e-12) {
      notes.push(
        `reported quantityStep=${input.reportedQuantityStep} equals legacy lotStep/minQuantity alias; increment remains BaseUnitSize=${step}.`,
      );
    } else {
      notes.push(
        `reported quantityStep=${input.reportedQuantityStep} differs from BaseUnitSize=${step} — treating BaseUnitSize as authoritative increment.`,
      );
    }
  }

  // Explicit contradiction: fractional invented min with whole-contract step.
  if (
    looksLikeInventedLotsMin(input.reportedQuantityMin)
    && finitePositive(input.reportedQuantityStep)
    && input.reportedQuantityStep >= 1 - 1e-12
  ) {
    notes.push(
      "Observed 0.01 vs ≥1 discrepancy: quantityMin=0.01 is local lots fallback; step≥1 is SDK-aligned. Not reconciled by inventing fractional contracts.",
    );
  }

  if (min == null) {
    // Fail closed: do not invent min=1 merely because base=1 without SDK min evidence,
    // UNLESS baseUnitSize itself is the only SDK-aligned value and public max-contracts
    // docs imply whole contracts — still prefer requiring min.
    // Practical DEMO: BaseUnitSize=1 + getMinQuantity commonly 1 via legacy lotStep.
    // Without any min signal, block.
    return {
      status: "UNVERIFIED",
      quantityMin: null,
      quantityStep: step,
      quantityUnit: "contracts",
      sizingBlocked: true,
      blockCode: "QTY_CONSTRAINTS_MIN_UNVERIFIED",
      blockMessage:
        "Minimum quantity unverified after discarding non-authoritative 0.01 lots fallback.",
      sources: { quantityMin: null, quantityStep: stepSource },
      notes,
      evidenceStatus: "UNVERIFIED",
    };
  }

  // Min must be a positive multiple of step (BaseUnitSize).
  const units = min / step;
  if (Math.abs(units - Math.round(units)) > 1e-8) {
    return {
      status: "CONTRADICTORY",
      quantityMin: min,
      quantityStep: step,
      quantityUnit: "contracts",
      sizingBlocked: true,
      blockCode: "QTY_CONSTRAINTS_MIN_NOT_MULTIPLE_OF_STEP",
      blockMessage:
        `quantityMin=${min} is not a multiple of BaseUnitSize/step=${step} — sizing blocked.`,
      sources: { quantityMin: minSource, quantityStep: stepSource },
      notes,
      evidenceStatus: "UNVERIFIED",
    };
  }

  if (min + 1e-12 < step) {
    return {
      status: "CONTRADICTORY",
      quantityMin: min,
      quantityStep: step,
      quantityUnit: "contracts",
      sizingBlocked: true,
      blockCode: "QTY_CONSTRAINTS_MIN_BELOW_STEP",
      blockMessage:
        `quantityMin=${min} < step=${step} — cannot place min without breaching increment.`,
      sources: { quantityMin: minSource, quantityStep: stepSource },
      notes,
      evidenceStatus: "UNVERIFIED",
    };
  }

  return {
    status: "VERIFIED",
    quantityMin: min,
    quantityStep: step,
    quantityUnit: "contracts",
    sizingBlocked: false,
    blockCode: null,
    blockMessage: null,
    sources: { quantityMin: minSource, quantityStep: stepSource },
    notes,
    evidenceStatus: "VERIFIED",
  };
}

/**
 * Floor quantity to step without ever rounding up past risk/budget limits.
 */
export function floorQuantityToStep(raw: number, step: number, min: number): number | null {
  if (!finitePositive(raw) || !finitePositive(step) || !finitePositive(min)) return null;
  let q = Math.floor(raw / step + 1e-12) * step;
  // Normalize float noise.
  q = Math.round(q / step) * step;
  if (q + 1e-12 < min) return null;
  return q;
}
