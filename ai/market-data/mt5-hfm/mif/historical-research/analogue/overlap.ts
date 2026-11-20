/**
 * Phase 5F STEP 2 — deterministic overlap / near-duplicate suppression.
 */
import {
  MIF_ANALOGUE_OVERLAP_POLICY_ID,
  MIF_ANALOGUE_OVERLAP_POLICY_VERSION,
} from "./contracts.js";
import type { MifAnalogueCandidateRecord } from "./types.js";

export function windowIou(a: {
  start: number;
  end: number;
}, b: {
  start: number;
  end: number;
}): number {
  const lo = Math.max(a.start, b.start);
  const hi = Math.min(a.end, b.end);
  const inter = Math.max(0, hi - lo);
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  if (union <= 0) return 0;
  return inter / union;
}

/**
 * Keep highest-ranked first; suppress later overlapping / same-tip duplicates.
 * Input must already be sorted by ranking tie-break order.
 */
export function suppressOverlappingAnalogues(input: {
  ranked: readonly MifAnalogueCandidateRecord[];
  iouThreshold: number;
}): {
  kept: MifAnalogueCandidateRecord[];
  suppressed: MifAnalogueCandidateRecord[];
  policyId: typeof MIF_ANALOGUE_OVERLAP_POLICY_ID;
  policyVersion: typeof MIF_ANALOGUE_OVERLAP_POLICY_VERSION;
} {
  const kept: MifAnalogueCandidateRecord[] = [];
  const suppressed: MifAnalogueCandidateRecord[] = [];
  const threshold = Math.max(0, Math.min(1, input.iouThreshold));

  for (const cand of input.ranked) {
    let reason: "OVERLAP_SUPPRESSED" | "SAME_EVENT_DUPLICATE" | null = null;
    for (const k of kept) {
      if (
        k.datasetId === cand.datasetId &&
        k.tipOpenTimeSec === cand.tipOpenTimeSec
      ) {
        reason = "SAME_EVENT_DUPLICATE";
        break;
      }
      if (
        k.datasetId === cand.datasetId &&
        windowIou(
          { start: k.windowStartOpenTimeSec, end: k.windowEndOpenTimeSec },
          { start: cand.windowStartOpenTimeSec, end: cand.windowEndOpenTimeSec },
        ) >= threshold
      ) {
        reason = "OVERLAP_SUPPRESSED";
        break;
      }
    }
    if (reason) {
      suppressed.push({
        ...cand,
        suppressed: true,
        suppressionReason: reason,
      });
    } else {
      kept.push({ ...cand, suppressed: false, suppressionReason: null });
    }
  }

  return {
    kept,
    suppressed,
    policyId: MIF_ANALOGUE_OVERLAP_POLICY_ID,
    policyVersion: MIF_ANALOGUE_OVERLAP_POLICY_VERSION,
  };
}
