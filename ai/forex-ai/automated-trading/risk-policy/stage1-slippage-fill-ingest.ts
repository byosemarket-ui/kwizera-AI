/**
 * Stage 1 — Slippage fill ingest (software path).
 * Never invents fill fields. Never submits orders. Never counts SYNTHETIC as production.
 *
 * Root cause of usableFillEvidenceCount=0 was missing ingest: validate/store existed but
 * nothing called setSlippageFills/appendSlippageFill from production paths.
 */
import { randomUUID } from "node:crypto";
import { isStage3ActiveInstrument } from "./types.js";
import { normalizeInstrumentSymbol } from "./validate.js";
import {
  validateSlippageFillEvidence,
  type SlippageFillEvidenceRecord,
} from "./slippage-evidence.js";
import { getStage1EvidenceStore, type Stage1EvidenceStore } from "./stage1-evidence-store.js";

export const STAGE1_SLIPPAGE_FILL_INGEST_ID = "Stage1SlippageFillIngest" as const;

export type SlippageIngestRejectCode =
  | "INSTRUMENT_OUT_OF_SCOPE"
  | "INSTRUMENT_INVALID"
  | "SYNTHETIC_NOT_PRODUCTION_EVIDENCE"
  | "VALIDATION_FAILED"
  | "DUPLICATE_EXECUTION_ID"
  | "MISSING_BROKER_FIELDS"
  | "WRONG_ACCOUNT_OR_ENVIRONMENT"
  | string;

export interface SlippageFillCandidateInput {
  instrument: string | null | undefined;
  direction: "BUY" | "SELL" | null | undefined;
  referencePrice: number | null | undefined;
  submissionReferencePrice?: number | null;
  executionPrice: number | null | undefined;
  fillTimestampUtc: string | null | undefined;
  executionIdentifier: string | null | undefined;
  brokerResponseId?: string | null;
  provenance: "BROKER_EXECUTION" | "SYNTHETIC_TEST_DATA";
  /** Optional environment/account guards (fail closed when mismatched). */
  expectedEnvironment?: "DEMO" | "LIVE" | null;
  observedEnvironment?: "DEMO" | "LIVE" | null;
  expectedAccountIdMasked?: string | null;
  observedAccountIdMasked?: string | null;
  evidenceId?: string | null;
}

export interface SlippageFillIngestResult {
  ingestId: typeof STAGE1_SLIPPAGE_FILL_INGEST_ID;
  accepted: boolean;
  duplicate: boolean;
  code: SlippageIngestRejectCode;
  blockers: string[];
  record: SlippageFillEvidenceRecord | null;
  countForInstrument: number | null;
  placesOrders: false;
  mutatesBroker: false;
  note: string;
}

/**
 * Validate + persist one genuine BROKER_EXECUTION fill for ACTIVE instruments (XAU).
 * Synthetic fixtures may be validated for tests but are never persisted as production evidence.
 */
export function ingestSlippageFillEvidence(
  input: SlippageFillCandidateInput,
  store: Stage1EvidenceStore = getStage1EvidenceStore(),
): SlippageFillIngestResult {
  const base = {
    ingestId: STAGE1_SLIPPAGE_FILL_INGEST_ID,
    placesOrders: false as const,
    mutatesBroker: false as const,
  };

  const sym = normalizeInstrumentSymbol(String(input.instrument || "")) || String(input.instrument || "").trim();
  if (!sym) {
    return {
      ...base,
      accepted: false,
      duplicate: false,
      code: "INSTRUMENT_INVALID",
      blockers: ["INSTRUMENT_INVALID"],
      record: null,
      countForInstrument: null,
      note: "Instrument identity missing — fill not ingested.",
    };
  }
  if (!isStage3ActiveInstrument(sym)) {
    return {
      ...base,
      accepted: false,
      duplicate: false,
      code: "INSTRUMENT_OUT_OF_SCOPE",
      blockers: ["INSTRUMENT_OUT_OF_SCOPE"],
      record: null,
      countForInstrument: store.getSlippageFills(sym).length,
      note: `${sym} is OUT_OF_SCOPE for this Automated Trading phase — fill not ingested.`,
    };
  }

  if (
    input.expectedEnvironment
    && input.observedEnvironment
    && input.expectedEnvironment !== input.observedEnvironment
  ) {
    return {
      ...base,
      accepted: false,
      duplicate: false,
      code: "WRONG_ACCOUNT_OR_ENVIRONMENT",
      blockers: ["WRONG_ACCOUNT_OR_ENVIRONMENT"],
      record: null,
      countForInstrument: store.getSlippageFills(sym).length,
      note: `Environment mismatch expected=${input.expectedEnvironment} observed=${input.observedEnvironment}.`,
    };
  }
  if (
    input.expectedAccountIdMasked
    && input.observedAccountIdMasked
    && String(input.expectedAccountIdMasked) !== String(input.observedAccountIdMasked)
  ) {
    return {
      ...base,
      accepted: false,
      duplicate: false,
      code: "WRONG_ACCOUNT_OR_ENVIRONMENT",
      blockers: ["WRONG_ACCOUNT_OR_ENVIRONMENT"],
      record: null,
      countForInstrument: store.getSlippageFills(sym).length,
      note: "Account identity mismatch — fill not ingested.",
    };
  }

  const validated = validateSlippageFillEvidence({
    evidenceId: input.evidenceId ?? `slip-${randomUUID()}`,
    instrument: sym,
    direction: input.direction,
    referencePrice: input.referencePrice,
    submissionReferencePrice: input.submissionReferencePrice,
    executionPrice: input.executionPrice,
    fillTimestampUtc: input.fillTimestampUtc,
    executionIdentifier: input.executionIdentifier,
    brokerResponseId: input.brokerResponseId,
    provenance: input.provenance,
  });

  if (!validated.record) {
    return {
      ...base,
      accepted: false,
      duplicate: false,
      code: validated.blockers[0] ?? "VALIDATION_FAILED",
      blockers: validated.blockers,
      record: null,
      countForInstrument: store.getSlippageFills(sym).length,
      note: validated.note,
    };
  }

  if (input.provenance !== "BROKER_EXECUTION" || !validated.ok) {
    return {
      ...base,
      accepted: false,
      duplicate: false,
      code: "SYNTHETIC_NOT_PRODUCTION_EVIDENCE",
      blockers: validated.blockers.length ? validated.blockers : ["SYNTHETIC_NOT_PRODUCTION_EVIDENCE"],
      record: validated.record,
      countForInstrument: store.getSlippageFills(sym).length,
      note: "Synthetic/test fill excluded from production evidence count.",
    };
  }

  const appended = store.appendSlippageFill(validated.record);
  return {
    ...base,
    accepted: appended.accepted,
    duplicate: appended.duplicate,
    code: appended.code,
    blockers: appended.accepted ? [] : [appended.code],
    record: validated.record,
    countForInstrument: appended.countForInstrument,
    note: appended.accepted
      ? `Persisted BROKER_EXECUTION fill; count=${appended.countForInstrument}.`
      : appended.duplicate
        ? "Duplicate executionIdentifier — evidence count not inflated."
        : `Fill rejected: ${appended.code}.`,
  };
}

