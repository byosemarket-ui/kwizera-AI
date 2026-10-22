/**
 * Phase 56.4.7 — Simulation persistence across synthetic process restart,
 * fail-closed recovery, quote freshness, and safety locks.
 * Synthetic restart ≠ production restart proof.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  evaluateDraftBoundaryQuote,
  openSimulatedPosition,
  monitorSimulatedPosition,
  closeSimulatedPositionManual,
  evaluateSimReentryPolicy,
  recoverSimPositionAfterProcessRestart,
  recoverSimPositionsAfterProcessRestart,
  SIM_RESTART_RECOVERY_NOTE,
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
    draftId: "draft_buy_56_4_7",
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

function openBuy(): SimPosition {
  const q = liveQuote(4072.5, 4072.8);
  if (!q.ok) throw new Error("quote");
  const opened = openSimulatedPosition({ draft: draftBuy(q.snapshot), quote: q.snapshot });
  if (!opened.ok) throw new Error("open");
  return opened.position;
}

describe("Phase 56.4.7 pure restart recovery", () => {
  it("marks MONITORING as STALE_INTERRUPTED without fabricating a fill", () => {
    const pos = openBuy();
    expect(pos.state).toBe("MONITORING");
    const r = recoverSimPositionAfterProcessRestart(pos);
    expect(r.changed).toBe(true);
    expect(r.action).toBe("MARKED_STALE_AWAITING_FRESH_QUOTE");
    expect(r.position.state).toBe("STALE_INTERRUPTED");
    expect(r.position.exitReason).toBeNull();
    expect(r.position.exitPrice).toBeNull();
    expect(r.position.realizedPnl).toBeNull();
    expect(r.position.simulationPositionId).toBe(pos.simulationPositionId);
    expect(r.position.entryPrice).toBe(pos.entryPrice);
    expect(r.position.stopLoss).toBe(pos.stopLoss);
    expect(r.position.takeProfit).toBe(pos.takeProfit);
    expect(r.position.placesOrders).toBe(false);
    expect(r.position.acceptsForExecution).toBe(false);
    expect(
      r.position.transitions.some((t) => t.note.includes("PROCESS_RESTART_RECOVERY")),
    ).toBe(true);
  });

  it("keeps SIMULATED_CLOSED unchanged (cannot reopen)", () => {
    const pos = openBuy();
    const closed = closeSimulatedPositionManual({
      position: pos,
      bid: 4071,
      ask: 4071.3,
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    const r = recoverSimPositionAfterProcessRestart(closed.position);
    expect(r.changed).toBe(false);
    expect(r.action).toBe("UNCHANGED_CLOSED");
    expect(r.position.state).toBe("SIMULATED_CLOSED");
    expect(r.position.exitReason).toBe("MANUAL_SIM_CLOSE");
  });

  it("blocks ambiguous EXIT_TRIGGERED without inventing SIMULATED_CLOSED", () => {
    const pos = openBuy();
    const ambiguous: SimPosition = {
      ...pos,
      state: "EXIT_TRIGGERED",
      exitReason: "STOP_LOSS_HIT",
      exitPrice: pos.stopLoss - 1,
      exitAtUtc: new Date().toISOString(),
    };
    const r = recoverSimPositionAfterProcessRestart(ambiguous);
    expect(r.action).toBe("AMBIGUOUS_EXIT_BLOCKED");
    expect(r.position.state).toBe("STALE_INTERRUPTED");
    expect(r.position.exitReason).toBeNull();
    expect(r.position.exitPrice).toBeNull();
  });

  it("batch recovery is idempotent (second pass changes nothing material)", () => {
    const open = openBuy();
    const first = recoverSimPositionsAfterProcessRestart([open]);
    expect(first.changedCount).toBe(1);
    expect(first.placesOrders).toBe(false);
    expect(first.autoReentryEnabled).toBe(false);
    const second = recoverSimPositionsAfterProcessRestart(first.positions);
    expect(second.changedCount).toBe(0);
    expect(second.results[0]?.action).toBe("ALREADY_INTERRUPTED");
    expect(second.positions[0]?.simulationPositionId).toBe(open.simulationPositionId);
  });

  it("re-entry remains disabled", () => {
    const p = evaluateSimReentryPolicy();
    expect(p.allowed).toBe(false);
    expect(p.autoReentryEnabled).toBe(false);
  });
});

describe("Phase 56.4.7 durable store survives synthetic process restart", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtSimLifecycleStoreForTests();
    tmp = mkdtempSync(join(tmpdir(), "kw-sim-56-4-7-"));
  });

  afterEach(() => {
    resetAtSimLifecycleStoreForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("open position ID survives new store instance; recovery then blocks until fresh quote", async () => {
    const storeA = new AtSimLifecycleStore(tmp);
    const open = openBuy();
    await storeA.upsert(open);
    const id = open.simulationPositionId;

    // Synthetic process restart: new store instance from same disk root.
    const storeB = new AtSimLifecycleStore(tmp);
    const loaded = storeB.get(id);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toBe("MONITORING");
    expect(loaded!.entryPrice).toBe(open.entryPrice);

    const recovered = recoverSimPositionsAfterProcessRestart(storeB.list());
    for (const p of recovered.positions) {
      if (recovered.results.find((r) => r.positionId === p.simulationPositionId)?.changed) {
        await storeB.upsert(p);
      }
    }
    const after = storeB.get(id)!;
    expect(after.state).toBe("STALE_INTERRUPTED");

    // Pre-restart-aged quote must not close.
    const stale = liveQuote(after.stopLoss - 1, after.stopLoss - 0.7, {
      priceChangeAgeMs: 90_000,
    });
    if (!stale.snapshot) throw new Error("stale snapshot");
    const blocked = monitorSimulatedPosition({ position: after, quote: stale.snapshot });
    expect(blocked.state).toBe("STALE_INTERRUPTED");
    expect(blocked.exitReason).toBeNull();

    // Fresh quote that does not hit SL resumes MONITORING (no fabricated fill).
    const mid = (after.entryPrice + after.stopLoss) / 2;
    const fresh = liveQuote(mid, mid + 0.3);
    if (!fresh.ok) throw new Error("fresh");
    const resumed = monitorSimulatedPosition({ position: blocked, quote: fresh.snapshot });
    expect(resumed.state).toBe("MONITORING");
    expect(resumed.exitReason).toBeNull();
    expect(resumed.simulationPositionId).toBe(id);

    // Fresh SL cross closes exactly once after recovery.
    const hit = liveQuote(after.stopLoss - 0.5, after.stopLoss - 0.2);
    if (!hit.ok) throw new Error("hit");
    const closed = monitorSimulatedPosition({ position: resumed, quote: hit.snapshot });
    expect(closed.state).toBe("SIMULATED_CLOSED");
    expect(closed.exitReason).toBe("STOP_LOSS_HIT");
    const again = monitorSimulatedPosition({ position: closed, quote: hit.snapshot });
    expect(again.exitAtUtc).toBe(closed.exitAtUtc);
    expect(again.transitions.length).toBe(closed.transitions.length);

    // Closed survives another synthetic restart.
    await storeB.upsert(closed);
    const storeC = new AtSimLifecycleStore(tmp);
    const closedLoaded = storeC.get(id)!;
    const postClose = recoverSimPositionAfterProcessRestart(closedLoaded);
    expect(postClose.action).toBe("UNCHANGED_CLOSED");
    expect(postClose.position.state).toBe("SIMULATED_CLOSED");
  });

  it("repeated recovery upserts do not duplicate position rows", async () => {
    const store = new AtSimLifecycleStore(tmp);
    const open = openBuy();
    await store.upsert(open);
    for (let i = 0; i < 3; i++) {
      const batch = recoverSimPositionsAfterProcessRestart(store.list());
      for (let j = 0; j < batch.positions.length; j++) {
        if (batch.results[j]?.changed) await store.upsert(batch.positions[j]!);
      }
    }
    expect(store.list().length).toBe(1);
    expect(store.list()[0]?.simulationPositionId).toBe(open.simulationPositionId);
  });
});

describe("Phase 56.4.7 wiring and safety", () => {
  it("service recovers on bootstrap and API exposes recover route", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("recoverSimLifecycleFromPersistence");
    expect(service).toContain("recoverSimPositionsAfterProcessRestart");
    expect(service).toContain("PROCESS_RESTART_RECOVERY");
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/simulation-lifecycle/recover");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");
    const life = read("ai/forex-ai/automated-trading/simulation-risk/simulation-lifecycle.ts");
    expect(life).toContain(SIM_RESTART_RECOVERY_NOTE);
    expect(life).toContain("Never fabricates fills");
  });
});
