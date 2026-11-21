/**
 * Presentation status ↔ existing MIF candidate lifecycle mapping.
 * Phase 4 does NOT introduce a second FSM — only transparent labels.
 */
import type { MifCandidateLifecycleState } from "../production-integration/persistence/types.js";
import type { MifOpportunityCandidateStatus } from "../opportunity-detection/types.js";
import type { MifScenarioPresentationStatus } from "./types.js";

/**
 * Map presentation status → existing persistence lifecycle.
 */
export function presentationStatusToLifecycle(
  status: MifScenarioPresentationStatus,
): MifCandidateLifecycleState {
  switch (status) {
    case "OBSERVING":
      return "DETECTED";
    case "DEVELOPING":
      return "ACTIVE";
    case "WAITING_FOR_CONFIRMATION":
      return "NEEDS_CONFIRMATION";
    case "CONFIRMED":
      return "CONFIRMED";
    case "INVALIDATED":
      return "INVALIDATED";
    case "EXPIRED":
      return "EXPIRED";
    case "INSUFFICIENT":
      return "OUTCOME_UNKNOWN";
    default:
      return "OUTCOME_UNKNOWN";
  }
}

/**
 * Map existing candidate status → presentation status (baseline before MTF/DQ adjustments).
 */
export function candidateStatusToPresentation(
  status: MifOpportunityCandidateStatus,
): MifScenarioPresentationStatus {
  switch (status) {
    case "DETECTED":
      return "DEVELOPING";
    case "NEEDS_CONFIRMATION":
      return "WAITING_FOR_CONFIRMATION";
    case "INVALID":
      return "INVALIDATED";
    case "REJECTED":
      return "INSUFFICIENT";
    default:
      return "OBSERVING";
  }
}

/** Human-readable mapping table for docs/tests. */
export const MIF_SCENARIO_LIFECYCLE_MAPPING: ReadonlyArray<{
  presentation: MifScenarioPresentationStatus;
  lifecycle: MifCandidateLifecycleState;
  notes: string;
}> = [
  { presentation: "OBSERVING", lifecycle: "DETECTED", notes: "Early / watch-only" },
  { presentation: "DEVELOPING", lifecycle: "ACTIVE", notes: "Setup forming with evidence" },
  {
    presentation: "WAITING_FOR_CONFIRMATION",
    lifecycle: "NEEDS_CONFIRMATION",
    notes: "Required confirmations outstanding",
  },
  {
    presentation: "CONFIRMED",
    lifecycle: "CONFIRMED",
    notes: "Requires CLOSED confirmation — never FORMING alone",
  },
  { presentation: "INVALIDATED", lifecycle: "INVALIDATED", notes: "Structure/thesis broken" },
  { presentation: "EXPIRED", lifecycle: "EXPIRED", notes: "Bar-based / observer expiry" },
  {
    presentation: "INSUFFICIENT",
    lifecycle: "OUTCOME_UNKNOWN",
    notes: "Incomplete or rejected — not negative proof",
  },
];
