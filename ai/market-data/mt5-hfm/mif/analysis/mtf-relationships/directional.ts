/**
 * Phase 5C Step 3 — directional multi-timeframe relationships.
 * Preserves disagreement; no majority-vote-only resolution.
 */
import type {
  MifMtfBandSummary,
  MifMtfDirectionalAnalysis,
  MifMtfDirectionalRelation,
  MifMtfDirection,
  MifMtfNormalizedContext,
  MifMtfRelationshipsPolicy,
} from "./types.js";

function opposite(a: MifMtfDirection, b: MifMtfDirection): boolean {
  return (a === "UP" && b === "DOWN") || (a === "DOWN" && b === "UP");
}

function knownDirectional(d: MifMtfDirection): d is "UP" | "DOWN" {
  return d === "UP" || d === "DOWN";
}

/**
 * Classify directional relationship across higher / intermediate / lower bands.
 *
 * Rules (deterministic, versioned by policy weights used only for optional score):
 * - All known bands same direction → ALIGNMENT
 * - Some agree, some unknown/neutral → PARTIAL_ALIGNMENT
 * - Higher vs lower opposite + intermediate agrees with higher OR transition → COUNTERTREND_PULLBACK
 * - Higher vs lower opposite + intermediate agrees with lower or TRANSITION structures → POTENTIAL_REVERSAL candidate
 * - Intermediate TRANSITION / UNSTABLE → TRANSITION
 * - Direct opposition without pullback markers → CONFLICT
 * - Insufficient known directions → INSUFFICIENT_DATA / UNKNOWN
 */
export function analyzeDirectionalRelationships(input: {
  higher: MifMtfBandSummary;
  intermediate: MifMtfBandSummary;
  lower: MifMtfBandSummary;
  contexts: readonly MifMtfNormalizedContext[];
  policy: MifMtfRelationshipsPolicy;
}): MifMtfDirectionalAnalysis {
  void input.policy;
  const h = input.higher.consensusDirection;
  const i = input.intermediate.consensusDirection;
  const l = input.lower.consensusDirection;

  const supporting: string[] = [];
  const opposing: string[] = [];
  for (const c of input.contexts) {
    if (!c.available || !knownDirectional(c.direction)) continue;
    if (knownDirectional(h) && c.direction === h) supporting.push(c.timeframe);
    else if (knownDirectional(h) && opposite(c.direction, h)) opposing.push(c.timeframe);
  }

  const known = [h, i, l].filter(knownDirectional);
  if (known.length === 0) {
    return {
      relation: input.higher.agreement === "INSUFFICIENT"
        && input.intermediate.agreement === "INSUFFICIENT"
        && input.lower.agreement === "INSUFFICIENT"
        ? "INSUFFICIENT_DATA"
        : "UNKNOWN",
      higherDirection: h,
      intermediateDirection: i,
      lowerDirection: l,
      explanation: "insufficient directional evidence across bands",
      supportingTimeframes: supporting,
      opposingTimeframes: opposing,
    };
  }

  const structures = input.contexts
    .filter((c) => c.available)
    .map((c) => c.structure);
  const hasTransitionStruct = structures.some((s) => s === "TRANSITION" || s === "UNSTABLE");
  const higherTrending = input.contexts.some(
    (c) => c.band === "HIGHER" && c.structure === "TRENDING" && knownDirectional(c.direction),
  );
  const lowerOppositeOfHigher = knownDirectional(h) && knownDirectional(l) && opposite(h, l);
  const intermediateAgreesHigher = knownDirectional(i) && knownDirectional(h) && i === h;
  const intermediateAgreesLower = knownDirectional(i) && knownDirectional(l) && i === l;
  const intermediateNeutralOrUnknown = i === "NEUTRAL" || i === "UNKNOWN";

  let relation: MifMtfDirectionalRelation = "UNKNOWN";
  let explanation = "";

  if (
    knownDirectional(h)
    && (!knownDirectional(i) || i === h)
    && (!knownDirectional(l) || l === h)
    && !(knownDirectional(i) && knownDirectional(l) && opposite(i, l))
  ) {
    const allKnownSame =
      [h, i, l].filter(knownDirectional).every((d) => d === h);
    relation = allKnownSame && known.length >= 2 ? "ALIGNMENT" : "PARTIAL_ALIGNMENT";
    explanation =
      relation === "ALIGNMENT"
        ? `directional alignment ${h} across available bands`
        : `partial alignment toward ${h}; some bands unknown/neutral`;
  } else if (lowerOppositeOfHigher && higherTrending && (intermediateAgreesHigher || intermediateNeutralOrUnknown)) {
    relation = "COUNTERTREND_PULLBACK";
    explanation =
      `higher ${h} with lower ${l} against trend`
      + (intermediateAgreesHigher ? "; intermediate still agrees with higher (pullback-compatible)" : "; intermediate inconclusive");
  } else if (
    lowerOppositeOfHigher
    && (intermediateAgreesLower || hasTransitionStruct || input.intermediate.consensusStructure === "TRANSITION")
  ) {
    relation = "POTENTIAL_REVERSAL";
    explanation =
      `higher ${h} opposed by lower ${l} with intermediate/transition evidence suggesting possible reversal development — not confirmed`;
  } else if (hasTransitionStruct || input.intermediate.agreement === "CONFLICT") {
    relation = "TRANSITION";
    explanation = "transition/unstable structure or intermediate conflict across timeframes";
  } else if (
    (knownDirectional(h) && knownDirectional(l) && opposite(h, l))
    || (knownDirectional(h) && knownDirectional(i) && opposite(h, i))
    || (knownDirectional(i) && knownDirectional(l) && opposite(i, l))
  ) {
    relation = "CONFLICT";
    explanation = `directional conflict H=${h} I=${i} L=${l} — preserved, not majority-voted away`;
  } else if (known.length === 1) {
    relation = "PARTIAL_ALIGNMENT";
    explanation = `only one band has known direction (${known[0]})`;
  } else {
    relation = "PARTIAL_ALIGNMENT";
    explanation = `mixed/partial directional evidence H=${h} I=${i} L=${l}`;
  }

  return {
    relation,
    higherDirection: h,
    intermediateDirection: i,
    lowerDirection: l,
    explanation,
    supportingTimeframes: supporting,
    opposingTimeframes: opposing,
  };
}

