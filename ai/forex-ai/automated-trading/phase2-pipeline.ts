/**
 * Phase 2 — Automated Trading downstream orchestration.
 * ACCEPTED eligible intake → proposal → handoff validate → precheck.
 * Never submits broker orders. System Master OFF / generation mismatch aborts.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import type { AtResultIntakeRecord } from "./result-intake/types.js";
import { getAtSystemMasterStore } from "./system-master/store.js";

export const PHASE2_PIPELINE_SCHEMA = "at-phase2-pipeline-v1" as const;

export interface Phase2ChainRecord {
  schemaVersion: typeof PHASE2_PIPELINE_SCHEMA;
  analysisId: string;
  intakeId: string;
  proposalId: string | null;
  riskDecisionId: string | null;
  handoffId: string | null;
  precheckId: string | null;
  status:
    | "STARTED"
    | "ALLOCATION_BLOCKED"
    | "PROPOSAL_CREATED"
    | "PROPOSAL_REJECTED"
    | "HANDOFF_VALIDATED"
    | "HANDOFF_BLOCKED"
    | "PRECHECK_PASSED"
    | "PRECHECK_BLOCKED"
    | "ABORTED_SYSTEM_OFF"
    | "ABORTED_GENERATION"
    | "SKIPPED_INELIGIBLE"
    | "ERROR";
  blockers: string[];
  direction: "BUY" | "SELL" | "NO_TRADE" | null;
  analysisGeneration: number;
  startedAtUtc: string;
  updatedAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface Phase2PipelineStoreState {
  schemaVersion: typeof PHASE2_PIPELINE_SCHEMA;
  latest: Phase2ChainRecord | null;
  byAnalysisId: Record<string, Phase2ChainRecord>;
}

type DownstreamHook = (input: {
  record: AtResultIntakeRecord;
  analysisGeneration: number;
}) => Promise<void>;

let downstreamHook: DownstreamHook | null = null;

export function registerPhase2DownstreamHook(fn: DownstreamHook | null): void {
  downstreamHook = fn;
}

export function invokePhase2DownstreamHook(input: {
  record: AtResultIntakeRecord;
  analysisGeneration: number;
}): void {
  if (!downstreamHook) return;
  void downstreamHook(input).catch(() => undefined);
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "phase2-pipeline.json",
  );
}

function emptyState(): Phase2PipelineStoreState {
  return {
    schemaVersion: PHASE2_PIPELINE_SCHEMA,
    latest: null,
    byAnalysisId: {},
  };
}

export class AtPhase2PipelineStore {
  private data: Phase2PipelineStoreState;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const raw = readJsonSafeSync(this.file, null).value;
    this.data = normalizeState(raw);
  }

  getLatest(): Phase2ChainRecord | null {
    return this.data.latest ? { ...this.data.latest, blockers: [...this.data.latest.blockers] } : null;
  }

  getByAnalysisId(analysisId: string): Phase2ChainRecord | null {
    const hit = this.data.byAnalysisId[analysisId];
    return hit ? { ...hit, blockers: [...hit.blockers] } : null;
  }

  async upsert(record: Phase2ChainRecord): Promise<Phase2ChainRecord> {
    const next: Phase2ChainRecord = {
      ...record,
      schemaVersion: PHASE2_PIPELINE_SCHEMA,
      blockers: [...record.blockers],
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      updatedAtUtc: new Date().toISOString(),
    };
    this.data.byAnalysisId[next.analysisId] = next;
    this.data.latest = next;
    this.data.schemaVersion = PHASE2_PIPELINE_SCHEMA;
    await writeJsonAtomic(this.file, this.data);
    return this.getByAnalysisId(next.analysisId)!;
  }
}

function normalizeState(raw: unknown): Phase2PipelineStoreState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== PHASE2_PIPELINE_SCHEMA) return base;
  const by: Record<string, Phase2ChainRecord> = {};
  if (o.byAnalysisId && typeof o.byAnalysisId === "object") {
    for (const [k, v] of Object.entries(o.byAnalysisId as Record<string, unknown>)) {
      const n = normalizeRecord(v);
      if (n) by[k] = n;
    }
  }
  const latest = normalizeRecord(o.latest);
  return { schemaVersion: PHASE2_PIPELINE_SCHEMA, latest, byAnalysisId: by };
}

function normalizeRecord(raw: unknown): Phase2ChainRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.analysisId !== "string" || typeof o.intakeId !== "string") return null;
  return {
    schemaVersion: PHASE2_PIPELINE_SCHEMA,
    analysisId: o.analysisId,
    intakeId: o.intakeId,
    proposalId: typeof o.proposalId === "string" ? o.proposalId : null,
    riskDecisionId: typeof o.riskDecisionId === "string" ? o.riskDecisionId : null,
    handoffId: typeof o.handoffId === "string" ? o.handoffId : null,
    precheckId: typeof o.precheckId === "string" ? o.precheckId : null,
    status: (typeof o.status === "string" ? o.status : "ERROR") as Phase2ChainRecord["status"],
    blockers: Array.isArray(o.blockers) ? o.blockers.map(String).slice(0, 24) : [],
    direction:
      o.direction === "BUY" || o.direction === "SELL" || o.direction === "NO_TRADE"
        ? o.direction
        : null,
    analysisGeneration: Number.isFinite(Number(o.analysisGeneration))
      ? Math.floor(Number(o.analysisGeneration))
      : 0,
    startedAtUtc: typeof o.startedAtUtc === "string" ? o.startedAtUtc : new Date().toISOString(),
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : new Date().toISOString(),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: typeof o.note === "string" ? o.note.slice(0, 240) : "Phase 2 chain record.",
  };
}

let storeSingleton: AtPhase2PipelineStore | null = null;

export function getAtPhase2PipelineStore(storageRoot?: string): AtPhase2PipelineStore {
  if (storageRoot) return new AtPhase2PipelineStore(storageRoot);
  if (!storeSingleton) storeSingleton = new AtPhase2PipelineStore();
  return storeSingleton;
}

export function resetAtPhase2PipelineStoreForTests(): void {
  storeSingleton = null;
}

export type Phase2DownstreamService = {
  generateProposal: (input?: {
    autoLevels?: boolean;
    individualOrderAllocation?: unknown;
  }) => Promise<Record<string, unknown>>;
  validateHandoff: (input?: { proposalId?: string }) => Promise<Record<string, unknown>>;
  runBrokerPrecheck: (input?: {
    handoffId?: string | null;
    proposalId?: string | null;
  }) => Promise<Record<string, unknown>>;
  getProposalAllocationConfig?: () => Promise<{ individualOrderAllocation: number | null }>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

/**
 * Run Phase 2 downstream for an ACCEPTED eligible intake.
 * Stops at precheck. Never mutates broker.
 */
