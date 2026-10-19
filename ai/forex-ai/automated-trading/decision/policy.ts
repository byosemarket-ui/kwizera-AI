/**
 * Phase 54 — Decision policy helpers (confidence threshold disabled by default).
 */
import { defaultDecisionPolicy, type AtDecisionPolicy } from "./types.js";

const TF_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

/** Fallback when timeframe/horizon cannot be resolved. */
export const AT_DECISION_DEFAULT_MAX_AGE_MS = 2 * 60 * 60_000;

export function resolveMaxAnalysisAgeMs(
  policy: AtDecisionPolicy,
  primaryTimeframe: string | null | undefined,
): number {
  if (typeof policy.maxAnalysisAgeMs === "number" && Number.isFinite(policy.maxAnalysisAgeMs)) {
    return Math.max(60_000, Math.floor(policy.maxAnalysisAgeMs));
  }
  const tf = String(primaryTimeframe ?? "").trim().toLowerCase();
  const horizon = TF_MS[tf];
  if (horizon) return Math.max(AT_DECISION_DEFAULT_MAX_AGE_MS, horizon * 2);
  return AT_DECISION_DEFAULT_MAX_AGE_MS;
}

export function normalizeDecisionPolicy(raw: unknown): AtDecisionPolicy {
  const base = defaultDecisionPolicy();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const minRaw = Number(o.minDirectionalConfidencePct);
  const min = Number.isFinite(minRaw)
    ? Math.max(0, Math.min(100, Math.round(minRaw * 10) / 10))
    : base.minDirectionalConfidencePct;
  let maxAge: number | null = base.maxAnalysisAgeMs;
  if (o.maxAnalysisAgeMs === null) maxAge = null;
  else if (typeof o.maxAnalysisAgeMs === "number" && Number.isFinite(o.maxAnalysisAgeMs)) {
    maxAge = Math.max(60_000, Math.floor(o.maxAnalysisAgeMs));
  }
  return {
    schemaVersion: "at-decision-policy-v1",
    confidenceThresholdEnabled: Boolean(o.confidenceThresholdEnabled),
    minDirectionalConfidencePct: min,
    maxAnalysisAgeMs: maxAge,
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : base.updatedAtUtc,
    updatedBy: o.updatedBy === "admin" ? "admin" : "system",
  };
}

export function parseDecisionPolicyPatch(raw: unknown): {
  ok: true;
  patch: Partial<AtDecisionPolicy>;
} | {
  ok: false;
  code: string;
  message: string;
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, code: "INVALID_POLICY", message: "Policy body required." };
  }
  const o = raw as Record<string, unknown>;
  const patch: Partial<AtDecisionPolicy> = {};
  if ("confidenceThresholdEnabled" in o) {
    patch.confidenceThresholdEnabled = Boolean(o.confidenceThresholdEnabled);
  }
  if ("minDirectionalConfidencePct" in o) {
    const n = Number(o.minDirectionalConfidencePct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return {
        ok: false,
        code: "INVALID_MIN_CONFIDENCE",
        message: "minDirectionalConfidencePct must be a finite number between 0 and 100.",
      };
    }
    patch.minDirectionalConfidencePct = Math.round(n * 10) / 10;
  }
  if ("maxAnalysisAgeMs" in o) {
    if (o.maxAnalysisAgeMs === null) {
      patch.maxAnalysisAgeMs = null;
    } else {
      const n = Number(o.maxAnalysisAgeMs);
      if (!Number.isFinite(n) || n < 60_000) {
        return {
          ok: false,
          code: "INVALID_MAX_AGE",
          message: "maxAnalysisAgeMs must be null or ≥ 60000 ms.",
        };
      }
      patch.maxAnalysisAgeMs = Math.floor(n);
    }
  }
  return { ok: true, patch };
}
