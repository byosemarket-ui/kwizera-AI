/**
 * Stage 1 Part 3 remediation — compare LIVE quote spreads to pending/active limits.
 * Advisory only. Never changes proposed or approved policy values.
 */
import { documentedPrecision, finitePositive, normalizeInstrumentSymbol } from "./validate.js";

export type PendingSpreadLiveRelation =
  | "NO_LIVE_SPREAD"
  | "NO_PENDING_OR_ACTIVE_LIMIT"
  | "LIVE_WITHIN_LIMIT"
  | "LIVE_EXCEEDS_PENDING_OR_ACTIVE_LIMIT";

export interface PendingSpreadLiveCheck {
  instrument: string;
  liveSpreadAbsolute: number | null;
  pendingProposedValue: number | null;
  activeApprovedValue: number | null;
  comparedAgainstValue: number | null;
  comparedAgainstSource: "pending_proposed" | "active_approved" | null;
  relation: PendingSpreadLiveRelation;
  /** True when live absolute spread is strictly above the compared policy candidate. */
  exceedsComparedLimit: boolean;
  pricePrecision: number | null;
  mayChangePolicyValue: false;
  note: string;
}

/**
 * Evaluate whether a LIVE absolute spread exceeds a pending proposal or active limit.
 * Prefer pending proposal when present (owner decision still outstanding); else active.
 * Does not invent thresholds and does not mutate policy.
 */
export function compareLiveSpreadToPendingOrActiveLimit(input: {
  instrument: string;
  liveBid?: number | null;
  liveAsk?: number | null;
  liveSpreadAbsolute?: number | null;
  pendingProposedValue?: number | null;
  activeApprovedValue?: number | null;
}): PendingSpreadLiveCheck {
  const instrument = normalizeInstrumentSymbol(input.instrument) || String(input.instrument || "");
  const precision = documentedPrecision(instrument);
  let live = input.liveSpreadAbsolute;
  if (!finitePositive(live) && finitePositive(input.liveBid) && finitePositive(input.liveAsk)) {
    const raw = Number(input.liveAsk) - Number(input.liveBid);
    live = Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (!finitePositive(live)) {
    return {
      instrument,
      liveSpreadAbsolute: null,
      pendingProposedValue: finitePositive(input.pendingProposedValue) ? input.pendingProposedValue! : null,
      activeApprovedValue: finitePositive(input.activeApprovedValue) ? input.activeApprovedValue! : null,
      comparedAgainstValue: null,
      comparedAgainstSource: null,
      relation: "NO_LIVE_SPREAD",
      exceedsComparedLimit: false,
      pricePrecision: precision,
      mayChangePolicyValue: false,
      note: "No LIVE absolute spread available for comparison.",
    };
  }

  const pending = finitePositive(input.pendingProposedValue) ? input.pendingProposedValue! : null;
  const active = finitePositive(input.activeApprovedValue) ? input.activeApprovedValue! : null;
  const comparedAgainstValue = pending ?? active;
  const comparedAgainstSource = pending != null
    ? "pending_proposed" as const
    : active != null
      ? "active_approved" as const
      : null;

  if (comparedAgainstValue == null || comparedAgainstSource == null) {
    return {
      instrument,
      liveSpreadAbsolute: live,
      pendingProposedValue: pending,
      activeApprovedValue: active,
      comparedAgainstValue: null,
      comparedAgainstSource: null,
      relation: "NO_PENDING_OR_ACTIVE_LIMIT",
      exceedsComparedLimit: false,
      pricePrecision: precision,
      mayChangePolicyValue: false,
      note: "No pending proposal or active approved spread limit to compare against.",
    };
  }

  const exceeds = live > comparedAgainstValue + 1e-15;
  return {
    instrument,
    liveSpreadAbsolute: live,
    pendingProposedValue: pending,
    activeApprovedValue: active,
    comparedAgainstValue,
    comparedAgainstSource,
    relation: exceeds ? "LIVE_EXCEEDS_PENDING_OR_ACTIVE_LIMIT" : "LIVE_WITHIN_LIMIT",
    exceedsComparedLimit: exceeds,
    pricePrecision: precision,
    mayChangePolicyValue: false,
    note: exceeds
      ? `LIVE spread ${live} exceeds ${comparedAgainstSource}=${comparedAgainstValue}. `
        + "Advisory only — proposed/approved values are not auto-raised."
      : `LIVE spread ${live} is within ${comparedAgainstSource}=${comparedAgainstValue}.`,
  };
}
