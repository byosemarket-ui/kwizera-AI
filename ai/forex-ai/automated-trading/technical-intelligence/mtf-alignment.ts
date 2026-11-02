/**
 * Phase 4.18F.4 — Deterministic multi-timeframe alignment engine.
 * Higher-timeframe context is explicit; majority vote alone is never enough.
 * Analysis-only: placesOrders/mutatesBroker remain false.
 */

export const MTF_ALIGNMENT_SCHEMA = "kwizera.mtf-alignment.v1" as const;
export const MTF_ALIGNMENT_VERSION = "mtf-alignment.v1" as const;

/** Supported AT MTF ladder (W1 optional / not required). */
export const MTF_ALIGNMENT_LADDER = [
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
] as const;

export type MtfLadderId = (typeof MTF_ALIGNMENT_LADDER)[number];

export type MtfTrendBias = "BULLISH" | "BEARISH" | "RANGING" | "MIXED" | "NEUTRAL" | "UNKNOWN";

export type MtfAlignmentClass =
  | "FULL_BULLISH_ALIGNMENT"
  | "FULL_BEARISH_ALIGNMENT"
  | "PARTIAL_BULLISH_ALIGNMENT"
  | "PARTIAL_BEARISH_ALIGNMENT"
  | "MIXED_ALIGNMENT"
  | "TIMEFRAME_CONFLICT"
  | "INSUFFICIENT_TIMEFRAME_DATA"
  | "STALE_TIMEFRAME_DATA";

/** Legacy reconciler agreement codes (preserved). */
export type LegacyMtfAgreement =
  | "AGREE_BULLISH"
  | "AGREE_BEARISH"
  | "CONFLICT"
  | "INSUFFICIENT"
  | "UNKNOWN";

export type TimeframeMatrixStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "STALE"
  | "INSUFFICIENT_DATA"
  | "CONFLICT"
  | "NOT_VERIFIED";

export interface MtfTimeframeInput {
  timeframe: string;
  bias: MtfTrendBias | string | null;
  sma9?: number | null;
  sma21?: number | null;
  atr?: number | null;
  atrMethod?: "SMA_OF_TR" | string | null;
  structureTrend?: string | null;
  closedBars?: number | null;
  lastCandleSec?: number | null;
  available?: boolean;
  stale?: boolean;
  insufficient?: boolean;
  qualityNote?: string | null;
}

export interface TimeframeMatrixRow {
  timeframe: string;
  trend: MtfTrendBias;
  sma9: number | null;
  sma21: number | null;
  atr: number | null;
  atrMethod: string | null;
  structure: string | null;
  freshness: "FRESH" | "STALE" | "UNKNOWN";
  quality: TimeframeMatrixStatus;
  closedBars: number | null;
  lastCandleSec: number | null;
  note: string | null;
}

export interface MtfPairComparison {
  lower: string;
  higher: string;
  lowerBias: MtfTrendBias;
  higherBias: MtfTrendBias;
  relation:
    | "AGREE_BULLISH"
    | "AGREE_BEARISH"
    | "BOTH_RANGING"
    | "CONFLICT"
    | "INCONCLUSIVE"
    | "MISSING_LOWER"
    | "MISSING_HIGHER";
  note: string;
}

