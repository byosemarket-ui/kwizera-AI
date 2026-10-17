/**
 * Phase 49C — Multi-timeframe roster and reasoning helpers (deterministic).
 * Does not invent missing screenshots or candles.
 */
import type { MultiImageCaptureRef, MultiImageMtfReasoning, MultiImageMtfRoster } from "./types.js";

/** Ascending duration order for supported capture timeframes. */
const TF_RANK: Record<string, number> = {
  "1m": 1,
  "5m": 2,
  "15m": 3,
  "30m": 4,
  "1h": 5,
  "4h": 6,
  "1d": 7,
  "1w": 8,
};

export type MtfRole = "higher" | "intermediate" | "lower" | "only";

export function timeframeRank(tf: string): number {
  const key = String(tf ?? "").trim().toLowerCase();
  return TF_RANK[key] ?? 50;
}

export function compareTimeframesAsc(a: string, b: string): number {
  const ra = timeframeRank(a);
  const rb = timeframeRank(b);
  if (ra !== rb) return ra - rb;
  return String(a).localeCompare(String(b));
}

export function buildMtfRoster(captures: MultiImageCaptureRef[]): MultiImageMtfRoster {
  const byTf = new Map<string, MultiImageCaptureRef[]>();
  for (const c of captures) {
    const tf = String(c.timeframe ?? "").trim() || "unknown";
    const list = byTf.get(tf) ?? [];
    list.push(c);
    byTf.set(tf, list);
  }

  const distinct = [...byTf.keys()].sort(compareTimeframesAsc);
  const sameTimeframeDuplicates = [...byTf.values()].some((list) => list.length > 1);

  let earliestMs = Number.POSITIVE_INFINITY;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const c of captures) {
    const ms = Date.parse(c.capturedAtUtc);
    if (!Number.isFinite(ms)) continue;
    earliestMs = Math.min(earliestMs, ms);
    latestMs = Math.max(latestMs, ms);
  }
  const captureSpanMs =
    Number.isFinite(earliestMs) && Number.isFinite(latestMs) && latestMs >= earliestMs
      ? latestMs - earliestMs
      : null;

  const roles: MultiImageMtfRoster["roles"] = distinct.map((tf) => {
    const list = byTf.get(tf) ?? [];
    let role: MtfRole = "only";
    if (distinct.length === 1) role = "only";
    else if (tf === distinct[distinct.length - 1]) role = "higher";
    else if (tf === distinct[0]) role = "lower";
    else role = "intermediate";

    const times = list
      .map((c) => Date.parse(c.capturedAtUtc))
      .filter((ms) => Number.isFinite(ms))
      .sort((a, b) => a - b);

    return {
      timeframe: tf,
      role,
      captureIds: list.map((c) => c.captureId),
      imageCount: list.length,
      earliestCapturedAtUtc: times.length
        ? new Date(times[0]!).toISOString()
        : list[0]?.capturedAtUtc ?? null,
      latestCapturedAtUtc: times.length
        ? new Date(times[times.length - 1]!).toISOString()
        : list[0]?.capturedAtUtc ?? null,
      note:
        list.length > 1
          ? `${list.length} images share timeframe ${tf} — not independent multi-timeframe confirmation.`
          : null,
    };
  });

  return {
    distinctTimeframes: distinct,
    sameTimeframeDuplicates,
    captureSpanMs,
    roles,
    note:
      distinct.length <= 1
        ? "Selection does not include multiple distinct timeframes. Do not invent missing timeframe evidence."
        : `Selection spans ${distinct.length} timeframes (${distinct.join(", ")}). Higher = longer duration.`,
  };
}

const AGREEMENT_VALUES = new Set([
  "ALIGNED",
  "MIXED",
  "CONFLICTING",
  "SINGLE_TIMEFRAME",
  "INSUFFICIENT",
]);

function asString(value: unknown, max = 1200): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function asStringArray(value: unknown, maxItems = 12, maxLen = 400): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = asString(item, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Parse optional mtfReasoning object from the model JSON without inventing content.
 */
export function parseMtfReasoningFromModel(
  raw: unknown,
  roster: MultiImageMtfRoster,
): MultiImageMtfReasoning {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const block = root.mtfReasoning && typeof root.mtfReasoning === "object"
    ? root.mtfReasoning as Record<string, unknown>
    : root;

  let agreement = asString(block.timeframeAgreement, 40)?.toUpperCase() ?? null;
  if (agreement && !AGREEMENT_VALUES.has(agreement)) agreement = null;
  if (!agreement) {
    agreement = roster.distinctTimeframes.length <= 1 ? "SINGLE_TIMEFRAME" : "INSUFFICIENT";
  }

  const keyLevelsRaw = Array.isArray(block.keyLevels) ? block.keyLevels : [];
  const keyLevels: MultiImageMtfReasoning["keyLevels"] = [];
  for (const row of keyLevelsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const level = asString(r.level, 120);
    if (!level) continue;
    const provRaw = asString(r.provenance, 40)?.toUpperCase() ?? "UNKNOWN";
    const provenance =
      provRaw === "VISIBLE_IN_IMAGE"
      || provRaw === "CONFIRMED_BY_DATA"
      || provRaw === "INFERENCE"
      || provRaw === "UNKNOWN"
        ? provRaw
        : "UNKNOWN";
    keyLevels.push({
      level,
      provenance,
      captureId: asString(r.captureId, 80),
      timeframe: asString(r.timeframe, 16),
    });
    if (keyLevels.length >= 12) break;
  }

  return {
    roster,
    timeframeAgreement: agreement as MultiImageMtfReasoning["timeframeAgreement"],
    higherTimeframeContext: asString(block.higherTimeframeContext),
    intermediateStructure: asString(block.intermediateStructure),
    lowerTimeframeSetup: asString(block.lowerTimeframeSetup),
    agreementSummary: asString(block.agreementSummary),
    conflictSummary: asString(block.conflictSummary),
    bullishScenario: asString(block.bullishScenario),
    bearishScenario: asString(block.bearishScenario),
    keyLevels,
    confirmationConditions: asStringArray(block.confirmationConditions),
    invalidationConditions: asStringArray(block.invalidationConditions),
    missingEvidence: asStringArray(block.missingEvidence),
  };
}

/**
 * Soft policy (Phase 50A): only material MTF CONFLICT forces WAIT on BUY/SELL.
 * INSUFFICIENT alone must not automatically block a defensible BUY — bullish-score policy handles weak evidence.
 */
export function shouldForceWaitForMtf(
  decision: string,
  mtf: MultiImageMtfReasoning,
): boolean {
  const d = String(decision ?? "").toUpperCase();
  if (d !== "BUY" && d !== "SELL") return false;
  return mtf.timeframeAgreement === "CONFLICTING";
}

export function formatMtfRosterForPrompt(roster: MultiImageMtfRoster): string {
  const lines = [
    "MTF_ROSTER (deterministic from capture metadata — do not invent missing timeframes):",
    roster.note,
    `distinctTimeframes=${roster.distinctTimeframes.join(",") || "none"}`,
    `sameTimeframeDuplicates=${roster.sameTimeframeDuplicates}`,
    `captureSpanMs=${roster.captureSpanMs ?? "null"}`,
  ];
  for (const role of roster.roles) {
    lines.push(
      `role=${role.role} tf=${role.timeframe} images=${role.imageCount} `
      + `captureIds=${role.captureIds.join(",")} `
      + `from=${role.earliestCapturedAtUtc ?? "null"} to=${role.latestCapturedAtUtc ?? "null"}`
      + (role.note ? ` note=${role.note}` : ""),
    );
  }
  return lines.join("\n");
}
