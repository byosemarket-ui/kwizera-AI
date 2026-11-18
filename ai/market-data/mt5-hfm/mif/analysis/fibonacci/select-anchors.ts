/**
 * Phase 5C Step 1A — confirmed-swing Fibonacci anchor selection.
 * Reuses forex-structure StructureSwing; never invents a second swing engine.
 *
 * Selection policy `latest_adjacent_confirmed_impulse`:
 * 1. Keep only CONFIRMED swings, sorted by (time, index, kind).
 * 2. Enumerate adjacent pairs (i, i+1) that form a valid impulse:
 *    - BULLISH: LOW → HIGH with high.price > low.price
 *    - BEARISH: HIGH → LOW with high.price > low.price
 * 3. Select the pair with the greatest end index (latest impulse end).
 *    Tie-break: greater end time, then BULLISH before BEARISH, then swingId.
 *
 * PROVISIONAL / FORMING swings are never selected as confirmed anchors.
 */
import type { StructureSwing } from "../../../../../forex-structure/types.js";
import type { MifFibonacciAnchorRef, MifFibonacciOrientation } from "./types.js";

export interface MifFibImpulseCandidate {
  orientation: MifFibonacciOrientation;
  anchorA: MifFibonacciAnchorRef;
  anchorB: MifFibonacciAnchorRef;
  low: number;
  high: number;
  endIndex: number;
  endTimeSec: number;
}

function toConfirmedAnchor(s: StructureSwing): MifFibonacciAnchorRef | null {
  if (s.status !== "CONFIRMED") return null;
  if (s.kind !== "HIGH" && s.kind !== "LOW") return null;
  if (!Number.isFinite(s.price) || !Number.isFinite(s.time)) return null;
  return {
    swingId: s.id,
    kind: s.kind,
    price: s.price,
    timeSec: s.time,
    index: s.index,
    status: "CONFIRMED",
  };
}

function compareConfirmed(a: StructureSwing, b: StructureSwing): number {
  if (a.time !== b.time) return a.time - b.time;
  if (a.index !== b.index) return a.index - b.index;
  return a.kind.localeCompare(b.kind);
}

export function listConfirmedImpulseCandidates(
  swings: readonly StructureSwing[],
): MifFibImpulseCandidate[] {
  const confirmed = swings
    .filter((s) => s.status === "CONFIRMED")
    .slice()
    .sort(compareConfirmed);

  const out: MifFibImpulseCandidate[] = [];
  for (let i = 0; i + 1 < confirmed.length; i += 1) {
    const a = toConfirmedAnchor(confirmed[i]!);
    const b = toConfirmedAnchor(confirmed[i + 1]!);
    if (!a || !b) continue;
    if (!(a.timeSec < b.timeSec)) continue;

    if (a.kind === "LOW" && b.kind === "HIGH" && b.price > a.price) {
      out.push({
        orientation: "BULLISH",
        anchorA: a,
        anchorB: b,
        low: a.price,
        high: b.price,
        endIndex: b.index,
        endTimeSec: b.timeSec,
      });
    } else if (a.kind === "HIGH" && b.kind === "LOW" && a.price > b.price) {
      out.push({
        orientation: "BEARISH",
        anchorA: a,
        anchorB: b,
        low: b.price,
        high: a.price,
        endIndex: b.index,
        endTimeSec: b.timeSec,
      });
    }
  }
  return out;
}

function compareCandidates(a: MifFibImpulseCandidate, b: MifFibImpulseCandidate): number {
  if (a.endIndex !== b.endIndex) return a.endIndex - b.endIndex;
  if (a.endTimeSec !== b.endTimeSec) return a.endTimeSec - b.endTimeSec;
  if (a.orientation !== b.orientation) {
    return a.orientation === "BULLISH" ? -1 : 1;
  }
  return a.anchorB.swingId.localeCompare(b.anchorB.swingId);
}

/**
 * Deterministic selection: latest adjacent confirmed impulse under documented policy.
 */
export function selectLatestAdjacentConfirmedImpulse(
  swings: readonly StructureSwing[],
): {
  selected: MifFibImpulseCandidate | null;
  candidates: MifFibImpulseCandidate[];
  confirmedCount: number;
  provisionalCount: number;
} {
  const confirmedCount = swings.filter((s) => s.status === "CONFIRMED").length;
  const provisionalCount = swings.filter((s) => s.status === "PROVISIONAL").length;
  const candidates = listConfirmedImpulseCandidates(swings);
  if (candidates.length === 0) {
    return { selected: null, candidates, confirmedCount, provisionalCount };
  }
  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i += 1) {
    const c = candidates[i]!;
    if (compareCandidates(c, best) > 0) best = c;
  }
  return { selected: best, candidates, confirmedCount, provisionalCount };
}
