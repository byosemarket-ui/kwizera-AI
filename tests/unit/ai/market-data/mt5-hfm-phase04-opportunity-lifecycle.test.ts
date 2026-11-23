/**
 * Phase 04 — Opportunity Lifecycle & Continuous Monitoring (HFM MT5).
 * FIXTURE TESTS — not live market verification.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  baseCanonicalCandle,
  getAllowedLifecycleTransitions,
  observeCandidateAgainstCandles,
  runHfmLifecycleMonitorCycle,
  getHfmLifecycleMonitorWorkerStatus,
  disableHfmLifecycleMonitorWorker,
  enableHfmLifecycleMonitorWorker,
  toSemanticLifecycleStage,
  isManualForceConfirmForbidden,
  isTerminalLifecycleState,
  HFM_LIFECYCLE_TRANSITION_RULE_VERSION,
  type MifCanonicalCandle,
  type MifPersistedCandidate,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  high: number,
  low: number,
  close?: number,
  state: "CLOSED" | "FORMING" = "CLOSED",
  symbol = "XAUUSD",
): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const mid = (high + low) / 2;
  return baseCanonicalCandle({
    providerSymbol: symbol,
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: mid,
    high,
    low,
    close: close ?? mid,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: state,
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "fixture",
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
  });
}

async function seedCandidate(
  store: MifOpportunityStorage,
  overrides: Partial<MifPersistedCandidate> = {},
): Promise<MifPersistedCandidate> {
  const now = new Date().toISOString();
  const candidate: MifPersistedCandidate = {
    schemaVersion: "1.0.0",
    candidateId: overrides.candidateId ?? "cand-phase04-1",
    runId: overrides.runId ?? "run-phase04-1",
    strategyId: "fixture.strategy",
    detectorId: "fixture.detector",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    direction: "BUY",
    detectionStatus: "DETECTED",
    lifecycleState: "DETECTED",
    timeframeRoles: ["H1"],
    assessmentTimestamp: now,
    createdAt: now,
    updatedAt: now,
    supportingEvidenceIds: ["ev.1", "ev.2"],
    conflictingEvidenceIds: [],
    requiredConfirmations: ["closed_retest"],
    invalidationConditions: ["invalidationPrice=2090", "invalidationSide=BELOW"],
    dataQualityStatus: "OK",
    mtfRelation: null,
    thesis: "fixture thesis entryPrice=2100 invalidationPrice=2090 targetPrice=2120",
    rationale: "fixture",
    outcomeKind: "NONE",
    candidateSnapshot: {
      tipOpenTimeSec: T0,
      openTimeSec: T0,
      assessmentTimestamp: now,
    } as never,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    notExecutable: true,
    ...overrides,
  };
  const dir = (store as unknown as { candidatesDir: string }).candidatesDir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${candidate.candidateId}.json`),
    `${JSON.stringify(candidate, null, 2)}\n`,
  );
  return candidate;
}

describe("Phase 04 — semantic mapping (fixture)", () => {
  it("maps persistence states to Phase 04 semantic stages", () => {
    expect(toSemanticLifecycleStage("DETECTED")).toBe("DETECTED");
    expect(toSemanticLifecycleStage("ACTIVE")).toBe("FORMING");
    expect(toSemanticLifecycleStage("NEEDS_CONFIRMATION")).toBe("WAITING_FOR_CONFIRMATION");
    expect(toSemanticLifecycleStage("CONFIRMED")).toBe("CONFIRMED");
    expect(toSemanticLifecycleStage("INVALIDATED")).toBe("INVALIDATED");
    expect(toSemanticLifecycleStage("EXPIRED")).toBe("EXPIRED");
    expect(toSemanticLifecycleStage("COMPLETED")).toBe("OUTCOME_EVALUATED");
    expect(toSemanticLifecycleStage("OUTCOME_UNKNOWN")).toBe("OUTCOME_EVALUATED");
  });

  it("forbids manual force confirm", () => {
    expect(isManualForceConfirmForbidden("CONFIRMED")).toBe(true);
    expect(isManualForceConfirmForbidden("ACTIVE")).toBe(false);
  });

  it("marks terminal states correctly", () => {
    expect(isTerminalLifecycleState("INVALIDATED")).toBe(true);
    expect(isTerminalLifecycleState("DETECTED")).toBe(false);
  });
});

describe("Phase 04 — FSM transitions (fixture)", () => {
  let tmp: string;
  let store: MifOpportunityStorage;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hfm-p04-"));
    store = new MifOpportunityStorage(tmp);
    await store.ensureReady();
    __setMifOpportunityStorageForTests(store);
    await seedCandidate(store);
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("allows permitted transitions and rejects forbidden ones", async () => {
    const table = getAllowedLifecycleTransitions();
    expect(table.DETECTED).toContain("ACTIVE");
    expect(table.OUTCOME_UNKNOWN).toEqual([]);

    const ok = await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "ACTIVE",
      reason: "observation_window_active",
    });
    expect(ok.ok).toBe(true);
    expect(ok.candidate?.lifecycleState).toBe("ACTIVE");

    const bad = await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "DETECTED",
      reason: "illegal_reopen",
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/invalid_transition/);
  });

  it("rejects missing reason code", async () => {
    const r = await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "ACTIVE",
      reason: "   ",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_reason_code");
  });

  it("protects terminal states from silent reopen", async () => {
    await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "INVALIDATED",
      reason: "invalidation_price_observed",
    });
    const reopen = await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "ACTIVE",
      reason: "should_fail",
    });
    expect(reopen.ok).toBe(false);
  });

  it("idempotent duplicate transition key does not duplicate history", async () => {
    const a = await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "ACTIVE",
      reason: "observation_window_active",
      idempotencyKey: "same-key-1",
      transitionRuleVersion: HFM_LIFECYCLE_TRANSITION_RULE_VERSION,
    });
    expect(a.ok).toBe(true);
    const b = await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "NEEDS_CONFIRMATION",
      reason: "waiting",
      idempotencyKey: "same-key-1",
    });
    expect(b.ok).toBe(true);
    expect(b.duplicate).toBe(true);
    const hist = await store.getCandidateHistory("cand-phase04-1");
    expect(hist.filter((e) => e.idempotencyKey === "same-key-1")).toHaveLength(1);
  });

  it("new opportunity after terminal uses new identity", async () => {
    await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "EXPIRED",
      reason: "max_observation_age",
    });
    await seedCandidate(store, { candidateId: "cand-phase04-2", runId: "run-2" });
    const listed = await store.listMonitorableCandidates({ providerSymbol: "XAUUSD" });
    expect(listed.items.some((c) => c.candidateId === "cand-phase04-2")).toBe(true);
    expect(listed.items.some((c) => c.candidateId === "cand-phase04-1")).toBe(false);
  });
});

describe("Phase 04 — observe invalidation / expiry / duplicate (fixture)", () => {
  let tmp: string;
  let store: MifOpportunityStorage;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hfm-p04-obs-"));
    store = new MifOpportunityStorage(tmp);
    await store.ensureReady();
    __setMifOpportunityStorageForTests(store);
    await seedCandidate(store, {
      thesis: "entryPrice=2100 invalidationPrice=2090 targetPrice=2120 invalidationSide=BELOW targetSide=ABOVE",
      invalidationConditions: ["invalidationPrice=2090", "invalidationSide=BELOW"],
      requiredConfirmations: ["targetPrice=2120", "targetSide=ABOVE"],
    });
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("invalidates on closed-candle breach and is idempotent on repeat", async () => {
    const closed = [
      candle(1, 2105, 2088, 2089),
      candle(2, 2095, 2085, 2087),
    ];
    const first = await observeCandidateAgainstCandles({
      candidateId: "cand-phase04-1",
      closedCandles: closed,
      invalidationPrice: 2090,
      invalidationSide: "BELOW",
      targetPrice: 2120,
      targetSide: "ABOVE",
      activationOpenTimeSec: T0,
    });
    expect(first.ok).toBe(true);
    expect(first.lifecycleState).toBe("INVALIDATED");

    const second = await observeCandidateAgainstCandles({
      candidateId: "cand-phase04-1",
      closedCandles: closed,
      invalidationPrice: 2090,
      invalidationSide: "BELOW",
      targetPrice: 2120,
      targetSide: "ABOVE",
      activationOpenTimeSec: T0,
    });
    expect(second.ok).toBe(true);
    const hist = await store.getCandidateHistory("cand-phase04-1");
    const inv = hist.filter((e) => e.toState === "INVALIDATED");
    expect(inv.length).toBe(1);
  });

  it("expires when maxAgeBars exceeded without decisive hit", async () => {
    await seedCandidate(store, {
      candidateId: "cand-expire",
      thesis: "entryPrice=2100 invalidationPrice=2000 targetPrice=3000 invalidationSide=BELOW targetSide=ABOVE",
    });
    const bars = Array.from({ length: 5 }, (_, i) =>
      candle(i + 1, 2102, 2098, 2100),
    );
    const obs = await observeCandidateAgainstCandles({
      candidateId: "cand-expire",
      closedCandles: bars,
      invalidationPrice: 2000,
      invalidationSide: "BELOW",
      targetPrice: 3000,
      targetSide: "ABOVE",
      activationOpenTimeSec: T0,
      maxAgeBars: 2,
    });
    expect(obs.ok).toBe(true);
    expect(obs.lifecycleState).toBe("EXPIRED");
  });

  it("does not use FORMING candles for decisive outcome", async () => {
    const formingOnly = [candle(1, 2085, 2080, 2082, "FORMING")];
    const obs = await observeCandidateAgainstCandles({
      candidateId: "cand-phase04-1",
      closedCandles: formingOnly,
      invalidationPrice: 2090,
      invalidationSide: "BELOW",
      targetPrice: 2120,
      targetSide: "ABOVE",
      activationOpenTimeSec: T0,
    });
    // No CLOSED window → no transition to INVALIDATED
    expect(obs.lifecycleState).toBe("DETECTED");
  });
});

describe("Phase 04 — monitor cycle evidence gates (fixture)", () => {
  let tmp: string;
  let store: MifOpportunityStorage;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hfm-p04-mon-"));
    store = new MifOpportunityStorage(tmp);
    await store.ensureReady();
    __setMifOpportunityStorageForTests(store);
    await seedCandidate(store);
    disableHfmLifecycleMonitorWorker();
  });

  afterEach(() => {
    disableHfmLifecycleMonitorWorker();
    __setMifOpportunityStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("rejects non-HFM provider evidence", async () => {
    const cycle = await runHfmLifecycleMonitorCycle({
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      nowMs: (T0 + 10 * STEP) * 1000,
      fetchCandles: async () => ({
        provider: "BINANCE",
        available: true,
        bars: [{ time: T0 + STEP, open: 1, high: 2, low: 0.5, close: 1.5, validationStatus: "ok" }],
        errors: [],
      }),
    });
    expect(cycle.evidenceHealth).toBe("PROVIDER_MISMATCH");
    expect(cycle.runsOpportunityDetection).toBe(false);
    expect(cycle.callsOpenAi).toBe(false);
  });

  it("rejects ForexConnect provider evidence", async () => {
    const cycle = await runHfmLifecycleMonitorCycle({
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      nowMs: (T0 + 10 * STEP) * 1000,
      fetchCandles: async () => ({
        provider: "FOREXCONNECT",
        available: true,
        bars: [{ time: T0 + STEP, open: 1, high: 2, low: 0.5, close: 1.5, validationStatus: "ok" }],
        errors: [],
      }),
    });
    expect(cycle.evidenceHealth).toBe("PROVIDER_MISMATCH");
  });

  it("confirms NEEDS_CONFIRMATION with fresh closed HFM bars (not confidence)", async () => {
    await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "NEEDS_CONFIRMATION",
      reason: "awaiting_closed_confirm",
    });
    const nowSec = T0 + 5 * STEP;
    const bars = [1, 2, 3, 4, 5].map((i) => candle(i, 2102, 2098, 2100));
    const obs = await observeCandidateAgainstCandles({
      candidateId: "cand-phase04-1",
      closedCandles: bars,
      invalidationPrice: 2000,
      invalidationSide: "BELOW",
      targetPrice: 3000,
      targetSide: "ABOVE",
      activationOpenTimeSec: T0,
      maxAgeBars: 50,
    });
    expect(obs.ok).toBe(true);
    expect(obs.lifecycleState).toBe("CONFIRMED");
    expect(toSemanticLifecycleStage("CONFIRMED", obs.outcomeKind)).toBe("CONFIRMED");
    void nowSec;
  });

  it("skips confirmation when evidence is stale for NEEDS_CONFIRMATION", async () => {
    await store.transitionLifecycle({
      candidateId: "cand-phase04-1",
      toState: "NEEDS_CONFIRMATION",
      reason: "awaiting_closed_confirm",
    });
    const cycle = await runHfmLifecycleMonitorCycle({
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      nowMs: (T0 + 1000 * STEP) * 1000,
      maxBarAgeMs: 60_000,
      fetchCandles: async () => ({
        provider: "HFM_MT5",
        available: true,
        bars: [
          {
            time: T0 + STEP,
            open: 2100,
            high: 2105,
            low: 2095,
            close: 2101,
            validationStatus: "ok",
          },
        ],
        errors: [],
        newestTimestamp: T0 + STEP,
      }),
    });
    expect(cycle.evidenceHealth).toBe("STALE");
    expect(cycle.results.some((r) => r.error === "stale_evidence_blocks_confirmation")).toBe(true);
  });

  it("observes active candidates with fresh closed HFM bars", async () => {
    const nowSec = T0 + 5 * STEP;
    const cycle = await runHfmLifecycleMonitorCycle({
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      nowMs: nowSec * 1000,
      maxBarAgeMs: 24 * 60 * 60 * 1000,
      fetchCandles: async () => ({
        provider: "HFM_MT5",
        available: true,
        bars: [1, 2, 3, 4, 5].map((i) => ({
          time: T0 + i * STEP,
          open: 2100,
          high: 2102,
          low: 2098,
          close: 2100,
          validationStatus: "ok",
        })),
        errors: [],
        newestTimestamp: nowSec,
      }),
    });
    expect(cycle.ok).toBe(true);
    expect(cycle.providerId).toBe("HFM_MT5");
    expect(cycle.evidenceHealth).toBe("FRESH");
    expect(cycle.candidatesConsidered).toBeGreaterThanOrEqual(1);
    expect(cycle.placesOrders).toBe(false);
  });

  it("worker remains disabled by default", () => {
    const s = getHfmLifecycleMonitorWorkerStatus();
    expect(s.enabled).toBe(false);
    expect(s.placesOrders).toBe(false);
    expect(s.activationPolicy).toBe("DISABLED_BY_DEFAULT_EXPLICIT_ENABLE_REQUIRED");
    const enabled = enableHfmLifecycleMonitorWorker({ symbol: "XAUUSD", intervalMs: 60_000 });
    expect(enabled.enabled).toBe(true);
    disableHfmLifecycleMonitorWorker();
    expect(getHfmLifecycleMonitorWorkerStatus().enabled).toBe(false);
  });
});
