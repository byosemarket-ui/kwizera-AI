/**
 * Phase 3 — Precheck → FXCM payload → validation → handoff record → execution boundary.
 * Always terminates at EXECUTION_BLOCKED. Never submits broker orders.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import { getAtSystemMasterStore } from "./system-master/store.js";
import {
  evaluateExecutionBoundary,
  type ExecutionBoundaryDecision,
} from "./broker-execution/execution-boundary.js";
import {
  validatePhase3PayloadPackage,
  type Phase3PayloadPackage,
} from "./broker-execution/phase3-payload-validator.js";
import { buildFxcmTrueMarketOpenPayload } from "./demo-submission-adapter/fxcm-payload.js";
import type { AtOrderProposalRecord } from "./order-proposal/types.js";

export const PHASE3_PIPELINE_SCHEMA = "at-phase3-pipeline-v1" as const;

export type Phase3ChainStatus =
  | "STARTED"
  | "PRECHECK_VALIDATION_FAILED"
  | "PAYLOAD_BUILDING"
  | "PAYLOAD_INVALID"
  | "PAYLOAD_VALIDATED"
  | "HANDOFF_VALIDATED"
  | "EXECUTION_BOUNDARY_REACHED"
  | "EXECUTION_BLOCKED"
  | "HANDOFF_REJECTED"
  | "HANDOFF_EXPIRED"
  | "ABORTED_SYSTEM_OFF"
  | "ABORTED_GENERATION"
  | "ERROR";

export interface Phase3ChainRecord {
  schemaVersion: typeof PHASE3_PIPELINE_SCHEMA;
  analysisId: string | null;
  intakeId: string | null;
  proposalId: string | null;
  riskDecisionId: string | null;
  handoffId: string | null;
  precheckId: string | null;
  payloadId: string | null;
  executionBoundaryDecisionId: string | null;
  status: Phase3ChainStatus;
  blockers: string[];
  direction: "BUY" | "SELL" | null;
  instrument: string | null;
  amount: number | null;
  quantityLots: number | null;
  offerId: string | null;
  analysisGeneration: number;
  payloadRedacted: Record<string, unknown> | null;
  boundaryStatus: "EXECUTION_BLOCKED" | null;
  boundaryReason: string | null;
  startedAtUtc: string;
  updatedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  submissionAttempted: false;
  note: string;
}

export interface Phase3PipelineStoreState {
  schemaVersion: typeof PHASE3_PIPELINE_SCHEMA;
  latest: Phase3ChainRecord | null;
  byPrecheckId: Record<string, Phase3ChainRecord>;
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "phase3-pipeline.json",
  );
}

function emptyState(): Phase3PipelineStoreState {
  return { schemaVersion: PHASE3_PIPELINE_SCHEMA, latest: null, byPrecheckId: {} };
}

function normalizeRecord(raw: unknown): Phase3ChainRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.precheckId !== "string" && typeof o.proposalId !== "string") return null;
  return {
    schemaVersion: PHASE3_PIPELINE_SCHEMA,
    analysisId: typeof o.analysisId === "string" ? o.analysisId : null,
    intakeId: typeof o.intakeId === "string" ? o.intakeId : null,
    proposalId: typeof o.proposalId === "string" ? o.proposalId : null,
    riskDecisionId: typeof o.riskDecisionId === "string" ? o.riskDecisionId : null,
    handoffId: typeof o.handoffId === "string" ? o.handoffId : null,
    precheckId: typeof o.precheckId === "string" ? o.precheckId : null,
    payloadId: typeof o.payloadId === "string" ? o.payloadId : null,
    executionBoundaryDecisionId:
      typeof o.executionBoundaryDecisionId === "string" ? o.executionBoundaryDecisionId : null,
    status: (typeof o.status === "string" ? o.status : "ERROR") as Phase3ChainStatus,
    blockers: Array.isArray(o.blockers) ? o.blockers.map(String).slice(0, 32) : [],
    direction: o.direction === "BUY" || o.direction === "SELL" ? o.direction : null,
    instrument: typeof o.instrument === "string" ? o.instrument : null,
    amount: typeof o.amount === "number" && Number.isFinite(o.amount) ? o.amount : null,
    quantityLots:
      typeof o.quantityLots === "number" && Number.isFinite(o.quantityLots) ? o.quantityLots : null,
    offerId: typeof o.offerId === "string" ? o.offerId : null,
    analysisGeneration: Number.isFinite(Number(o.analysisGeneration))
      ? Math.floor(Number(o.analysisGeneration))
      : 0,
    payloadRedacted:
      o.payloadRedacted && typeof o.payloadRedacted === "object"
        ? (o.payloadRedacted as Record<string, unknown>)
        : null,
    boundaryStatus: o.boundaryStatus === "EXECUTION_BLOCKED" ? "EXECUTION_BLOCKED" : null,
    boundaryReason: typeof o.boundaryReason === "string" ? o.boundaryReason : null,
    startedAtUtc: typeof o.startedAtUtc === "string" ? o.startedAtUtc : new Date().toISOString(),
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : new Date().toISOString(),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    submissionAttempted: false,
    note: typeof o.note === "string" ? o.note.slice(0, 280) : "Phase 3 chain record.",
  };
}

export class AtPhase3PipelineStore {
  private data: Phase3PipelineStoreState;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const raw = readJsonSafeSync(this.file, null).value;
    if (raw && typeof raw === "object" && (raw as { schemaVersion?: string }).schemaVersion === PHASE3_PIPELINE_SCHEMA) {
      const o = raw as Record<string, unknown>;
      const by: Record<string, Phase3ChainRecord> = {};
      if (o.byPrecheckId && typeof o.byPrecheckId === "object") {
        for (const [k, v] of Object.entries(o.byPrecheckId as Record<string, unknown>)) {
          const n = normalizeRecord(v);
          if (n) by[k] = n;
        }
      }
      this.data = {
        schemaVersion: PHASE3_PIPELINE_SCHEMA,
        latest: normalizeRecord(o.latest),
        byPrecheckId: by,
      };
    } else {
      this.data = emptyState();
    }
  }

  getLatest(): Phase3ChainRecord | null {
    return this.data.latest
      ? { ...this.data.latest, blockers: [...this.data.latest.blockers] }
      : null;
  }

  getByPrecheckId(precheckId: string): Phase3ChainRecord | null {
    const hit = this.data.byPrecheckId[precheckId];
    return hit ? { ...hit, blockers: [...hit.blockers] } : null;
  }

  async upsert(record: Phase3ChainRecord): Promise<Phase3ChainRecord> {
    const next: Phase3ChainRecord = {
      ...record,
      schemaVersion: PHASE3_PIPELINE_SCHEMA,
      blockers: [...record.blockers],
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      submissionAttempted: false,
      updatedAtUtc: new Date().toISOString(),
    };
    if (next.precheckId) this.data.byPrecheckId[next.precheckId] = next;
    this.data.latest = next;
    this.data.schemaVersion = PHASE3_PIPELINE_SCHEMA;
    await writeJsonAtomic(this.file, this.data);
    return this.getByPrecheckId(next.precheckId || "") ?? next;
  }
}

let storeSingleton: AtPhase3PipelineStore | null = null;

export function getAtPhase3PipelineStore(storageRoot?: string): AtPhase3PipelineStore {
  if (storageRoot) return new AtPhase3PipelineStore(storageRoot);
  if (!storeSingleton) storeSingleton = new AtPhase3PipelineStore();
  return storeSingleton;
}

export function resetAtPhase3PipelineStoreForTests(): void {
  storeSingleton = null;
}

export type Phase3DownstreamService = {
  getProposal: (proposalId: string | null) => AtOrderProposalRecord | null;
  getAccountIdForPayload: () => string | null;
  getContractMeta: () => {
    offerId: string | null;
    baseUnitSize: number | null;
    quantityMin: number | null;
    quantityStep: number | null;
    contractSource: string | null;
    contractFresh: boolean;
    symbol: string | null;
  };
  getQuote: () => { bid: number | null; ask: number | null; fresh: boolean };
  getSafety: () => {
    executionMasterEnabled: boolean;
    emergencyEntryLock: boolean;
    demoMutationAllowed: boolean;
    activeDemoGrant: boolean;
  };
};

export interface RunPhase3Input {
  precheckId: string;
  precheckStatus: string;
  precheckPassedDomain: boolean;
  precheckExpiresAtUtc?: string | null;
  proposalId: string;
  handoffId?: string | null;
  analysisId?: string | null;
  intakeId?: string | null;
  riskDecisionId?: string | null;
  analysisGeneration: number;
  service: Phase3DownstreamService;
  store?: AtPhase3PipelineStore;
  nowMs?: number;
}

/**
 * Run Phase 3 from a trusted precheck outcome. Always ends EXECUTION_BLOCKED.
 */