/**
 * Attempt to map a raw broker trade/closed-trade row into a slippage candidate.
 * Fail closed when required fields are absent — never invent reference/execution prices.
 */
export function mapBrokerTradeRowToSlippageCandidate(row: Record<string, unknown> | null | undefined): {
  ok: true;
  candidate: SlippageFillCandidateInput;
} | {
  ok: false;
  code: "MISSING_BROKER_FIELDS";
  missing: string[];
  note: string;
} {
  if (!row || typeof row !== "object") {
    return {
      ok: false,
      code: "MISSING_BROKER_FIELDS",
      missing: ["row"],
      note: "Broker trade row missing.",
    };
  }
  const missing: string[] = [];
  const instrument = String(
    row.instrument ?? row.providerSymbol ?? row.symbol ?? row.offerInstrument ?? "",
  ).trim() || null;
  if (!instrument) missing.push("instrument");

  const dirRaw = String(row.direction ?? row.side ?? row.buySell ?? "").trim().toUpperCase();
  const direction = dirRaw === "BUY" || dirRaw === "B" || dirRaw === "1"
    ? "BUY" as const
    : dirRaw === "SELL" || dirRaw === "S" || dirRaw === "2"
      ? "SELL" as const
      : null;
  if (!direction) missing.push("direction");

  const referencePrice = num(row.referencePrice ?? row.requestedPrice ?? row.submissionPrice ?? row.orderPrice);
  if (referencePrice == null) missing.push("referencePrice");

  const executionPrice = num(row.executionPrice ?? row.fillPrice ?? row.openRate ?? row.closeRate ?? row.rate);
  if (executionPrice == null) missing.push("executionPrice");

  const fillTimestampUtc = str(
    row.fillTimestampUtc ?? row.executedAtUtc ?? row.closeTimeUtc ?? row.openTimeUtc ?? row.timestampUtc,
  );
  if (!fillTimestampUtc || !Number.isFinite(Date.parse(fillTimestampUtc))) missing.push("fillTimestampUtc");

  const executionIdentifier = str(
    row.executionIdentifier ?? row.tradeId ?? row.fillId ?? row.orderId ?? row.brokerTradeId,
  );
  if (!executionIdentifier) missing.push("executionIdentifier");

  if (missing.length > 0) {
    return {
      ok: false,
      code: "MISSING_BROKER_FIELDS",
      missing,
      note:
        "Broker row lacks required Stage 1 fill fields — not mapped (fail closed; values not invented). "
        + `Missing: ${missing.join(",")}.`,
    };
  }

  return {
    ok: true,
    candidate: {
      instrument,
      direction,
      referencePrice,
      submissionReferencePrice: num(row.submissionReferencePrice ?? row.submissionPrice),
      executionPrice,
      fillTimestampUtc,
      executionIdentifier,
      brokerResponseId: str(row.brokerResponseId ?? row.requestId ?? row.orderId),
      provenance: "BROKER_EXECUTION",
      observedEnvironment: row.environment === "LIVE" || row.environment === "DEMO"
        ? row.environment
        : null,
      observedAccountIdMasked: str(row.accountIdMasked ?? row.accountId),
    },
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
