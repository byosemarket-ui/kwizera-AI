/**
 * Phase 56.4.6 — Controlled SL fixtures, stale inject wiring, idempotency, safety locks.
 * Synthetic only — production controlled-inject evidence belongs in the phase report.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateDraftBoundaryQuote,
  openSimulatedPosition,
  monitorSimulatedPosition,
  closeSimulatedPositionManual,
  evaluateSimReentryPolicy,
  proposeControlledSlCrossingLevels,
  proposeControlledSlApproachLevels,
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
    priceChangeAgeMs: 80,
    receiptAgeMs: 60,
    updateCount: 12,
    sourceTimestampMs: Date.now(),
    receivedAtMs: Date.now(),
    nowMs: Date.now(),
    staleMs: 15_000,
    ...overrides,
  });
}

function draftBuy(quote: DraftQuoteSnapshot): AtSimDraftResult {
  const entry = quote.ask;
  return {
    schemaVersion: "at-simulation-risk-draft-v1",
    draftId: "draft_buy_56_4_6",
    createdAtUtc: new Date().toISOString(),
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "XAU/USD",
    direction: "BUY",
    entryPrice: entry,
    stopLoss: entry - 3,
    takeProfit: entry + 9,
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
  } as AtSimDraftResult;
}

function draftSell(quote: DraftQuoteSnapshot): AtSimDraftResult {
  const entry = quote.bid;
  return {
    ...draftBuy(quote),
    draftId: "draft_sell_56_4_6",
    direction: "SELL",
    entryPrice: entry,
    stopLoss: entry + 3,
    takeProfit: entry - 9,
  } as AtSimDraftResult;
}

function openBuy(): SimPosition {
  const q = liveQuote(4072.5, 4072.8);
  if (!q.ok) throw new Error("quote");
  const opened = openSimulatedPosition({ draft: draftBuy(q.snapshot), quote: q.snapshot });
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

describe("Phase 56.4.6 controlled SL crossing fixtures (BUY)", () => {
  it("approach levels do not close; cross levels close STOP_LOSS_HIT at mark", () => {
    const pos = openBuy();
    const approach = proposeControlledSlApproachLevels(pos);
    const approachTick = liveQuote(approach.bid, approach.ask);
    if (!approachTick.ok) throw new Error("approach quote");
    const approaching = monitorSimulatedPosition({
      position: pos,
      quote: approachTick.snapshot,
    });
    expect(approaching.state).toBe("MONITORING");
    expect(approaching.exitReason).toBeNull();

    const cross = proposeControlledSlCrossingLevels(pos);
    expect(cross.expectedExitReason).toBe("STOP_LOSS_HIT");
    expect(cross.bid).toBeLessThan(pos.stopLoss);
    const crossTick = liveQuote(cross.bid, cross.ask);
    if (!crossTick.ok) throw new Error("cross quote");
    const closed = monitorSimulatedPosition({
      position: approaching,
      quote: crossTick.snapshot,
    });
    expect(closed.state).toBe("SIMULATED_CLOSED");
    expect(closed.exitReason).toBe("STOP_LOSS_HIT");
    expect(closed.exitPrice).toBe(cross.bid);
    expect(closed.exitQuoteSnapshotId).toBe(crossTick.snapshot.snapshotId);
    expect(closed.achievedR!).toBeLessThan(0);
    expect(closed.realizedPnl).toBeNull();
  });

  it("gap farther across SL still fills at mark, not exact stop", () => {
    const pos = openBuy();
    const levels = proposeControlledSlCrossingLevels(pos);
    const deepBid = levels.bid - 8;
    const tick = liveQuote(deepBid, deepBid + 0.3);
    if (!tick.ok) throw new Error("gap quote");
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBe(deepBid);
    expect(next.exitPrice).not.toBe(pos.stopLoss);
  });
});

describe("Phase 56.4.6 controlled SL crossing fixtures (SELL)", () => {
  it("cross levels close STOP_LOSS_HIT using ask mark", () => {
    const pos = openSell();
    const approach = proposeControlledSlApproachLevels(pos);
    const approachTick = liveQuote(approach.bid, approach.ask);
    if (!approachTick.ok) throw new Error("approach quote");
    expect(
      monitorSimulatedPosition({ position: pos, quote: approachTick.snapshot }).state,
    ).toBe("MONITORING");

    const cross = proposeControlledSlCrossingLevels(pos);
    expect(cross.ask).toBeGreaterThan(pos.stopLoss);
    const crossTick = liveQuote(cross.bid, cross.ask);
    if (!crossTick.ok) throw new Error("cross quote");
    const closed = monitorSimulatedPosition({ position: pos, quote: crossTick.snapshot });
    expect(closed.exitReason).toBe("STOP_LOSS_HIT");
    expect(closed.exitPrice).toBeCloseTo(cross.ask, 5);
    expect(closed.exitQuoteSnapshotId).toBeTruthy();
  });
});

describe("Phase 56.4.6 stale / reconnect / duplicate close", () => {
  it("controlled stale fixture cannot invent SL fill", () => {
    const pos = openBuy();
    const levels = proposeControlledSlCrossingLevels(pos);
    const stale = liveQuote(levels.bid, levels.ask, { priceChangeAgeMs: 90_000 });
    expect(stale.ok).toBe(false);
    if (!stale.snapshot) return;
    const next = monitorSimulatedPosition({ position: pos, quote: stale.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitReason).toBeNull();
    expect(next.exitPrice).toBeNull();
  });

  it("FEED_NOT_LIVE then fresh controlled cross closes exactly once", () => {
    const pos = openBuy();
    const dead = liveQuote(pos.stopLoss - 1, pos.stopLoss - 0.7, {
      streamState: "DISCONNECTED",
      priceChangeAgeMs: 40,
    });
    if (!dead.snapshot) throw new Error("dead");
    const interrupted = monitorSimulatedPosition({ position: pos, quote: dead.snapshot });
    expect(interrupted.state).toBe("STALE_INTERRUPTED");

    const cross = proposeControlledSlCrossingLevels(pos);
    const tick = liveQuote(cross.bid, cross.ask);
    if (!tick.ok) throw new Error("fresh");
    const closed = monitorSimulatedPosition({ position: interrupted, quote: tick.snapshot });
    expect(closed.state).toBe("SIMULATED_CLOSED");
    expect(closed.exitReason).toBe("STOP_LOSS_HIT");
    const again = monitorSimulatedPosition({ position: closed, quote: tick.snapshot });
    expect(again.exitAtUtc).toBe(closed.exitAtUtc);
    expect(again.transitions.length).toBe(closed.transitions.length);
    expect(again.realizedPnl).toBe(closed.realizedPnl);
  });

  it("duplicate manual close after SL is idempotent", () => {
    const pos = openBuy();
    const cross = proposeControlledSlCrossingLevels(pos);
    const tick = liveQuote(cross.bid, cross.ask);
    if (!tick.ok) throw new Error("cross");
    const closed = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    const a = closeSimulatedPositionManual({
      position: closed,
      bid: cross.bid,
      ask: cross.ask,
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.idempotent).toBe(true);
    expect(a.position.exitReason).toBe("STOP_LOSS_HIT");
  });

  it("same-tick SL+TP still prefers Stop Loss", () => {
    const pos = openBuy();
    // Bid at/below SL (SL) while also conceptually past TP is impossible on one mark;
    // for BUY, SL wins when mark <= SL even if a synthetic quote were near TP.
    const tick = liveQuote(pos.stopLoss - 0.1, pos.stopLoss + 0.2);
    if (!tick.ok) throw new Error("tick");
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
  });

  it("re-entry remains disabled", () => {
    const p = evaluateSimReentryPolicy();
    expect(p.allowed).toBe(false);
    expect(p.autoReentryEnabled).toBe(false);
  });
});

describe("Phase 56.4.6 wiring and safety invariants", () => {
  it("service exposes controlled inject with audit-before-upsert and CONTROLLED_INJECT", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("injectControlledSimMonitorTick");
    expect(service).toContain("proposeControlledSlCrossingLevels");
    expect(service).toContain("CONTROLLED_INJECT");
    const injectIdx = service.indexOf("injectControlledSimMonitorTick");
    const slice = service.slice(injectIdx, injectIdx + 4500);
    const auditIdx = slice.indexOf("appendAudit");
    const upsertIdx = slice.indexOf("await life.upsert(next)");
    expect(auditIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(auditIdx);
  });

  it("API route is Admin-gated controlled-inject and EXECUTION_FORBIDDEN remains", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("requireForexAdmin");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("/simulation-lifecycle/controlled-inject");
    expect(api).toContain("sl_cross");
    expect(api).toContain("simulationOnly: true");
  });

  it("UI wires Controlled SL / stale inject without broker language", () => {
    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(ui).toContain("controlledSimInjectUi");
    expect(ui).toContain("data-fx-at-sim-controlled-sl");
    expect(ui).toContain("data-fx-at-sim-controlled-stale");
    expect(ui).toContain("simulation-lifecycle/controlled-inject");
    expect(ui).toContain("Never a broker order");
  });

  it("lifecycle helpers document gap fill at mark and SL-over-TP", () => {
    const life = read("ai/forex-ai/automated-trading/simulation-risk/simulation-lifecycle.ts");
    expect(life).toContain("proposeControlledSlCrossingLevels");
    expect(life).toContain("proposeControlledSlApproachLevels");
    expect(life).toContain("Stop Loss wins over Take Profit");
    expect(life).toContain("Gap fill = executable mark");
  });
});
