/**
 * Immutable analysis preparation job context + single-flight lock.
 */
import { randomUUID } from "node:crypto";
import {
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
} from "./constants.js";
import type { HfmAnalysisImmutableJob, HfmAnalysisJobStatus } from "./types.js";

let symbolVersionCounter = 1;
let selectedSymbol = "";
let selectedSymbolVersion = 0;

let activeJob: HfmAnalysisImmutableJob | null = null;
let lockHeld = false;
let pendingSymbol: string | null = null;

export function noteSelectedChartSymbol(symbol: string): { symbol: string; version: number } {
  const next = String(symbol || "").trim().toUpperCase();
  if (!next) return { symbol: selectedSymbol, version: selectedSymbolVersion };
  if (next !== selectedSymbol) {
    selectedSymbol = next;
    symbolVersionCounter += 1;
    selectedSymbolVersion = symbolVersionCounter;
    if (lockHeld && activeJob) {
      pendingSymbol = next;
    }
  }
  return { symbol: selectedSymbol, version: selectedSymbolVersion };
}

export function getSelectedChartSymbolState(): { symbol: string; version: number; pendingSymbol: string | null } {
  return { symbol: selectedSymbol, version: selectedSymbolVersion, pendingSymbol };
}

export function createImmutableAnalysisJob(input: {
  symbol: string;
  chartTimeframe: string;
  analysisTimeframes?: readonly string[];
}): HfmAnalysisImmutableJob {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const noted = noteSelectedChartSymbol(symbol);
  return {
    jobId: randomUUID(),
    provider: HFM_ANALYSIS_PROVIDER,
    symbolAtStart: symbol,
    selectedSymbolVersion: noted.version,
    chartTimeframeAtStart: String(input.chartTimeframe || "").trim().toUpperCase() || "H1",
    analysisTimeframes: input.analysisTimeframes ?? [...HFM_ANALYSIS_DEFAULT_TF_PACK],
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "RUNNING",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

export function finalizeJob(
  job: HfmAnalysisImmutableJob,
  status: Exclude<HfmAnalysisJobStatus, "RUNNING">,
): HfmAnalysisImmutableJob {
  return {
    ...job,
    status,
    completedAt: new Date().toISOString(),
  };
}

export function tryAcquireAnalysisJobLock(): boolean {
  if (lockHeld) return false;
  lockHeld = true;
  return true;
}

export function releaseAnalysisJobLock(job: HfmAnalysisImmutableJob | null): void {
  activeJob = job;
  lockHeld = false;
}

export function setActiveAnalysisJob(job: HfmAnalysisImmutableJob | null): void {
  activeJob = job;
}

export function getActiveAnalysisJob(): HfmAnalysisImmutableJob | null {
  return activeJob;
}

export function isAnalysisJobLocked(): boolean {
  return lockHeld;
}

/** Test helper — reset process-local job state. */
export function __resetAnalysisJobStateForTests(): void {
  symbolVersionCounter = 1;
  selectedSymbol = "";
  selectedSymbolVersion = 0;
  activeJob = null;
  lockHeld = false;
  pendingSymbol = null;
}
