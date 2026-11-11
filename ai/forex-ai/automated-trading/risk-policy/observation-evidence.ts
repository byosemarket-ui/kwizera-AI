/**
 * Stage 7.3 — Spread/slippage observation evidence helpers.
 * Never invents thresholds. Never marks observations as approved policy values.
 * Weekend/stale/cached quotes are labelled and rejected as recommendation evidence.
 */
import {
  STAGE3_ACTIVE_INSTRUMENTS,
  STAGE3_TRACKED_INSTRUMENTS,
  type Stage3TrackedInstrument,
} from "./types.js";
import { documentedPrecision, normalizeInstrumentSymbol } from "./validate.js";

export type QuoteProvenanceLabel =
  | "LIVE"
  | "DELAYED"
  | "HISTORICAL"
  | "CACHED"
  | "STALE"
  | "SYNTHETIC_TEST_DATA"
  | "UNKNOWN";

export interface SpreadObservation {
  instrument: string;
  bid: number | null;
  ask: number | null;
  /** ask − bid when both finite; otherwise null. Units: absolute_price. */
  spreadAbsolute: number | null;
  observedAtUtc: string | null;
  provenance: QuoteProvenanceLabel;
  source: string;
}

export interface ObservationQualityResult {
  usableForRecommendation: boolean;
  code: string;
  message: string;
  provenance: QuoteProvenanceLabel;
  spreadAbsolute: number | null;
  ageMs: number | null;
  units: "absolute_price";
  pricePrecision: number | null;
}

/** Minimum independent LIVE observations before a recommendation may be drafted (not approved). */
export const MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION = 20;
/** Maximum age for a LIVE observation to count toward recommendation evidence. */
export const MAX_LIVE_OBSERVATION_AGE_MS = 60_000;
/** Calendar span guidance for recommendation sampling windows (owner still approves values). */
export const RECOMMENDATION_SAMPLE_WINDOW_GUIDANCE = {
  minSessions: 3,
  preferMarketOpenHours: true,
  rejectWeekendAsLive: true,
  rejectCachedStaleAsLive: true,
} as const;

export function computeSpreadAbsolute(bid: unknown, ask: unknown): number | null {
  if (typeof bid !== "number" || typeof ask !== "number") return null;
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
  const spread = ask - bid;
  if (!Number.isFinite(spread) || spread <= 0) return null;
  return spread;
}

/**
 * Classify whether a single quote observation may contribute to a *recommendation*
 * (still never an approved policy). Cached/stale/weekend snapshots fail closed.
 */
