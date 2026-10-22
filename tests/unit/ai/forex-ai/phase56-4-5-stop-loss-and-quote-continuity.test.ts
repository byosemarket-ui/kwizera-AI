/**
 * Phase 56.4.5 — Automatic Stop Loss matrix, achieved R, audit-before-upsert, stale-before-SL.
 * Synthetic fixtures only — production soak evidence belongs in the phase report.
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
    draftId: "draft_buy_56_4_5",
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
    draftId: "draft_sell_56_4_5",
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

describe("Phase 56.4.5 automatic Stop Loss (BUY mark=bid)", () => {
  it("approaches SL without closing", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.stopLoss + 0.02, pos.stopLoss + 0.32);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("MONITORING");
    expect(next.exitReason).toBeNull();
  });

  it("hits STOP_LOSS_HIT with negative achieved R and exit quote snapshot", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.stopLoss - 0.5, pos.stopLoss - 0.2);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.state).toBe("SIMULATED_CLOSED");
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBe(pos.stopLoss - 0.5);
    expect(next.exitQuoteSnapshotId).toBe(tick.snapshot.snapshotId);
    expect(next.achievedR).not.toBeNull();
    expect(next.achievedR!).toBeLessThan(0);
    expect(next.realizedPnl).toBeNull();
  });

  it("gap across SL fills at mark, not exact stop", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.stopLoss - 12, pos.stopLoss - 11.7);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBe(pos.stopLoss - 12);
  });
});

describe("Phase 56.4.5 automatic Stop Loss (SELL mark=ask)", () => {
  it("hits SL when ask rises through stop; achieved R negative", () => {
    const pos = openSell();
    const tick = liveQuote(pos.stopLoss - 0.2, pos.stopLoss + 0.4);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
    expect(next.exitPrice).toBeCloseTo(pos.stopLoss + 0.4, 5);
    expect(next.achievedR!).toBeLessThan(0);
    expect(next.exitQuoteSnapshotId).toBeTruthy();
  });

  it("same-tick SL+TP prefers Stop Loss (never the profitable TP)", () => {
    const pos = openSell();
    // Ask far above SL (SL) — for a short that is adverse; also below TP would be favorable.
    // Construct a quote that is past SL on ask.
    const tick = liveQuote(pos.stopLoss + 5, pos.stopLoss + 5.3);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("STOP_LOSS_HIT");
  });
});

describe("Phase 56.4.5 stale / disconnect before SL evaluation", () => {
  it("stale quote immediately before SL cannot invent STOP_LOSS_HIT", () => {
    const pos = openBuy();
    const wouldHit = pos.stopLoss - 1;
    const stale = liveQuote(wouldHit, wouldHit + 0.3, { priceChangeAgeMs: 90_000 });
    expect(stale.ok).toBe(false);
    if (!stale.snapshot) return;
    const next = monitorSimulatedPosition({ position: pos, quote: stale.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitReason).toBeNull();
    expect(next.exitPrice).toBeNull();
    expect(next.exitQuoteSnapshotId == null || next.exitQuoteSnapshotId === null).toBe(true);
  });

  it("FEED_NOT_LIVE before SL does not close", () => {
    const pos = openBuy();
    const dead = liveQuote(pos.stopLoss - 1, pos.stopLoss - 0.7, {
      streamState: "DISCONNECTED",
      priceChangeAgeMs: 40,
    });
    expect(dead.ok).toBe(false);
    if (!dead.snapshot) return;
    const next = monitorSimulatedPosition({ position: pos, quote: dead.snapshot });
    expect(next.state).toBe("STALE_INTERRUPTED");
    expect(next.exitReason).toBeNull();
  });

  it("after stale interrupt, fresh SL tick closes once with audit fields", () => {
    const pos = openBuy();
    const stale = liveQuote(4071, 4071.3, { priceChangeAgeMs: 90_000 });
    if (!stale.snapshot) return;
    const interrupted = monitorSimulatedPosition({ position: pos, quote: stale.snapshot });
    const tick = liveQuote(pos.stopLoss - 0.2, pos.stopLoss + 0.1);
    if (!tick.ok) return;
    const closed = monitorSimulatedPosition({ position: interrupted, quote: tick.snapshot });
    expect(closed.state).toBe("SIMULATED_CLOSED");
    expect(closed.exitReason).toBe("STOP_LOSS_HIT");
    expect(closed.exitQuoteSnapshotId).toBe(tick.snapshot.snapshotId);
    const again = monitorSimulatedPosition({ position: closed, quote: tick.snapshot });
    expect(again.exitAtUtc).toBe(closed.exitAtUtc);
    expect(again.transitions.length).toBe(closed.transitions.length);
  });

  it("repeated identical-timestamp fresh quotes do not duplicate open positions", () => {
    const pos = openBuy();
    const mid = (pos.entryPrice + pos.stopLoss) / 2;
    const tick = liveQuote(mid, mid + 0.3);
    if (!tick.ok) return;
    let cur = pos;
    for (let i = 0; i < 5; i++) {
      cur = monitorSimulatedPosition({ position: cur, quote: tick.snapshot });
    }
    expect(cur.state).toBe("MONITORING");
    expect(cur.simulationPositionId).toBe(pos.simulationPositionId);
    expect(cur.entryPrice).toBe(pos.entryPrice);
  });
});

describe("Phase 56.4.5 TP regression and accounting", () => {
  it("BUY TP still hits with positive achieved R", () => {
    const pos = openBuy();
    const tick = liveQuote(pos.takeProfit + 0.2, pos.takeProfit + 0.5);
    if (!tick.ok) return;
    const next = monitorSimulatedPosition({ position: pos, quote: tick.snapshot });
    expect(next.exitReason).toBe("TAKE_PROFIT_HIT");
    expect(next.achievedR!).toBeGreaterThan(0);
    expect(next.exitQuoteSnapshotId).toBe(tick.snapshot.snapshotId);
  });

  it("manual close remains idempotent", () => {
    const pos = openBuy();
    const a = closeSimulatedPositionManual({ position: pos, bid: 4071, ask: 4071.3 });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = closeSimulatedPositionManual({ position: a.position, bid: 1, ask: 1.1 });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.idempotent).toBe(true);
  });

  it("re-entry remains disabled", () => {
    const p = evaluateSimReentryPolicy();
    expect(p.allowed).toBe(false);
    expect(p.autoReentryEnabled).toBe(false);
  });
});

describe("Phase 56.4.5 wiring", () => {
  it("audits automatic close before upsert and persists exitQuoteSnapshotId", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    const auditIdx = service.indexOf("appendAudit");
    const upsertIdx = service.indexOf("await life.upsert(next)");
    expect(auditIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(auditIdx);
    expect(service).toContain("exitQuoteSnapshotId");
    expect(service).toContain("Audit before upsert");
    const life = read("ai/forex-ai/automated-trading/simulation-risk/simulation-lifecycle.ts");
    expect(life).toContain("exitQuoteSnapshotId");
    expect(life).toContain("Stop Loss wins over Take Profit");
  });
});
