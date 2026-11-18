/**
 * Phase 5B.2 Step 1 — session calendar uncertainty (no invented HFM calendar).
 */
import { MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR } from "./codes.js";
import type { MifExpectedIntervalAuthority, MifQualityFinding } from "./types.js";

/**
 * Always emit NO_AUTHORITATIVE_SESSION_CALENDAR when no authority is attached.
 * When an authority is present, do not invent hours — authority decides expected opens.
 */
export function sessionCalendarUncertaintyFinding(
  authority: MifExpectedIntervalAuthority | null | undefined,
): MifQualityFinding | null {
  if (authority != null) return null;
  return {
    code: MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR,
    severity: "warning",
    message:
      "No authoritative HFM session calendar is attached; session closures cannot be confirmed and gaps cannot be classified as confirmed missing based on market hours",
  };
}

/** Large-gap heuristic threshold (bars) for UNKNOWN_SESSION_GAP labeling — not confirmation. */
export const UNKNOWN_SESSION_GAP_MIN_MISSED_BARS = 12;
/** Large-gap heuristic threshold (seconds) ~ 1 day. */
export const UNKNOWN_SESSION_GAP_MIN_GAP_SEC = 86_400;
