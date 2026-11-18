/**
 * Phase 4 — backend-owned Auto Analysis scheduler (completion + 30m).
 * Analysis-only: never places orders or mutates broker state.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { getHfmCatalogService } from "../../catalog-service.js";
import { prepareHfmAnalysisContext } from "../orchestrator.js";
import type { HfmAnalysisContextResult } from "../types.js";
import { resolveHfmAnalysisDir } from "../storage.js";
import {
  getActiveReasoningRecord,
  isReasoningLocked,
} from "./job.js";
import { runHfmAiReasoning } from "./engine.js";
import type { HfmReasoningRecord } from "./types.js";

type PrepareFn = (input: {
  symbol: string;
  chartTimeframe?: string;
  refresh?: boolean;
}) => Promise<HfmAnalysisContextResult>;

type ReasonFn = (input: { contextId: string }) => Promise<HfmReasoningRecord>;

type SymbolValidator = (
  symbol: string,
) => Promise<{ ok: true; symbol: string } | { ok: false; message: string }>;

let prepareFn: PrepareFn = prepareHfmAnalysisContext;
let reasonFn: ReasonFn = runHfmAiReasoning;
let symbolValidator: SymbolValidator | null = null;

export const HFM_AUTO_ANALYSIS_INTERVAL_MS = 30 * 60 * 1000;

export type HfmAutoAnalysisSchedulerStatus =
  | "OFF"
  | "IDLE"
  | "WAITING"
  | "RUNNING"
  | "FAILED";

export interface HfmAutoAnalysisState {
  enabled: boolean;
  selectedSymbol: string;
  chartTimeframe: string;
  status: HfmAutoAnalysisSchedulerStatus;
  lastRunId: string | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  nextRunAt: string | null;
  activeJobId: string | null;
  lastResultStatus: string | null;
  lastError: string | null;
  lastTrigger: "manual" | "auto" | null;
  updatedAt: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface HfmAnalyzeNowResult {
  ok: boolean;
  stage: string;
  blocked?: boolean;
  alreadyRunning?: boolean;
  contextId: string | null;
  analysis: HfmReasoningRecord | null;
  scheduler: HfmAutoAnalysisState;
  errorCode: string | null;
  errorMessage: string | null;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

type Clock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};

const defaultClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

let clock: Clock = defaultClock;
let timer: ReturnType<typeof setTimeout> | null = null;
let bootstrapped = false;
let runInFlight = false;
let storageRootOverride: string | undefined;

function schedulerPath(root?: string): string {
  return path.join(resolveHfmAnalysisDir(root ?? storageRootOverride), "scheduler", "auto-analysis.json");
}

function defaultState(): HfmAutoAnalysisState {
  return {
    enabled: false,
    selectedSymbol: "XAUUSD",
    chartTimeframe: "H4",
    status: "OFF",
    lastRunId: null,
    lastStartedAt: null,
    lastCompletedAt: null,
    nextRunAt: null,
    activeJobId: null,
    lastResultStatus: null,
    lastError: null,
    lastTrigger: null,
    updatedAt: new Date(clock.now()).toISOString(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}.${clock.now()}`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, filePath);
}

async function loadState(): Promise<HfmAutoAnalysisState> {
  try {
    const raw = await fs.readFile(schedulerPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<HfmAutoAnalysisState>;
    return {
      ...defaultState(),
      ...parsed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  } catch {
    return defaultState();
  }
}

async function saveState(state: HfmAutoAnalysisState): Promise<HfmAutoAnalysisState> {
  const next = {
    ...state,
    updatedAt: new Date(clock.now()).toISOString(),
    placesOrders: false as const,
    mutatesBroker: false as const,
    acceptsForExecution: false as const,
  };
  await atomicWrite(schedulerPath(), JSON.stringify(next, null, 2));
  return next;
}

function clearTimer(): void {
  if (timer != null) {
    clock.clearTimeout(timer);
    timer = null;
  }
}

function scheduleAt(nextRunAtMs: number): void {
  clearTimer();
  const delay = Math.max(0, nextRunAtMs - clock.now());
  timer = clock.setTimeout(() => {
    void onTimerFire();
  }, delay);
}

async function onTimerFire(): Promise<void> {
  timer = null;
  const state = await loadState();
  if (!state.enabled) return;
  if (runInFlight || isReasoningLocked()) {
    // Defer until after the active job completes (completion-based).
    const deferAt = clock.now() + 5_000;
    await saveState({
      ...state,
      status: "WAITING",
      nextRunAt: new Date(deferAt).toISOString(),
      lastError: "Deferred: analysis already running",
    });
    scheduleAt(deferAt);
    return;
  }
  await executeAnalysisPipeline({
    symbol: state.selectedSymbol,
    chartTimeframe: state.chartTimeframe,
    trigger: "auto",
  });
}

async function validateSymbol(symbol: string): Promise<{ ok: true; symbol: string } | { ok: false; message: string }> {
  if (symbolValidator) return symbolValidator(symbol);
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return { ok: false, message: "symbol is required" };
  try {
    const cat = await getHfmCatalogService(storageRootOverride).getSymbol(sym);
    if (!cat) return { ok: false, message: `Symbol ${sym} not found in HFM catalog` };
    return { ok: true, symbol: cat.symbol.toUpperCase() };
  } catch {
    // Catalog may be temporarily unavailable; still allow known-looking symbols for recovery.
    if (/^[A-Z0-9._/-]{3,32}$/.test(sym)) return { ok: true, symbol: sym };
    return { ok: false, message: "Unable to validate symbol against HFM catalog" };
  }
}

export async function getHfmAutoAnalysisStatus(): Promise<HfmAutoAnalysisState> {
  const state = await loadState();
  if (state.enabled && state.status === "OFF") {
    return { ...state, status: state.nextRunAt ? "WAITING" : "IDLE" };
  }
  return state;
}

export async function setHfmAutoAnalysisSymbol(input: {
  symbol: string;
  chartTimeframe?: string;
}): Promise<HfmAutoAnalysisState> {
  const valid = await validateSymbol(input.symbol);
  if (!valid.ok) throw new Error(valid.message);
  const state = await loadState();
  return saveState({
    ...state,
    selectedSymbol: valid.symbol,
    chartTimeframe: String(input.chartTimeframe || state.chartTimeframe || "H4"),
  });
}

export async function disableHfmAutoAnalysis(): Promise<HfmAutoAnalysisState> {
  clearTimer();
  const state = await loadState();
  return saveState({
    ...state,
    enabled: false,
    status: "OFF",
    nextRunAt: null,
    // Keep activeJobId if a run is finishing; do not schedule after it.
  });
}

export async function enableHfmAutoAnalysis(input: {
  symbol: string;
  chartTimeframe?: string;
}): Promise<{ state: HfmAutoAnalysisState; firstRun: HfmAnalyzeNowResult }> {
  const valid = await validateSymbol(input.symbol);
  if (!valid.ok) throw new Error(valid.message);
  const tf = String(input.chartTimeframe || "H4");
  let state = await loadState();
  state = await saveState({
    ...state,
    enabled: true,
    selectedSymbol: valid.symbol,
    chartTimeframe: tf,
    status: "IDLE",
    lastError: null,
  });
  const firstRun = await executeAnalysisPipeline({
    symbol: valid.symbol,
    chartTimeframe: tf,
    trigger: "auto",
  });
  return { state: firstRun.scheduler, firstRun };
}

/**
 * Manual Analyze Now OR automatic scheduled run.
 * Shares Phase 3 reasoning single-flight lock via runHfmAiReasoning.
 */
