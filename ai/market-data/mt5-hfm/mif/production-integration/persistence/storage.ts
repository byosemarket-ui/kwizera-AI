/**
 * Phase 5D.6/5D.7 — JSON-file durable store for MIF opportunity runs/candidates.
 * Atomic writes + corrupt quarantine + index rebuild. Never silently discards history.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MifProductionIntegrationResult } from "../types.js";
import type { MifOutcomeEvaluationRecord } from "../outcome-evaluation.js";
import type { MifHistoricalReplayRun } from "../historical-replay.js";
import type { MifOpportunityRankingRun } from "../../opportunity-ranking/types.js";
import type {
  MifCalibrationRun,
  MifEvidenceIntelligenceAssessment,
  MifProbabilityAssessment,
  MifProbabilityBundle,
} from "../../probability-intelligence/types.js";
import type { MifAiMarketReasoningRun } from "../../ai-market-reasoning/types.js";
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

/**
 * Crash-safe atomic replacement: write temp → fsync → rename.
 * On Windows rename over existing may fail; unlink then rename as fallback.
 */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, filePath);
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {
      /* target may not exist */
    }
    await fs.rename(tmp, filePath);
  }
}

export interface MifJsonReadResult<T> {
  ok: boolean;
  value: T | null;
  corrupt: boolean;
  error?: string;
}

async function quarantineCorrupt(filePath: string, reason: string): Promise<void> {
  const corruptDir = path.join(path.dirname(filePath), "_corrupt");
  await ensureDir(corruptDir);
  const base = path.basename(filePath);
  const dest = path.join(corruptDir, `${base}.${Date.now()}.corrupt`);
  try {
    await fs.rename(filePath, dest);
    await fs.writeFile(
      `${dest}.reason.txt`,
      `${reason}\noriginal=${filePath}\n`,
      "utf8",
    );
  } catch {
    /* best-effort quarantine — never delete original without rename */
  }
}

