/**
 * Stage 1 — Slippage evidence schema & validation.
 * Slippage ≠ quote spread. Requires actual broker execution fill evidence.
 * Never invents samples. Never submits orders. Never auto-approves.
 */
import type { Stage3TrackedInstrument } from "./types.js";
import { documentedPrecision, finitePositive, normalizeInstrumentSymbol } from "./validate.js";

export const STAGE1_SLIPPAGE_EVIDENCE_SCHEMA = "kwizera.at-slippage-evidence.v1" as const;
export const MIN_SLIPPAGE_FILL_OBSERVATIONS_FOR_RECOMMENDATION = 20;

export const SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION =
  "SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION" as const;

export type SlippageEvidenceBlocker =
  | typeof SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION
  | "MISSING_REFERENCE_PRICE"
  | "MISSING_EXECUTION_PRICE"
  | "MISSING_FILL_TIMESTAMP"
  | "MISSING_DIRECTION"
  | "MISSING_EXECUTION_ID"
  | "INVALID_PRICES"
  | "SYNTHETIC_NOT_PRODUCTION_EVIDENCE"
  | "INSUFFICIENT_FILL_SAMPLES";

/**
 * Absolute slippage for entry_vs_executable:
 * BUY: max(0, fill − reference) adverse when fill > reference (paid more)
 * SELL: max(0, reference − fill) adverse when fill < reference (received less)
 * Also expose unsigned |fill − reference| for policy absolute_price limits.
 */
export function computeExecutionSlippage(input: {
  direction: "BUY" | "SELL";
  referencePrice: number;
  executionPrice: number;
}): {
  ok: true;
  signedSlippage: number;
  absoluteSlippage: number;
  adverseAbsolute: number;
  units: "absolute_price";
} | { ok: false; reason: string } {
  if (!finitePositive(input.referencePrice) || !finitePositive(input.executionPrice)) {
    return { ok: false, reason: "referencePrice and executionPrice must be finite positive." };
  }
  const signed = input.executionPrice - input.referencePrice;
  const absolute = Math.abs(signed);
  let adverseAbsolute: number;
  if (input.direction === "BUY") {
    // Adverse if paid above reference
    adverseAbsolute = Math.max(0, input.executionPrice - input.referencePrice);
  } else {
    // Adverse if received below reference
    adverseAbsolute = Math.max(0, input.referencePrice - input.executionPrice);
  }
  return {
    ok: true,
    signedSlippage: signed,
    absoluteSlippage: absolute,
    adverseAbsolute,
    units: "absolute_price",
  };
}

export interface SlippageFillEvidenceRecord {
  evidenceId: string;
  instrument: string;
  direction: "BUY" | "SELL";
  /** Intended / submission reference price (not mid-move speculation). */
  referencePrice: number;
  submissionReferencePrice: number | null;
  executionPrice: number;
  fillTimestampUtc: string;
  executionIdentifier: string;
  brokerResponseId: string | null;
  absoluteSlippage: number;
  signedSlippage: number;
  adverseAbsolute: number;
  units: "absolute_price";
  pricePrecision: number | null;
  provenance: "BROKER_EXECUTION" | "SYNTHETIC_TEST_DATA";
  placesOrders: false;
  mutatesBroker: false;
}

export interface SlippageEvidenceValidationResult {
  ok: boolean;
  blockers: SlippageEvidenceBlocker[];
  record: SlippageFillEvidenceRecord | null;
  note: string;
}

/**
 * Validate a candidate fill-based slippage observation (pure).
 * Does not call the broker.
 */
export function validateSlippageFillEvidence(input: {
  evidenceId?: string | null;
  instrument: string;
  direction: "BUY" | "SELL" | null | undefined;
  referencePrice: number | null | undefined;
  submissionReferencePrice?: number | null;
  executionPrice: number | null | undefined;
  fillTimestampUtc: string | null | undefined;
  executionIdentifier: string | null | undefined;
  brokerResponseId?: string | null;
  provenance: "BROKER_EXECUTION" | "SYNTHETIC_TEST_DATA";
}): SlippageEvidenceValidationResult {
  const blockers: SlippageEvidenceBlocker[] = [];
  if (input.provenance === "SYNTHETIC_TEST_DATA") {
    blockers.push("SYNTHETIC_NOT_PRODUCTION_EVIDENCE");
  }
  if (input.direction !== "BUY" && input.direction !== "SELL") {
    blockers.push("MISSING_DIRECTION");
  }
  if (!finitePositive(input.referencePrice)) blockers.push("MISSING_REFERENCE_PRICE");
  if (!finitePositive(input.executionPrice)) blockers.push("MISSING_EXECUTION_PRICE");
  if (!input.fillTimestampUtc || !Number.isFinite(Date.parse(input.fillTimestampUtc))) {
    blockers.push("MISSING_FILL_TIMESTAMP");
  }
  if (!String(input.executionIdentifier || "").trim()) {
    blockers.push("MISSING_EXECUTION_ID");
  }

  if (blockers.length > 0 && !(blockers.length === 1 && blockers[0] === "SYNTHETIC_NOT_PRODUCTION_EVIDENCE")) {
    // If only synthetic flag, still compute for tests; otherwise fail.
    const hard = blockers.filter((b) => b !== "SYNTHETIC_NOT_PRODUCTION_EVIDENCE");
    if (hard.length > 0) {
      return {
        ok: false,
        blockers,
        record: null,
        note: `Slippage evidence incomplete: ${hard.join(",")}.`,
      };
    }
  }

  if (input.direction !== "BUY" && input.direction !== "SELL") {
    return { ok: false, blockers, record: null, note: "Direction required." };
  }
  if (!finitePositive(input.referencePrice) || !finitePositive(input.executionPrice)) {
    return { ok: false, blockers: [...blockers, "INVALID_PRICES"], record: null, note: "Invalid prices." };
  }

  const slip = computeExecutionSlippage({
    direction: input.direction,
    referencePrice: input.referencePrice,
    executionPrice: input.executionPrice,
  });
  if (!slip.ok) {
    return { ok: false, blockers: [...blockers, "INVALID_PRICES"], record: null, note: slip.reason };
  }

  const inst = normalizeInstrumentSymbol(input.instrument) ?? input.instrument;
  const record: SlippageFillEvidenceRecord = {
    evidenceId: String(input.evidenceId || "").trim() || `slip-${Date.now()}`,
    instrument: inst,
    direction: input.direction,
    referencePrice: input.referencePrice,
    submissionReferencePrice: finitePositive(input.submissionReferencePrice)
      ? input.submissionReferencePrice
      : null,
    executionPrice: input.executionPrice,
    fillTimestampUtc: String(input.fillTimestampUtc),
    executionIdentifier: String(input.executionIdentifier).trim(),
    brokerResponseId: input.brokerResponseId ? String(input.brokerResponseId) : null,
    absoluteSlippage: slip.absoluteSlippage,
    signedSlippage: slip.signedSlippage,
    adverseAbsolute: slip.adverseAbsolute,
    units: "absolute_price",
    pricePrecision: documentedPrecision(inst),
    provenance: input.provenance,
    placesOrders: false,
    mutatesBroker: false,
  };

  const ok = !blockers.includes("SYNTHETIC_NOT_PRODUCTION_EVIDENCE");
  return {
    ok,
    blockers,
    record,
    note: ok
      ? "Broker execution slippage evidence validated (not an approved policy)."
      : "Synthetic record for tests only — not production evidence.",
  };
}