export async function runPhase2Downstream(input: {
  record: AtResultIntakeRecord;
  analysisGeneration: number;
  service: Phase2DownstreamService;
  store?: AtPhase2PipelineStore;
  nowMs?: number;
}): Promise<Phase2ChainRecord> {
  const store = input.store ?? getAtPhase2PipelineStore();
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  const existing = store.getByAnalysisId(input.record.analysisId);
  if (
    existing
    && existing.intakeId === input.record.resultId
    && existing.status !== "ERROR"
    && existing.status !== "ABORTED_SYSTEM_OFF"
    && existing.status !== "ABORTED_GENERATION"
  ) {
    return existing;
  }

  const base: Phase2ChainRecord = {
    schemaVersion: PHASE2_PIPELINE_SCHEMA,
    analysisId: input.record.analysisId,
    intakeId: input.record.resultId,
    proposalId: null,
    riskDecisionId: null,
    handoffId: null,
    precheckId: null,
    status: "STARTED",
    blockers: [],
    direction: input.record.decision === "BUY" || input.record.decision === "SELL"
      ? input.record.decision
      : input.record.canonicalDecision === "BUY" || input.record.canonicalDecision === "SELL"
        ? input.record.canonicalDecision
        : null,
    analysisGeneration: input.analysisGeneration,
    startedAtUtc: nowIso,
    updatedAtUtc: nowIso,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: "Phase 2 downstream started — proposal/handoff/precheck only.",
  };

  const master = getAtSystemMasterStore().get();
  if (master.ownerState !== "ON" || master.masterEnabled !== true) {
    return store.upsert({
      ...base,
      status: "ABORTED_SYSTEM_OFF",
      blockers: ["SYSTEM_MASTER_OFF"],
      note: "System Master OFF — Phase 2 downstream aborted.",
    });
  }
  if (master.analysisGeneration !== input.analysisGeneration) {
    return store.upsert({
      ...base,
      status: "ABORTED_GENERATION",
      blockers: ["ANALYSIS_GENERATION_MISMATCH"],
      note: "System Master generation changed — in-flight Phase 2 aborted.",
    });
  }
  if (!input.record.eligibleForOrderPreparation
    || (input.record.decision !== "BUY" && input.record.decision !== "SELL")) {
    return store.upsert({
      ...base,
      status: "SKIPPED_INELIGIBLE",
      blockers: ["NOT_ELIGIBLE_FOR_ORDER_PREPARATION"],
      note: "Intake accepted but not trade-eligible — directional bias preserved without proposal.",
    });
  }

  let allocation: number | null = null;
  try {
    if (input.service.getProposalAllocationConfig) {
      const cfg = await input.service.getProposalAllocationConfig();
      allocation = cfg.individualOrderAllocation;
    }
  } catch {
    allocation = null;
  }
  if (allocation == null || !Number.isFinite(allocation) || allocation <= 0) {
    return store.upsert({
      ...base,
      status: "ALLOCATION_BLOCKED",
      blockers: ["PER_ORDER_ALLOCATION_MISSING"],
      note: "individualOrderAllocation not configured — fail closed; no fabricated allocation.",
    });
  }

  // Re-check generation before paid/downstream work
  const masterBeforeProposal = getAtSystemMasterStore().get();
  if (
    masterBeforeProposal.ownerState !== "ON"
    || masterBeforeProposal.masterEnabled !== true
    || masterBeforeProposal.analysisGeneration !== input.analysisGeneration
  ) {
    return store.upsert({
      ...base,
      status: "ABORTED_SYSTEM_OFF",
      blockers: ["SYSTEM_MASTER_OFF_OR_GENERATION"],
      note: "System Master stopped before proposal generation.",
    });
  }

  const proposalOut = await input.service.generateProposal({
    autoLevels: true,
    individualOrderAllocation: allocation,
  });
  const proposal = asRecord(proposalOut.proposal);
  const proposalId = typeof proposal?.proposalId === "string" ? proposal.proposalId : null;
  const perOrderRisk = asRecord(proposalOut.perOrderRisk) ?? asRecord(proposal?.perOrderRisk);
  const riskDecisionId =
    typeof perOrderRisk?.decisionId === "string"
      ? perOrderRisk.decisionId
      : typeof perOrderRisk?.riskDecisionId === "string"
        ? perOrderRisk.riskDecisionId
        : null;
  const proposalStatus = String(proposal?.lifecycle ?? proposal?.status ?? "");
  const proposalBlockers = strArr(proposal?.blockers).concat(strArr(proposal?.blockerCodes));

  if (proposalOut.ok === false || !proposalId) {
    return store.upsert({
      ...base,
      proposalId,
      riskDecisionId,
      status: "PROPOSAL_REJECTED",
      blockers: proposalBlockers.length
        ? proposalBlockers
        : [String(proposalOut.code ?? "PROPOSAL_FAILED")],
      note: String(proposalOut.message ?? "Proposal generation failed."),
    });
  }

  const rejected =
    /REJECT|BLOCK|FAIL|INELIGIBLE/i.test(proposalStatus)
    || proposalBlockers.some((b) => /MISSING|BLOCK|REJECT|FAIL/i.test(b));
  if (rejected && !/READY|ACCEPTED|VALID/i.test(proposalStatus)) {
    return store.upsert({
      ...base,
      proposalId,
      riskDecisionId,
      status: "PROPOSAL_REJECTED",
      blockers: proposalBlockers.length ? proposalBlockers : [proposalStatus || "PROPOSAL_REJECTED"],
      note: "Proposal created but rejected/blocked — terminal for this analysis.",
    });
  }

  let chain = await store.upsert({
    ...base,
    proposalId,
    riskDecisionId,
    status: "PROPOSAL_CREATED",
    blockers: [],
    note: "Proposal created — validating handoff (read-only).",
  });

  const masterBeforeHandoff = getAtSystemMasterStore().get();
  if (
    masterBeforeHandoff.ownerState !== "ON"
    || masterBeforeHandoff.masterEnabled !== true
    || masterBeforeHandoff.analysisGeneration !== input.analysisGeneration
  ) {
    return store.upsert({
      ...chain,
      status: "ABORTED_SYSTEM_OFF",
      blockers: ["SYSTEM_MASTER_OFF_OR_GENERATION"],
      note: "System Master stopped before handoff validation.",
    });
  }

  const handoffOut = await input.service.validateHandoff({ proposalId });
  const handoff = asRecord(handoffOut.handoff) ?? asRecord(handoffOut.record);
  const handoffId = typeof handoff?.handoffId === "string" ? handoff.handoffId : null;
  const handoffBlockers = strArr(handoff?.blockers).concat(strArr(handoff?.blockerCodes));
  const handoffLifecycle = String(handoff?.lifecycle ?? handoff?.status ?? "");
  const handoffOk =
    handoffOut.ok !== false
    && Boolean(handoffId)
    && !/BLOCK|REJECT|FAIL|EXPIRED/i.test(handoffLifecycle);
  if (!handoffOk) {
    return store.upsert({
      ...chain,
      handoffId,
      status: "HANDOFF_BLOCKED",
      blockers: handoffBlockers.length
        ? handoffBlockers
        : [String(handoffOut.code ?? (handoffLifecycle || "HANDOFF_BLOCKED"))],
      note: String(handoffOut.message ?? "Handoff validation blocked."),
    });
  }

  chain = await store.upsert({
    ...chain,
    handoffId,
    status: "HANDOFF_VALIDATED",
    blockers: [],
    note: "Handoff validated — running pre-execution precheck (no submission).",
  });

  const masterBeforePrecheck = getAtSystemMasterStore().get();
  if (
    masterBeforePrecheck.ownerState !== "ON"
    || masterBeforePrecheck.masterEnabled !== true
    || masterBeforePrecheck.analysisGeneration !== input.analysisGeneration
  ) {
    return store.upsert({
      ...chain,
      status: "ABORTED_SYSTEM_OFF",
      blockers: ["SYSTEM_MASTER_OFF_OR_GENERATION"],
      note: "System Master stopped before precheck.",
    });
  }

  const precheckOut = await input.service.runBrokerPrecheck({
    handoffId,
    proposalId,
  });
  const validation = asRecord(precheckOut.validation);
  const precheckRec =
    asRecord(precheckOut.precheck)
    ?? asRecord(precheckOut.record)
    ?? validation;
  const precheckId =
    typeof precheckRec?.precheckId === "string"
      ? precheckRec.precheckId
      : typeof precheckRec?.validationId === "string"
        ? precheckRec.validationId
        : typeof validation?.id === "string"
          ? validation.id
          : null;
  const precheckBlockers = strArr(precheckRec?.blockers)
    .concat(strArr(precheckRec?.blockerCodes))
    .concat(strArr(validation?.blockers));
  const outcome = String(
    precheckRec?.outcome
    ?? precheckRec?.status
    ?? validation?.outcome
    ?? validation?.status
    ?? "",
  );
  const precheckPassed =
    precheckOut.ok !== false
    && precheckOut.mutatesBroker !== true
    && precheckOut.placesOrders !== true
    && (/PASS|PASSED|OK|VALID|ACCEPT/i.test(outcome) || (outcome === "" && precheckBlockers.length === 0 && precheckOut.executionAuthorized === false));

  return store.upsert({
    ...chain,
    precheckId,
    status: precheckPassed ? "PRECHECK_PASSED" : "PRECHECK_BLOCKED",
    blockers: precheckPassed
      ? []
      : (precheckBlockers.length
        ? precheckBlockers
        : [String(precheckOut.code ?? (outcome || "PRECHECK_BLOCKED"))]),
    note: precheckPassed
      ? "Precheck PASSED — pipeline terminates here. Broker execution DISABLED; no order submitted."
      : String(precheckOut.message ?? "Precheck blocked — no order submitted."),
  });
}
