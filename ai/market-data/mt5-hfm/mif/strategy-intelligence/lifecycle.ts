/**
 * Phase 5D Step 1 — strategy definition lifecycle transitions.
 * Distinct from future opportunity-candidate lifecycle.
 */
import type { MifStrategyLifecycleStatus } from "./types.js";

const ALLOWED: Record<MifStrategyLifecycleStatus, readonly MifStrategyLifecycleStatus[]> = {
  DRAFT: ["ACTIVE", "DISABLED", "DEPRECATED"],
  ACTIVE: ["DISABLED", "DEPRECATED"],
  DISABLED: ["ACTIVE", "DEPRECATED"],
  DEPRECATED: [], // terminal for registry purposes — keep for historical reference
};

export function isAllowedStrategyLifecycleTransition(
  from: MifStrategyLifecycleStatus,
  to: MifStrategyLifecycleStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function validateStrategyLifecycleTransition(
  from: MifStrategyLifecycleStatus,
  to: MifStrategyLifecycleStatus,
): { ok: boolean; error: string | null } {
  if (isAllowedStrategyLifecycleTransition(from, to)) return { ok: true, error: null };
  return {
    ok: false,
    error: `lifecycle transition ${from} → ${to} is not allowed`,
  };
}

/** Only ACTIVE strategies may become ELIGIBLE_FOR_DETECTION. */
export function lifecycleAllowsDetection(status: MifStrategyLifecycleStatus): boolean {
  return status === "ACTIVE";
}
