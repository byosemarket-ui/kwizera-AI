/**
 * Phase 5D Steps 3–11 — implemented detector catalog (deterministic order).
 * Only detectors that are implemented and tested belong here.
 */
import type { MifOpportunityDetector } from "../types.js";
import { mifBreakoutDetector } from "./breakout.js";
import { mifBreakoutRetestDetector } from "./breakout-retest.js";
import { mifLiquiditySweepDetector } from "./liquidity-sweep.js";
import { mifMomentumExpansionDetector } from "./momentum-expansion.js";
import { mifPatternCompletionDetector } from "./pattern-completion.js";
import { mifPullbackDetector } from "./pullback.js";
import { mifRangeDetector } from "./range.js";
import { mifReversalDetector } from "./reversal.js";
import { mifSupplyDemandDetector } from "./supply-demand.js";
import { mifTrendContinuationDetector } from "./trend-continuation.js";

/** Stable alphabetical-by-id order for deterministic registry loading. */
export const MIF_IMPLEMENTED_OPPORTUNITY_DETECTORS: readonly MifOpportunityDetector[] = Object.freeze([
  mifBreakoutDetector,
  mifBreakoutRetestDetector,
  mifLiquiditySweepDetector,
  mifMomentumExpansionDetector,
  mifPatternCompletionDetector,
  mifPullbackDetector,
  mifRangeDetector,
  mifReversalDetector,
  mifSupplyDemandDetector,
  mifTrendContinuationDetector,
]);
