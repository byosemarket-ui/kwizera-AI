/**
 * Phase 5B.2 Step 2 — consumer-specific multi-timeframe requirements.
 * No global requirement for every supported timeframe.
 */
import type { MifCandleState } from "../../canonical/types.js";

export type MifCandleStatePolicyMode = "closed_only" | "allow_forming" | "explicit_states";

export interface MifCandleStatePolicy {
  mode: MifCandleStatePolicyMode;
  /** Used when mode === "explicit_states". */
  allowedStates?: readonly MifCandleState[];
}

export interface MifMultiTimeframeRequirement {
  consumerId: string;
  requiredTimeframes: readonly string[];
  optionalTimeframes?: readonly string[];
  /** When true, missing required TF is blocking. Default true. */
  missingRequiredBlocks?: boolean;
  candleStatePolicy: MifCandleStatePolicy;
  /**
   * Optional max tip skew in seconds. When null/undefined, skew is measured only
   * (no pass/fail). Never invent a universal 6h threshold.
   */
  maxTipSkewSec?: number | null;
  /** Tip field used for skew: open times (default) or exclusive close bounds when known. */
  skewBoundary?: "open" | "close";
}

export const MIF_SUPPORTED_FIXED_TIMEFRAMES = [
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
] as const;
