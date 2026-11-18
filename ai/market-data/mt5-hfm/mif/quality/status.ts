/**
 * Shared scoped status derivation for MIF quality subsystems (Step 1/2).
 * Precedence: BLOCKED > DEGRADED > WARNING > VALID
 */
import type { MifQualityFinding } from "./types.js";

export type MifScopedQualityStatus = "VALID" | "WARNING" | "DEGRADED" | "BLOCKED";

export function deriveScopedQualityStatus(
  findings: readonly MifQualityFinding[],
): MifScopedQualityStatus {
  if (findings.some((f) => f.severity === "blocking")) return "BLOCKED";
  if (findings.some((f) => f.severity === "degraded")) return "DEGRADED";
  if (findings.some((f) => f.severity === "warning")) return "WARNING";
  return "VALID";
}

export function uniqueFindingCodes(
  findings: readonly MifQualityFinding[],
  pred: (f: MifQualityFinding) => boolean,
): Array<MifQualityFinding["code"]> {
  const out: Array<MifQualityFinding["code"]> = [];
  const seen = new Set<string>();
  for (const f of findings) {
    if (!pred(f) || seen.has(f.code)) continue;
    seen.add(f.code);
    out.push(f.code);
  }
  return out;
}
