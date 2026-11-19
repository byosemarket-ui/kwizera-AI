/**
 * Phase 5C Step 2 — select ordered XABCD pivot windows from existing swings.
 * Reuses StructureSwing; does not invent a competing swing detector.
 */
import type { StructureSwing } from "../../../../../forex-structure/types.js";
import { confirmedOnly } from "../patterns/geometry.js";
import type { MifHarmonicOrientation, MifHarmonicPivotRef, MifHarmonicPolicy } from "./types.js";

export interface XabcdWindow {
  orientation: MifHarmonicOrientation;
  pivots: [StructureSwing, StructureSwing, StructureSwing, StructureSwing, StructureSwing];
  allConfirmed: boolean;
}

function alternateOk(
  a: StructureSwing,
  b: StructureSwing,
  expectedA: "HIGH" | "LOW",
): boolean {
  return a.kind === expectedA && b.kind !== a.kind;
}

function barsOk(a: StructureSwing, b: StructureSwing, minBars: number): boolean {
  return Math.abs(b.index - a.index) >= minBars;
}

function chronological(a: StructureSwing, b: StructureSwing): boolean {
  return a.time < b.time && a.index < b.index;
}

function distinctPrices(pivots: StructureSwing[], tickSize: number | null): boolean {
  const eps = tickSize != null && tickSize > 0 ? tickSize / 2 : 1e-12;
  for (let i = 0; i < pivots.length; i++) {
    for (let j = i + 1; j < pivots.length; j++) {
      if (Math.abs(pivots[i]!.price - pivots[j]!.price) <= eps && pivots[i]!.kind === pivots[j]!.kind) {
        // Same-kind near-duplicate prices at different times can happen; reject identical time/index.
        if (pivots[i]!.time === pivots[j]!.time || pivots[i]!.index === pivots[j]!.index) {
          return false;
        }
      }
      if (pivots[i]!.id === pivots[j]!.id) return false;
    }
  }
  return true;
}

/**
 * Enumerate alternating 5-pivot windows.
 * Bullish: X=LOW A=HIGH B=LOW C=HIGH D=LOW
 * Bearish: X=HIGH A=LOW B=HIGH C=LOW D=HIGH
 */
export function selectXabcdWindows(
  swings: readonly StructureSwing[],
  policy: MifHarmonicPolicy,
  opts?: { tickSize?: number | null; includeProvisionalTip?: boolean },
): XabcdWindow[] {
  const confirmed = confirmedOnly(swings);
  let pool = confirmed;
  if (opts?.includeProvisionalTip) {
    const tip = swings
      .filter((s) => s.status === "PROVISIONAL")
      .slice()
      .sort((a, b) => (a.time !== b.time ? a.time - b.time : a.index - b.index));
    // Only the latest provisional may tip D; XABC must remain confirmed.
    const lastProv = tip[tip.length - 1];
    if (lastProv && !confirmed.some((c) => c.id === lastProv.id)) {
      pool = [...confirmed, lastProv].sort((a, b) =>
        a.time !== b.time ? a.time - b.time : a.index - b.index,
      );
    }
  }

  const out: XabcdWindow[] = [];
  const minBars = policy.minBarsBetweenPivots;
  const tickSize = opts?.tickSize ?? null;

  for (let i = 0; i + 4 < pool.length; i++) {
    for (const orientation of ["BULLISH", "BEARISH"] as const) {
      const xKind: "HIGH" | "LOW" = orientation === "BULLISH" ? "LOW" : "HIGH";
      const seq = [pool[i]!, pool[i + 1]!, pool[i + 2]!, pool[i + 3]!, pool[i + 4]!] as const;
      let ok = seq[0].kind === xKind;
      for (let k = 0; k < 4; k++) {
        if (!alternateOk(seq[k]!, seq[k + 1]!, seq[k]!.kind)) {
          ok = false;
          break;
        }
        if (!chronological(seq[k]!, seq[k + 1]!)) {
          ok = false;
          break;
        }
        if (!barsOk(seq[k]!, seq[k + 1]!, minBars)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (!distinctPrices([...seq], tickSize)) continue;

      // XABC must be confirmed; only D may be provisional when includeProvisionalTip.
      const xabcConfirmed = seq.slice(0, 4).every((s) => s.status === "CONFIRMED");
      if (!xabcConfirmed) continue;

      const allConfirmed = seq.every((s) => s.status === "CONFIRMED");
      out.push({ orientation, pivots: [...seq] as XabcdWindow["pivots"], allConfirmed });
    }
  }
  return out;
}

export function swingToHarmonicPivot(
  role: MifHarmonicPivotRef["role"],
  s: StructureSwing,
): MifHarmonicPivotRef {
  return {
    role,
    swingId: s.id,
    kind: s.kind,
    price: s.price,
    timeSec: s.time,
    index: s.index,
    status: s.status === "CONFIRMED" ? "CONFIRMED" : "PROVISIONAL",
  };
}