export interface MtfAlignmentResult {
  schemaVersion: typeof MTF_ALIGNMENT_SCHEMA;
  alignmentVersion: typeof MTF_ALIGNMENT_VERSION;
  instrument: string;
  primaryTimeframe: string;
  calculatedAtMs: number;
  classification: MtfAlignmentClass;
  /** Mapped for canonical reconciler HTF rule. */
  legacyAgreement: LegacyMtfAgreement;
  higherTimeframeBias: MtfTrendBias;
  lowerTimeframeBias: MtfTrendBias;
  agreeingTimeframes: string[];
  disagreeingTimeframes: string[];
  unavailableTimeframes: string[];
  staleTimeframes: string[];
  insufficientTimeframes: string[];
  pairwise: MtfPairComparison[];
  matrix: TimeframeMatrixRow[];
  explanations: string[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

const PAIRS: Array<[MtfLadderId, MtfLadderId]> = [
  ["5m", "15m"],
  ["15m", "30m"],
  ["30m", "1h"],
  ["1h", "4h"],
  ["4h", "1d"],
];

const HIGHER: MtfLadderId[] = ["1h", "4h", "1d"];
const LOWER: MtfLadderId[] = ["5m", "15m", "30m"];

function normBias(raw: string | null | undefined): MtfTrendBias {
  const s = String(raw ?? "UNKNOWN").toUpperCase();
  if (s === "BULLISH") return "BULLISH";
  if (s === "BEARISH") return "BEARISH";
  if (s === "RANGING" || s === "RANGE") return "RANGING";
  if (s === "MIXED") return "MIXED";
  if (s === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function directional(b: MtfTrendBias): b is "BULLISH" | "BEARISH" {
  return b === "BULLISH" || b === "BEARISH";
}

function rowStatus(input: MtfTimeframeInput | undefined): TimeframeMatrixStatus {
  if (!input || input.available === false) return "UNAVAILABLE";
  if (input.stale) return "STALE";
  if (input.insufficient || (input.closedBars != null && input.closedBars < 21)) {
    return "INSUFFICIENT_DATA";
  }
  if (input.available === true || (input.closedBars != null && input.closedBars > 0)) {
    return "AVAILABLE";
  }
  return "NOT_VERIFIED";
}

function toMatrixRow(tf: string, input: MtfTimeframeInput | undefined): TimeframeMatrixRow {
  const quality = rowStatus(input);
  const bias = normBias(input?.bias);
  return {
    timeframe: tf,
    trend: bias,
    sma9: input?.sma9 ?? null,
    sma21: input?.sma21 ?? null,
    atr: input?.atr ?? null,
    atrMethod: input?.atrMethod ?? (input?.atr != null ? "SMA_OF_TR" : null),
    structure: input?.structureTrend ?? null,
    freshness: input?.stale ? "STALE" : input ? "FRESH" : "UNKNOWN",
    quality,
    closedBars: input?.closedBars ?? null,
    lastCandleSec: input?.lastCandleSec ?? null,
    note: input?.qualityNote ?? null,
  };
}

function comparePair(
  lower: MtfLadderId,
  higher: MtfLadderId,
  byTf: Map<string, MtfTimeframeInput>,
): MtfPairComparison {
  const lo = byTf.get(lower);
  const hi = byTf.get(higher);
  const lowerBias = normBias(lo?.bias);
  const higherBias = normBias(hi?.bias);
  if (!lo || lo.available === false || rowStatus(lo) === "UNAVAILABLE") {
    return {
      lower,
      higher,
      lowerBias,
      higherBias,
      relation: "MISSING_LOWER",
      note: `${lower} unavailable for pair vs ${higher}`,
    };
  }
  if (!hi || hi.available === false || rowStatus(hi) === "UNAVAILABLE") {
    return {
      lower,
      higher,
      lowerBias,
      higherBias,
      relation: "MISSING_HIGHER",
      note: `${higher} unavailable for pair vs ${lower}`,
    };
  }
  if (rowStatus(lo) === "INSUFFICIENT_DATA" || rowStatus(hi) === "INSUFFICIENT_DATA") {
    return {
      lower,
      higher,
      lowerBias,
      higherBias,
      relation: "INCONCLUSIVE",
      note: `Insufficient history on ${lower} or ${higher}`,
    };
  }
  if (directional(lowerBias) && directional(higherBias)) {
    if (lowerBias === higherBias) {
      return {
        lower,
        higher,
        lowerBias,
        higherBias,
        relation: lowerBias === "BULLISH" ? "AGREE_BULLISH" : "AGREE_BEARISH",
        note: `${lower} and ${higher} both ${lowerBias}`,
      };
    }
    return {
      lower,
      higher,
      lowerBias,
      higherBias,
      relation: "CONFLICT",
      note: `${lower}=${lowerBias} conflicts with ${higher}=${higherBias}`,
    };
  }
  if (lowerBias === "RANGING" && higherBias === "RANGING") {
    return {
      lower,
      higher,
      lowerBias,
      higherBias,
      relation: "BOTH_RANGING",
      note: `${lower} and ${higher} ranging`,
    };
  }
  return {
    lower,
    higher,
    lowerBias,
    higherBias,
    relation: "INCONCLUSIVE",
    note: `${lower}=${lowerBias}, ${higher}=${higherBias} — not a hard conflict`,
  };
}

function consensus(biases: MtfTrendBias[]): MtfTrendBias {
  const dirs = biases.filter(directional);
  if (!dirs.length) {
    if (biases.every((b) => b === "RANGING")) return "RANGING";
    return "UNKNOWN";
  }
  const bulls = dirs.filter((d) => d === "BULLISH").length;
  const bears = dirs.filter((d) => d === "BEARISH").length;
  if (bulls > 0 && bears > 0) return "MIXED";
  if (bulls > 0) return "BULLISH";
  if (bears > 0) return "BEARISH";
  return "UNKNOWN";
}

/**
 * Compute MTF alignment. Missing HTF ≠ conflict.
 * Hard conflict requires opposing directional biases across the ladder
 * (especially lower vs higher), not a simple majority vote.
 */
export function computeMtfAlignment(input: {
  instrument: string;
  primaryTimeframe: string;
  timeframes: MtfTimeframeInput[];
  nowMs?: number;
}): MtfAlignmentResult {
  const nowMs = input.nowMs ?? Date.now();
  const byTf = new Map<string, MtfTimeframeInput>();
  for (const row of input.timeframes) {
    byTf.set(String(row.timeframe), row);
  }

  const matrix = MTF_ALIGNMENT_LADDER.map((tf) => toMatrixRow(tf, byTf.get(tf)));
  const pairwise = PAIRS.map(([lo, hi]) => comparePair(lo, hi, byTf));

  const unavailableTimeframes = matrix.filter((m) => m.quality === "UNAVAILABLE").map((m) => m.timeframe);
  const staleTimeframes = matrix.filter((m) => m.quality === "STALE").map((m) => m.timeframe);
  const insufficientTimeframes = matrix
    .filter((m) => m.quality === "INSUFFICIENT_DATA")
    .map((m) => m.timeframe);

  const explanations: string[] = [];
  for (const p of pairwise) {
    if (p.relation === "CONFLICT" || p.relation.startsWith("AGREE") || p.relation === "BOTH_RANGING") {
      explanations.push(p.note);
    }
  }

  const lowerAvail = LOWER.map((tf) => byTf.get(tf)).filter(
    (r): r is MtfTimeframeInput => Boolean(r) && rowStatus(r) === "AVAILABLE",
  );
  const higherAvail = HIGHER.map((tf) => byTf.get(tf)).filter(
    (r): r is MtfTimeframeInput => Boolean(r) && rowStatus(r) === "AVAILABLE",
  );
  const lowerTimeframeBias = consensus(lowerAvail.map((r) => normBias(r.bias)));
  const higherTimeframeBias = consensus(higherAvail.map((r) => normBias(r.bias)));

  const hardConflicts = pairwise.filter((p) => p.relation === "CONFLICT");
  const agreeBull = pairwise.filter((p) => p.relation === "AGREE_BULLISH");
  const agreeBear = pairwise.filter((p) => p.relation === "AGREE_BEARISH");

  const availableDirectional = matrix.filter(
    (m) => m.quality === "AVAILABLE" && directional(m.trend),
  );
  const agreeingTimeframes: string[] = [];
  const disagreeingTimeframes: string[] = [];

  if (directional(higherTimeframeBias)) {
    for (const m of availableDirectional) {
      if (m.trend === higherTimeframeBias) agreeingTimeframes.push(m.timeframe);
      else if (directional(m.trend) && m.trend !== higherTimeframeBias) {
        disagreeingTimeframes.push(m.timeframe);
      }
    }
  }

  let classification: MtfAlignmentClass;
  if (staleTimeframes.length > 0 && availableDirectional.length === 0) {
    classification = "STALE_TIMEFRAME_DATA";
    explanations.push("All directional timeframes stale or absent.");
  } else if (higherAvail.length === 0 || availableDirectional.length < 2) {
    // Missing HTF is never treated as TIMEFRAME_CONFLICT.
    classification = "INSUFFICIENT_TIMEFRAME_DATA";
    explanations.push(
      higherAvail.length === 0
        ? "Higher-timeframe context unavailable — insufficient for alignment (not a conflict)."
        : "Fewer than two usable directional timeframes.",
    );
  } else if (hardConflicts.length > 0) {
    // Only escalate to conflict when lower vs higher (or adjacent ladder) actually oppose.
    const lowerVsHigherConflict =
      directional(lowerTimeframeBias)
      && directional(higherTimeframeBias)
      && lowerTimeframeBias !== higherTimeframeBias;
    const adjacentHard = hardConflicts.some(
      (p) =>
        (LOWER.includes(p.lower as MtfLadderId) && HIGHER.includes(p.higher as MtfLadderId))
        || PAIRS.some(([a, b]) => a === p.lower && b === p.higher),
    );
    if (lowerVsHigherConflict || adjacentHard) {
      classification = "TIMEFRAME_CONFLICT";
      explanations.push("Documented directional conflict across MTF ladder (not majority vote).");
    } else {
      classification = "MIXED_ALIGNMENT";
      explanations.push("Some adjacent pairs conflict without clear HTF opposition.");
    }
  } else if (
    directional(higherTimeframeBias)
    && agreeBull.length + agreeBear.length >= 3
    && disagreeingTimeframes.length === 0
    && (
      (higherTimeframeBias === "BULLISH" && agreeBear.length === 0)
      || (higherTimeframeBias === "BEARISH" && agreeBull.length === 0)
    )
  ) {
    classification =
      higherTimeframeBias === "BULLISH" ? "FULL_BULLISH_ALIGNMENT" : "FULL_BEARISH_ALIGNMENT";
    explanations.push(`Full ${higherTimeframeBias.toLowerCase()} alignment across compared pairs.`);
  } else if (
    directional(higherTimeframeBias)
    && (
      (higherTimeframeBias === "BULLISH" && (agreeBull.length > 0 || lowerTimeframeBias === "BULLISH"))
      || (higherTimeframeBias === "BEARISH" && (agreeBear.length > 0 || lowerTimeframeBias === "BEARISH"))
    )
    && !lowerVsHigherConflictSafe(lowerTimeframeBias, higherTimeframeBias)
  ) {
    classification =
      higherTimeframeBias === "BULLISH"
        ? "PARTIAL_BULLISH_ALIGNMENT"
        : "PARTIAL_BEARISH_ALIGNMENT";
    explanations.push(`Partial ${higherTimeframeBias.toLowerCase()} alignment; HTF supports bias.`);
  } else if (staleTimeframes.length > 0) {
    classification = "STALE_TIMEFRAME_DATA";
    explanations.push(`Stale timeframes: ${staleTimeframes.join(", ")}`);
  } else {
    classification = "MIXED_ALIGNMENT";
    explanations.push("No clear full/partial alignment and no hard HTF conflict.");
  }

  const legacyAgreement = toLegacyAgreement(classification, higherTimeframeBias);

  return {
    schemaVersion: MTF_ALIGNMENT_SCHEMA,
    alignmentVersion: MTF_ALIGNMENT_VERSION,
    instrument: input.instrument,
    primaryTimeframe: input.primaryTimeframe,
    calculatedAtMs: nowMs,
    classification,
    legacyAgreement,
    higherTimeframeBias,
    lowerTimeframeBias,
    agreeingTimeframes: [...new Set(agreeingTimeframes)],
    disagreeingTimeframes: [...new Set(disagreeingTimeframes)],
    unavailableTimeframes,
    staleTimeframes,
    insufficientTimeframes,
    pairwise,
    matrix,
    explanations: explanations.slice(0, 24),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

function lowerVsHigherConflictSafe(lo: MtfTrendBias, hi: MtfTrendBias): boolean {
  return directional(lo) && directional(hi) && lo !== hi;
}

export function toLegacyAgreement(
  classification: MtfAlignmentClass,
  higherBias: MtfTrendBias,
): LegacyMtfAgreement {
  switch (classification) {
    case "FULL_BULLISH_ALIGNMENT":
    case "PARTIAL_BULLISH_ALIGNMENT":
      return "AGREE_BULLISH";
    case "FULL_BEARISH_ALIGNMENT":
    case "PARTIAL_BEARISH_ALIGNMENT":
      return "AGREE_BEARISH";
    case "TIMEFRAME_CONFLICT":
      return "CONFLICT";
    case "INSUFFICIENT_TIMEFRAME_DATA":
      return "INSUFFICIENT";
    case "STALE_TIMEFRAME_DATA":
      return "UNKNOWN";
    case "MIXED_ALIGNMENT":
      return directional(higherBias)
        ? (higherBias === "BULLISH" ? "UNKNOWN" : "UNKNOWN")
        : "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}