/**
 * Alignment score definition (versioned):
 * score = Σ (bandWeight * bandAgreement) / Σ weights_for_present_bands
 * bandAgreement: AGREE=1, PARTIAL=0.5, CONFLICT=0, INSUFFICIENT=excluded
 * NOT a trade win probability.
 */
export function computeAlignmentScore(input: {
  higher: MifMtfBandSummary;
  intermediate: MifMtfBandSummary;
  lower: MifMtfBandSummary;
  policy: MifMtfRelationshipsPolicy;
}): { score: number | null; definition: string } {
  const definition =
    "alignmentScore = weighted mean of band agreement (AGREE=1, PARTIAL=0.5, CONFLICT=0); "
    + "INSUFFICIENT bands excluded; weights from policy; NOT a trade probability";

  const rows: Array<{ w: number; v: number }> = [];
  const map = (agreement: MifMtfBandSummary["agreement"]): number | null => {
    if (agreement === "AGREE") return 1;
    if (agreement === "PARTIAL") return 0.5;
    if (agreement === "CONFLICT") return 0;
    return null;
  };
  const hv = map(input.higher.agreement);
  const iv = map(input.intermediate.agreement);
  const lv = map(input.lower.agreement);
  if (hv != null && input.higher.timeframesPresent.length) rows.push({ w: input.policy.weightHigher, v: hv });
  if (iv != null && input.intermediate.timeframesPresent.length) {
    rows.push({ w: input.policy.weightIntermediate, v: iv });
  }
  if (lv != null && input.lower.timeframesPresent.length) rows.push({ w: input.policy.weightLower, v: lv });
  if (!rows.length) return { score: null, definition };
  const wSum = rows.reduce((a, r) => a + r.w, 0);
  if (!(wSum > 0)) return { score: null, definition };
  const score = rows.reduce((a, r) => a + r.w * r.v, 0) / wSum;
  return { score: Math.max(0, Math.min(1, score)), definition };
}
