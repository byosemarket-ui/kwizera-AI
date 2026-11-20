/**
 * Phase 5F STEP 2 — ForexAdmin Historical Analogue UI helpers (pure / testable).
 * Similarity is never treated as probability.
 */

export const ANALOGUE_SIMILARITY_LABEL = "Similarity score — NOT probability";

export const ANALOGUE_DOCUMENTED_LIMITATIONS = [
  "COMPLETE historical archives are recent/shallow relative to full market history.",
  "No COMPLETE M1 archive is currently available (STEP 1 report).",
  "INCOMPLETE datasets are excluded from the normal search corpus.",
  "Historical PIT metadata is limited; no historical session authority.",
  "Historical commission, swap, and slippage are unavailable or incomplete.",
  "Cost-adjusted backtesting is not supported by this evidence.",
  "PRICE_ACTION is the only supported v1 matching mode.",
  "STRUCTURE_REGIME and MULTI_TIMEFRAME matching are contracted but not implemented in v1 scoring.",
  "Similarity score is not probability, win rate, or a forecast.",
  "No ML, DTW, or STEP 3 probability calibration is included.",
] as const;

export type AnalogueEligibilityModeOption = {
  value: string;
  label: string;
  supportedForSearch: boolean;
  note: string;
};

/** Only PRICE_ACTION is supported for v1 matching; others are shown as unavailable. */
export const ANALOGUE_MODE_OPTIONS: readonly AnalogueEligibilityModeOption[] = [
  {
    value: "PRICE_ACTION",
    label: "PRICE_ACTION (v1 supported)",
    supportedForSearch: true,
    note: "Candle/return/volatility/momentum similarity",
  },
  {
    value: "STRUCTURE_REGIME",
    label: "STRUCTURE_REGIME (not in v1 matching)",
    supportedForSearch: false,
    note: "Contracted; structure features not scored in v1",
  },
  {
    value: "MULTI_TIMEFRAME",
    label: "MULTI_TIMEFRAME (not in v1 matching)",
    supportedForSearch: false,
    note: "Contracted; cross-TF rejected by default",
  },
  {
    value: "HISTORICAL_OUTCOME",
    label: "HISTORICAL_OUTCOME (post-match only)",
    supportedForSearch: false,
    note: "Outcomes attach after ranking; not a matching feature mode in v1 UI",
  },
] as const;

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function shortId(id: unknown, n = 14): string {
  const s = String(id ?? "");
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

export function formatUnixSec(sec: unknown): string {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "—";
  try {
    return new Date(n * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return String(sec);
  }
}

export function formatScore(score: unknown): string {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function formatPct(n: unknown, digits = 2): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function validateAnalogueReferenceInput(input: {
  datasetId: string;
  tipOpenTimeSec: string | number;
  lookbackBars: string | number;
  warmupBars: string | number;
  eligibilityMode: string;
}): { ok: true } | { ok: false; message: string } {
  const datasetId = String(input.datasetId || "").trim();
  if (!datasetId) return { ok: false, message: "Select a COMPLETE research dataset." };
  const tip = Number(input.tipOpenTimeSec);
  if (!Number.isFinite(tip) || tip <= 0) {
    return { ok: false, message: "Reference tip must be a positive unix open-time (CLOSED candle)." };
  }
  const lookback = Number(input.lookbackBars);
  const warmup = Number(input.warmupBars);
  if (!Number.isFinite(lookback) || lookback < 8 || lookback > 128) {
    return { ok: false, message: "Lookback must be between 8 and 128." };
  }
  if (!Number.isFinite(warmup) || warmup < 0 || warmup > 200) {
    return { ok: false, message: "Warmup must be between 0 and 200." };
  }
  const mode = ANALOGUE_MODE_OPTIONS.find((m) => m.value === input.eligibilityMode);
  if (!mode?.supportedForSearch) {
    return {
      ok: false,
      message: "Only PRICE_ACTION is supported for v1 reference/search matching.",
    };
  }
  return { ok: true };
}

export function similarityNeverProbabilityCopy(score: unknown): string {
  return `${ANALOGUE_SIMILARITY_LABEL}: ${formatScore(score)} / 100`;
}

export function summarizeCoverage(summary: Record<string, unknown> | null): {
  cells: number;
  archived: number;
  complete: number;
  eligible: number;
  registry: number;
} {
  const s = summary ?? {};
  return {
    cells: Number(s.cells ?? 0) || 0,
    archived: Number(s.archivedCells ?? 0) || 0,
    complete: Number(s.completeCells ?? 0) || 0,
    eligible: Number(s.researchEligibleCells ?? 0) || 0,
    registry: Number(s.registryDatasets ?? 0) || 0,
  };
}

export function partitionDatasets(datasets: Array<Record<string, unknown>>): {
  complete: Array<Record<string, unknown>>;
  incomplete: Array<Record<string, unknown>>;
} {
  const complete: Array<Record<string, unknown>> = [];
  const incomplete: Array<Record<string, unknown>> = [];
  for (const d of datasets) {
    if (String(d.status ?? "") === "COMPLETE" && d.suitableForCandleResearch === true) {
      complete.push(d);
    } else {
      incomplete.push(d);
    }
  }
  return { complete, incomplete };
}
