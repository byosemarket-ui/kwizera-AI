/**
 * Phase 5D Steps 3–7 — implemented detector catalog (deterministic order).
 * Only detectors that are implemented and tested belong here.
 */
import type { MifOpportunityDetector } from "../types.js";
import { mifBreakoutDetector } from "./breakout.js";
import { mifBreakoutRetestDetector } from "./breakout-retest.js";
import { mifPullbackDetector } from "./pullback.js";
import { mifRangeDetector } from "./range.js";
import { mifReversalDetector } from "./reversal.js";
import { mifTrendContinuationDetector } from "./trend-continuation.js";

/** Stable alphabetical-by-id order for deterministic registry loading. */
export const MIF_IMPLEMENTED_OPPORTUNITY_DETECTORS: readonly MifOpportunityDetector[] = Object.freeze([
  mifBreakoutDetector,
  mifBreakoutRetestDetector,
  mifPullbackDetector,
  mifRangeDetector,
  mifReversalDetector,
  mifTrendContinuationDetector,
]);
