/**
 * Phase 5D.6 — optional controlled MIF OD worker.
 * DISABLED by default. Bounded, non-overlapping, no broker interaction.
 */
import { runMifHfmOpportunityPipelineLive } from "./run-pipeline.js";

export interface MifOdWorkerConfig {
  enabled: boolean;
  symbol: string;
  intervalMs: number;
  timeframes?: readonly string[];
  candleLimit?: number;
}

export interface MifOdWorkerStatus {
  enabled: boolean;
  running: boolean;
  symbol: string | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastRunId: string | null;
  intervalMs: number;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15m when enabled

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let stopped = true;
let cfg: MifOdWorkerConfig = {
  enabled: false,
  symbol: "XAUUSD",
  intervalMs: DEFAULT_INTERVAL_MS,
};
let status: MifOdWorkerStatus = {
  enabled: false,
  running: false,
  symbol: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastStatus: null,
  lastError: null,
  lastRunId: null,
  intervalMs: DEFAULT_INTERVAL_MS,
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
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
    const result = await runMifHfmOpportunityPipelineLive({
      providerSymbol: cfg.symbol,
      timeframes: cfg.timeframes,
      candleLimit: cfg.candleLimit,
      persist: true,
    });
    status.lastStatus = result.analysisStatus;
    status.lastRunId = result.persistence?.runId ?? result.requestId;
    status.lastError = null;
    status.lastCompletedAt = new Date().toISOString();
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
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

export function getMifOdWorkerStatus(): MifOdWorkerStatus {
  return { ...status };
}

/** Enable only when explicitly configured. Disabled by default. */
export function enableMifOdWorker(input: Partial<MifOdWorkerConfig> & { symbol: string }): MifOdWorkerStatus {
  cfg = {
    enabled: true,
    symbol: String(input.symbol).trim().toUpperCase(),
    intervalMs: Math.max(60_000, input.intervalMs ?? DEFAULT_INTERVAL_MS),
    timeframes: input.timeframes,
    candleLimit: input.candleLimit,
  };
  stopped = false;
  status = {
    ...status,
    enabled: true,
    symbol: cfg.symbol,
    intervalMs: cfg.intervalMs,
  };
  schedule();
  return getMifOdWorkerStatus();
}

export function disableMifOdWorker(): MifOdWorkerStatus {
  stopped = true;
  cfg = { ...cfg, enabled: false };
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  status = { ...status, enabled: false, running: false };
  return getMifOdWorkerStatus();
}