export async function runPhase3FromPrecheck(
  input: RunPhase3Input,
): Promise<{
  chain: Phase3ChainRecord;
  payloadPackage: Phase3PayloadPackage | null;
  boundary: ExecutionBoundaryDecision | null;
}> {
  const store = input.store ?? getAtPhase3PipelineStore();
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const existing = store.getByPrecheckId(input.precheckId);
  if (
    existing
    && existing.status === "EXECUTION_BLOCKED"
    && existing.proposalId === input.proposalId
  ) {
    return { chain: existing, payloadPackage: null, boundary: null };
  }

  let chain: Phase3ChainRecord = {
    schemaVersion: PHASE3_PIPELINE_SCHEMA,
    analysisId: input.analysisId ?? null,
    intakeId: input.intakeId ?? null,
    proposalId: input.proposalId,
    riskDecisionId: input.riskDecisionId ?? null,
    handoffId: input.handoffId ?? null,
    precheckId: input.precheckId,
    payloadId: null,
    executionBoundaryDecisionId: null,
    status: "STARTED",
    blockers: [],
    direction: null,
    instrument: null,
    amount: null,
    quantityLots: null,
    offerId: null,
    analysisGeneration: input.analysisGeneration,
    payloadRedacted: null,
    boundaryStatus: null,
    boundaryReason: null,
    startedAtUtc: nowIso,
    updatedAtUtc: nowIso,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    submissionAttempted: false,
    note: "Phase 3 started — payload construction only; execution disabled.",
  };

  const master = getAtSystemMasterStore().get();
  if (master.ownerState !== "ON" || master.masterEnabled !== true) {
    chain = await store.upsert({
      ...chain,
      status: "ABORTED_SYSTEM_OFF",
      blockers: ["SYSTEM_MASTER_OFF"],
      note: "System Master OFF — Phase 3 aborted.",
    });
    return { chain, payloadPackage: null, boundary: null };
  }
  if (master.analysisGeneration !== input.analysisGeneration) {
    chain = await store.upsert({
      ...chain,
      status: "ABORTED_GENERATION",
      blockers: ["ANALYSIS_GENERATION_MISMATCH"],
      note: "System Master generation changed — Phase 3 aborted.",
    });
    return { chain, payloadPackage: null, boundary: null };
  }

  if (!input.precheckPassedDomain) {
    chain = await store.upsert({
      ...chain,
      status: "PRECHECK_VALIDATION_FAILED",
      blockers: ["PRECHECK_FAILED", String(input.precheckStatus || "UNKNOWN")],
      note: "Precheck not eligible for Phase 3 payload construction.",
    });
    return { chain, payloadPackage: null, boundary: null };
  }

  chain = await store.upsert({
    ...chain,
    status: "PAYLOAD_BUILDING",
    note: "Building FXCM TRUE_MARKET_OPEN payload from trusted proposal (no submission).",
  });

  const proposal = input.service.getProposal(input.proposalId);
  if (!proposal) {
    chain = await store.upsert({
      ...chain,
      status: "PAYLOAD_INVALID",
      blockers: ["PROPOSAL_MISSING"],
      note: "Trusted proposal missing — cannot build payload.",
    });
    return { chain, payloadPackage: null, boundary: null };
  }

  const accountId = input.service.getAccountIdForPayload();
  const contract = input.service.getContractMeta();
  const quote = input.service.getQuote();
  const built = buildFxcmTrueMarketOpenPayload({
    proposal,
    accountId: accountId || "MASKED_DEMO_ACCOUNT",
    offerId: contract.offerId,
    symbol: contract.symbol || proposal.instrument,
    baseUnitSize: contract.baseUnitSize,
    bid: quote.bid,
    ask: quote.ask,
    timeInForce: "IOC",
  });

  if (!built.ok || !built.payload) {
    chain = await store.upsert({
      ...chain,
      status: "PAYLOAD_INVALID",
      blockers: [built.ok === false ? built.code : "PAYLOAD_SCHEMA_INVALID"],
      direction: proposal.direction === "BUY" || proposal.direction === "SELL" ? proposal.direction : null,
      instrument: proposal.instrument,
      note: built.ok === false ? built.message : "Payload build failed.",
    });
    return { chain, payloadPackage: null, boundary: null };
  }

  // If we used a placeholder account id, force metadata failure unless real id provided.
  const accountMissing = !accountId;
  const pkg = validatePhase3PayloadPackage({
    proposal,
    payload: built.payload,
    precheckId: input.precheckId,
    precheckStatus: input.precheckStatus,
    precheckExpiresAtUtc: input.precheckExpiresAtUtc ?? null,
    precheckPassedDomain: input.precheckPassedDomain,
    handoffId: input.handoffId ?? null,
    analysisId: input.analysisId ?? null,
    intakeId: input.intakeId ?? null,
    riskDecisionId: input.riskDecisionId ?? null,
    offerId: contract.offerId,
    baseUnitSize: contract.baseUnitSize,
    quantityMin: contract.quantityMin,
    quantityStep: contract.quantityStep,
    contractSource: contract.contractSource,
    contractFresh: contract.contractFresh && !accountMissing,
    quoteBid: quote.bid,
    quoteAsk: quote.ask,
    quoteFresh: quote.fresh,
    individualOrderAllocation: proposal.capital?.individualOrderAllocation ?? null,
    modeledMaxLoss: proposal.perOrderRisk?.actualModeledMonetaryRisk ?? null,
    idempotencyKey: `phase3:${input.precheckId}:${proposal.proposalId}`,
    nowMs,
  });

  if (accountMissing && !pkg.blockers.includes("BROKER_METADATA_MISSING")) {
    pkg.blockers.push("BROKER_METADATA_MISSING");
    pkg.validationStatus = "PAYLOAD_INVALID";
  }

  if (pkg.validationStatus !== "PAYLOAD_VALIDATED") {
    chain = await store.upsert({
      ...chain,
      payloadId: pkg.payloadId,
      status: "PAYLOAD_INVALID",
      blockers: pkg.blockers,
      direction: pkg.direction,
      instrument: pkg.instrument,
      amount: pkg.amount,
      quantityLots: pkg.quantityLots,
      offerId: pkg.offerId,
      payloadRedacted: pkg.fxcmPayloadRedacted,
      note: pkg.note,
    });
    return { chain, payloadPackage: pkg, boundary: null };
  }

  chain = await store.upsert({
    ...chain,
    payloadId: pkg.payloadId,
    status: "PAYLOAD_VALIDATED",
    blockers: ["EXECUTION_DISABLED"],
    direction: pkg.direction,
    instrument: pkg.instrument,
    amount: pkg.amount,
    quantityLots: pkg.quantityLots,
    offerId: pkg.offerId,
    payloadRedacted: pkg.fxcmPayloadRedacted,
    note: "Payload VALIDATED — advancing to execution boundary (no submission).",
  });

  chain = await store.upsert({
    ...chain,
    status: "HANDOFF_VALIDATED",
    handoffId: input.handoffId ?? chain.handoffId,
    note: "Internal handoff record linked — reaching hard execution boundary.",
  });

  const safety = input.service.getSafety();
  const boundary = evaluateExecutionBoundary({
    payloadId: pkg.payloadId,
    handoffId: chain.handoffId,
    proposalId: chain.proposalId,
    precheckId: chain.precheckId,
    analysisId: chain.analysisId,
    instrument: chain.instrument,
    direction: chain.direction,
    executionMasterEnabled: safety.executionMasterEnabled,
    emergencyEntryLock: safety.emergencyEntryLock,
    demoMutationAllowed: safety.demoMutationAllowed,
    activeDemoGrant: safety.activeDemoGrant,
    nowMs,
  });

  chain = await store.upsert({
    ...chain,
    status: "EXECUTION_BLOCKED",
    executionBoundaryDecisionId: boundary.decisionId,
    boundaryStatus: "EXECUTION_BLOCKED",
    boundaryReason: boundary.reasonCode,
    blockers: boundary.reasons,
    note: boundary.note,
  });

  return { chain, payloadPackage: pkg, boundary };
}