export interface InstrumentSlippageEvidenceSummary {
  instrument: Stage3TrackedInstrument | string;
  productionFillCount: number;
  minRequired: number;
  sufficientForRecommendation: boolean;
  status:
    | typeof SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION
    | "INSUFFICIENT_FILL_SAMPLES"
    | "EVIDENCE_READY_FOR_RECOMMENDATION"
    | "NOT_CONFIGURED";
  units: "absolute_price";
  recommendedMaxSlippageAbsolute: null;
  autoApproved: false;
  maySubmitOrderToCollect: false;
  note: string;
}

/**
 * Summarize slippage readiness. Without broker fills → controlled DEMO required.
 */
export function summarizeSlippageEvidence(input: {
  instrument: string;
  productionFills: SlippageFillEvidenceRecord[];
}): InstrumentSlippageEvidenceSummary {
  const fills = input.productionFills.filter(
    (f) => f.provenance === "BROKER_EXECUTION" && f.instrument === (normalizeInstrumentSymbol(input.instrument) ?? input.instrument),
  );
  if (fills.length === 0) {
    return {
      instrument: input.instrument,
      productionFillCount: 0,
      minRequired: MIN_SLIPPAGE_FILL_OBSERVATIONS_FOR_RECOMMENDATION,
      sufficientForRecommendation: false,
      status: SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION,
      units: "absolute_price",
      recommendedMaxSlippageAbsolute: null,
      autoApproved: false,
      maySubmitOrderToCollect: false,
      note:
        "No broker execution fill evidence available. Stage 1 forbids order submission to collect slippage. "
        + "Separate controlled DEMO execution approval is required.",
    };
  }
  const sufficient = fills.length >= MIN_SLIPPAGE_FILL_OBSERVATIONS_FOR_RECOMMENDATION;
  return {
    instrument: input.instrument,
    productionFillCount: fills.length,
    minRequired: MIN_SLIPPAGE_FILL_OBSERVATIONS_FOR_RECOMMENDATION,
    sufficientForRecommendation: sufficient,
    status: sufficient ? "EVIDENCE_READY_FOR_RECOMMENDATION" : "INSUFFICIENT_FILL_SAMPLES",
    units: "absolute_price",
    recommendedMaxSlippageAbsolute: null,
    autoApproved: false,
    maySubmitOrderToCollect: false,
    note: sufficient
      ? "Fill evidence adequate to draft a recommendation only — owner approve+confirm still required."
      : `Need ${MIN_SLIPPAGE_FILL_OBSERVATIONS_FOR_RECOMMENDATION - fills.length} more broker fill samples.`,
  };
}

/** Collection workflow description for owner-approved DEMO later (not executed now). */
export function getSlippageEvidenceCollectionWorkflow(): {
  maySubmitOrderInStage1: false;
  requiredFields: string[];
  steps: string[];
  blockerWithoutFills: typeof SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION;
  note: string;
} {
  return {
    maySubmitOrderInStage1: false,
    requiredFields: [
      "instrument",
      "direction",
      "referencePrice (intended/submission)",
      "executionPrice (broker fill)",
      "fillTimestampUtc",
      "executionIdentifier",
      "brokerResponseId (when available)",
    ],
    steps: [
      "Owner authorizes controlled DEMO submission separately from Stage 1",
      "Capture reference price at submission",
      "Record broker fill price + ids from RO/authoritative response",
      "validateSlippageFillEvidence → persist BROKER_EXECUTION records",
      "After ≥20 fills per instrument, draft recommendation (not auto-approve)",
      "Owner propose→approve+confirm maxSlippageAbsolute",
    ],
    blockerWithoutFills: SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION,
    note: "Quote movement is not execution slippage. Do not derive slippage limits from spread observations.",
  };
}
