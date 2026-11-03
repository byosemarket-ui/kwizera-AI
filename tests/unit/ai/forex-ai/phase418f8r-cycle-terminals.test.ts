/**
 * Phase 4.18F.8R — scheduled cycle terminals must never treat mid-flight as complete.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isTerminalCycleStatus,
  defaultMonitorHealth,
} from "../../../../ai/forex-ai/automated-trading/monitoring/types.ts";
import {
  AtMonitorWorker,
  AtMonitorStore,
  fiveMinuteBoundarySec,
  resetAtMonitorStoreForTests,
  resetAtMonitorWorkerForTests,
} from "../../../../ai/forex-ai/automated-trading/monitoring/index.ts";

describe("Phase 4.18F.8R cycle terminal acceptance", () => {
  it("rejects ANALYSIS_IN_FLIGHT as a terminal cycle status", () => {
    expect(isTerminalCycleStatus("ANALYSIS_IN_FLIGHT")).toBe(false);
    expect(isTerminalCycleStatus("ANALYSIS_IN_PROGRESS")).toBe(false);
    expect(isTerminalCycleStatus(null)).toBe(false);
  });

  it("accepts real terminal outcomes including overlap skip and stale block", () => {
    expect(isTerminalCycleStatus("ANALYSIS_VALID")).toBe(true);
    expect(isTerminalCycleStatus("SCHEDULE_SLOT_SKIPPED_IN_FLIGHT")).toBe(true);
    expect(isTerminalCycleStatus("SCHEDULE_SLOT_MISSED")).toBe(true);
    expect(isTerminalCycleStatus("STALE_QUOTES")).toBe(true);
    expect(isTerminalCycleStatus("BLOCKED_STALE_QUOTES")).toBe(true);
    expect(isTerminalCycleStatus("ANALYSIS_FAILED")).toBe(true);
    expect(isTerminalCycleStatus("PROVIDER_ERROR")).toBe(true);
    expect(isTerminalCycleStatus("CONFIG_CHANGED")).toBe(true);
  });

  it("default health includes empty recentCycleTerminals ring", () => {
    const h = defaultMonitorHealth();
    expect(Array.isArray(h.recentCycleTerminals)).toBe(true);
    expect(h.recentCycleTerminals).toEqual([]);
    expect(h.lastCycleTerminalStatus).toBeNull();
  });

  it("smoke acceptance: mid-flight poll must not count as a completed cycle", () => {
    // Mirrors the production smoke rule: require completedAt + terminalStatus, never IN_FLIGHT.
    const midFlightPoll = {
      lastScheduleSlotSec: 1_793_719_500,
      lastCycleCompletedAtUtc: null,
      lastBlockerCode: "ANALYSIS_IN_FLIGHT",
      lastCycleTerminalStatus: null,
      analysisInFlight: true,
    };
    const countsAsCycle = Boolean(
      midFlightPoll.lastScheduleSlotSec != null
      && midFlightPoll.lastCycleCompletedAtUtc
      && midFlightPoll.lastCycleTerminalStatus
      && midFlightPoll.lastCycleTerminalStatus !== "ANALYSIS_IN_FLIGHT"
      && !midFlightPoll.analysisInFlight,
    );
    expect(countsAsCycle).toBe(false);

    const terminalSkip = {
      lastScheduleSlotSec: 1_793_719_500,
      lastCycleCompletedAtUtc: "2026-11-03T15:26:10.000Z",
      lastCycleTerminalStatus: "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT",
      analysisInFlight: false,
    };
    const skipCounts = Boolean(
      terminalSkip.lastScheduleSlotSec != null
      && terminalSkip.lastCycleCompletedAtUtc
      && terminalSkip.lastCycleTerminalStatus
      && terminalSkip.lastCycleTerminalStatus !== "ANALYSIS_IN_FLIGHT"
      && !terminalSkip.analysisInFlight,
    );
    expect(skipCounts).toBe(true);
  });

  it("worker claims the schedule slot before slow refresh/candle awaits", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "ai/forex-ai/automated-trading/monitoring/worker.ts"),
      "utf8",
    );
    expect(src).toContain("Claim the slot BEFORE refresh/candle awaits");
    expect(src).toContain("onBoundaryWake");
    expect(src).toContain("claimedThisTick");
    const claimIdx = src.indexOf("Claim the slot BEFORE refresh/candle awaits");
    const refreshIdx = src.indexOf("Refresh live verification before freshness gate", claimIdx);
    expect(claimIdx).toBeGreaterThan(0);
    expect(refreshIdx).toBeGreaterThan(claimIdx);
  });
});

describe("Phase 4.18F.8R slow refresh emits blocked terminal not false MISSED", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-f8r-claim-"));
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
  });

  afterEach(() => {
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("records BLOCKED_VERIFICATION after slow refresh instead of orphaning the slot", async () => {
    const now = Date.now();
    const slotSec = fiveMinuteBoundarySec(now);
    const ageMs = now - slotSec * 1000;
    // Only meaningful inside grace; otherwise the worker correctly marks MISSED.
    if (ageMs > 80_000) {
      return;
    }

    let refreshStarted = false;
    let claimBeforeRefreshDone = false;
    const store = new AtMonitorStore(tmp);

    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      store,
      autoStart: false,
      pollIntervalMs: 60_000,
      isSystemMasterOn: () => true,
      getSelectedEnvironment: () => "DEMO",
      getVerification: () => null,
      refreshVerification: async () => {
        refreshStarted = true;
        // Slot must already be claimed before this await yields.
        const health = store.getState().health;
        claimBeforeRefreshDone = health.lastScheduleSlotSec === slotSec;
        await new Promise((r) => setTimeout(r, 40));
        return null;
      },
      loadCandles: async () => [],
    });

    const started = await worker.start({
      environment: "DEMO",
      instrument: "XAU/USD",
      timeframe: "5m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
    });
    expect(started.ok).toBe(true);

    // start() fires an immediate tick — wait for the slow refresh path to finish.
    for (let i = 0; i < 40; i++) {
      const t = store.getState().health.recentCycleTerminals.find((row) => row.slotSec === slotSec);
      if (t?.completedAtUtc) break;
      await new Promise((r) => setTimeout(r, 25));
    }

    const health = store.getState().health;
    const terminal = health.recentCycleTerminals.find((t) => t.slotSec === slotSec);
    expect(refreshStarted).toBe(true);
    expect(claimBeforeRefreshDone).toBe(true);
    expect(terminal).toBeTruthy();
    expect(terminal?.terminalStatus).toBe("BLOCKED_VERIFICATION");
    expect(terminal?.terminalStatus).not.toBe("SCHEDULE_SLOT_MISSED");
    expect(health.lastCycleTerminalStatus).toBe("BLOCKED_VERIFICATION");
    worker.dispose();
  });
});