export function evaluateSpreadObservationQuality(input: {
  observation: SpreadObservation;
  nowMs?: number;
  marketOpen?: boolean | null;
}): ObservationQualityResult {
  const nowMs = input.nowMs ?? Date.now();
  const inst = normalizeInstrumentSymbol(input.observation.instrument);
  const precision = inst ? documentedPrecision(inst) : null;
  const provenance = input.observation.provenance;
  const spread = input.observation.spreadAbsolute
    ?? computeSpreadAbsolute(input.observation.bid, input.observation.ask);

  let ageMs: number | null = null;
  if (input.observation.observedAtUtc) {
    const t = Date.parse(input.observation.observedAtUtc);
    if (Number.isFinite(t)) ageMs = Math.max(0, nowMs - t);
  }

  if (provenance === "SYNTHETIC_TEST_DATA") {
    return {
      usableForRecommendation: false,
      code: "SYNTHETIC_NOT_RECOMMENDATION_EVIDENCE",
      message: "Synthetic test data must not be used to recommend production spread/slippage limits.",
      provenance,
      spreadAbsolute: spread,
      ageMs,
      units: "absolute_price",
      pricePrecision: precision,
    };
  }

  if (provenance === "CACHED" || provenance === "STALE" || provenance === "HISTORICAL" || provenance === "DELAYED") {
    return {
      usableForRecommendation: false,
      code: "NON_LIVE_OBSERVATION",
      message:
        `Observation provenance=${provenance} is not LIVE — refuse to treat it as current market evidence `
        + "for policy recommendations (weekend/cached snapshots included).",
      provenance,
      spreadAbsolute: spread,
      ageMs,
      units: "absolute_price",
      pricePrecision: precision,
    };
  }

  if (input.marketOpen === false) {
    return {
      usableForRecommendation: false,
      code: "MARKET_CLOSED",
      message: "Market is closed — refuse LIVE recommendation sampling.",
      provenance,
      spreadAbsolute: spread,
      ageMs,
      units: "absolute_price",
      pricePrecision: precision,
    };
  }

  if (provenance !== "LIVE") {
    return {
      usableForRecommendation: false,
      code: "PROVENANCE_UNKNOWN",
      message: "Observation provenance is not positively LIVE.",
      provenance,
      spreadAbsolute: spread,
      ageMs,
      units: "absolute_price",
      pricePrecision: precision,
    };
  }

  if (spread == null) {
    return {
      usableForRecommendation: false,
      code: "SPREAD_UNAVAILABLE",
      message: "Bid/ask spread could not be computed as a positive absolute_price value.",
      provenance,
      spreadAbsolute: null,
      ageMs,
      units: "absolute_price",
      pricePrecision: precision,
    };
  }

  if (ageMs == null || ageMs > MAX_LIVE_OBSERVATION_AGE_MS) {
    return {
      usableForRecommendation: false,
      code: "OBSERVATION_TOO_OLD",
      message:
        `LIVE observation ageMs=${ageMs} exceeds ${MAX_LIVE_OBSERVATION_AGE_MS}ms freshness budget.`,
      provenance,
      spreadAbsolute: spread,
      ageMs,
      units: "absolute_price",
      pricePrecision: precision,
    };
  }

  return {
    usableForRecommendation: true,
    code: "LIVE_OBSERVATION_OK",
    message: "Observation meets LIVE freshness gates for recommendation sampling (not approval).",
    provenance,
    spreadAbsolute: spread,
    ageMs,
    units: "absolute_price",
    pricePrecision: precision,
  };
}

export function ownerApprovalRequirements(): {
  instruments: Stage3TrackedInstrument[];
  activeInstruments: Stage3TrackedInstrument[];
  trackedCatalog: Stage3TrackedInstrument[];
  units: "absolute_price";
  requireProposeThenOwnerApproveConfirm: true;
  requireDistinctOwnerToken: true;
  adminCannotApprove: true;
  failClosedWhenMissing: true;
  minLiveObservationsForRecommendation: number;
  /** Mandatory owner fields for Stage 1 completion (ACTIVE XAU). */
  fieldsPerInstrument: Array<"slippage.maxSlippageAbsolute">;
  /** Optional emergency-only; NOT required for DYNAMIC_PER_TRADE eligibility. */
  optionalEmergencyFields: Array<"spread.maxSpreadAbsolute">;
  note: string;
} {
  return {
    // Phase-active instruments require owner approval this cycle.
    instruments: [...STAGE3_ACTIVE_INSTRUMENTS],
    activeInstruments: [...STAGE3_ACTIVE_INSTRUMENTS],
    trackedCatalog: [...STAGE3_TRACKED_INSTRUMENTS],
    units: "absolute_price",
    requireProposeThenOwnerApproveConfirm: true,
    requireDistinctOwnerToken: true,
    adminCannotApprove: true,
    failClosedWhenMissing: true,
    minLiveObservationsForRecommendation: MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION,
    fieldsPerInstrument: ["slippage.maxSlippageAbsolute"],
    optionalEmergencyFields: ["spread.maxSpreadAbsolute"],
    note:
      "ACTIVE XAU/USD: primary spread eligibility is DYNAMIC_PER_TRADE economic feasibility. "
      + "Historical maxSpreadAbsolute proposals (e.g. 0.30 PENDING) remain audit-only and are "
      + "NOT required for trade eligibility. Optional emergency ceiling may still use Stage 4 "
      + "propose→approve+confirm. Stage 1 completion still requires APPROVED maxSlippageAbsolute "
      + "backed by ≥20 genuine BROKER_EXECUTION fills. Recommendations ≠ approval. "
      + "OUT_OF_SCOPE instruments remain excluded from the active workflow.",
  };
}

