/**
 * Phase 60.0.5 — never coerce null/undefined/"" into a verified numeric zero.
 * Number(null) === 0 in JS; that must not invent amounts or P/L.
 */
export function safeFiniteNumber(n: unknown): number | null {
  if (n == null || n === "") return null;
  if (typeof n === "number") return Number.isFinite(n) ? n : null;
  if (typeof n === "bigint") {
    const v = Number(n);
    return Number.isFinite(v) ? v : null;
  }
  if (typeof n !== "string") return null;
  const trimmed = n.trim();
  if (!trimmed) return null;
  const v = Number(trimmed);
  return Number.isFinite(v) ? v : null;
}
