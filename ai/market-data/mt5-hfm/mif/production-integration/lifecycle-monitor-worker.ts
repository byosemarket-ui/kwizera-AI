/**
 * Phase 04 — optional HFM MT5 opportunity lifecycle monitor worker.
 * DISABLED by default. Bounded, non-overlapping, no OD / OpenAI / broker.
 *
 * Activation requires explicit admin enable. Prefer run-once for verification
 * on constrained VPS before enabling continuous polling.
 */
import { runHfmLifecycleMonitorCycle } from "./lifecycle-monitor-cycle.js";

export interface HfmLifecycleMonitorWorkerConfig {
  enabled: boolean;
  symbol: string;
  intervalMs: number;
  timeframe?: string;
  candleLimit?: number;
  batchLimit?: number;
  maxAgeBars?: number;
}

export interface HfmLifecycleMonitorWorkerStatus {
  enabled: boolean;
  running: boolean;
  symbol: string | null;
  timeframe: string | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastEvidenceHealth: string | null;
  lastTransitionsApplied: number | null;
  lastCandidatesObserved: number | null;
  intervalMs: number;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  callsOpenAi: false;
  runsOpportunityDetection: false;
  activationPolicy: "DISABLED_BY_DEFAULT_EXPLICIT_ENABLE_REQUIRED";
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5m when enabled

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let stopped = true;
let cfg: HfmLifecycleMonitorWorkerConfig = {
  enabled: false,
  symbol: "XAUUSD",
  intervalMs: DEFAULT_INTERVAL_MS,
  timeframe: "H1",
};
let status: HfmLifecycleMonitorWorkerStatus = {
  enabled: false,
  running: false,
  symbol: null,
  timeframe: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastStatus: null,
  lastError: null,
  lastEvidenceHealth: null,
  lastTransitionsApplied: null,
  lastCandidatesObserved: null,
  intervalMs: DEFAULT_INTERVAL_MS,
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  callsOpenAi: false,
  runsOpportunityDetection: false,
  activationPolicy: "DISABLED_BY_DEFAULT_EXPLICIT_ENABLE_REQUIRED",
};

async function tick(): Promise<void> {
  if (stopped || !cfg.enabled) return;
  if (inFlight) {
    schedule();
    return;
  }
  inFlight = true;
  status.running = true;
  status.lastStartedAt = new Date().toISOString();
  try {
    const result = await runHfmLifecycleMonitorCycle({
      providerSymbol: cfg.symbol,
      timeframe: cfg.timeframe,
      candleLimit: cfg.candleLimit,
      batchLimit: cfg.batchLimit,
      maxAgeBars: cfg.maxAgeBars,
    });
    status.lastStatus = result.ok ? "OK" : "DEGRADED";
    status.lastEvidenceHealth = result.evidenceHealth;
    status.lastTransitionsApplied = result.transitionsApplied;
    status.lastCandidatesObserved = result.candidatesObserved;
    status.lastError = result.diagnostics.length ? result.diagnostics.join(";") : null;
    status.lastCompletedAt = new Date().toISOString();
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
    status.lastStatus = "FAILED";
    status.lastCompletedAt = new Date().toISOString();
  } finally {
    inFlight = false;
    status.running = false;
    schedule();
  }
}

function schedule(): void {
  if (stopped || !cfg.enabled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void tick();
  }, Math.max(60_000, cfg.intervalMs));
}

export function getHfmLifecycleMonitorWorkerStatus(): HfmLifecycleMonitorWorkerStatus {
  return { ...status };
}

/** Enable only when explicitly configured. Disabled by default. */
export function enableHfmLifecycleMonitorWorker(
  input: Partial<HfmLifecycleMonitorWorkerConfig> & { symbol: string },
): HfmLifecycleMonitorWorkerStatus {
  cfg = {
    enabled: true,
    symbol: String(input.symbol).trim().toUpperCase(),
    intervalMs: Math.max(60_000, input.intervalMs ?? DEFAULT_INTERVAL_MS),
    timeframe: String(input.timeframe || cfg.timeframe || "H1").trim().toUpperCase(),
    candleLimit: input.candleLimit,
    batchLimit: input.batchLimit,
    maxAgeBars: input.maxAgeBars,
  };
  stopped = false;
  status = {
    ...status,
    enabled: true,
    symbol: cfg.symbol,
    timeframe: cfg.timeframe ?? "H1",
    intervalMs: cfg.intervalMs,
  };
  schedule();
  return getHfmLifecycleMonitorWorkerStatus();
}

export function disableHfmLifecycleMonitorWorker(): HfmLifecycleMonitorWorkerStatus {
  stopped = true;
  cfg = { ...cfg, enabled: false };
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  status = {
    ...status,
    enabled: false,
    running: false,
  };
  return getHfmLifecycleMonitorWorkerStatus();
}

/** One-shot monitor cycle without enabling the persistent worker. */
export async function runHfmLifecycleMonitorOnce(
  input: Partial<HfmLifecycleMonitorWorkerConfig> & { symbol: string },
): Promise<{
  worker: HfmLifecycleMonitorWorkerStatus;
  cycle: Awaited<ReturnType<typeof runHfmLifecycleMonitorCycle>>;
}> {
  const cycle = await runHfmLifecycleMonitorCycle({
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    candleLimit: input.candleLimit,
    batchLimit: input.batchLimit,
    maxAgeBars: input.maxAgeBars,
  });
  status = {
    ...status,
    lastStartedAt: cycle.startedAt,
    lastCompletedAt: cycle.completedAt,
    lastStatus: cycle.ok ? "OK_ONCE" : "DEGRADED_ONCE",
    lastError: cycle.diagnostics.length ? cycle.diagnostics.join(";") : null,
    lastEvidenceHealth: cycle.evidenceHealth,
    lastTransitionsApplied: cycle.transitionsApplied,
    lastCandidatesObserved: cycle.candidatesObserved,
    symbol: cycle.providerSymbol,
    timeframe: cycle.timeframe,
  };
  return { worker: getHfmLifecycleMonitorWorkerStatus(), cycle };
}
