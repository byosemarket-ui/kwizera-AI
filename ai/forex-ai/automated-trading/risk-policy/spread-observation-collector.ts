/**
 * Stage 1 — LIVE spread observation collection (read-only).
 * Never fabricates LIVE samples. Never invents thresholds. Never mutates broker.
 * Weekend/closed markets → WAITING_FOR_LIVE_MARKET (not an app failure).
 */
import { randomUUID } from "node:crypto";
import {
  MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION,
  computeSpreadAbsolute,
  evaluateSpreadObservationQuality,
  type QuoteProvenanceLabel,
  type SpreadObservation,
} from "./observation-evidence.js";
import {
  STAGE3_TRACKED_INSTRUMENTS,
  type Stage3TrackedInstrument,
} from "./types.js";
import { documentedPrecision, normalizeInstrumentSymbol } from "./validate.js";

export const STAGE1_SPREAD_COLLECTOR_SCHEMA = "kwizera.at-spread-observation.v1" as const;

/** Minimum wall-clock gap between independent LIVE samples for the same instrument. */
export const MIN_INDEPENDENT_OBSERVATION_GAP_MS = 5_000;

export type SpreadCollectionStatus =
  | "ACCEPTED_LIVE"
  | "REJECTED"
  | "WAITING_FOR_LIVE_MARKET"
  | "DUPLICATE_NOT_INDEPENDENT";

export interface LiveSpreadObservationRecord {
  observationId: string;
  instrument: Stage3TrackedInstrument;
  bid: number;
  ask: number;
  /** ask − bid; absolute_price units. */
  spreadAbsolute: number;
  observedAtUtc: string;
  provider: string;
  sourceType: string;
  marketStatus: "OPEN" | "CLOSED" | "UNKNOWN";
  freshnessStatus: "FRESH" | "STALE" | "UNKNOWN";
  provenance: QuoteProvenanceLabel;
  units: "absolute_price";
  pricePrecision: number | null;
  independent: true;
}

export interface SpreadObservationIngestInput {
  instrument: string;
  bid: number | null | undefined;
  ask: number | null | undefined;
  observedAtUtc: string | null | undefined;
  provider: string;
  sourceType: string;
  marketStatus: "OPEN" | "CLOSED" | "UNKNOWN";
  freshnessStatus: "FRESH" | "STALE" | "UNKNOWN";
  provenance: QuoteProvenanceLabel;
  /** Caller-supplied id; generated if omitted. Must be unique for independence. */
  observationId?: string | null;
  /** Prior accepted LIVE records for this instrument (dedupe / independence). */
  priorAccepted?: LiveSpreadObservationRecord[];
  nowMs?: number;
}

export interface SpreadObservationIngestResult {
  status: SpreadCollectionStatus;
  code: string;
  message: string;
  record: LiveSpreadObservationRecord | null;
  placesOrders: false;
  mutatesBroker: false;
}

function isTracked(inst: string | null): inst is Stage3TrackedInstrument {
  return !!inst && (STAGE3_TRACKED_INSTRUMENTS as readonly string[]).includes(inst);
}

/**
 * Ingest one quote snapshot as a candidate LIVE spread observation.
 * Rejects closed market, non-LIVE provenance, stale freshness, non-independent repeats.
 */
