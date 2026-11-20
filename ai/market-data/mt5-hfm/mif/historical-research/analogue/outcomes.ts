/**
 * Phase 5F STEP 2 — post-match outcome attachment (strictly after tip).
 * Never feeds into similarity. Cost/session uncertainty always flagged while limited.
 */
import type { MifResearchStoredBar } from "../types.js";
import type { MifAnalogueOutcomeAttachment, MifAnalogueOutcomeHorizon } from "./types.js";

function isValidPrice(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * Attach outcomes using only bars with openTimeSec > tipOpenTimeSec.
 */
export function attachAnalogueOutcomes(input: {
  tipOpenTimeSec: number;
  tipClose: number;
  bars: readonly MifResearchStoredBar[];
  horizons: readonly number[];
}): MifAnalogueOutcomeAttachment {
  const future = input.bars
    .filter((b) => b.time > input.tipOpenTimeSec)
    .sort((a, b) => a.time - b.time);

  const entry = input.tipClose;
  const horizons: MifAnalogueOutcomeHorizon[] = input.horizons.map((h) => {
    if (!isValidPrice(entry) || h < 1) {
      return {
        bars: h,
        forwardReturn: null,
        direction: null,
        mfe: null,
        mae: null,
        completeness: "INSUFFICIENT",
        gapFlags: ["INVALID_ENTRY_OR_HORIZON"],
      };
    }
    if (future.length < h) {
      return {
        bars: h,
        forwardReturn: null,
        direction: null,
        mfe: null,
        mae: null,
        completeness: future.length === 0 ? "INSUFFICIENT" : "PARTIAL",
        gapFlags: [`NEED_${h}_HAVE_${future.length}`],
      };
    }
    const window = future.slice(0, h);
    const last = window[window.length - 1]!;
    const forwardReturn = isValidPrice(last.close) ? (last.close - entry) / entry : null;
    let mfe = 0;
    let mae = 0;
    for (const b of window) {
      if (!isValidPrice(b.high) || !isValidPrice(b.low)) continue;
      mfe = Math.max(mfe, (b.high - entry) / entry);
      mae = Math.min(mae, (b.low - entry) / entry);
    }
    let direction: "UP" | "DOWN" | "FLAT" | null = null;
    if (forwardReturn != null) {
      if (forwardReturn > 1e-12) direction = "UP";
      else if (forwardReturn < -1e-12) direction = "DOWN";
      else direction = "FLAT";
    }
    return {
      bars: h,
      forwardReturn,
      direction,
      mfe,
      mae,
      completeness: "COMPLETE",
      gapFlags: [],
    };
  });

  return {
    candidateTipOpenTimeSec: input.tipOpenTimeSec,
    horizons,
    sessionUncertainty: true,
    costUncertainty: true,
    note: "Outcomes are historical observations only; not a forecast or probability. Session/cost authority limited.",
    separatedFromSimilarityScore: true,
    probabilityNotComputed: true,
  };
}
