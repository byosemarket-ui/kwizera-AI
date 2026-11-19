/**
 * Phase 5D.6 — JSON-file durable store for MIF opportunity runs/candidates.
 * Mirrors HfmAnalysisStorage atomic-write pattern under KWIZERA_STORAGE_ROOT.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MifProductionIntegrationResult } from "../types.js";
import type {
  MifCandidateLifecycleState,
  MifCandidateListFilter,
  MifCandidateOutcomeKind,
  MifPersistedAnalysisRun,
  MifPersistedCandidate,
  MifPersistedLifecycleEvent,
} from "./types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveMifOpportunityDir(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "mif", "opportunities");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, filePath);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const ALLOWED_TRANSITIONS: Record<MifCandidateLifecycleState, readonly MifCandidateLifecycleState[]> = {
  DETECTED: ["ACTIVE", "NEEDS_CONFIRMATION", "CONFIRMED", "INVALIDATED", "EXPIRED", "COMPLETED", "OUTCOME_UNKNOWN"],
  ACTIVE: ["NEEDS_CONFIRMATION", "CONFIRMED", "INVALIDATED", "EXPIRED", "COMPLETED", "OUTCOME_UNKNOWN"],
  NEEDS_CONFIRMATION: ["CONFIRMED", "INVALIDATED", "EXPIRED", "ACTIVE", "OUTCOME_UNKNOWN", "COMPLETED"],
  CONFIRMED: ["ACTIVE", "INVALIDATED", "EXPIRED", "COMPLETED", "OUTCOME_UNKNOWN"],
  INVALIDATED: ["OUTCOME_UNKNOWN"],
  EXPIRED: ["OUTCOME_UNKNOWN"],
  COMPLETED: ["OUTCOME_UNKNOWN"],
  OUTCOME_UNKNOWN: [],
  REJECTED: ["OUTCOME_UNKNOWN"],
  INVALID: ["OUTCOME_UNKNOWN"],
};

function mapInitialLifecycle(status: string): MifCandidateLifecycleState {
  switch (status) {
    case "DETECTED":
      return "DETECTED";
    case "NEEDS_CONFIRMATION":
      return "NEEDS_CONFIRMATION";
    case "INVALID":
      return "INVALID";
    case "REJECTED":
      return "REJECTED";
    default:
      return "DETECTED";
  }
}

export class MifOpportunityStorage {
  readonly root: string;
  readonly runsDir: string;
  readonly candidatesDir: string;
  readonly eventsDir: string;
  readonly indexPath: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveMifOpportunityDir(storageRoot);
    this.runsDir = path.join(this.root, "runs");
    this.candidatesDir = path.join(this.root, "candidates");
    this.eventsDir = path.join(this.root, "events");
    this.indexPath = path.join(this.root, "index.json");
  }

  async ensureReady(): Promise<void> {
    await ensureDir(this.runsDir);
    await ensureDir(this.candidatesDir);
    await ensureDir(this.eventsDir);
  }

  runPath(runId: string): string {
    return path.join(this.runsDir, `${runId}.json`);
  }

  candidatePath(candidateId: string): string {
    return path.join(this.candidatesDir, `${candidateId}.json`);
  }

  eventsPath(candidateId: string): string {
    return path.join(this.eventsDir, `${candidateId}.json`);
  }

  /**
   * Persist a completed analysis result idempotently by requestId/runId.
   * If the same requestId already exists, returns the existing run without overwrite.
   */
  async persistAnalysisResult(
    result: MifProductionIntegrationResult,
    opts?: { analysisStartedAt?: string; runId?: string },
  ): Promise<{ run: MifPersistedAnalysisRun; created: boolean; candidates: MifPersistedCandidate[] }> {
    await this.ensureReady();
    const analysisCompletedAt = result.processingTimestamp || new Date().toISOString();
    const analysisStartedAt = opts?.analysisStartedAt ?? analysisCompletedAt;
    const runId = opts?.runId || result.requestId || randomUUID();

    const existing = await this.getRun(runId);
    if (existing) {
      const cands = await this.listCandidates({ limit: 500 });
      return {
        run: existing,
        created: false,
        candidates: cands.items.filter((c) => c.runId === runId),
      };
    }

    const startedMs = Date.parse(analysisStartedAt);
    const completedMs = Date.parse(analysisCompletedAt);
    const processingDurationMs =
      Number.isFinite(startedMs) && Number.isFinite(completedMs)
        ? Math.max(0, completedMs - startedMs)
        : 0;

    // Strip debug context from persisted snapshot
    const { _debugContext: _drop, ...safeResult } = result as MifProductionIntegrationResult & {
      _debugContext?: unknown;
    };
    void _drop;

    const run: MifPersistedAnalysisRun = {
      schemaVersion: "1.0.0",
      runId,
      requestId: result.requestId,
      providerId: "HFM_MT5",
      providerSymbol: result.providerSymbol,
      requestedTimeframes: result.requestedTimeframes,
      resolvedTimeframes: result.resolvedTimeframes,
      primaryTimeframe: result.primaryTimeframe,
      marketDataTimestamp: result.marketDataTimestamp,
      analysisStartedAt,
      analysisCompletedAt,
      processingDurationMs,
      dataFreshness: result.dataFreshness,
      dataQualityStatus: result.dataQualityStatus,
      analysisStatus: result.analysisStatus,
      candidateCount: result.candidateCount,
      contractId: result.contractId,
      contractVersion: result.contractVersion,
      engineId: result.engineId,
      engineVersion: result.engineVersion,
      mtfRelation: result.mtfRelation,
      warnings: result.warnings,
      errors: result.errors,
      failureCodes: result.failureCodes,
      evidenceQualitySummary:
        (result as MifProductionIntegrationResult & { evidenceQuality?: Record<string, unknown> })
          .evidenceQuality
        ?? null,
      eligibility: (result.eligibility ?? []).map((e) => ({
        strategyId: String(e.strategyId),
        status: e.status,
      })),
      detectorOutcomes: (result.detection?.outcomes ?? []).map((o) => ({
        strategyId: String(o.strategyId),
        detectorId: o.detectorId,
        status: o.status,
      })),
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      resultSnapshot: safeResult as MifProductionIntegrationResult,
    };

    await atomicWrite(this.runPath(runId), `${JSON.stringify(run, null, 2)}\n`);

    const candidates: MifPersistedCandidate[] = [];
    const now = analysisCompletedAt;
    for (const cand of result.detection?.candidates ?? []) {
      // Idempotent: skip if candidate file already exists
      const prior = await this.getCandidate(cand.candidateId);
      if (prior) {
        candidates.push(prior);
        continue;
      }
      const lifecycleState = mapInitialLifecycle(cand.status);
      const persisted: MifPersistedCandidate = {
        schemaVersion: "1.0.0",
        candidateId: cand.candidateId,
        runId,
        strategyId: String(cand.strategyId),
        detectorId: cand.detectorId,
        providerId: "HFM_MT5",
        providerSymbol: cand.providerSymbol,
        direction: cand.direction,
        detectionStatus: cand.status,
        lifecycleState,
        timeframeRoles: cand.timeframeRoles as string[],
        assessmentTimestamp: cand.assessmentTimestamp,
        createdAt: now,
        updatedAt: now,
        supportingEvidenceIds: cand.supportingEvidenceIds,
        conflictingEvidenceIds: cand.conflictingEvidenceIds,
        requiredConfirmations: cand.requiredConfirmations,
        invalidationConditions: cand.invalidationConditions,
        dataQualityStatus: result.dataQualityStatus,
        mtfRelation: result.mtfRelation,
        thesis: cand.thesis,
        rationale: cand.rationale,
        outcomeKind: "NONE",
        candidateSnapshot: cand,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        notExecutable: true,
      };
      await atomicWrite(this.candidatePath(cand.candidateId), `${JSON.stringify(persisted, null, 2)}\n`);
      const birth: MifPersistedLifecycleEvent = {
        eventId: `${cand.candidateId}:birth`,
        runId,
        candidateId: cand.candidateId,
        fromState: null,
        toState: lifecycleState,
        reason: "candidate_persisted",
        observationOpenTimeSec: null,
        observedAt: now,
        outcomeKind: null,
        notes: "initial persistence from detection run",
      };
      await atomicWrite(this.eventsPath(cand.candidateId), `${JSON.stringify([birth], null, 2)}\n`);
      candidates.push(persisted);
    }

    await this.touchIndex(run);
    return { run, created: true, candidates };
  }

  private async touchIndex(run: MifPersistedAnalysisRun): Promise<void> {
    const idx = (await readJsonFile<{ runs: Array<{ runId: string; requestId: string; symbol: string; at: string }> }>(
      this.indexPath,
    )) ?? { runs: [] };
    if (!idx.runs.some((r) => r.runId === run.runId)) {
      idx.runs.unshift({
        runId: run.runId,
        requestId: run.requestId,
        symbol: run.providerSymbol,
        at: run.analysisCompletedAt,
      });
      idx.runs = idx.runs.slice(0, 5000);
      await atomicWrite(this.indexPath, `${JSON.stringify(idx, null, 2)}\n`);
    }
  }

  async getRun(runId: string): Promise<MifPersistedAnalysisRun | null> {
    return readJsonFile(this.runPath(runId));
  }

  async getCandidate(candidateId: string): Promise<MifPersistedCandidate | null> {
    return readJsonFile(this.candidatePath(candidateId));
  }

  async getCandidateHistory(candidateId: string): Promise<MifPersistedLifecycleEvent[]> {
    return (await readJsonFile<MifPersistedLifecycleEvent[]>(this.eventsPath(candidateId))) ?? [];
  }

  async listCandidates(filter: MifCandidateListFilter = {}): Promise<{
    items: MifPersistedCandidate[];
    total: number;
    limit: number;
    offset: number;
  }> {
    await this.ensureReady();
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50));
    const offset = Math.max(0, filter.offset ?? 0);
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.candidatesDir)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifPersistedCandidate[] = [];
    for (const name of names) {
      const c = await readJsonFile<MifPersistedCandidate>(path.join(this.candidatesDir, name));
      if (!c) continue;
      if (filter.providerSymbol && c.providerSymbol !== filter.providerSymbol.toUpperCase()) continue;
      if (filter.strategyId && c.strategyId !== filter.strategyId) continue;
      if (filter.direction && c.direction !== filter.direction) continue;
      if (filter.lifecycleState && c.lifecycleState !== filter.lifecycleState) continue;
      if (filter.fromIso && c.createdAt < filter.fromIso) continue;
      if (filter.toIso && c.createdAt > filter.toIso) continue;
      items.push(c);
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  async transitionLifecycle(input: {
    candidateId: string;
    toState: MifCandidateLifecycleState;
    reason: string;
    observationOpenTimeSec?: number | null;
    outcomeKind?: MifCandidateOutcomeKind | null;
    notes?: string;
  }): Promise<{ ok: boolean; candidate: MifPersistedCandidate | null; error?: string }> {
    const candidate = await this.getCandidate(input.candidateId);
    if (!candidate) return { ok: false, candidate: null, error: "candidate_not_found" };
    const allowed = ALLOWED_TRANSITIONS[candidate.lifecycleState] ?? [];
    if (input.toState !== candidate.lifecycleState && !allowed.includes(input.toState)) {
      return {
        ok: false,
        candidate,
        error: `invalid_transition ${candidate.lifecycleState}→${input.toState}`,
      };
    }
    if (input.toState === candidate.lifecycleState) {
      return { ok: true, candidate };
    }
    const now = new Date().toISOString();
    const event: MifPersistedLifecycleEvent = {
      eventId: `${input.candidateId}:${Date.now()}`,
      runId: candidate.runId,
      candidateId: input.candidateId,
      fromState: candidate.lifecycleState,
      toState: input.toState,
      reason: input.reason,
      observationOpenTimeSec: input.observationOpenTimeSec ?? null,
      observedAt: now,
      outcomeKind: input.outcomeKind ?? null,
      notes: input.notes ?? "",
    };
    const history = await this.getCandidateHistory(input.candidateId);
    history.push(event);
    const updated: MifPersistedCandidate = {
      ...candidate,
      lifecycleState: input.toState,
      updatedAt: now,
      outcomeKind: input.outcomeKind ?? candidate.outcomeKind,
    };
    await atomicWrite(this.candidatePath(input.candidateId), `${JSON.stringify(updated, null, 2)}\n`);
    await atomicWrite(this.eventsPath(input.candidateId), `${JSON.stringify(history, null, 2)}\n`);
    return { ok: true, candidate: updated };
  }
}

let singleton: MifOpportunityStorage | null = null;

export function getMifOpportunityStorage(): MifOpportunityStorage {
  if (!singleton) singleton = new MifOpportunityStorage();
  return singleton;
}

export function __setMifOpportunityStorageForTests(store: MifOpportunityStorage | null): void {
  singleton = store;
}