export function ingestSpreadObservation(
  input: SpreadObservationIngestInput,
): SpreadObservationIngestResult {
  const baseFlags = { placesOrders: false as const, mutatesBroker: false as const };
  const inst = normalizeInstrumentSymbol(input.instrument);

  if (input.marketStatus === "CLOSED") {
    return {
      ...baseFlags,
      status: "WAITING_FOR_LIVE_MARKET",
      code: "WAITING_FOR_LIVE_MARKET",
      message:
        "Forex market is closed — refuse to label or store this snapshot as LIVE evidence. "
        + "Collector ready; wait for market open.",
      record: null,
    };
  }

  if (!isTracked(inst)) {
    return {
      ...baseFlags,
      status: "REJECTED",
      code: "INSTRUMENT_NOT_TRACKED",
      message: `Instrument ${input.instrument} is not a Stage 1 tracked instrument.`,
      record: null,
    };
  }

  if (input.provenance !== "LIVE") {
    return {
      ...baseFlags,
      status: "REJECTED",
      code: "NON_LIVE_PROVENANCE",
      message: `provenance=${input.provenance} cannot count toward LIVE spread evidence.`,
      record: null,
    };
  }

  if (input.freshnessStatus === "STALE") {
    return {
      ...baseFlags,
      status: "REJECTED",
      code: "FRESHNESS_STALE",
      message: "Freshness STALE — refuse LIVE spread evidence.",
      record: null,
    };
  }

  const spread = computeSpreadAbsolute(input.bid, input.ask);
  if (spread == null || typeof input.bid !== "number" || typeof input.ask !== "number") {
    return {
      ...baseFlags,
      status: "REJECTED",
      code: "SPREAD_INVALID",
      message: "Bid/ask must yield a positive absolute_price spread (ask − bid).",
      record: null,
    };
  }

  if (!input.observedAtUtc || !Number.isFinite(Date.parse(input.observedAtUtc))) {
    return {
      ...baseFlags,
      status: "REJECTED",
      code: "TIMESTAMP_MISSING",
      message: "Valid observedAtUtc required.",
      record: null,
    };
  }

  const candidateObs: SpreadObservation = {
    instrument: inst,
    bid: input.bid,
    ask: input.ask,
    spreadAbsolute: spread,
    observedAtUtc: input.observedAtUtc,
    provenance: "LIVE",
    source: `${input.provider}/${input.sourceType}`,
  };

  const quality = evaluateSpreadObservationQuality({
    observation: candidateObs,
    nowMs: input.nowMs,
    marketOpen: input.marketStatus === "OPEN" ? true : input.marketStatus === "UNKNOWN" ? null : false,
  });

  if (!quality.usableForRecommendation) {
    if (quality.code === "MARKET_CLOSED") {
      return {
        ...baseFlags,
        status: "WAITING_FOR_LIVE_MARKET",
        code: "WAITING_FOR_LIVE_MARKET",
        message: quality.message,
        record: null,
      };
    }
    return {
      ...baseFlags,
      status: "REJECTED",
      code: quality.code,
      message: quality.message,
      record: null,
    };
  }

  const observationId = String(input.observationId || "").trim() || randomUUID();
  const prior = input.priorAccepted ?? [];
  if (prior.some((p) => p.observationId === observationId)) {
    return {
      ...baseFlags,
      status: "DUPLICATE_NOT_INDEPENDENT",
      code: "DUPLICATE_OBSERVATION_ID",
      message: "Observation id already accepted — not independent.",
      record: null,
    };
  }

  const last = prior.length > 0 ? prior[prior.length - 1] : null;
  if (last) {
    const tNew = Date.parse(input.observedAtUtc);
    const tOld = Date.parse(last.observedAtUtc);
    if (Number.isFinite(tNew) && Number.isFinite(tOld) && tNew - tOld < MIN_INDEPENDENT_OBSERVATION_GAP_MS) {
      return {
        ...baseFlags,
        status: "DUPLICATE_NOT_INDEPENDENT",
        code: "INSUFFICIENT_TIME_GAP",
        message:
          `Observations must be ≥${MIN_INDEPENDENT_OBSERVATION_GAP_MS}ms apart to count as independent.`,
        record: null,
      };
    }
    if (
      last.bid === input.bid
      && last.ask === input.ask
      && last.observedAtUtc === input.observedAtUtc
    ) {
      return {
        ...baseFlags,
        status: "DUPLICATE_NOT_INDEPENDENT",
        code: "REPEATED_SNAPSHOT",
        message: "Identical bid/ask/timestamp snapshot is not an independent observation.",
        record: null,
      };
    }
  }

  const record: LiveSpreadObservationRecord = {
    observationId,
    instrument: inst,
    bid: input.bid,
    ask: input.ask,
    spreadAbsolute: spread,
    observedAtUtc: input.observedAtUtc,
    provider: String(input.provider || "").trim() || "UNKNOWN",
    sourceType: String(input.sourceType || "").trim() || "UNKNOWN",
    marketStatus: input.marketStatus === "OPEN" ? "OPEN" : "UNKNOWN",
    freshnessStatus: input.freshnessStatus === "FRESH" ? "FRESH" : "UNKNOWN",
    provenance: "LIVE",
    units: "absolute_price",
    pricePrecision: documentedPrecision(inst),
    independent: true,
  };

  return {
    ...baseFlags,
    status: "ACCEPTED_LIVE",
    code: "LIVE_OBSERVATION_ACCEPTED",
    message: "Independent LIVE observation accepted for recommendation sampling (not approval).",
    record,
  };
}

