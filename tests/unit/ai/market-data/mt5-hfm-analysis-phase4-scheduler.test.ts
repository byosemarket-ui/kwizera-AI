/**
 * Phase 4 — Auto Analysis scheduler + Analyze Now (mocked pipeline; fake clock).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HFM_AUTO_ANALYSIS_INTERVAL_MS,
  __fireHfmAutoAnalysisTimerForTests,
  __resetHfmAutoAnalysisSchedulerForTests,
  __setHfmAutoAnalysisClockForTests,
  __setHfmAutoAnalysisDepsForTests,
  __setHfmAutoAnalysisStorageRootForTests,
  bootstrapHfmAutoAnalysisScheduler,
  disableHfmAutoAnalysis,
  enableHfmAutoAnalysis,
  executeAnalysisPipeline,
  getHfmAutoAnalysisStatus,
  isReasoningLocked,
  tryAcquireReasoningLock,
  releaseReasoningLock,
  __resetReasoningJobStateForTests,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/index";
import type { HfmAnalysisContextResult } from "../../../../ai/market-data/mt5-hfm/analysis/types";
import type { HfmReasoningRecord } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/types";

function makePrep(symbol: string, ok = true): HfmAnalysisContextResult {
  const snapId = `ctx-${symbol.toLowerCase()}`;
  return {
    ok,
    state: ok ? "COMPLETED" : "FAILED",
    job: {
      jobId: "job-1",
      provider: "HFM_MT5",
      symbolAtStart: symbol,
      selectedSymbolVersion: 1,
      chartTimeframeAtStart: "H4",
      analysisTimeframes: ["H1", "M30", "M15", "M5"],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: ok ? "COMPLETED" : "FAILED",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    snapshot: ok
      ? {
          snapshotId: snapId,
          snapshotHash: "b".repeat(64),
          hashVersion: "hfm-analysis-snapshot-v1",
          provider: "HFM_MT5",
          symbol,
          capturedAt: new Date().toISOString(),
          chartTimeframeAtStart: "H4",
          timeframes: {},
          quote: {
            symbol,
            bid: 1,
            ask: 1.1,
            spread: 0.1,
            brokerTimestamp: 1,
            receiveTimestamp: new Date().toISOString(),
            freshness: "LIVE",
            acquisition: "SymbolInfoTick",
          },
          dataQuality: {
            status: "VALID",
            errors: [],
            warnings: [],
            approvedForAiReasoning: true,
          },
          synchronization: {
            status: "SYNCHRONIZED",
            errors: [],
            warnings: [],
          },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        }
      : null,
    chartImages: {},
    timings: {
      collectMs: 1,
      normalizeMs: 1,
      validateMs: 1,
      renderMs: 1,
      persistMs: 1,
      totalMs: 5,
    },
    diagnostics: ok ? [] : ["HFM disconnected"],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  } as unknown as HfmAnalysisContextResult;
}

function makeReason(symbol: string, contextId: string, status: "COMPLETED" | "FAILED" = "COMPLETED"): HfmReasoningRecord {
  return {
    analysisId: `an-${symbol}-${contextId}`,
    contextId,
    snapshotId: contextId,
    snapshotHash: "b".repeat(64),
    symbol,
    provider: "HFM_MT5",
    status,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    promptVersion: "test",
    schemaVersion: "test",
    model: "mock-model",
    errorCode: status === "COMPLETED" ? null : "OPENAI_REQUEST_FAILED",
    errorMessage: status === "COMPLETED" ? null : "mock failure",
    dataQualityStatus: "VALID",
    synchronizationStatus: "SYNCHRONIZED",
    candleCounts: {},
    imageRefs: [],
    usage: null,
    result: status === "COMPLETED"
      ? {
          schemaVersion: "test",
          analysisStatus: "COMPLETED",
          provider: "HFM_MT5",
          symbol,
          contextId,
          snapshotId: contextId,
          snapshotHash: "b".repeat(64),
          promptVersion: "test",
          model: "mock-model",
          decision: {
            action: "NO_TRADE",
            confidence: 55,
            confidenceLabel: "MODERATE",
            summary: "Mock insight",
          },
          marketOverview: {
            sectionStatus: "PROVIDED",
            marketCondition: "RANGING",
            overallBias: "NEUTRAL",
            higherTimeframeBias: "NEUTRAL",
            timeframeAlignment: "UNCLEAR",
          },
          timeframeAnalysis: {
            H1: { sectionStatus: "PROVIDED", bias: "NEUTRAL", structure: "range", observations: ["flat"], supportingEvidence: [], risks: [] },
            M30: { sectionStatus: "NOT_PROVIDED", bias: "NOT_PROVIDED", structure: "", observations: [], supportingEvidence: [], risks: [] },
            M15: { sectionStatus: "NOT_PROVIDED", bias: "NOT_PROVIDED", structure: "", observations: [], supportingEvidence: [], risks: [] },
            M5: { sectionStatus: "NOT_PROVIDED", bias: "NOT_PROVIDED", structure: "", observations: [], supportingEvidence: [], risks: [] },
          },
          scenarios: {
            bullish: { status: "POSSIBLE", conditions: [], confirmation: [], invalidation: [] },
            bearish: { status: "POSSIBLE", conditions: [], confirmation: [], invalidation: [] },
          },
          tradePlan: {
            direction: "NONE",
            setupStatus: "NOT_APPLICABLE",
            entryZone: { low: null, high: null },
            stopLoss: null,
            takeProfitTargets: [],
            invalidationPrice: null,
            riskRewardEstimate: null,
            explanation: "",
          },
          evidence: {
            observedFacts: ["mock fact"],
            interpretations: [],
            uncertainties: [],
            missingData: [],
            dataQualityWarnings: [],
          },
          riskAssessment: {
            sectionStatus: "PROVIDED",
            riskLevel: "MODERATE",
            reasons: [],
            reasonsToAvoidTrade: [],
          },
          nextConfirmation: { required: false, conditions: [], timeframesToWatch: [] },
          completeness: { status: "INCOMPLETE", missingSections: ["M30"], notes: [] },
          pricePrecision: {
            verified: true,
            digits: 2,
            tickSize: 0.01,
            point: 0.01,
            source: "HFM_CATALOG",
            reason: null,
          },
          disclaimer: "analysis only",
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        }
      : null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

describe("HFM Analysis Phase 4 — scheduler", () => {
  let tmp = "";
  let now = 1_700_000_000_000;
  let timers: Array<{ at: number; fn: () => void }> = [];
  let prepCalls: string[] = [];
  let reasonCalls: string[] = [];

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-p4-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __resetHfmAutoAnalysisSchedulerForTests();
    __resetReasoningJobStateForTests();
    __setHfmAutoAnalysisStorageRootForTests(tmp);
    now = 1_700_000_000_000;
    timers = [];
    prepCalls = [];
    reasonCalls = [];
    __setHfmAutoAnalysisClockForTests({
      now: () => now,
      setTimeout: (fn, ms) => {
        const handle = { at: now + ms, fn };
        timers.push(handle);
        return handle as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (id) => {
        timers = timers.filter((t) => t !== (id as unknown as typeof timers[number]));
      },
    });
    __setHfmAutoAnalysisDepsForTests({
      validateSymbol: async (symbol) => {
        const sym = symbol.trim().toUpperCase();
        if (!sym) return { ok: false, message: "symbol is required" };
        return { ok: true, symbol: sym };
      },
      prepare: async ({ symbol }) => {
        prepCalls.push(symbol);
        return makePrep(symbol);
      },
      reason: async ({ contextId }) => {
        const symbol = contextId.replace(/^ctx-/, "").toUpperCase();
        reasonCalls.push(symbol);
        return makeReason(symbol, contextId);
      },
    });
  });

  afterEach(async () => {
    __resetHfmAutoAnalysisSchedulerForTests();
    __resetReasoningJobStateForTests();
    delete process.env.KWIZERA_STORAGE_ROOT;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("defaults to OFF with no next run", async () => {
    const status = await getHfmAutoAnalysisStatus();
    expect(status.enabled).toBe(false);
    expect(status.status).toBe("OFF");
    expect(status.nextRunAt).toBeNull();
    expect(status.placesOrders).toBe(false);
    expect(status.mutatesBroker).toBe(false);
    expect(status.acceptsForExecution).toBe(false);
  });

  it("Analyze Now runs once and does not schedule when OFF", async () => {
    const result = await executeAnalysisPipeline({
      symbol: "XAUUSD",
      chartTimeframe: "H4",
      trigger: "manual",
    });
    expect(result.ok).toBe(true);
    expect(result.stage).toBe("COMPLETED");
    expect(prepCalls).toEqual(["XAUUSD"]);
    expect(reasonCalls).toEqual(["XAUUSD"]);
    expect(result.scheduler.enabled).toBe(false);
    expect(result.scheduler.nextRunAt).toBeNull();
    expect(timers.length).toBe(0);
  });

  it("blocks duplicate Analyze Now while locked", async () => {
    expect(tryAcquireReasoningLock()).toBe(true);
    const result = await executeAnalysisPipeline({
      symbol: "XAUUSD",
      trigger: "manual",
    });
    releaseReasoningLock();
    expect(result.alreadyRunning).toBe(true);
    expect(result.stage).toBe("ALREADY_RUNNING");
    expect(prepCalls.length).toBe(0);
  });

  it("enable starts immediately and schedules completion + 30m", async () => {
    const { firstRun, state } = await enableHfmAutoAnalysis({
      symbol: "XAUUSD",
      chartTimeframe: "H1",
    });
    expect(firstRun.ok).toBe(true);
    expect(state.enabled).toBe(true);
    expect(prepCalls).toEqual(["XAUUSD"]);
    const completedAt = Date.parse(state.lastCompletedAt!);
    const nextAt = Date.parse(state.nextRunAt!);
    expect(nextAt - completedAt).toBe(HFM_AUTO_ANALYSIS_INTERVAL_MS);
    expect(timers.length).toBe(1);
  });

  it("OFF during waiting cancels future automatic runs", async () => {
    await enableHfmAutoAnalysis({ symbol: "EURUSD" });
    expect(timers.length).toBe(1);
    const off = await disableHfmAutoAnalysis();
    expect(off.enabled).toBe(false);
    expect(off.status).toBe("OFF");
    expect(off.nextRunAt).toBeNull();
    expect(timers.length).toBe(0);
  });

  it("failed analysis still schedules +30m when enabled", async () => {
    __setHfmAutoAnalysisDepsForTests({
      validateSymbol: async (symbol) => ({ ok: true, symbol: symbol.toUpperCase() }),
      prepare: async ({ symbol }) => makePrep(symbol, false),
      reason: async ({ contextId }) => makeReason("XAUUSD", contextId, "FAILED"),
    });
    const { firstRun } = await enableHfmAutoAnalysis({ symbol: "XAUUSD" });
    expect(firstRun.ok).toBe(false);
    expect(firstRun.scheduler.enabled).toBe(true);
    expect(firstRun.scheduler.nextRunAt).toBeTruthy();
    const completedAt = Date.parse(firstRun.scheduler.lastCompletedAt!);
    const nextAt = Date.parse(firstRun.scheduler.nextRunAt!);
    expect(nextAt - completedAt).toBe(HFM_AUTO_ANALYSIS_INTERVAL_MS);
  });

  it("manual completion while ON reschedules from that completion", async () => {
    await enableHfmAutoAnalysis({ symbol: "XAUUSD" });
    prepCalls = [];
    reasonCalls = [];
    now += 60_000;
    const manual = await executeAnalysisPipeline({
      symbol: "GBPUSD",
      trigger: "manual",
    });
    expect(manual.ok).toBe(true);
    expect(manual.scheduler.enabled).toBe(true);
    expect(manual.scheduler.selectedSymbol).toBe("GBPUSD");
    const completedAt = Date.parse(manual.scheduler.lastCompletedAt!);
    const nextAt = Date.parse(manual.scheduler.nextRunAt!);
    expect(nextAt - completedAt).toBe(HFM_AUTO_ANALYSIS_INTERVAL_MS);
  });

  it("next automatic run uses latest selected symbol", async () => {
    await enableHfmAutoAnalysis({ symbol: "XAUUSD" });
    const { setHfmAutoAnalysisSymbol } = await import(
      "../../../../ai/market-data/mt5-hfm/analysis/reasoning/scheduler"
    );
    await setHfmAutoAnalysisSymbol({ symbol: "USDJPY", chartTimeframe: "H4" });
    prepCalls = [];
    reasonCalls = [];
    now = Date.parse((await getHfmAutoAnalysisStatus()).nextRunAt!) + 1;
    await __fireHfmAutoAnalysisTimerForTests();
    expect(prepCalls).toEqual(["USDJPY"]);
    expect(reasonCalls).toEqual(["USDJPY"]);
  });

  it("due timer defers when reasoning lock is held", async () => {
    await enableHfmAutoAnalysis({ symbol: "XAUUSD" });
    prepCalls = [];
    expect(tryAcquireReasoningLock()).toBe(true);
    now = Date.parse((await getHfmAutoAnalysisStatus()).nextRunAt!) + 1;
    await __fireHfmAutoAnalysisTimerForTests();
    releaseReasoningLock();
    expect(prepCalls.length).toBe(0);
    expect(isReasoningLocked()).toBe(false);
    const status = await getHfmAutoAnalysisStatus();
    expect(status.status).toBe("WAITING");
    expect(status.lastError).toMatch(/already running/i);
  });

  it("bootstrap recovers OFF and does not start jobs", async () => {
    __resetHfmAutoAnalysisSchedulerForTests();
    __setHfmAutoAnalysisStorageRootForTests(tmp);
    __setHfmAutoAnalysisClockForTests({
      now: () => now,
      setTimeout: (fn, ms) => {
        const handle = { at: now + ms, fn };
        timers.push(handle);
        return handle as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (id) => {
        timers = timers.filter((t) => t !== (id as unknown as typeof timers[number]));
      },
    });
    __setHfmAutoAnalysisDepsForTests({
      validateSymbol: async (symbol) => ({ ok: true, symbol: symbol.toUpperCase() }),
      prepare: async ({ symbol }) => makePrep(symbol),
      reason: async ({ contextId }) => makeReason(contextId.replace(/^ctx-/, "").toUpperCase(), contextId),
    });
    const state = await bootstrapHfmAutoAnalysisScheduler({ storageRoot: tmp });
    expect(state.enabled).toBe(false);
    expect(prepCalls.length).toBe(0);
  });

  it("bootstrap recovers interrupted RUNNING as failed then schedules", async () => {
    const enabled = await enableHfmAutoAnalysis({ symbol: "XAUUSD" });
    const file = path.join(tmp, "mt5-hfm", "analysis", "scheduler", "auto-analysis.json");
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    raw.status = "RUNNING";
    raw.activeJobId = "interrupted-job";
    raw.enabled = true;
    raw.nextRunAt = null;
    await fs.writeFile(file, JSON.stringify(raw), "utf8");

    __resetHfmAutoAnalysisSchedulerForTests();
    __setHfmAutoAnalysisStorageRootForTests(tmp);
    prepCalls = [];
    __setHfmAutoAnalysisClockForTests({
      now: () => now,
      setTimeout: (fn, ms) => {
        const handle = { at: now + ms, fn };
        timers.push(handle);
        return handle as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (id) => {
        timers = timers.filter((t) => t !== (id as unknown as typeof timers[number]));
      },
    });
    __setHfmAutoAnalysisDepsForTests({
      validateSymbol: async (symbol) => ({ ok: true, symbol: symbol.toUpperCase() }),
      prepare: async ({ symbol }) => makePrep(symbol),
      reason: async ({ contextId }) => makeReason("XAUUSD", contextId),
    });

    const recovered = await bootstrapHfmAutoAnalysisScheduler({ storageRoot: tmp });
    expect(recovered.enabled).toBe(true);
    expect(recovered.lastResultStatus).toBe("FAILED");
    expect(recovered.lastError).toMatch(/restart/i);
    expect(recovered.nextRunAt).toBeTruthy();
    expect(prepCalls.length).toBe(0);
    expect(enabled.firstRun.ok).toBe(true);
  });
});

describe("HFM Analysis Phase 4 — UI/API markers", () => {
  it("panel CSS and Analyze Now / Auto Analysis controls exist", async () => {
    const css = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/hfm-analysis-panel.css"),
      "utf8",
    );
    expect(css).toContain(".hfm-analysis-panel");
    expect(css).toContain(".hap-btn-analyze");
    expect(css).toContain(".hap-btn-auto");
    expect(css).toContain("@media (max-width: 720px)");

    const panel = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/HfmAnalysisPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("Analyze Now");
    expect(panel).toContain("Auto Analysis");
    expect(panel).toContain("WAITING_FOR_CONFIRMATION");
    expect(panel).toContain("placesOrders=false");
    expect(panel).not.toMatch(/Place Order|OrderSend|Auto Trade/i);

    const api = await fs.readFile(
      path.join(process.cwd(), "dev/server/mt5-hfm-analysis-api.ts"),
      "utf8",
    );
    expect(api).toContain("/analysis/analyze-now");
    expect(api).toContain("/analysis/auto-analysis/enable");
    expect(api).toContain("/analysis/auto-analysis/disable");
    expect(api).toContain("executeAnalysisPipeline");
  });

  it("chart CSS file does not absorb analysis panel rules", async () => {
    const chartCss = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/hfm-charts.css"),
      "utf8",
    );
    expect(chartCss).not.toContain(".hap-btn-analyze");
    expect(chartCss).toContain(".hfm-charts-analysis-boundary");
  });
});