export async function executeAnalysisPipeline(input: {
  symbol: string;
  chartTimeframe?: string;
  trigger: "manual" | "auto";
}): Promise<HfmAnalyzeNowResult> {
  const base = (): HfmAnalyzeNowResult => ({
    ok: false,
    stage: "IDLE",
    contextId: null,
    analysis: null,
    scheduler: defaultState(),
    errorCode: null,
    errorMessage: null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  });

  if (runInFlight || isReasoningLocked()) {
    const active = getActiveReasoningRecord();
    const scheduler = await loadState();
    return {
      ...base(),
      stage: "ALREADY_RUNNING",
      blocked: true,
      alreadyRunning: true,
      contextId: active?.contextId ?? null,
      analysis: active,
      scheduler,
      errorCode: "REASONING_JOB_ALREADY_RUNNING",
      errorMessage: "Another HFM AI analysis is already running",
    };
  }

  const valid = await validateSymbol(input.symbol);
  if (!valid.ok) {
    return {
      ...base(),
      stage: "BLOCKED",
      blocked: true,
      scheduler: await loadState(),
      errorCode: "SYMBOL_MISMATCH",
      errorMessage: valid.message,
    };
  }

  const symbol = valid.symbol;
  const chartTimeframe = String(input.chartTimeframe || "H4");
  runInFlight = true;

  let scheduler = await loadState();
  // Persist latest selected symbol for *next* auto run, without mutating active job symbol.
  scheduler = await saveState({
    ...scheduler,
    selectedSymbol: input.trigger === "auto" ? scheduler.selectedSymbol || symbol : symbol,
    chartTimeframe,
    status: "RUNNING",
    lastStartedAt: new Date(clock.now()).toISOString(),
    lastTrigger: input.trigger,
    lastError: null,
    activeJobId: null,
  });

  try {
    // 1) Phase 2 context prep
    const prep = await prepareFn({
      symbol,
      chartTimeframe,
      refresh: true,
    });
    if (!prep.ok || !prep.snapshot) {
      const completedAt = new Date(clock.now()).toISOString();
      scheduler = await afterAttempt({
        trigger: input.trigger,
        completedAt,
        lastRunId: null,
        lastResultStatus: "FAILED",
        lastError: prep.diagnostics?.[0] ?? "Context preparation failed",
        activeJobId: null,
      });
      return {
        ...base(),
        stage: "FAILED",
        scheduler,
        errorCode: "CONTEXT_NOT_VALID",
        errorMessage: prep.diagnostics?.[0] ?? "HFM analysis context preparation failed",
      };
    }

    const quality = prep.snapshot.dataQuality?.status;
    if (quality !== "VALID" || !prep.snapshot.dataQuality?.approvedForAiReasoning) {
      const completedAt = new Date(clock.now()).toISOString();
      scheduler = await afterAttempt({
        trigger: input.trigger,
        completedAt,
        lastRunId: null,
        lastResultStatus: "FAILED",
        lastError: `Context quality ${quality ?? "unknown"} not approved for AI`,
        activeJobId: null,
      });
      return {
        ...base(),
        stage: "FAILED",
        contextId: prep.snapshot.snapshotId,
        scheduler,
        errorCode: "AI_NOT_APPROVED",
        errorMessage: `Context quality ${quality ?? "unknown"} is not approved for AI reasoning`,
      };
    }

    // 2) Phase 3.1 reasoning (owns reasoning lock)
    const analysis = await reasonFn({ contextId: prep.snapshot.snapshotId });
    if (analysis.errorCode === "REASONING_JOB_ALREADY_RUNNING") {
      const current = await loadState();
      scheduler = await saveState({
        ...current,
        status: current.enabled ? (current.nextRunAt ? "WAITING" : "IDLE") : "OFF",
        activeJobId: null,
        lastError: "Deferred: analysis already running",
      });
      return {
        ...base(),
        stage: "ALREADY_RUNNING",
        blocked: true,
        alreadyRunning: true,
        contextId: prep.snapshot.snapshotId,
        analysis,
        scheduler,
        errorCode: "REASONING_JOB_ALREADY_RUNNING",
        errorMessage: analysis.errorMessage ?? "Another HFM AI analysis is already running",
      };
    }
    const completedAt = analysis.completedAt ?? new Date(clock.now()).toISOString();
    const ok = analysis.status === "COMPLETED";
    scheduler = await afterAttempt({
      trigger: input.trigger,
      completedAt,
      lastRunId: analysis.analysisId,
      lastResultStatus: analysis.status,
      lastError: ok ? null : (analysis.errorMessage ?? analysis.errorCode ?? "Analysis failed"),
      activeJobId: null,
    });

    return {
      ok,
      stage: ok ? "COMPLETED" : "FAILED",
      contextId: prep.snapshot.snapshotId,
      analysis,
      scheduler,
      errorCode: ok ? null : analysis.errorCode,
      errorMessage: ok ? null : analysis.errorMessage,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  } catch (err) {
    const completedAt = new Date(clock.now()).toISOString();
    const message = err instanceof Error ? err.message : String(err);
    scheduler = await afterAttempt({
      trigger: input.trigger,
      completedAt,
      lastRunId: null,
      lastResultStatus: "FAILED",
      lastError: message.slice(0, 500),
      activeJobId: null,
    });
    return {
      ...base(),
      stage: "FAILED",
      scheduler,
      errorCode: "OPENAI_REQUEST_FAILED",
      errorMessage: message.slice(0, 500),
    };
  } finally {
    runInFlight = false;
  }
}

async function afterAttempt(input: {
  trigger: "manual" | "auto";
  completedAt: string;
  lastRunId: string | null;
  lastResultStatus: string;
  lastError: string | null;
  activeJobId: string | null;
}): Promise<HfmAutoAnalysisState> {
  clearTimer();
  const state = await loadState();
  const completedMs = Date.parse(input.completedAt) || clock.now();

  // Manual-only when scheduler OFF: do not schedule.
  if (!state.enabled) {
    return saveState({
      ...state,
      status: "OFF",
      lastRunId: input.lastRunId ?? state.lastRunId,
      lastCompletedAt: input.completedAt,
      nextRunAt: null,
      activeJobId: input.activeJobId,
      lastResultStatus: input.lastResultStatus,
      lastError: input.lastError,
      lastTrigger: input.trigger,
    });
  }

  // Auto ON: next run is always completion + 30m (manual or auto), including failures.
  const nextRunAtMs = completedMs + HFM_AUTO_ANALYSIS_INTERVAL_MS;
  const nextRunAt = new Date(nextRunAtMs).toISOString();
  const saved = await saveState({
    ...state,
    enabled: true,
    status: input.lastResultStatus === "COMPLETED" || input.lastResultStatus === "COMPLETED_WITH_GAPS"
      ? "WAITING"
      : "FAILED",
    lastRunId: input.lastRunId ?? state.lastRunId,
    lastCompletedAt: input.completedAt,
    nextRunAt,
    activeJobId: input.activeJobId,
    lastResultStatus: input.lastResultStatus,
    lastError: input.lastError,
    lastTrigger: input.trigger,
  });
  scheduleAt(nextRunAtMs);
  return saved;
}

/** Boot recovery: restore timer if enabled; never assume interrupted OpenAI succeeded. */
export async function bootstrapHfmAutoAnalysisScheduler(opts?: {
  storageRoot?: string;
}): Promise<HfmAutoAnalysisState> {
  if (opts?.storageRoot) storageRootOverride = opts.storageRoot;
  if (bootstrapped) return loadState();
  bootstrapped = true;

  let state = await loadState();
  if (!state.enabled) {
    state = await saveState({ ...state, status: "OFF", nextRunAt: null, activeJobId: null });
    return state;
  }

  // Interrupted active job: mark failed, schedule from now+30m (do not claim success).
  if (state.status === "RUNNING" || state.activeJobId) {
    const completedAt = new Date(clock.now()).toISOString();
    state = await afterAttempt({
      trigger: state.lastTrigger ?? "auto",
      completedAt,
      lastRunId: state.lastRunId,
      lastResultStatus: "FAILED",
      lastError: "Interrupted by backend restart; previous OpenAI request not assumed complete",
      activeJobId: null,
    });
    return state;
  }

  if (state.nextRunAt) {
    const nextMs = Date.parse(state.nextRunAt);
    if (Number.isFinite(nextMs)) {
      state = await saveState({ ...state, status: "WAITING" });
      scheduleAt(nextMs);
      return state;
    }
  }

  // Enabled but no nextRunAt: schedule from lastCompletedAt+30m or now.
  const base = state.lastCompletedAt ? Date.parse(state.lastCompletedAt) : clock.now();
  const nextMs = (Number.isFinite(base) ? base : clock.now()) + HFM_AUTO_ANALYSIS_INTERVAL_MS;
  state = await saveState({
    ...state,
    status: "WAITING",
    nextRunAt: new Date(nextMs).toISOString(),
  });
  scheduleAt(nextMs);
  return state;
}

export function __setHfmAutoAnalysisClockForTests(next: Partial<Clock> | null): void {
  clock = next ? { ...defaultClock, ...next } : defaultClock;
}

export function __resetHfmAutoAnalysisSchedulerForTests(): void {
  clearTimer();
  bootstrapped = false;
  runInFlight = false;
  storageRootOverride = undefined;
  clock = defaultClock;
  prepareFn = prepareHfmAnalysisContext;
  reasonFn = runHfmAiReasoning;
  symbolValidator = null;
}

export function __setHfmAutoAnalysisStorageRootForTests(root: string | undefined): void {
  storageRootOverride = root;
}

export function __setHfmAutoAnalysisDepsForTests(deps: {
  prepare?: PrepareFn;
  reason?: ReasonFn;
  validateSymbol?: SymbolValidator;
} | null): void {
  prepareFn = deps?.prepare ?? prepareHfmAnalysisContext;
  reasonFn = deps?.reason ?? runHfmAiReasoning;
  symbolValidator = deps?.validateSymbol ?? null;
}

/** Test helper: fire due timer immediately (does not wait for real delay). */
export async function __fireHfmAutoAnalysisTimerForTests(): Promise<void> {
  await onTimerFire();
}
