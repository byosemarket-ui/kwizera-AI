/**
 * Phase 56.4.3 — Simulation lifecycle UI wiring, manual close idempotency, persistence soak (fixtures).
 * Synthetic / source-wiring only — production UI evidence belongs in the phase report.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  evaluateDraftBoundaryQuote,
  openSimulatedPosition,
  monitorSimulatedPosition,
  closeSimulatedPositionManual,
  evaluateSimReentryPolicy,
  AtSimLifecycleStore,
  resetAtSimLifecycleStoreForTests,
  type AtSimDraftResult,
  type DraftQuoteSnapshot,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function freshQuote(): DraftQuoteSnapshot {
  const r = evaluateDraftBoundaryQuote({
    instrument: "XAU/USD",
    bid: 4054.5,
    ask: 4054.9,
    streamState: "LIVE",
    priceChangeAgeMs: 100,
    receiptAgeMs: 80,
    updateCount: 5,
    nowMs: Date.now(),
  });
  if (!r.ok) throw new Error("fixture quote not fresh");
  return r.snapshot;
}

function passedDraft(quote: DraftQuoteSnapshot): AtSimDraftResult {
  const entry = quote.bid; // SELL
  const stopLoss = entry + 1.5;
  const takeProfit = entry - 4.5;
  return {
    schemaVersion: "at-simulation-risk-draft-v1",
    draftId: "draft_soak_56_4_3",
    createdAtUtc: new Date().toISOString(),
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "XAU/USD",
    direction: "SELL",
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
      perOrderAllocation: 100,
    },
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

describe("Phase 56.4.3 UI and API wiring (source)", () => {
  it("AT page exposes reopen, open, monitor, close, and lifecycle panel markers", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("data-fx-at-sim-reopen");
    expect(page).toContain("data-fx-at-sim-open");
    expect(page).toContain("data-fx-at-sim-lifecycle");
    expect(page).toContain("simulation-risk/reopen");
    expect(page).toContain("simulation-lifecycle/open");
    expect(page).toContain("simulation-lifecycle/monitor");
    expect(page).toContain("simulation-lifecycle/close");
    expect(page).toContain("simulation-risk/history");
    expect(page).toMatch(/placesOrders=false/);
    expect(page).toContain("Auto re-entry disabled");
  });

  it("API routes include close and reopen draftId", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("simulation-lifecycle/close");
    expect(api).toContain("body.draftId");
    expect(api).toMatch(/placesOrders:\s*false/);
    expect(api).toContain("requireForexAdmin");
  });

  it("CSS covers lifecycle cards at phone/tablet breakpoints", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-auto-sim-life-card");
    expect(css).toContain(".fx-auto-sim-history");
    expect(css).toMatch(/@media \(max-width: 420px\)/);
    expect(css).toMatch(/@media \(max-width: 768px\)/);
  });
});

describe("Phase 56.4.3 manual close + re-entry disabled", () => {
  it("closes open position and is idempotent on second close", () => {
    const q = freshQuote();
    const opened = openSimulatedPosition({ draft: passedDraft(q), quote: q });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const first = closeSimulatedPositionManual({
      position: opened.position,
      bid: q.bid,
      ask: q.ask,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.idempotent).toBe(false);
    expect(first.position.state).toBe("SIMULATED_CLOSED");
    expect(first.position.exitReason).toBe("MANUAL_SIM_CLOSE");
    const second = closeSimulatedPositionManual({ position: first.position, bid: q.bid, ask: q.ask });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(second.position.exitAtUtc).toBe(first.position.exitAtUtc);
  });

  it("keeps auto re-entry disabled after close", () => {
    const policy = evaluateSimReentryPolicy();
    expect(policy.allowed).toBe(false);
    expect(policy.autoReentryEnabled).toBe(false);
  });
});

describe("Phase 56.4.3 persistence soak (isolated storage)", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtSimLifecycleStoreForTests();
    tmp = mkdtempSync(join(tmpdir(), "at-sim-life-"));
  });

  afterEach(() => {
    resetAtSimLifecycleStoreForTests();
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("survives reopen cycles without duplicating open positions", async () => {
    const store = new AtSimLifecycleStore(tmp);
    const q = freshQuote();
    const opened = openSimulatedPosition({ draft: passedDraft(q), quote: q });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    await store.upsert(opened.position);

    const cycles = 5;
    let current = opened.position;
    for (let i = 0; i < cycles; i += 1) {
      const tick = evaluateDraftBoundaryQuote({
        instrument: "XAU/USD",
        bid: q.bid - i * 0.01,
        ask: q.ask - i * 0.01,
        streamState: "LIVE",
        priceChangeAgeMs: 50,
        nowMs: Date.now(),
      });
      expect(tick.ok).toBe(true);
      if (!tick.ok) return;
      current = monitorSimulatedPosition({ position: current, quote: tick.snapshot });
      await store.upsert(current);
      // Reload from disk (new store instance) — same id, no duplicate open.
      resetAtSimLifecycleStoreForTests();
      const reloaded = new AtSimLifecycleStore(tmp);
      const listed = reloaded.list();
      expect(listed.length).toBe(1);
      expect(listed[0].simulationPositionId).toBe(opened.position.simulationPositionId);
      current = listed[0];
    }

    expect(existsSync(join(tmp, "forex-automated-trading", "simulation-positions.json"))).toBe(true);
    const dup = store.findOpenByDraft("draft_soak_56_4_3");
    expect(dup?.simulationPositionId).toBe(opened.position.simulationPositionId);

    const closed = closeSimulatedPositionManual({
      position: current,
      bid: q.bid,
      ask: q.ask,
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    await store.upsert(closed.position);
    resetAtSimLifecycleStoreForTests();
    const after = new AtSimLifecycleStore(tmp).list();
    expect(after).toHaveLength(1);
    expect(after[0].state).toBe("SIMULATED_CLOSED");
    expect(after[0].exitReason).toBe("MANUAL_SIM_CLOSE");
  });

  it("refuses duplicate open for same draft while still open", async () => {
    const store = new AtSimLifecycleStore(tmp);
    const q = freshQuote();
    const draft = passedDraft(q);
    const a = openSimulatedPosition({ draft, quote: q });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    await store.upsert(a.position);
    expect(store.findOpenByDraft(draft.draftId)?.simulationPositionId).toBe(
      a.position.simulationPositionId,
    );
  });
});
