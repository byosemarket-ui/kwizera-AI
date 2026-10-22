/**
 * Phase 56.4.2 — Draft-boundary quote revalidation, rejection codes, sim lifecycle.
 * Synthetic fixtures only — production evidence belongs in the phase report.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateDraftBoundaryQuote,
  enrichDraftRejectionReasons,
  normalizeRejectionCode,
  openSimulatedPosition,
  monitorSimulatedPosition,
  evaluateSimReentryPolicy,
  proposeSimLevels,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  type AtSimDraftResult,
  type DraftQuoteSnapshot,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function freshQuote(overrides: Partial<Parameters<typeof evaluateDraftBoundaryQuote>[0]> = {}) {
  return evaluateDraftBoundaryQuote({
    instrument: "XAU/USD",
    bid: 4072.5,
    ask: 4072.8,
    streamState: "LIVE",
    priceChangeAgeMs: 200,
    receiptAgeMs: 150,
    updateCount: 4,
    sourceTimestampMs: Date.now(),
    receivedAtMs: Date.now(),
    nowMs: Date.now(),
    staleMs: 15_000,
    ...overrides,
  });
}

function passedDraft(quote: DraftQuoteSnapshot): AtSimDraftResult {
  const entry = quote.ask; // BUY
  const stopLoss = entry - 3;
  const takeProfit = entry + 9; // 3R
  return {
    schemaVersion: "at-simulation-risk-draft-v1",
    draftId: "draft_test_56_4_2",
    createdAtUtc: new Date().toISOString(),
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "XAU/USD",
    direction: "BUY",
    entryPrice: entry,
    stopLoss,
    takeProfit,
    proposedQuantity: 1,
    overallStatus: "VALIDATION_PASSED",
    structuralOk: true,
    checks: [],
    reasons: [],
    placesOrders: false,
    acceptsForExecution: false,
    capitalBudgetAnalysis: {
      accountEquity: 10_000,
      strategyAllocationPercent: 10,
      strategyAllocationBudget: 1_000,
      reservedStrategyBudget: 0,
      remainingStrategyBudget: 1_000,
      perOrderAllocation: 100,
      orderAllocationOk: true,
    } as AtSimDraftResult["capitalBudgetAnalysis"],
    quoteSnapshot: {
      snapshotId: quote.snapshotId,
      observedAtUtc: quote.observedAtUtc,
      source: quote.source,
      streamState: quote.streamState,
      bid: quote.bid,
      ask: quote.ask,
      priceChangeAgeMs: quote.priceChangeAgeMs,
      fresh: quote.fresh,
      reasonCode: quote.reasonCode,
    },
  } as AtSimDraftResult;
}

describe("Phase 56.4.2 draft-boundary quote refresh", () => {
  it("accepts LIVE fresh bid/ask within freshness window", () => {
    const r = freshQuote();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.fresh).toBe(true);
    expect(r.snapshot.reasonCode).toBe("LIVE_FRESH");
    expect(r.snapshot.snapshotId).toMatch(/^dq_/);
    expect(r.snapshot.source).toBe("forexconnect-live-offers");
  });

  it("rejects stale price-change age as QUOTE_STALE", () => {
    const r = freshQuote({ priceChangeAgeMs: 60_000 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("QUOTE_STALE");
    expect(r.snapshot?.reasonCode).toBe("QUOTE_AGE_EXCEEDED");
  });

  it("rejects non-LIVE feed as FEED_NOT_LIVE", () => {
    const r = freshQuote({ streamState: "DISCONNECTED" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("FEED_NOT_LIVE");
  });

  it("rejects crossed bid/ask as QUOTE_INVALID", () => {
    const r = freshQuote({ bid: 4073, ask: 4072 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("QUOTE_INVALID");
  });

  it("rejects missing bid/ask as QUOTE_MISSING", () => {
    const r = freshQuote({ bid: null, ask: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("QUOTE_MISSING");
  });

  it("rejects unknown price-change age (heartbeat-only) as QUOTE_STALE", () => {
    const r = freshQuote({ priceChangeAgeMs: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("QUOTE_STALE");
  });
});

describe("Phase 56.4.2 entry/SL/TP and 3R", () => {
  it("BUY uses ask entry; SL below; TP at 3R", () => {
    const proposed = proposeSimLevels({
      direction: "BUY",
      bid: 4072.5,
      ask: 4072.8,
      mid: 4072.65,
      quoteFresh: true,
      supportLevels: [{ price: 4069.8, timeframe: "1h" }],
      resistanceLevels: [{ price: 4080, timeframe: "1h" }],
      digits: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.entryPrice).toBe(4072.8);
    expect(proposed.stopLoss!).toBeLessThan(proposed.entryPrice!);
    const R = Math.abs(proposed.entryPrice! - proposed.stopLoss!);
    expect(Math.abs(proposed.takeProfit! - (proposed.entryPrice! + 3 * R))).toBeLessThan(0.02);
  });

  it("SELL uses bid entry; SL above; TP at 3R", () => {
    const proposed = proposeSimLevels({
      direction: "SELL",
      bid: 4072.5,
      ask: 4072.8,
      mid: 4072.65,
      quoteFresh: true,
      supportLevels: [{ price: 4060, timeframe: "1h" }],
      resistanceLevels: [{ price: 4075.5, timeframe: "1h" }],
      digits: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.entryPrice).toBe(4072.5);
    expect(proposed.stopLoss!).toBeGreaterThan(proposed.entryPrice!);
    const R = Math.abs(proposed.entryPrice! - proposed.stopLoss!);
    expect(Math.abs(proposed.takeProfit! - (proposed.entryPrice! - 3 * R))).toBeLessThan(0.02);
  });

  it("rejects TP that violates 3R after explicit override", () => {
    const draft = validateSimulationDraft({
      environment: "DEMO",
      environmentMeta: {
        requested: "DEMO",
        actualSession: "DEMO",
        matches: true,
        environmentEpoch: 1,
        identityVerified: true,
        liveExecutionAuthorized: false,
      },
      instrument: "XAU/USD",
      direction: "BUY",
      entryPrice: 4072.8,
      stopLoss: 4069.8,
      takeProfit: 4073.0, // not 3R (expected 4081.8)
      requestedQuantity: 1,
      quote: {
        bid: 4072.5,
        ask: 4072.8,
        entryPrice: 4072.8,
        entrySource: "test",
        fresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        quoteAgeMs: 100,
        observedAtUtc: new Date().toISOString(),
      },
      account: {
        verified: true,
        accountIdMasked: "****9999",
        accountCurrency: "USD",
        balance: 10_000,
        equity: 10_000,
        usedMargin: 0,
        usableMargin: 9_000,
        fetchedAtUtc: new Date().toISOString(),
        environment: "DEMO",
        unavailableReason: null,
      },
      contract: {
        verified: true,
        pointSize: 0.01,
        tickSize: 0.01,
        digits: 2,
        quantityMin: 1,
        quantityStep: 1,
        quantityUnit: "contracts",
        quantityUnitAmbiguous: false,
        contractMultiplier: 1,
        baseUnitSize: 1,
        pipCostAccount: 0.01,
        marginPerLotAccount: 4.79,
        minStopDistance: null,
        minStopDistanceVerified: true,
        minStopNoPositiveMinimum: true,
        condDistStopPips: 0,
        condDistUnit: "pips",
        source: "synthetic",
        unavailableReason: null,
      },
      capitalAllocationPercent: 50,
      requestedPerOrderAllocation: 100,
      reservedStrategyBudgetActive: 0,
      allocationPercentage: 18,
      marketEvidenceStrength: "SUFFICIENT",
      profitProtection: null,
      sourceDecisionId: "d1",
      sourceAnalysisId: "a1",
      sourceEvidenceFingerprint: "fp",
      sourceDecidedAtUtc: new Date().toISOString(),
      policy: { ...defaultSimRiskPolicy(), riskBudgetMode: "PERCENTAGE", riskPercent: 0.5 },
      openPositionsCount: 0,
      pendingOrdersCount: 0,
      exposureDataAuthoritative: true,
    });
    expect(draft.overallStatus).not.toBe("VALIDATION_PASSED");
    expect(draft.checks.some((c) => c.code === "TP_NOT_3R" && c.status === "FAIL")).toBe(true);
  });
});

describe("Phase 56.4.2 rejection enrichment", () => {
  it("maps engine codes to stable actionable categories", () => {
    expect(normalizeRejectionCode("QUOTE_AGE_EXCEEDED")).toBe("QUOTE_STALE");
    expect(normalizeRejectionCode("STOP_LOSS_REQUIRED")).toBe("STOP_LOSS_MISSING");
    expect(normalizeRejectionCode("PER_ORDER_LOSS_LIMIT_EXCEEDED")).toBe(
      "STOP_LOSS_RISK_LIMIT_EXCEEDED",
    );
    expect(normalizeRejectionCode("EXECUTION_FORBIDDEN")).toBe("SIMULATION_ONLY_EXECUTION_LOCKED");
  });

  it("enriches failing checks without secrets", () => {
    const a = enrichDraftRejectionReasons(
      [{ code: "QUOTE_AGE_EXCEEDED", category: "QUOTE", status: "FAIL", message: "aged" }],
      [{ code: "SAFETY_EMERGENCY_LOCK", message: "lock on" }],
    );
    expect(a.map((x) => x.code)).toEqual(
      expect.arrayContaining(["QUOTE_STALE", "SIMULATION_ONLY_EXECUTION_LOCKED"]),
    );
    expect(a.every((x) => !/token|password|secret/i.test(x.message))).toBe(true);
    expect(a.find((x) => x.code === "SIMULATION_ONLY_EXECUTION_LOCKED")?.classification).toBe(
      "safety_restriction",
    );
  });
});

describe("Phase 56.4.2 simulated lifecycle", () => {
  it("opens MONITORING position from VALIDATION_PASSED + fresh quote", () => {
    const q = freshQuote();
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    const opened = openSimulatedPosition({ draft: passedDraft(q.snapshot), quote: q.snapshot });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.position.state).toBe("MONITORING");
    expect(opened.position.placesOrders).toBe(false);
    expect(opened.position.acceptsForExecution).toBe(false);
    expect(opened.position.simulationOnly).toBe(true);
    expect(opened.position.simulationPositionId).toMatch(/^sim_/);
  });

  it("refuses open when draft is not VALIDATION_PASSED", () => {
    const q = freshQuote();
    if (!q.ok) return;
    const draft = { ...passedDraft(q.snapshot), overallStatus: "REJECTED_LOCAL" as const };
    const opened = openSimulatedPosition({ draft, quote: q.snapshot });
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.code).toBe("SIM_OPEN_DRAFT_NOT_VALIDATED");
  });

  it("hits TP on BUY when mark (bid) reaches take profit", () => {
    const q = freshQuote();
    if (!q.ok) return;
    const opened = openSimulatedPosition({ draft: passedDraft(q.snapshot), quote: q.snapshot });
    if (!opened.ok) return;
    const tp = opened.position.takeProfit;
    const tick = evaluateDraftBoundaryQuote({
      instrument: "XAU/USD",
      bid: tp + 0.01,
      ask: tp + 0.31,
      streamState: "LIVE",
      priceChangeAgeMs: 50,
      receiptAgeMs: 40,
      updateCount: 10,
      nowMs: Date.now(),
    });
    expect(tick.ok).toBe(true);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: opened.position, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("TAKE_PROFIT_HIT");
    expect(next.exitPrice).toBeCloseTo(tp + 0.01, 2);
  });

  it("hits SL on BUY when mark (bid) reaches stop", () => {
    const q = freshQuote();
    if (!q.ok) return;
    const opened = openSimulatedPosition({ draft: passedDraft(q.snapshot), quote: q.snapshot });
    if (!opened.ok) return;
    const sl = opened.position.stopLoss;
    const tick = evaluateDraftBoundaryQuote({
      instrument: "XAU/USD",
      bid: sl - 0.01,
      ask: sl + 0.29,
      streamState: "LIVE",
      priceChangeAgeMs: 50,
      receiptAgeMs: 40,
      updateCount: 10,
      nowMs: Date.now(),
    });
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: opened.position, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
  });

  it("interrupts monitoring on stale quote without inventing a fill", () => {
    const q = freshQuote();
    if (!q.ok) return;
    const opened = openSimulatedPosition({ draft: passedDraft(q.snapshot), quote: q.snapshot });
    if (!opened.ok) return;
    const stale = evaluateDraftBoundaryQuote({
      instrument: "XAU/USD",
      bid: 4072.5,
      ask: 4072.8,
      streamState: "LIVE",
      priceChangeAgeMs: 90_000,
      nowMs: Date.now(),
    });
    expect(stale.ok).toBe(false);
    if (!stale.snapshot) return;
    const next = monitorSimulatedPosition({ position: opened.position, quote: stale.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitPrice).toBeNull();
    // Interrupt is not a simulated exit — do not set exitReason/fill.
    expect(next.exitReason).toBeNull();
  });

  it("disables automatic re-entry", () => {
    const policy = evaluateSimReentryPolicy();
    expect(policy.allowed).toBe(false);
    expect(policy.autoReentryEnabled).toBe(false);
    expect(policy.code).toBe("SIM_REENTRY_REQUIRES_NEW_DRAFT");
  });
});

describe("Phase 56.4.2 source wiring", () => {
  it("service refreshes quote at draft boundary and exposes lifecycle APIs", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("evaluateDraftBoundaryQuote");
    expect(service).toContain("reopenAndRevalidateLatestDraft");
    expect(service).toContain("openSimulatedFromLatestDraft");
    expect(service).toContain("enrichDraftRejectionReasons");
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("simulation-risk/reopen");
    expect(api).toContain("simulation-lifecycle/open");
    expect(api).toContain("simulation-lifecycle/monitor");
    expect(api).toContain("simulation-lifecycle/status");
  });

  it("keeps safety invariants in lifecycle module", () => {
    const life = read("ai/forex-ai/automated-trading/simulation-risk/simulation-lifecycle.ts");
    expect(life).toContain("placesOrders: false");
    expect(life).toContain("acceptsForExecution: false");
    expect(life).toContain("autoReentryEnabled: false");
    expect(life).not.toContain("submitOrder");
  });
});