export interface InstrumentPolicyEvidenceRow {
  instrument: Stage3TrackedInstrument;
  units: "absolute_price";
  pricePrecision: number | null;
  policyStatus: "NOT_CONFIGURED" | "PENDING_APPROVAL" | "APPROVED" | "UNKNOWN";
  activeMaxSpreadAbsolute: number | null;
  activeMaxSlippageAbsolute: number | null;
  observationCount: number;
  usableLiveObservationCount: number;
  mayDraftRecommendation: boolean;
  mayApproveFromObservationsAlone: false;
  rejectedObservations: Array<{ code: string; provenance: QuoteProvenanceLabel; spreadAbsolute: number | null }>;
  note: string;
}

/**
 * Build a fail-closed evidence row for one instrument.
 * Never invents thresholds. Never promotes observations to APPROVED policy values.
 */
export function buildInstrumentPolicyEvidenceRow(input: {
  instrument: Stage3TrackedInstrument;
  observations?: SpreadObservation[];
  policyStatus?: InstrumentPolicyEvidenceRow["policyStatus"];
  activeMaxSpreadAbsolute?: number | null;
  activeMaxSlippageAbsolute?: number | null;
  nowMs?: number;
  marketOpen?: boolean | null;
}): InstrumentPolicyEvidenceRow {
  const observations = input.observations ?? [];
  const rejected: InstrumentPolicyEvidenceRow["rejectedObservations"] = [];
  let usable = 0;
  for (const obs of observations) {
    const q = evaluateSpreadObservationQuality({
      observation: { ...obs, instrument: input.instrument },
      nowMs: input.nowMs,
      marketOpen: input.marketOpen,
    });
    if (q.usableForRecommendation) usable += 1;
    else {
      rejected.push({
        code: q.code,
        provenance: q.provenance,
        spreadAbsolute: q.spreadAbsolute,
      });
    }
  }
  const status = input.policyStatus ?? "NOT_CONFIGURED";
  const mayDraft = usable >= MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION;
  return {
    instrument: input.instrument,
    units: "absolute_price",
    pricePrecision: documentedPrecision(input.instrument),
    policyStatus: status,
    activeMaxSpreadAbsolute: input.activeMaxSpreadAbsolute ?? null,
    activeMaxSlippageAbsolute: input.activeMaxSlippageAbsolute ?? null,
    observationCount: observations.length,
    usableLiveObservationCount: usable,
    mayDraftRecommendation: mayDraft,
    mayApproveFromObservationsAlone: false,
    rejectedObservations: rejected,
    note: status === "NOT_CONFIGURED"
      ? `NOT_CONFIGURED — fail closed until owner propose→approve+confirm. `
        + `Usable LIVE samples=${usable}/${MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION} required to draft a recommendation only.`
      : `Policy status=${status}; observations never auto-approve.`,
  };
}

/**
 * Evidence matrix for all Stage 3 tracked instruments.
 * Labels stale XAU 0.30 (or any CACHED/STALE) as non-recommendable.
 */
export function buildTrackedInstrumentsEvidenceReport(input?: {
  observationsByInstrument?: Partial<Record<Stage3TrackedInstrument, SpreadObservation[]>>;
  policyStatusByInstrument?: Partial<Record<Stage3TrackedInstrument, InstrumentPolicyEvidenceRow["policyStatus"]>>;
  nowMs?: number;
  marketOpen?: boolean | null;
}): {
  units: "absolute_price";
  failClosedWhenMissing: true;
  ownerMustProvide: ReturnType<typeof ownerApprovalRequirements>;
  instruments: InstrumentPolicyEvidenceRow[];
  staleXau030NotApproved: true;
  note: string;
} {
  const instruments = STAGE3_TRACKED_INSTRUMENTS.map((instrument) =>
    buildInstrumentPolicyEvidenceRow({
      instrument,
      observations: input?.observationsByInstrument?.[instrument] ?? [],
      policyStatus: input?.policyStatusByInstrument?.[instrument] ?? "NOT_CONFIGURED",
      nowMs: input?.nowMs,
      marketOpen: input?.marketOpen,
    }),
  );
  return {
    units: "absolute_price",
    failClosedWhenMissing: true,
    ownerMustProvide: ownerApprovalRequirements(),
    instruments,
    staleXau030NotApproved: true,
    note:
      "Observed XAU/USD spread 0.30 labelled CACHED/STALE while market closed is NOT an approved threshold "
      + "and is not recommendation evidence. Owner must supply absolute_price values for all four instruments.",
  };
}