export interface InstrumentSpreadEvidenceSummary {
  instrument: Stage3TrackedInstrument;
  validLiveCount: number;
  minRequired: number;
  sufficientForRecommendation: boolean;
  status:
    | "WAITING_FOR_LIVE_MARKET"
    | "INSUFFICIENT_LIVE_EVIDENCE"
    | "EVIDENCE_READY_FOR_RECOMMENDATION"
    | "NOT_CONFIGURED";
  units: "absolute_price";
  pricePrecision: number | null;
  note: string;
}

export function summarizeInstrumentSpreadEvidence(input: {
  instrument: Stage3TrackedInstrument;
  accepted: LiveSpreadObservationRecord[];
  marketOpen: boolean | null;
  policyStatus?: "NOT_CONFIGURED" | "PENDING_APPROVAL" | "APPROVED";
}): InstrumentSpreadEvidenceSummary {
  const validLiveCount = input.accepted.filter((r) => r.instrument === input.instrument).length;
  const sufficient = validLiveCount >= MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION;
  let status: InstrumentSpreadEvidenceSummary["status"];
  if (input.marketOpen === false) status = "WAITING_FOR_LIVE_MARKET";
  else if (sufficient) status = "EVIDENCE_READY_FOR_RECOMMENDATION";
  else if (input.policyStatus === "NOT_CONFIGURED" || !input.policyStatus) status = "INSUFFICIENT_LIVE_EVIDENCE";
  else status = "INSUFFICIENT_LIVE_EVIDENCE";

  return {
    instrument: input.instrument,
    validLiveCount,
    minRequired: MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION,
    sufficientForRecommendation: sufficient,
    status: input.marketOpen === false ? "WAITING_FOR_LIVE_MARKET" : status,
    units: "absolute_price",
    pricePrecision: documentedPrecision(input.instrument),
    note:
      input.marketOpen === false
        ? "WAITING_FOR_LIVE_MARKET — collector ready; do not fabricate LIVE samples while closed."
        : sufficient
          ? "≥20 LIVE samples available to draft a recommendation only (owner must still approve)."
          : `Need ${MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION - validLiveCount} more independent LIVE samples.`,
  };
}

/**
 * Forex weekend heuristic for Stage 1 reporting (UTC).
 * Fri 22:00 UTC → Sun 22:00 UTC ≈ closed for FX majors. Not a broker authority.
 */
export function estimateForexMarketOpenUtc(nowMs: number = Date.now()): boolean {
  const d = new Date(nowMs);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const openMinute = 22 * 60; // Sun 22:00 UTC reopen approx
  if (day === 6) return false; // Saturday
  if (day === 0 && minutes < openMinute) return false; // Sunday before reopen
  if (day === 5 && minutes >= openMinute) return false; // Friday after close
  return true;
}

export function stage1SpreadCollectionGate(nowMs?: number): {
  marketLikelyOpen: boolean;
  collectionStatus: "READY_TO_COLLECT_LIVE" | "WAITING_FOR_LIVE_MARKET";
  code: "WAITING_FOR_LIVE_MARKET" | "MARKET_LIKELY_OPEN";
  message: string;
  placesOrders: false;
  mutatesBroker: false;
} {
  const open = estimateForexMarketOpenUtc(nowMs);
  if (!open) {
    return {
      marketLikelyOpen: false,
      collectionStatus: "WAITING_FOR_LIVE_MARKET",
      code: "WAITING_FOR_LIVE_MARKET",
      message:
        "FX session estimated closed (weekend). Spread collector implemented; "
        + "LIVE samples will be accepted only after market open with genuine bid/ask freshness.",
      placesOrders: false,
      mutatesBroker: false,
    };
  }
  return {
    marketLikelyOpen: true,
    collectionStatus: "READY_TO_COLLECT_LIVE",
    code: "MARKET_LIKELY_OPEN",
    message: "FX session estimated open — may collect LIVE observations when FC quotes are fresh.",
    placesOrders: false,
    mutatesBroker: false,
  };
}
