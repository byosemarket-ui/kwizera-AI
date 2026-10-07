/**
 * Phase 23 — ForexMemoryService
 * Filesystem JSON under KWIZERA_STORAGE_ROOT/forex-memory (same pattern as Phase 19 knowledge).
 * Immutable analysis records; outcomes/mistakes append as linked records.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../storage/safe-json.js";
import { buildAnalysisMemoryFromPayload, type PersistAnalysisInput } from "./from-analysis.js";
import { aggregateLearning } from "./learning-engine.js";
import { detectMistakesForAnalysis } from "./mistake-engine.js";
import { evaluateScenarioOutcome } from "./outcome-engine.js";
import { formatMemoryContextForPrompt, retrieveRelevantMemory } from "./retrieve.js";
import {
  FOREX_MEMORY_SCHEMA_VERSION,
  type ForexAnalysisMemoryRecord,
  type ForexMemoryListQuery,
  type ForexMemoryRetrieveQuery,
  type ForexMemoryStoreFile,
  type ForexMistakeRecord,
  type ForexModelPerfCounters,
  type ForexScenarioOutcomeRecord,
} from "./types.js";

const EMPTY_STORE: ForexMemoryStoreFile = {
  version: 1,
  schemaVersion: FOREX_MEMORY_SCHEMA_VERSION,
  marketSnapshots: [],
  analyses: [],
  outcomes: [],
  mistakes: [],
  modelPerf: [],
};

const MAX_ANALYSES = 2000;
const MAX_SNAPSHOTS = 8000;
const MAX_OUTCOMES = 2000;
const MAX_MISTAKES = 4000;

export class ForexMemoryService {
  private readonly rootDir: string;
  private readonly storePath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.rootDir = path.join(storageRoot ?? resolveStorageRoot(), "forex-memory");
    this.storePath = path.join(this.rootDir, "store.json");
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    fs.mkdirSync(this.rootDir, { recursive: true });
    if (!fs.existsSync(this.storePath)) {
      await writeJsonAtomic(this.storePath, EMPTY_STORE);
    }
    this.ready = true;
  }

  private readStore(): ForexMemoryStoreFile {
    const result = readJsonSafeSync<ForexMemoryStoreFile>(this.storePath, EMPTY_STORE);
    const value = result.value ?? EMPTY_STORE;
    return {
      version: 1,
      schemaVersion: FOREX_MEMORY_SCHEMA_VERSION,
      marketSnapshots: Array.isArray(value.marketSnapshots) ? value.marketSnapshots : [],
      analyses: Array.isArray(value.analyses) ? value.analyses : [],
      outcomes: Array.isArray(value.outcomes) ? value.outcomes : [],
      mistakes: Array.isArray(value.mistakes) ? value.mistakes : [],
      modelPerf: Array.isArray(value.modelPerf) ? value.modelPerf : [],
    };
  }

  private enqueueWrite(mutator: (store: ForexMemoryStoreFile) => void): Promise<ForexMemoryStoreFile> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readStore();
      mutator(store);
      // retention caps (oldest drop) — never silently wipe recent journal
      if (store.analyses.length > MAX_ANALYSES) {
        store.analyses = store.analyses.slice(-MAX_ANALYSES);
      }
      if (store.marketSnapshots.length > MAX_SNAPSHOTS) {
        store.marketSnapshots = store.marketSnapshots.slice(-MAX_SNAPSHOTS);
      }
      if (store.outcomes.length > MAX_OUTCOMES) {
        store.outcomes = store.outcomes.slice(-MAX_OUTCOMES);
      }
      if (store.mistakes.length > MAX_MISTAKES) {
        store.mistakes = store.mistakes.slice(-MAX_MISTAKES);
      }
      await writeJsonAtomic(this.storePath, store);
      return store;
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private bumpModelPerf(
    store: ForexMemoryStoreFile,
    record: ForexAnalysisMemoryRecord,
  ): void {
    const modelId = record.modelId || "unknown";
    let row = store.modelPerf.find((m) => m.modelId === modelId);
    if (!row) {
      row = {
        modelId,
        totalAnalyses: 0,
        validJsonOrModelNarrative: 0,
        deterministicFallback: 0,
        groundingRejected: 0,
        timeoutOrUnavailable: 0,
        totalLatencyMs: 0,
        totalPromptChars: 0,
        samplesWithLatency: 0,
        samplesWithPrompt: 0,
      };
      store.modelPerf.push(row);
    }
    row.totalAnalyses += 1;
    if (record.analysisStatus === "FALLBACK") row.deterministicFallback += 1;
    if (record.narrativeStatus === "MODEL") row.validJsonOrModelNarrative += 1;
    if (record.latencyMs != null) {
      row.totalLatencyMs += record.latencyMs;
      row.samplesWithLatency += 1;
    }
    if (record.promptChars != null) {
      row.totalPromptChars += record.promptChars;
      row.samplesWithPrompt += 1;
    }
  }

  /** Persist analysis snapshot (idempotent by idempotencyKey). */
  async persistAnalysis(input: PersistAnalysisInput): Promise<{
    created: boolean;
    analysis: ForexAnalysisMemoryRecord;
    mistakes: ForexMistakeRecord[];
  }> {
    const built = buildAnalysisMemoryFromPayload(input);
    if (!built.record.symbol || !/^[A-Z0-9]{4,30}$/.test(built.record.symbol)) {
      throw new Error("Invalid symbol for memory persistence.");
    }

    let created = false;
    let mistakes: ForexMistakeRecord[] = [];
    let analysis = built.record;

    await this.enqueueWrite((store) => {
      const existing = store.analyses.find((a) => a.idempotencyKey === built.record.idempotencyKey);
      if (existing) {
        analysis = existing;
        created = false;
        return;
      }
      // Never mutate prior records — append only
      store.marketSnapshots.push(...built.marketSnapshots);
      store.analyses.push(built.record);
      this.bumpModelPerf(store, built.record);
      mistakes = detectMistakesForAnalysis(built.record, null);
      store.mistakes.push(...mistakes);
      analysis = built.record;
      created = true;
    });

    return { created, analysis, mistakes };
  }

  async getAnalysis(id: string): Promise<ForexAnalysisMemoryRecord | null> {
    await this.ensureReady();
    return this.readStore().analyses.find((a) => a.id === id) ?? null;
  }

  async listAnalyses(query: ForexMemoryListQuery = {}): Promise<{
    total: number;
    items: Array<ForexAnalysisMemoryRecord & { outcomeStatus: string | null }>;
  }> {
    await this.ensureReady();
    const store = this.readStore();
    const outcomeByAnalysis = new Map(store.outcomes.map((o) => [o.analysisId, o]));
    let items = [...store.analyses].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    if (query.symbol) items = items.filter((a) => a.symbol === query.symbol!.toUpperCase());
    if (query.scenario) items = items.filter((a) => a.scenario === query.scenario);
    if (query.analysisType) items = items.filter((a) => a.analysisType === query.analysisType);
    if (query.timeframe) {
      items = items.filter((a) => a.timeframes.includes(query.timeframe!));
    }
    if (query.outcome) {
      items = items.filter((a) => (outcomeByAnalysis.get(a.id)?.status ?? "NONE") === query.outcome);
    }
    const total = items.length;
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const page = items.slice(offset, offset + limit).map((a) => ({
      ...a,
      outcomeStatus: outcomeByAnalysis.get(a.id)?.status ?? null,
    }));
    return { total, items: page };
  }

  async listOutcomes(query: ForexMemoryListQuery = {}): Promise<{ total: number; items: ForexScenarioOutcomeRecord[] }> {
    await this.ensureReady();
    let items = [...this.readStore().outcomes].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
    if (query.symbol) items = items.filter((o) => o.symbol === query.symbol!.toUpperCase());
    if (query.scenario) items = items.filter((o) => o.scenario === query.scenario);
    if (query.outcome || query.status) {
      const status = query.outcome ?? query.status;
      items = items.filter((o) => o.status === status);
    }
    const total = items.length;
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    return { total, items: items.slice(offset, offset + limit) };
  }

  async listMistakes(query: ForexMemoryListQuery = {}): Promise<{ total: number; items: ForexMistakeRecord[] }> {
    await this.ensureReady();
    let items = [...this.readStore().mistakes].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    if (query.symbol) items = items.filter((m) => m.symbol === query.symbol!.toUpperCase());
    if (query.scenario) items = items.filter((m) => m.scenario === query.scenario);
    const total = items.length;
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    return { total, items: items.slice(offset, offset + limit) };
  }

  async getLearning() {
    await this.ensureReady();
    const store = this.readStore();
    return aggregateLearning(store);
  }

  async retrieve(query: ForexMemoryRetrieveQuery) {
    await this.ensureReady();
    const store = this.readStore();
    return retrieveRelevantMemory({
      analyses: store.analyses,
      outcomes: store.outcomes,
      query,
    });
  }

  formatContextForPrompt(query: ForexMemoryRetrieveQuery): Promise<string> {
    return this.retrieve(query).then(formatMemoryContextForPrompt);
  }

  /**
   * Evaluate a stored analysis against a later server-sourced price.
   * Does not rewrite the original analysis record.
   */
  async evaluateAnalysis(input: {
    analysisId: string;
    laterPrice: number | null;
    laterTimestamp: string | null;
    historicalAvailable: boolean;
  }): Promise<{ outcome: ForexScenarioOutcomeRecord; mistakes: ForexMistakeRecord[] }> {
    await this.ensureReady();
    const store = this.readStore();
    const analysis = store.analyses.find((a) => a.id === input.analysisId);
    if (!analysis) throw new Error(`Analysis not found: ${input.analysisId}`);

    // Preserve immutability: clone for evaluation, never mutate analysis fields
    const frozen = structuredClone(analysis);
    const outcome = evaluateScenarioOutcome({
      analysis: frozen,
      laterPrice: input.laterPrice,
      laterTimestamp: input.laterTimestamp,
      historicalAvailable: input.historicalAvailable,
    });
    const mistakes = detectMistakesForAnalysis(frozen, outcome);

    await this.enqueueWrite((s) => {
      // Replace prior PENDING outcome for same analysis if present
      s.outcomes = s.outcomes.filter((o) => !(o.analysisId === analysis.id && o.status === "PENDING"));
      const existingFinal = s.outcomes.find((o) => o.analysisId === analysis.id && o.status !== "PENDING");
      if (existingFinal && outcome.status === "PENDING") {
        // keep existing final
        return;
      }
      if (existingFinal && existingFinal.status === outcome.status) {
        return;
      }
      s.outcomes.push(outcome);
      const idx = s.analyses.findIndex((a) => a.id === analysis.id);
      if (idx >= 0) {
        // Only allow linking outcomeId — do not rewrite original analysis body fields
        s.analyses[idx] = { ...s.analyses[idx]!, outcomeId: outcome.id };
      }
      s.mistakes.push(...mistakes);
    });

    return { outcome, mistakes };
  }

  async overview() {
    await this.ensureReady();
    const store = this.readStore();
    const learning = aggregateLearning(store);
    return {
      schemaVersion: FOREX_MEMORY_SCHEMA_VERSION,
      analyses: store.analyses.length,
      outcomes: store.outcomes.length,
      mistakes: store.mistakes.length,
      marketSnapshots: store.marketSnapshots.length,
      pendingOutcomes: learning.totals.pendingOutcomes,
      recentAnalyses: store.analyses
        .slice()
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .slice(0, 8)
        .map((a) => ({
          id: a.id,
          symbol: a.symbol,
          scenario: a.scenario,
          posture: a.decisionPosture,
          generatedAt: a.generatedAt,
          analysisType: a.analysisType,
          dataQuality: a.dataQuality,
        })),
      modelTraining: false,
      note: "External memory only — Ollama model weights are never modified.",
    };
  }
}

let singleton: ForexMemoryService | null = null;

export function createForexMemoryService(storageRoot?: string): ForexMemoryService {
  return new ForexMemoryService(storageRoot);
}

export function getForexMemoryService(): ForexMemoryService {
  singleton ??= new ForexMemoryService();
  return singleton;
}

/** Test helper */
export function resetForexMemoryServiceForTests(): void {
  singleton = null;
}

export function newMemoryId(): string {
  return randomUUID();
}
