/**
 * Phase 59.0 — Map simulation proposedQuantity → ForexConnect DEMO integer lots.
 * Never upsizes below-broker-minimum quantity beyond the risk budget.
 * Clamps to grant maxLots only when that does not increase risk beyond proposed size
 * (clamp down only).
 */
import type { AtExecutionRejection } from "./types.js";

export interface MapProposedQuantityToLotsInput {
  proposedQuantity: number | null | undefined;
  grantMaxLots: number;
  /** Optional explicit lots override from operator — still clamped to grant and ≤ floor(proposed). */
  lotsOverride?: number | null;
}

export interface MapProposedQuantityToLotsResult {
  ok: boolean;
  lots: number | null;
  method: "FLOOR_PROPOSED_QUANTITY" | null;
  clampedToGrant: boolean;
  rejections: AtExecutionRejection[];
  note: string;
}

export function mapProposedQuantityToLots(
  input: MapProposedQuantityToLotsInput,
): MapProposedQuantityToLotsResult {
  const rejections: AtExecutionRejection[] = [];
  const maxLots = input.grantMaxLots;

  if (!Number.isInteger(maxLots) || maxLots < 1) {
    rejections.push({
      code: "GRANT_MAX_LOTS_INVALID",
      message: "grantMaxLots must be a positive integer.",
    });
    return {
      ok: false,
      lots: null,
      method: null,
      clampedToGrant: false,
      rejections,
      note: "Invalid grant maxLots.",
    };
  }

  const qty = input.proposedQuantity;
  if (qty == null || !Number.isFinite(qty) || qty <= 0) {
    rejections.push({
      code: "PROPOSED_QUANTITY_MISSING",
      message:
        "Simulation draft has no positive proposedQuantity — lots are not invented from equity.",
    });
    return {
      ok: false,
      lots: null,
      method: null,
      clampedToGrant: false,
      rejections,
      note: "Missing proposedQuantity.",
    };
  }

  let lots = Math.floor(qty);
  if (lots < 1) {
    rejections.push({
      code: "LOTS_BELOW_MINIMUM",
      message:
        "Floor(proposedQuantity) < 1 — refusing to upsize beyond the risk-derived quantity.",
    });
    return {
      ok: false,
      lots: null,
      method: "FLOOR_PROPOSED_QUANTITY",
      clampedToGrant: false,
      rejections,
      note: "Quantity below 1 lot after floor; fail-closed.",
    };
  }

  if (input.lotsOverride != null && input.lotsOverride !== undefined) {
    const ov = input.lotsOverride;
    if (!Number.isInteger(ov) || ov < 1) {
      rejections.push({
        code: "LOTS_OVERRIDE_INVALID",
        message: "lotsOverride must be a positive integer when provided.",
      });
      return {
        ok: false,
        lots: null,
        method: "FLOOR_PROPOSED_QUANTITY",
        clampedToGrant: false,
        rejections,
        note: "Invalid lots override.",
      };
    }
    if (ov > lots) {
      rejections.push({
        code: "LOTS_OVERRIDE_EXCEEDS_RISK",
        message: "lotsOverride exceeds risk-derived floor(proposedQuantity) — not permitted.",
      });
      return {
        ok: false,
        lots: null,
        method: "FLOOR_PROPOSED_QUANTITY",
        clampedToGrant: false,
        rejections,
        note: "Override would increase size beyond risk budget.",
      };
    }
    lots = ov;
  }

  let clampedToGrant = false;
  if (lots > maxLots) {
    lots = maxLots;
    clampedToGrant = true;
  }

  return {
    ok: true,
    lots,
    method: "FLOOR_PROPOSED_QUANTITY",
    clampedToGrant,
    rejections: [],
    note: clampedToGrant
      ? `Lots clamped down to grant maxLots=${maxLots}.`
      : `Lots=${lots} from floor(proposedQuantity=${qty}).`,
  };
}
