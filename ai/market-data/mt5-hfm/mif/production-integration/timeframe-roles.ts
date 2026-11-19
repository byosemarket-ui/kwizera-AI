/**
 * Phase 5D.5 — map resolved HFM timeframes → strategy timeframe roles.
 */
import type { MifTimeframeRole } from "../strategy-intelligence/types.js";

const ROLE_BY_TF: Record<string, readonly MifTimeframeRole[]> = {
  W1: ["MACRO_CONTEXT"],
  D1: ["MAJOR_CONTEXT", "PRIMARY_DIRECTION"],
  H4: ["PRIMARY_DIRECTION", "MAJOR_CONTEXT"],
  H1: ["INTERMEDIATE_STRUCTURE", "PRIMARY_DIRECTION"],
  M30: ["INTERMEDIATE_STRUCTURE", "SETUP_DEVELOPMENT"],
  M15: ["SETUP_DEVELOPMENT", "OPPORTUNITY_FORMATION", "LOWER_TIMEFRAME_CONFIRMATION"],
  M5: ["OPPORTUNITY_FORMATION", "LOWER_TIMEFRAME_CONFIRMATION", "OPTIONAL_ENTRY_REFINEMENT"],
  M1: ["OPTIONAL_ENTRY_REFINEMENT", "LOWER_TIMEFRAME_CONFIRMATION"],
};

export function resolveAvailableTimeframeRoles(
  timeframes: readonly string[],
): MifTimeframeRole[] {
  const out: MifTimeframeRole[] = [];
  const seen = new Set<string>();
  for (const raw of timeframes) {
    const tf = String(raw || "").trim().toUpperCase();
    const roles = ROLE_BY_TF[tf];
    if (!roles) continue;
    for (const role of roles) {
      if (seen.has(role)) continue;
      seen.add(role);
      out.push(role);
    }
  }
  return out;
}

export function isSupportedProductionTimeframe(tf: string): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_BY_TF, String(tf || "").trim().toUpperCase());
}
