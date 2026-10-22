/**
 * Phase 56.4.4 — Deterministic SL/TP triggers, stale/reconnect, soak integrity.
 * Synthetic fixtures only — production soak evidence belongs in the phase report.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  evaluateDraftBoundaryQuote,
  openSimulatedPosition,
  monitorSimulatedPosition,
  closeSimulatedPositionManual,
  evaluateSimReentryPolicy,
  simulationLifecyclePublicStatus,
  AtSimLifecycleStore,
  resetAtSimLifecycleStoreForTests,
  type AtSimDraftResult,
  type DraftQuoteSnapshot,
  type SimPosition,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function liveQuote(
  bid: number,
  ask: number,
  overrides: Partial<Parameters<typeof evaluateDraftBoundaryQuote>[0]> = {},
) {
  return evaluateDraftBoundaryQuote({
    instrument: "XAU/USD",
    bid,
    ask,
    streamState: "LIVE",
    priceChangeAgeMs: 100,
    receiptAgeMs: 80,
    updateCount: 8,
    sourceTimestampMs: Date.now(),
    receivedAtMs: Date.now(),
    nowMs: Date.now(),
    staleMs: 15_000,
    ...overrides,
  });
}

function draftBuy(quote: DraftQuoteSnapshot, overrides: Partial<AtSimDraftResult> = {}): AtSimDraftResult {
  const entry = quote.ask;
  const stopLoss = entry - 3;
  const takeProfit = entry + 9;
  return {
    schemaVersion: "at-simulation-risk-draft-v1",
    draftId: "draft_buy_56_4_4",
    createdAtUtc: new Date().toISOString(),
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "XAU/USD",
    direction: "BUY",
    entryPrice: entry,
    stopLoss,
    takeProfit,
    proposedQuantity: 2,
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
    ...overrides,
  } as AtSimDraftResult;
}

function draftSell(quote: DraftQuoteSnapshot): AtSimDraftResult {
  const entry = quote.bid;
  const stopLoss = entry + 3;
  const takeProfit = entry - 9;
  return draftBuy(quote, {
    draftId: "draft_sell_56_4_4",
    direction: "SELL",
    entryPrice: entry,
    stopLoss,
    takeProfit,
  });
}

function openBuy(): SimPosition {
  const q = liveQuote(4072.5, 4072.8);
  expect(q.ok).toBe(true);
  if (!q.ok) throw new Error("quote");
  const opened = openSimulatedPosition({ draft: draftBuy(q.snapshot), quote: q.snapshot });
  expect(opened.ok).toBe(true);
  if (!opened.ok) throw new Error("open");
  return opened.position;
}

function openSell(): SimPosition {
  const q = liveQuote(4072.5, 4072.8);
  if (!q.ok) throw new Error("quote");
  const opened = openSimulatedPosition({ draft: draftSell(q.snapshot), quote: q.snapshot });
  if (!opened.ok) throw new Error("open");
  return opened.position;
}

describe("Phase 56.4.4 SL/TP trigger policy (BUY mark=bid)", () => {
  it("does not trigger when bid approaches but does not reach SL", () => {
    const pos = openBuy();
    const sl = pos.stopLoss;
    const tick = liveQuote(sl + 0.01, sl + 0.31);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("MONITORING");
    expect(next.exitReason).toBeNull();
    expect(next.entryPrice).toBe(pos.entryPrice);
  });

  it("triggers STOP_LOSS_HIT when bid reaches/crosses SL", () => {
    const pos = openBuy();
    const sl = pos.stopLoss;
    const tick = liveQuote(sl, sl + 0.3);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBe(sl);
  });

  it("does not trigger when bid approaches but does not reach TP", () => {
    const pos = openBuy();
    const tp = pos.takeProfit;
    const tick = liveQuote(tp - 0.01, tp + 0.29);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("MONITORING");
    expect(next.exitReason).toBeNull();
  });

  it("triggers TAKE_PROFIT_HIT when bid reaches/crosses TP", () => {
    const pos = openBuy();
    const tp = pos.takeProfit;
    const tick = liveQuote(tp + 0.05, tp + 0.35);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("TAKE_PROFIT_HIT");
    // Gap fill = mark (bid), not necessarily exact TP.
    expect(next.exitPrice).toBeCloseTo(tp + 0.05, 5);
  });

  it("on gap across both levels, Stop Loss wins (conservative)", () => {
    const pos = openBuy();
    // Bid far below SL and also would be below TP directionally for a long — SL fires first.
    const tick = liveQuote(pos.stopLoss - 10, pos.stopLoss - 9.7);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBe(pos.stopLoss - 10);
  });
});

describe("Phase 56.4.4 SL/TP trigger policy (SELL mark=ask)", () => {
  it("hits SL when ask rises to/above stop", () => {
    const pos = openSell();
    const sl = pos.stopLoss;
    const tick = liveQuote(sl - 0.3, sl + 0.01);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBeCloseTo(sl + 0.01, 5);
  });

  it("hits TP when ask falls to/below take profit", () => {
    const pos = openSell();
    const tp = pos.takeProfit;
    const tick = liveQuote(tp - 0.3, tp - 0.01);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("TAKE_PROFIT_HIT");
  });
});

describe("Phase 56.4.4 stale / disconnect / reconnect", () => {
  it("stale quote interrupts without inventing a fill or exitReason", () => {
    const pos = openBuy();
    const stale = liveQuote(4070, 4070.3, { priceChangeAgeMs: 90_000 });
    expect(stale.ok).toBe(false);
    if (!stale.snapshot) return;
    const next = monitorSimulatedPosition({ position: pos, quote: stale.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitReason).toBeNull();
    expect(next.exitPrice).toBeNull();
    expect(next.unrealizedPnl).toBeNull();
    expect(next.entryPrice).toBe(pos.entryPrice);
  });

  it("FEED_NOT_LIVE interrupts without closing", () => {
    const pos = openBuy();
    const dead = liveQuote(4070, 4070.3, { streamState: "DISCONNECTED", priceChangeAgeMs: 50 });
    expect(dead.ok).toBe(false);
    if (!dead.snapshot) return;
    const next = monitorSimulatedPosition({ position: pos, quote: dead.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitReason).toBeNull();
  });

  it("reconnect with fresh quote resumes MONITORING then can hit TP", () => {
    const pos = openBuy();
    const stale = liveQuote(4070, 4070.3, { priceChangeAgeMs: 90_000 });
    if (!stale.snapshot) return;
    const interrupted = monitorSimulatedPosition({ position: pos, quote: stale.snapshot });
    expect(interrupted.state).toBe("STALE_INTERRUPTED");
    const mid = liveQuote(pos.entryPrice + 1, pos.entryPrice + 1.3);
    if (!mid.ok) return;
    const resumed = monitorSimulatedPosition({ position: interrupted, quote: mid.snapshot });
    expect(resumed.state).toBe("MONITORING");
    expect(resumed.exitReason).toBeNull();
    const tpTick = liveQuote(pos.takeProfit + 0.1, pos.takeProfit + 0.4);
    if (!tpTick.ok) return;
    const closed = monitorSimulatedPosition({ position: resumed, quote: tpTick.snapshot });
    expect(closed.state).toBe("SIMULATED_CLOSED");
    expect(closed.exitReason).toBe("TAKE_PROFIT_HIT");
  });

  it("malformed quote (ask < bid) interrupts without fill", () => {
    const pos = openBuy();
    const bad = evaluateDraftBoundaryQuote({
      instrument: "XAU/USD",
      bid: 4072.8,
      ask: 4072.5,
      streamState: "LIVE",
      priceChangeAgeMs: 50,
      nowMs: Date.now(),
    });
    expect(bad.ok).toBe(false);
    if (!bad.snapshot) return;
    const next = monitorSimulatedPosition({ position: pos, quote: bad.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitPrice).toBeNull();
  });
});

describe("Phase 56.4.4 idempotency and accounting", () => {
  it("duplicate trigger on already-closed position is a no-op", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.stopLoss - 1, pos.stopLoss - 0.7);
    if (!tick.ok) return;
    const closed = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(closed.state).toBe("SIMULATED_CLOSED");
    const again = monitorSimulatedPosition({ position: closed, quote: tick.snapshot });
    expect(again.state).toBe("SIMULATED_CLOSED");
    expect(again.exitAtUtc).toBe(closed.exitAtUtc);
    expect(again.realizedPnl).toBe(closed.realizedPnl);
    expect(again.transitions.length).toBe(closed.transitions.length);
  });

  it("manual close is idempotent and does not double-realize", () => {
    const pos = openBuy();
    const first = closeSimulatedPositionManual({ position: pos, bid: 4071, ask: 4071.3 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = closeSimulatedPositionManual({
      position: first.position,
      bid: 1,
      ask: 1.1,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(second.position.exitPrice).toBe(first.position.exitPrice);
  });

  it("P/L stays UNKNOWN without pip/point metadata; R still from stop distance", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.takeProfit + 1, pos.takeProfit + 1.3);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.realizedPnl).toBeNull();
    expect(next.achievedR).not.toBeNull();
    expect(next.achievedR!).toBeGreaterThan(0);
  });

  it("with pip metadata, realized P/L is numeric", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.takeProfit + 1, pos.takeProfit + 1.3);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({
      position: pos,
      quote: tick.snapshot,
      pipCostAccount: 0.1,
      pointSize: 0.01,
    });
    expect(next.realizedPnl).not.toBeNull();
    expect(Number.isFinite(next.realizedPnl!)).toBe(true);
  });

  it("keeps auto re-entry disabled", () => {
    const p = evaluateSimReentryPolicy();
    expect(p.allowed).toBe(false);
    expect(p.autoReentryEnabled).toBe(false);
  });
});

describe("Phase 56.4.4 persistence soak (isolated store)", () => {
  it("survives monitor cycles + close + reload without duplicate ids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "phase56-4-4-soak-"));
    try {
      resetAtSimLifecycleStoreForTests();
      const store = new AtSimLifecycleStore(dir);
      let pos = openBuy();
      const id = pos.simulationPositionId;
      const entry = pos.entryPrice;
      const sl = pos.stopLoss;
      const tp = pos.takeProfit;
      await store.upsert(pos);

      let cycles = 0;
      for (let i = 0; i < 8; i++) {
        const mid = entry + (i % 3) * 0.1;
        const tick = liveQuote(mid, mid + 0.3);
        if (!tick.ok) continue;
        pos = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
        await store.upsert(pos);
        cycles += 1;
      }
      expect(pos.state).toBe("MONITORING");
      expect(pos.simulationPositionId).toBe(id);
      expect(pos.entryPrice).toBe(entry);
      expect(pos.stopLoss).toBe(sl);
      expect(pos.takeProfit).toBe(tp);

      const tpTick = liveQuote(tp + 0.2, tp + 0.5);
      if (!tpTick.ok) return;
      pos = monitorSimulatedPosition({ position: pos, quote: tpTick.snapshot });
      await store.upsert(pos);
      expect(pos.state).toBe("SIMULATED_CLOSED");
      expect(pos.exitReason).toBe("TAKE_PROFIT_HIT");

      resetAtSimLifecycleStoreForTests();
      const reloaded = new AtSimLifecycleStore(dir).get(id);
      expect(reloaded).toBeTruthy();
      expect(reloaded!.state).toBe("SIMULATED_CLOSED");
      expect(reloaded!.exitReason).toBe("TAKE_PROFIT_HIT");
      expect(reloaded!.entryPrice).toBe(entry);

      const status = simulationLifecyclePublicStatus([reloaded!]);
      expect(status.openCount).toBe(0);
      expect(status.closedCount).toBe(1);
      expect(status.autoReentryEnabled).toBe(false);
      expect(cycles).toBeGreaterThanOrEqual(5);
    } finally {
      resetAtSimLifecycleStoreForTests();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Phase 56.4.4 wiring", () => {
  it("service audits automatic sim closes and lifecycle documents gap policy", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("becameClosed");
    expect(service).toContain("simulation_position_closed");
    const life = read("ai/forex-ai/automated-trading/simulation-risk/simulation-lifecycle.ts");
    expect(life).toContain("Gap / jump policy");
    expect(life).toContain("Stop Loss wins");
    expect(life).not.toContain("submitOrder");
  });

  it("AT UI marks STALE_INTERRUPTED as monitoring blocked and hides Exit until closed", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("STALE_INTERRUPTED");
    expect(page).toContain("monitoring blocked");
    expect(page).toContain("data-fx-at-sim-monitor-blocked");
    expect(page).toContain("isClosed && p.exitReason");
    expect(page).toContain("P/L UNKNOWN");
  });
});
