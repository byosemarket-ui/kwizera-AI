/**
 * Phase 5F STEP 2 — frozen reproducible reference-state builder.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../quality/stable-identity.js";
import {
  assertNoFutureBarsBeyondTip,
  clipResearchBarsClosedAtDecision,
  clipResearchBarsToTip,
} from "../replay-bridge.js";
import type { MifResearchDatasetManifest, MifResearchStoredBar } from "../types.js";
import {
  MIF_ANALOGUE_CONTRACT_ID,
  MIF_ANALOGUE_CONTRACT_VERSION,
  MIF_ANALOGUE_DEFAULT_LOOKBACK_BARS,
  MIF_ANALOGUE_DEFAULT_WARMUP_BARS,
  MIF_ANALOGUE_ENGINE_ID,
  MIF_ANALOGUE_ENGINE_VERSION,
  MIF_ANALOGUE_FEATURE_SET_ID,
  MIF_ANALOGUE_FEATURE_SET_VERSION,
  MIF_ANALOGUE_MAX_LOOKBACK_BARS,
  MIF_ANALOGUE_MIN_LOOKBACK_BARS,
  type MifAnalogueEligibilityMode,
} from "./contracts.js";
import { extractAnalogueFeatures } from "./features.js";
import { MIF_ANALOGUE_SAFETY, type MifAnalogueReferenceState } from "./types.js";

export type BuildReferenceStateResult =
  | { ok: true; reference: MifAnalogueReferenceState }
  | { ok: false; code: string; message: string };

function detectGaps(bars: readonly MifResearchStoredBar[]): number {
  if (bars.length < 3) return 0;
  const steps: number[] = [];
  for (let i = 1; i < bars.length; i++) steps.push(bars[i]!.time - bars[i - 1]!.time);
  steps.sort((a, b) => a - b);
  const median = steps[Math.floor(steps.length / 2)]!;
  let gaps = 0;
  for (const s of steps) {
    if (median > 0 && s > median * 2.5) gaps += 1;
  }
  return gaps;
}

export function buildAnalogueReferenceState(input: {
  manifest: MifResearchDatasetManifest;
  bars: readonly MifResearchStoredBar[];
  tipOpenTimeSec: number;
  lookbackBars?: number;
  warmupBars?: number;
  eligibilityMode?: MifAnalogueEligibilityMode;
  createdAt?: string;
}): BuildReferenceStateResult {
  const lookback = Math.min(
    MIF_ANALOGUE_MAX_LOOKBACK_BARS,
    Math.max(MIF_ANALOGUE_MIN_LOOKBACK_BARS, input.lookbackBars ?? MIF_ANALOGUE_DEFAULT_LOOKBACK_BARS),
  );
  const warmup = Math.max(0, input.warmupBars ?? MIF_ANALOGUE_DEFAULT_WARMUP_BARS);
  const tip = input.tipOpenTimeSec;

  if (!Number.isFinite(tip) || tip <= 0) {
    return { ok: false, code: "INVALID_TIP", message: "tipOpenTimeSec must be a positive unix second" };
  }

  const tipBar = input.bars.find((b) => b.time === tip);
  if (!tipBar) {
    return { ok: false, code: "TIP_NOT_FOUND", message: "tip candle not present in dataset bars" };
  }

  // P8.B — close-time visibility is the authoritative PIT gate (open-time alone is insufficient).
  const closedClip = clipResearchBarsClosedAtDecision({
    bars: input.bars,
    timeframe: input.manifest.timeframe,
    tipOpenTimeSec: tip,
  });
  if (!closedClip.ok) {
    return {
      ok: false,
      code: closedClip.code,
      message: closedClip.message,
    };
  }
  // Keep open-time assert as defense-in-depth on the already close-time-filtered set.
  const openClip = clipResearchBarsToTip(closedClip.bars, tip);
  if (!openClip.noFutureLeakage) {
    return { ok: false, code: "FUTURE_BARS_IN_WINDOW", message: "future bars leaked into reference clip" };
  }
  const clipped = { bars: closedClip.bars, noFutureLeakage: true as const };
  const assert = assertNoFutureBarsBeyondTip(clipped.bars, tip);
  if (!assert.ok) {
    return { ok: false, code: "FUTURE_BARS_IN_WINDOW", message: `leakCount=${assert.leakCount}` };
  }

  const need = lookback + warmup;
  if (clipped.bars.length < need) {
    return {
      ok: false,
      code: "INSUFFICIENT_HISTORY",
      message: `need ${need} CLOSED bars through tip; have ${clipped.bars.length}`,
    };
  }

  // Use only the trailing need bars (warmup + lookback ending at tip).
  const windowBars = clipped.bars.slice(clipped.bars.length - need);
  const features = extractAnalogueFeatures({
    barsThroughTip: windowBars,
    lookbackBars: lookback,
    warmupBars: warmup,
  });
  if (features.unavailableFeatures.includes("INSUFFICIENT_HISTORY")) {
    return { ok: false, code: "INSUFFICIENT_HISTORY", message: "feature extraction failed: insufficient history" };
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const eligibilityMode = input.eligibilityMode ?? "PRICE_ACTION";
  const pitWarnings: string[] = [];
  const costWarnings: string[] = [];
  if (input.manifest.researchEligibility?.metadataAuthority !== "HISTORICALLY_AUTHORITATIVE") {
    pitWarnings.push("METADATA_LIMITED: PIT sessions/specs are observation-only");
  }
  if (!input.manifest.researchEligibility?.suitableForCostAdjustedBacktest) {
    costWarnings.push("COST_INCOMPLETE: slippage/commission/swap unavailable for cost-adjusted use");
  }

  const gapCount = detectGaps(windowBars);
  const quality = {
    missingInWindow: 0,
    gapCount,
    insufficientHistory: false,
    notes: gapCount > 0 ? [`detected ${gapCount} possible gaps in reference window`] : ([] as string[]),
  };

  const identityPayload = {
    instrument: input.manifest.instrument,
    timeframe: input.manifest.timeframe,
    tipOpenTimeSec: tip,
    datasetId: input.manifest.datasetId,
    datasetVersion: input.manifest.version,
    contentHash: input.manifest.contentHash,
    lookbackBars: lookback,
    warmupBars: warmup,
    featureSetId: MIF_ANALOGUE_FEATURE_SET_ID,
    featureSetVersion: MIF_ANALOGUE_FEATURE_SET_VERSION,
    eligibilityMode,
    features: features.continuous.map((f) => ({ n: f.name, v: f.value, a: f.available })),
    cat: features.categorical.map((f) => ({ n: f.name, v: f.value, a: f.available })),
    contractVersion: MIF_ANALOGUE_CONTRACT_VERSION,
  };
  const referenceId = `ref:${createHash("sha256").update(stableSerialize(identityPayload)).digest("hex").slice(0, 24)}`;

  const reference: MifAnalogueReferenceState = {
    contractId: MIF_ANALOGUE_CONTRACT_ID,
    contractVersion: MIF_ANALOGUE_CONTRACT_VERSION,
    engineId: MIF_ANALOGUE_ENGINE_ID,
    engineVersion: MIF_ANALOGUE_ENGINE_VERSION,
    referenceId,
    createdAt,
    instrument: input.manifest.instrument,
    timeframe: input.manifest.timeframe,
    tipOpenTimeSec: tip,
    datasetId: input.manifest.datasetId,
    datasetVersion: input.manifest.version,
    contentHash: input.manifest.contentHash,
    lookbackBars: lookback,
    warmupBars: warmup,
    featureSetId: MIF_ANALOGUE_FEATURE_SET_ID,
    featureSetVersion: MIF_ANALOGUE_FEATURE_SET_VERSION,
    eligibilityMode,
    comparisonMode: "SAME_INSTRUMENT_SAME_TIMEFRAME",
    multiTimeframe: [],
    quality,
    pitWarnings,
    costWarnings,
    features,
    ...MIF_ANALOGUE_SAFETY,
  };

  return { ok: true, reference };
}
