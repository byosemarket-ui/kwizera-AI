/**
 * Phase 5D Steps 3–4 — implemented detector catalog (deterministic order).
 * Only detectors that are implemented and tested belong here.
 */
import type { MifOpportunityDetector } from "../types.js";
import { mifPullbackDetector } from "./pullback.js";
import { mifReversalDetector } from "./reversal.js";
import { mifTrendContinuationDetector } from "./trend-continuation.js";

/** Stable alphabetical-by-id order for deterministic registry loading. */
export const MIF_IMPLEMENTED_OPPORTUNITY_DETECTORS: readonly MifOpportunityDetector[] = Object.freeze([
  mifPullbackDetector,
  mifReversalDetector,
  mifTrendContinuationDetector,
]);
