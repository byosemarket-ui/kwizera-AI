/**
 * Phase 3.1 — strict confidence scale detection and validation (no silent clamp).
 *
 * Scale rules:
 * - 0 → 0
 * - (0, 1] → fractional scale → percentage via ×100
 * - (1, 100] → already percentage
 * - <0, >100, NaN, Infinity → reject
 */
export type ConfidenceNormalizeOk = { ok: true; confidence: number; scale: "zero" | "fraction" | "percent" };
export type ConfidenceNormalizeErr = { ok: false; error: string };

export function normalizeHfmReasoningConfidence(raw: unknown): ConfidenceNormalizeOk | ConfidenceNormalizeErr {
  if (raw === null || raw === undefined) {
    return { ok: false, error: "confidence missing" };
  }
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string") {
    const t = raw.replace(/%/g, "").trim();
    if (!t) return { ok: false, error: "confidence empty" };
    n = Number(t);
  } else {
    return { ok: false, error: "confidence type invalid" };
  }
  if (!Number.isFinite(n)) {
    return { ok: false, error: "confidence not finite" };
  }
  if (n < 0) {
    return { ok: false, error: "confidence negative" };
  }
  if (n === 0) {
    return { ok: true, confidence: 0, scale: "zero" };
  }
  if (n > 0 && n <= 1) {
    const pct = Math.round(n * 100);
    if (pct < 0 || pct > 100) return { ok: false, error: "confidence fraction out of range" };
    return { ok: true, confidence: pct, scale: "fraction" };
  }
  if (n > 1 && n <= 100) {
    const pct = Math.round(n);
    if (pct < 0 || pct > 100) return { ok: false, error: "confidence percent out of range" };
    return { ok: true, confidence: pct, scale: "percent" };
  }
  return { ok: false, error: "confidence above 100" };
}