async function readJsonFileDetailed<T>(filePath: string): Promise<MifJsonReadResult<T>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) {
      await quarantineCorrupt(filePath, "empty_file");
      return { ok: false, value: null, corrupt: true, error: "empty_file" };
    }
    try {
      return { ok: true, value: JSON.parse(raw) as T, corrupt: false };
    } catch (err) {
      await quarantineCorrupt(
        filePath,
        err instanceof Error ? err.message : "json_parse_error",
      );
      return {
        ok: false,
        value: null,
        corrupt: true,
        error: err instanceof Error ? err.message : "json_parse_error",
      };
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { ok: true, value: null, corrupt: false };
    return {
      ok: false,
      value: null,
      corrupt: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const r = await readJsonFileDetailed<T>(filePath);
  return r.value;
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

/** Default retention: keep newest N runs in index; files retained unless prune called. */
export const MIF_OPPORTUNITY_INDEX_RETENTION = 5000 as const;

export class MifOpportunityStorage {
  readonly root: string;
  readonly runsDir: string;
  readonly candidatesDir: string;
  readonly eventsDir: string;
  readonly outcomesDir: string;
  readonly replaysDir: string;
  readonly rankingsDir: string;
  readonly evidenceIntelDir: string;
  readonly probabilityDir: string;
  readonly calibrationDir: string;
  readonly aiReasoningDir: string;
  readonly indexPath: string;
  /** Simple in-process mutex for concurrent API writes. */
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot = resolveStorageRoot()) {
    this.root = resolveMifOpportunityDir(storageRoot);
    this.runsDir = path.join(this.root, "runs");
    this.candidatesDir = path.join(this.root, "candidates");
    this.eventsDir = path.join(this.root, "events");
    this.outcomesDir = path.join(this.root, "outcomes");
    this.replaysDir = path.join(this.root, "replays");
    this.rankingsDir = path.join(this.root, "rankings");
    this.evidenceIntelDir = path.join(this.root, "evidence-intelligence");
    this.probabilityDir = path.join(this.root, "probability-assessments");
    this.calibrationDir = path.join(this.root, "calibration-runs");
    this.aiReasoningDir = path.join(this.root, "ai-market-reasoning");
    this.indexPath = path.join(this.root, "index.json");
  }

  async ensureReady(): Promise<void> {
    await ensureDir(this.runsDir);
    await ensureDir(this.candidatesDir);
    await ensureDir(this.eventsDir);
    await ensureDir(this.outcomesDir);
    await ensureDir(this.replaysDir);
    await ensureDir(this.rankingsDir);
    await ensureDir(this.evidenceIntelDir);
    await ensureDir(this.probabilityDir);
    await ensureDir(this.calibrationDir);
    await ensureDir(this.aiReasoningDir);
  }

  /** Serialize mutating operations within this process. */
  private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const prev = this.writeChain;
    this.writeChain = prev.then(() => gate);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
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

  outcomePath(evaluationId: string): string {
    return path.join(this.outcomesDir, `${evaluationId.replace(/[^a-zA-Z0-9._:-]/g, "_")}.json`);
  }

  replayPath(runId: string): string {
    return path.join(this.replaysDir, `${runId.replace(/[^a-zA-Z0-9._:-]/g, "_")}.json`);
  }

  rankingPath(rankingRunId: string): string {
    // Strip ':' — invalid on Windows paths (rank:<uuid> style ids).
    return path.join(
      this.rankingsDir,
      `${rankingRunId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
    );
  }

  evidenceIntelPath(assessmentId: string): string {
    return path.join(
      this.evidenceIntelDir,
      `${assessmentId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
    );
  }

  probabilityPath(assessmentId: string): string {
    return path.join(
      this.probabilityDir,
      `${assessmentId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
    );
  }

  calibrationPath(calibrationRunId: string): string {
    return path.join(
      this.calibrationDir,
      `${calibrationRunId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
    );
  }

  aiReasoningPath(reasoningRunId: string): string {
    return path.join(
      this.aiReasoningDir,
      `${reasoningRunId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
    );
  }

  /**
   * Persist a completed analysis result idempotently by requestId/runId.
   * If the same requestId already exists, returns the existing run without overwrite.
   */
  async persistAnalysisResult(
    result: MifProductionIntegrationResult,
    opts?: { analysisStartedAt?: string; runId?: string },
  ): Promise<{
    run: MifPersistedAnalysisRun;
    created: boolean;
    candidates: MifPersistedCandidate[];
    rankingRunId: string | null;
    probabilityAssessmentIds: string[];
  }> {
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
        rankingRunId: result.ranking?.rankingRunId ?? null,
        probabilityAssessmentIds: [],
      };
    }

    const startedMs = Date.parse(analysisStartedAt);
    const completedMs = Date.parse(analysisCompletedAt);
    const processingDurationMs =
      Number.isFinite(startedMs) && Number.isFinite(completedMs)
        ? Math.max(0, completedMs - startedMs)
        : 0;

    // Strip debug/internal payloads from persisted snapshot (ranking/prob stored separately)
    const {
      _debugContext: _drop,
      _rankingRun: rankingRun,
      _probabilityBundles: probabilityBundles,
      ...safeResult
    } = result as MifProductionIntegrationResult & {
      _debugContext?: unknown;
      _rankingRun?: MifOpportunityRankingRun | null;
      _probabilityBundles?: readonly MifProbabilityBundle[] | null;
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

    let rankingRunId: string | null = null;
    if (rankingRun && rankingRun.rankingRunId) {
      const saved = await this.persistRankingRun(rankingRun);
      rankingRunId = rankingRun.rankingRunId;
      void saved;
    } else if (result.ranking?.rankingRunId) {
      rankingRunId = result.ranking.rankingRunId;
    }

    const probabilityAssessmentIds: string[] = [];
    if (probabilityBundles?.length) {
      for (const bundle of probabilityBundles) {
        await this.persistEvidenceIntelligence(bundle.evidence);
        await this.persistProbabilityAssessment(bundle.probability);
        probabilityAssessmentIds.push(bundle.probability.assessmentId);
      }
    }

    return { run, created: true, candidates, rankingRunId, probabilityAssessmentIds };
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
      idx.runs = idx.runs.slice(0, MIF_OPPORTUNITY_INDEX_RETENTION);
      await atomicWrite(this.indexPath, `${JSON.stringify(idx, null, 2)}\n`);
    }
  }

  /**
   * Rebuild index from runs/ directory. Quarantines corrupt run files; never deletes them.
   */
  async rebuildIndex(): Promise<{
    ok: boolean;
    indexed: number;
    corrupt: number;
    errors: string[];
  }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const errors: string[] = [];
      let indexed = 0;
      let corrupt = 0;
      let names: string[] = [];
      try {
        names = (await fs.readdir(this.runsDir)).filter((n) => n.endsWith(".json"));
      } catch (err) {
        return {
          ok: false,
          indexed: 0,
          corrupt: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        };
      }
      const runs: Array<{ runId: string; requestId: string; symbol: string; at: string }> = [];
      for (const name of names) {
        const detailed = await readJsonFileDetailed<MifPersistedAnalysisRun>(
          path.join(this.runsDir, name),
        );
        if (detailed.corrupt) {
          corrupt += 1;
          errors.push(`${name}: ${detailed.error ?? "corrupt"}`);
          continue;
        }
        if (!detailed.value) continue;
        const run = detailed.value;
        if (run.schemaVersion !== "1.0.0" || !run.runId) {
          corrupt += 1;
          errors.push(`${name}: schema_invalid`);
          await quarantineCorrupt(
            path.join(this.runsDir, name),
            "schema_invalid",
          );
          continue;
        }
        runs.push({
          runId: run.runId,
          requestId: run.requestId,
          symbol: run.providerSymbol,
          at: run.analysisCompletedAt,
        });
        indexed += 1;
      }
      runs.sort((a, b) => b.at.localeCompare(a.at));
      await atomicWrite(
        this.indexPath,
        `${JSON.stringify({ schemaVersion: "1.0.0", rebuiltAt: new Date().toISOString(), runs: runs.slice(0, MIF_OPPORTUNITY_INDEX_RETENTION) }, null, 2)}\n`,
      );
      return { ok: true, indexed, corrupt, errors };
    });
  }

  async getRun(runId: string): Promise<MifPersistedAnalysisRun | null> {
    const r = await readJsonFileDetailed<MifPersistedAnalysisRun>(this.runPath(runId));
    return r.value;
  }

  async getCandidate(candidateId: string): Promise<MifPersistedCandidate | null> {
    const r = await readJsonFileDetailed<MifPersistedCandidate>(this.candidatePath(candidateId));
    return r.value;
  }

  async getCandidateHistory(candidateId: string): Promise<MifPersistedLifecycleEvent[]> {
    const r = await readJsonFileDetailed<MifPersistedLifecycleEvent[]>(
      this.eventsPath(candidateId),
    );
    return r.value ?? [];
  }

  async persistOutcomeEvaluation(
    record: MifOutcomeEvaluationRecord,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.outcomePath(record.evaluationId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(record, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getOutcomeEvaluation(
    evaluationId: string,
  ): Promise<MifOutcomeEvaluationRecord | null> {
    return readJsonFile(this.outcomePath(evaluationId));
  }

  async listOutcomeEvaluations(filter?: {
    candidateId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: MifOutcomeEvaluationRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    await this.ensureReady();
    const limit = Math.min(200, Math.max(1, filter?.limit ?? 50));
    const offset = Math.max(0, filter?.offset ?? 0);
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.outcomesDir)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifOutcomeEvaluationRecord[] = [];
    for (const name of names) {
      const r = await readJsonFileDetailed<MifOutcomeEvaluationRecord>(
        path.join(this.outcomesDir, name),
      );
      if (!r.value) continue;
      if (filter?.candidateId && r.value.candidateId !== filter.candidateId) continue;
      items.push(r.value);
    }
    items.sort((a, b) => b.evaluationTimestamp.localeCompare(a.evaluationTimestamp));
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  async persistReplayRun(
    run: MifHistoricalReplayRun,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.replayPath(run.runId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(run, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getReplayRun(runId: string): Promise<MifHistoricalReplayRun | null> {
    return readJsonFile(this.replayPath(runId));
  }

  async persistRankingRun(
    run: MifOpportunityRankingRun,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.rankingPath(run.rankingRunId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(run, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getRankingRun(rankingRunId: string): Promise<MifOpportunityRankingRun | null> {
    return readJsonFile(this.rankingPath(rankingRunId));
  }

  async persistEvidenceIntelligence(
    assessment: MifEvidenceIntelligenceAssessment,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.evidenceIntelPath(assessment.assessmentId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(assessment, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getEvidenceIntelligence(
    assessmentId: string,
  ): Promise<MifEvidenceIntelligenceAssessment | null> {
    return readJsonFile(this.evidenceIntelPath(assessmentId));
  }

  async persistProbabilityAssessment(
    assessment: MifProbabilityAssessment,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.probabilityPath(assessment.assessmentId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(assessment, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getProbabilityAssessment(
    assessmentId: string,
  ): Promise<MifProbabilityAssessment | null> {
    return readJsonFile(this.probabilityPath(assessmentId));
  }

  async listProbabilityAssessments(filter?: {
    providerSymbol?: string;
    strategyId?: string;
    fromIso?: string;
    toIso?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: MifProbabilityAssessment[];
    total: number;
    limit: number;
    offset: number;
  }> {
    await this.ensureReady();
    const limit = Math.min(200, Math.max(1, filter?.limit ?? 50));
    const offset = Math.max(0, filter?.offset ?? 0);
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.probabilityDir)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifProbabilityAssessment[] = [];
    for (const name of names) {
      const r = await readJsonFileDetailed<MifProbabilityAssessment>(
        path.join(this.probabilityDir, name),
      );
      if (!r.ok || !r.value) continue;
      const a = r.value;
      if (
        filter?.providerSymbol
        && a.providerSymbol.toUpperCase() !== filter.providerSymbol.toUpperCase()
      ) {
        continue;
      }
      if (filter?.strategyId && a.strategyId !== filter.strategyId) continue;
      if (filter?.fromIso && a.calculatedAt < filter.fromIso) continue;
      if (filter?.toIso && a.calculatedAt > filter.toIso) continue;
      items.push(a);
    }
    items.sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  async persistCalibrationRun(
    run: MifCalibrationRun,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.calibrationPath(run.calibrationRunId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(run, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getCalibrationRun(calibrationRunId: string): Promise<MifCalibrationRun | null> {
    return readJsonFile(this.calibrationPath(calibrationRunId));
  }

  async persistAiMarketReasoning(
    run: MifAiMarketReasoningRun,
  ): Promise<{ ok: boolean; path: string; created: boolean }> {
    await this.ensureReady();
    return this.withWriteLock(async () => {
      const p = this.aiReasoningPath(run.reasoningRunId);
      const existing = await readJsonFile(p);
      if (existing) return { ok: true, path: p, created: false };
      await atomicWrite(p, `${JSON.stringify(run, null, 2)}\n`);
      return { ok: true, path: p, created: true };
    });
  }

  async getAiMarketReasoning(reasoningRunId: string): Promise<MifAiMarketReasoningRun | null> {
    return readJsonFile(this.aiReasoningPath(reasoningRunId));
  }

  async listAiMarketReasoning(filter?: {
    providerSymbol?: string;
    analysisRunId?: string;
    fromIso?: string;
    toIso?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: MifAiMarketReasoningRun[];
    total: number;
    limit: number;
    offset: number;
  }> {
    await this.ensureReady();
    const limit = Math.min(100, Math.max(1, filter?.limit ?? 50));
    const offset = Math.max(0, filter?.offset ?? 0);
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.aiReasoningDir)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifAiMarketReasoningRun[] = [];
    for (const name of names) {
      const r = await readJsonFileDetailed<MifAiMarketReasoningRun>(
        path.join(this.aiReasoningDir, name),
      );
      if (!r.ok || !r.value) continue;
      const a = r.value;
      if (
        filter?.providerSymbol
        && a.providerSymbol.toUpperCase() !== filter.providerSymbol.toUpperCase()
      ) {
        continue;
      }
      if (filter?.analysisRunId && a.analysisRunId !== filter.analysisRunId) continue;
      if (filter?.fromIso && a.calculatedAt < filter.fromIso) continue;
      if (filter?.toIso && a.calculatedAt > filter.toIso) continue;
      items.push(a);
    }
    items.sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  async listRankingRuns(filter?: {
    providerSymbol?: string;
    strategyId?: string;
    fromIso?: string;
    toIso?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: MifOpportunityRankingRun[];
    total: number;
    limit: number;
    offset: number;
  }> {
    await this.ensureReady();
    const limit = Math.min(200, Math.max(1, filter?.limit ?? 50));
    const offset = Math.max(0, filter?.offset ?? 0);
    let names: string[] = [];
    try {
      names = (await fs.readdir(this.rankingsDir)).filter((n) => n.endsWith(".json"));
    } catch {
      names = [];
    }
    const items: MifOpportunityRankingRun[] = [];
    for (const name of names) {
      const r = await readJsonFileDetailed<MifOpportunityRankingRun>(
        path.join(this.rankingsDir, name),
      );
      if (!r.value) continue;
      if (
        filter?.providerSymbol
        && r.value.providerSymbol
        && r.value.providerSymbol !== filter.providerSymbol.toUpperCase()
      ) {
        continue;
      }
      if (filter?.strategyId && r.value.strategyFilter !== filter.strategyId) continue;
      if (filter?.fromIso && r.value.completedAt < filter.fromIso) continue;
      if (filter?.toIso && r.value.completedAt > filter.toIso) continue;
      items.push(r.value);
    }
    items.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
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
    return this.withWriteLock(async () => {
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
      // Append-only: never rewrite prior events; push only.
      history.push(event);
      const updated: MifPersistedCandidate = {
        ...candidate,
        lifecycleState: input.toState,
        updatedAt: now,
        outcomeKind: input.outcomeKind ?? candidate.outcomeKind,
      };
      await atomicWrite(
        this.candidatePath(input.candidateId),
        `${JSON.stringify(updated, null, 2)}\n`,
      );
      await atomicWrite(
        this.eventsPath(input.candidateId),
        `${JSON.stringify(history, null, 2)}\n`,
      );
      return { ok: true, candidate: updated };
    });
  }

  /**
   * Integrity audit: count files, detect missing schema, report disk readiness.
   * Does not delete or migrate.
   */
  async auditIntegrity(): Promise<{
    ok: boolean;
    runs: number;
    candidates: number;
    events: number;
    outcomes: number;
    replays: number;
    rankings: number;
    evidenceIntelligence: number;
    probabilityAssessments: number;
    calibrationRuns: number;
    aiMarketReasoning: number;
    indexEntries: number;
    corruptQuarantinedHint: string;
    permissionsWritable: boolean;
  }> {
    await this.ensureReady();
    const count = async (dir: string) => {
      try {
        return (await fs.readdir(dir)).filter((n) => n.endsWith(".json")).length;
      } catch {
        return 0;
      }
    };
    let permissionsWritable = true;
    try {
      const probe = path.join(this.root, `.write-probe.${process.pid}`);
      await fs.writeFile(probe, "ok", "utf8");
      await fs.unlink(probe);
    } catch {
      permissionsWritable = false;
    }
    const idx = await readJsonFile<{ runs: unknown[] }>(this.indexPath);
    return {
      ok: permissionsWritable,
      runs: await count(this.runsDir),
      candidates: await count(this.candidatesDir),
      events: await count(this.eventsDir),
      outcomes: await count(this.outcomesDir),
      replays: await count(this.replaysDir),
      rankings: await count(this.rankingsDir),
      evidenceIntelligence: await count(this.evidenceIntelDir),
      probabilityAssessments: await count(this.probabilityDir),
      calibrationRuns: await count(this.calibrationDir),
      aiMarketReasoning: await count(this.aiReasoningDir),
      indexEntries: idx?.runs?.length ?? 0,
      corruptQuarantinedHint: path.join(this.runsDir, "_corrupt"),
      permissionsWritable,
    };
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
