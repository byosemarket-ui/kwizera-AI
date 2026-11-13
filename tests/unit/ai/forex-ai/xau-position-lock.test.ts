/**
 * XAU/USD single-position lock + read-only lifecycle monitor — FIXTURE broker tables
 * (not live broker evidence). No broker mutation surface exists in these modules.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyXauBrokerExposure,
  runXauPositionMonitorTick,
  XauPositionLockStore,
  type XauBrokerEvidence,
} from "../../../../ai/forex-ai/automated-trading/position-lock/index.ts";
import {
  getAtPhase2PipelineStore,
  resetAtPhase2PipelineStoreForTests,
  runPhase2Downstream,
} from "../../../../ai/forex-ai/automated-trading/phase2-pipeline.ts";
import {
  getAtSystemMasterStore,
  resetAtSystemMasterStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/system-master/index.ts";
import { AT_SYSTEM_MASTER_OWNED_MODULES } from "../../../../ai/forex-ai/automated-trading/system-master/types.ts";
import type { AtResultIntakeRecord } from "../../../../ai/forex-ai/automated-trading/result-intake/types.ts";

const T0 = Date.parse("2026-11-13T12:00:00.000Z");
const OFFER = "4001";

type Row = Record<string, unknown>;

function tables(opts: {
  trades?: Row[];
  orders?: Row[];
  cap?: string;
  fetchedAtMs?: number;
}) {
  const fetchedAt = new Date(opts.fetchedAtMs ?? T0).toISOString();
  const trades = opts.trades ?? [];
  const orders = opts.orders ?? [];
  return {
    trades: {
      ok: true,
      capabilityStatus: opts.cap ?? "AVAILABLE",
      code: trades.length ? "OK" : "NO_TRADES",
      count: trades.length,
      fetchedAt,
      trades,
    },
    orders: {
      ok: true,
      capabilityStatus: opts.cap ?? "AVAILABLE",
      code: orders.length ? "OK" : "NO_ORDERS",
      count: orders.length,
      fetchedAt,
      orders,
    },
  };
}

function evidence(
  opts: { trades?: Row[]; orders?: Row[]; cap?: string; closed?: Row[]; tracked?: string[]; nowMs?: number } = {},
): XauBrokerEvidence {
  const nowMs = opts.nowMs ?? T0;
  const t = tables({ ...opts, fetchedAtMs: nowMs });
  return classifyXauBrokerExposure({
    trades: t.trades,
    orders: t.orders,
    closedTrades: opts.closed ? { ok: true, capabilityStatus: "AVAILABLE", code: "OK", trades: opts.closed } : null,
    symbol: "XAU/USD",
    offerId: OFFER,
    trackedTradeIds: opts.tracked ?? [],
    nowMs,
  });
}

const xauTrade = (id: string, pl = -10, over: Row = {}): Row => ({
  tradeId: id,
  instrument: OFFER,
  offerId: OFFER,
  side: "B",
  amount: 1,
  openRate: 2000,
  currentPrice: 1995,
  floatingPl: pl,
  stopLoss: 1990,
  takeProfit: 2030,
  ...over,
});

let root: string;
let store: XauPositionLockStore;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-xau-lock-"));
  process.env.KWIZERA_STORAGE_ROOT = root;
  store = new XauPositionLockStore(root);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("classifyXauBrokerExposure (FIXTURE)", () => {
  it("confirmed flat only when both RO tables are authoritative and empty of XAU", () => {
    expect(evidence().status).toBe("CONFIRMED_FLAT");
    expect(evidence({ trades: [{ tradeId: "e1", instrument: "EUR/USD", amount: 1000 }] }).status).toBe("CONFIRMED_FLAT");
  });

  it("matches XAU by OfferID when rows omit the symbol", () => {
    const e = evidence({ trades: [xauTrade("t1")] });
    expect(e.status).toBe("OCCUPIED");
    expect(e.positions[0].ownership).toBe("EXTERNAL");
    expect(e.reasonCodes).toContain("EXTERNAL_XAU_POSITION_PRESENT");
  });

  it("pending XAU order → OCCUPIED", () => {
    const e = evidence({ orders: [{ orderId: "o1", instrument: "XAU/USD", side: "S", amount: 1 }] });
    expect(e.status).toBe("OCCUPIED");
    expect(e.reasonCodes).toContain("XAU_PENDING_ORDER_PRESENT");
  });

  it("disconnected tables or unidentifiable rows → UNKNOWN (never flat)", () => {
    expect(evidence({ cap: "AVAILABLE_BUT_DISCONNECTED" }).status).toBe("UNKNOWN");
    const unidentified = classifyXauBrokerExposure({
      ...tables({ trades: [{ tradeId: "x", instrument: "77" }] }),
      symbol: "XAU/USD",
      offerId: null,
      nowMs: T0,
    });
    expect(unidentified.status).toBe("UNKNOWN");
    expect(classifyXauBrokerExposure({ trades: null, orders: null, symbol: "XAU/USD", offerId: OFFER, nowMs: T0 }).status)
      .toBe("UNKNOWN");
  });
});

describe("XAU position lock (FIXTURE)", () => {
  const acquire = (s: XauPositionLockStore, id: string, e = evidence(), nowMs = T0) =>
    s.acquireReservation({ proposalId: id, idempotencyKey: `k:${id}`, evidence: e, maxRiskAccountCurrency: 125, nowMs });

  it("no position/order → reservation acquired; duplicate request reuses it", async () => {
    const a = await acquire(store, "p1");
    expect(a.ok).toBe(true);
    const b = await acquire(store, "p1");
    expect(b.ok && b.duplicate).toBe(true);
    if (a.ok && b.ok) expect(b.reservationId).toBe(a.reservationId);
    const c = await acquire(store, "p2");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.code).toBe("POSITION_LOCK_HELD");
  });

  it("external XAU position or pending order blocks entry and holds the lock", async () => {
    const a = await acquire(store, "p1", evidence({ trades: [xauTrade("ext-1")] }));
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.code).toBe("EXTERNAL_XAU_POSITION_PRESENT");
    expect(store.get().state).toBe("EXTERNAL_POSITION_BLOCK");

    const s2 = new XauPositionLockStore(fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-xau-lock-")));
    const b = await acquire(s2, "p1", evidence({ orders: [{ orderId: "o1", instrument: "XAU/USD" }] }));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.code).toBe("XAU_PENDING_ORDER_PRESENT");
  });

  it("unknown or stale broker state → BROKER_STATE_UNKNOWN, no reservation", async () => {
    const a = await acquire(store, "p1", evidence({ cap: "ERROR" }));
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.code).toBe("BROKER_STATE_UNKNOWN");
    const stale = await acquire(store, "p1", evidence({ nowMs: T0 - 120_000 }), T0);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("BROKER_STATE_UNKNOWN");
    expect(store.get().reservation).toBeNull();
  });

  it("concurrent workers across store instances → exactly one reservation", async () => {
    const stores = Array.from({ length: 5 }, () => new XauPositionLockStore(root));
    const now = Date.now();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => acquire(stores[i % 5], `p${i}`, evidence({ nowMs: now }), now)),
    );
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.code === "POSITION_LOCK_HELD").length).toBe(19);
  });

  it("separate OS processes → exactly one reservation (multi-instance)", async () => {
    const storeTs = path.resolve(process.cwd(), "ai/forex-ai/automated-trading/position-lock/store.ts");
    const script = path.join(root, "acquire-child.ts");
    fs.writeFileSync(
      script,
      `import { XauPositionLockStore } from ${JSON.stringify(storeTs)};
const id = process.argv[2];
const now = Date.now();
const evidence = { status: "CONFIRMED_FLAT", observedAtUtc: new Date(now).toISOString(), fetchedAtUtc: null, freshnessMs: 0,
  positions: [], pendingOrders: [], unidentifiedRows: 0, closedTradeIds: [], accountBindingHash: null, reasonCodes: [], readOnly: true };
const out = await new XauPositionLockStore(process.argv[3]).acquireReservation({ proposalId: id, idempotencyKey: "k:" + id, evidence, nowMs: now });
process.stdout.write(JSON.stringify({ ok: out.ok }));
`,
    );
    const run = (id: string) =>
      new Promise<{ ok: boolean }>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", script, id, root], { cwd: process.cwd() });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += String(d)));
        child.stderr.on("data", (d) => (err += String(d)));
        child.on("close", (code) => {
          try {
            resolve(JSON.parse(out));
          } catch {
            reject(new Error(`child ${id} exit ${code}: ${err.slice(0, 400)}`));
          }
        });
      });
    const results = await Promise.all(["m1", "m2", "m3", "m4"].map(run));
    expect(results.filter((r) => r.ok).length).toBe(1);
  }, 60_000);

  it("restart restores a held lock from disk", async () => {
    await acquire(store, "p1");
    const restarted = new XauPositionLockStore(root);
    expect(restarted.get().state).toBe("RESERVED");
    expect(restarted.get().reservation?.proposalId).toBe("p1");
  });

  it("corrupt persisted lock is held fail-closed", async () => {
    fs.writeFileSync(store.file, "{not json");
    expect(new XauPositionLockStore(root).get().state).toBe("UNKNOWN_BROKER_STATE");
  });

  it("automated position: open → broker disconnect keeps lock → close confirmed twice → released", async () => {
    const a = await acquire(store, "p1");
    if (!a.ok) throw new Error("acquire failed");
    await store.recordSubmissionPending({ reservationId: a.reservationId, requestId: "req-1", nowMs: T0 });
    await store.recordSubmissionOutcome({ reservationId: a.reservationId, outcome: "ACKNOWLEDGED", brokerTradeId: "T1", nowMs: T0 });
    let rec = await store.reconcile(evidence({ trades: [xauTrade("T1")], tracked: ["T1"] }), { nowMs: T0 });
    expect(rec.state).toBe("POSITION_OPEN");
    expect(rec.lastEvidence?.positions[0].ownership).toBe("AUTOMATED");

    const other = await acquire(store, "p2");
    expect(other.ok).toBe(false);

    rec = await store.reconcile(evidence({ cap: "AVAILABLE_BUT_DISCONNECTED", nowMs: T0 + 1_000 }), { nowMs: T0 + 1_000 });
    expect(rec.state).toBe("UNKNOWN_BROKER_STATE");

    rec = await store.reconcile(evidence({ nowMs: T0 + 2_000 }), { nowMs: T0 + 2_000 });
    expect(rec.state).toBe("RECONCILIATION_PENDING");
    rec = await store.reconcile(evidence({ nowMs: T0 + 5_000 }), { nowMs: T0 + 5_000 });
    expect(rec.state).toBe("RECONCILIATION_PENDING");
    rec = await store.reconcile(evidence({ nowMs: T0 + 13_000 }), { nowMs: T0 + 13_000 });
    expect(rec.state).toBe("AVAILABLE");
    expect(rec.lastReleaseReason).toBe("BROKER_CONFIRMED_FLAT");
  });

  it("ClosedTrades containing the tracked trade releases on first flat observation", async () => {
    const a = await acquire(store, "p1");
    if (!a.ok) throw new Error("acquire failed");
    await store.recordSubmissionOutcome({ reservationId: a.reservationId, outcome: "ACKNOWLEDGED", brokerTradeId: "T9", nowMs: T0 });
    await store.reconcile(evidence({ trades: [xauTrade("T9")], tracked: ["T9"] }), { nowMs: T0 });
    const rec = await store.reconcile(evidence({ closed: [{ tradeId: "T9" }], nowMs: T0 + 1_000 }), { nowMs: T0 + 1_000 });
    expect(rec.state).toBe("AVAILABLE");
    expect(rec.lastReleaseReason).toBe("BROKER_CONFIRMED_CLOSED");
  });

  it("position gone but pending XAU order remains → stays locked", async () => {
    const a = await acquire(store, "p1");
    if (!a.ok) throw new Error("acquire failed");
    await store.recordSubmissionOutcome({ reservationId: a.reservationId, outcome: "ACKNOWLEDGED", brokerTradeId: "T1", nowMs: T0 });
    await store.reconcile(evidence({ trades: [xauTrade("T1")], tracked: ["T1"] }), { nowMs: T0 });
    const rec = await store.reconcile(
      evidence({ orders: [{ orderId: "o-stop", instrument: OFFER }], nowMs: T0 + 20_000 }),
      { nowMs: T0 + 20_000 },
    );
    expect(rec.state).not.toBe("AVAILABLE");
  });

  it("unknown submission outcome is never released by flat evidence", async () => {
    const a = await acquire(store, "p1");
    if (!a.ok) throw new Error("acquire failed");
    await store.recordSubmissionPending({ reservationId: a.reservationId, requestId: "req", nowMs: T0 });
    await store.recordSubmissionOutcome({ reservationId: a.reservationId, outcome: "UNKNOWN_OUTCOME", nowMs: T0 });
    for (const dt of [1_000, 20_000, 60_000]) {
      const rec = await store.reconcile(evidence({ nowMs: T0 + dt }), { nowMs: T0 + dt });
      expect(rec.state).not.toBe("AVAILABLE");
    }
  });

  it("external position closes → released only after broker confirmation", async () => {
    await acquire(store, "p1", evidence({ trades: [xauTrade("ext")] }));
    let rec = await store.reconcile(evidence({ nowMs: T0 + 1_000 }), { nowMs: T0 + 1_000 });
    expect(rec.state).toBe("RECONCILIATION_PENDING");
    rec = await store.reconcile(evidence({ nowMs: T0 + 12_000 }), { nowMs: T0 + 12_000 });
    expect(rec.state).toBe("AVAILABLE");
  });

  it("unsubmitted reservation releases only on broker-flat evidence", async () => {
    await acquire(store, "p1");
    const kept = await store.releaseUnsubmittedReservation({
      proposalId: "p1",
      reason: "PRECHECK_BLOCKED",
      evidence: evidence({ cap: "ERROR" }),
      nowMs: T0,
    });
    expect(kept.released).toBe(false);
    expect(store.get().state).toBe("RESERVED");
    const ok = await store.releaseUnsubmittedReservation({ proposalId: "p1", reason: "PRECHECK_BLOCKED", evidence: evidence(), nowMs: T0 });
    expect(ok.released).toBe(true);
    expect(store.get().state).toBe("AVAILABLE");
  });

  it("reservation TTL alone never releases (unknown broker state keeps lock)", async () => {
    await acquire(store, "p1");
    const late = T0 + 11 * 60_000;
    const rec = await store.reconcile(evidence({ cap: "ERROR", nowMs: late }), { nowMs: late });
    expect(rec.state).toBe("UNKNOWN_BROKER_STATE");
  });

  it("unexpired reservation stays on flat evidence; expired + broker flat releases", async () => {
    await acquire(store, "p1");
    let rec = await store.reconcile(evidence({ nowMs: T0 + 60_000 }), { nowMs: T0 + 60_000 });
    expect(rec.state).toBe("RESERVED");
    const late = T0 + 11 * 60_000;
    rec = await store.reconcile(evidence({ nowMs: late }), { nowMs: late });
    expect(rec.state).toBe("AVAILABLE");
    expect(rec.lastReleaseReason).toBe("RESERVATION_EXPIRED_BROKER_FLAT");
  });
});

describe("XAU lifecycle monitor (FIXTURE, read-only)", () => {
  function deps(trades: Row[], extra: Partial<Parameters<typeof runXauPositionMonitorTick>[0]> = {}) {
    return {
      store,
      fetchTrades: async () => tables({ trades, fetchedAtMs: extra.nowMs ?? T0 }).trades,
      fetchOrders: async () => tables({ fetchedAtMs: extra.nowMs ?? T0 }).orders,
      symbol: "XAU/USD",
      offerId: OFFER,
      accountBindingHash: null,
      nowMs: T0,
      ...extra,
    };
  }

  async function openAutomated(): Promise<void> {
    const a = await store.acquireReservation({ proposalId: "p1", idempotencyKey: "k", evidence: evidence(), maxRiskAccountCurrency: 125, nowMs: T0 });
    if (!a.ok) throw new Error("acquire failed");
    await store.recordSubmissionOutcome({ reservationId: a.reservationId, outcome: "ACKNOWLEDGED", brokerTradeId: "T1", nowMs: T0 });
  }

  it("tracks floating profit/loss updates", async () => {
    await openAutomated();
    let out = await runXauPositionMonitorTick(deps([xauTrade("T1", -40)]));
    expect(out.record.state).toBe("POSITION_OPEN");
    expect(out.record.lastEvidence?.positions[0].floatingPl).toBe(-40);
    out = await runXauPositionMonitorTick(deps([xauTrade("T1", 55)]));
    expect(out.record.lastEvidence?.positions[0].floatingPl).toBe(55);
    expect(out.alerts.some((a) => a.code === "RISK_LIMIT_EXCEEDED")).toBe(false);
  });

  it("25% breach: critical alert, entry freeze, lock kept; ack refused until reconciled", async () => {
    await openAutomated();
    const out = await runXauPositionMonitorTick(deps([xauTrade("T1", -130)]));
    expect(out.alerts.some((a) => a.code === "RISK_LIMIT_EXCEEDED" && a.severity === "CRITICAL")).toBe(true);
    expect(out.record.entryFreeze.active).toBe(true);
    expect(out.record.state).toBe("POSITION_OPEN");
    const ack = await store.acknowledgeRiskBreach({ operator: "test" });
    expect(ack.ok).toBe(false);
    const blocked = await store.acquireReservation({ proposalId: "p9", idempotencyKey: "k9", evidence: evidence(), nowMs: T0 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("RISK_BREACH_ENTRY_FREEZE");
  });

  it("Stop Loss / Take Profit hit (simulated): position disappears into ClosedTrades → released", async () => {
    await openAutomated();
    await runXauPositionMonitorTick(deps([xauTrade("T1", -100)]));
    const out = await runXauPositionMonitorTick({
      ...deps([], { nowMs: T0 + 1_000 }),
      fetchClosedTrades: async () => ({ ok: true, capabilityStatus: "AVAILABLE", code: "OK", trades: [{ tradeId: "T1" }] }),
    });
    expect(out.record.state).toBe("AVAILABLE");
  });

  it("unexpected disappearance without ClosedTrades needs confirmation; connection loss keeps lock", async () => {
    await openAutomated();
    await runXauPositionMonitorTick(deps([xauTrade("T1")]));
    let out = await runXauPositionMonitorTick(deps([], { nowMs: T0 + 1_000 }));
    expect(out.record.state).toBe("RECONCILIATION_PENDING");
    out = await runXauPositionMonitorTick({
      ...deps([], { nowMs: T0 + 2_000 }),
      fetchTrades: async () => {
        throw new Error("sidecar down");
      },
    });
    expect(out.record.state).toBe("UNKNOWN_BROKER_STATE");
    expect(out.evidence.status).toBe("UNKNOWN");
  });

  it("monitor uses only read functions (no mutation surface)", async () => {
    const d = deps([]);
    expect(Object.keys(d).filter((k) => typeof (d as Record<string, unknown>)[k] === "function").sort())
      .toEqual(["fetchOrders", "fetchTrades"]);
    const out = await runXauPositionMonitorTick(d);
    expect(out.placesOrders).toBe(false);
    expect(out.mutatesBroker).toBe(false);
  });
});

describe("Phase 2 ACCOUNT_BALANCE basis + single-position lock integration (FIXTURE)", () => {
  function intake(): AtResultIntakeRecord {
    return {
      resultId: "intake-x",
      analysisId: "analysis-x",
      decision: "BUY",
      canonicalDecision: "BUY",
      eligibleForOrderPreparation: true,
    } as AtResultIntakeRecord;
  }

  beforeEach(async () => {
    resetAtSystemMasterStoreForTests();
    resetAtPhase2PipelineStoreForTests();
    await getAtSystemMasterStore().forceSet((prev) => ({
      ...prev,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
    }));
  });

  afterEach(() => {
    resetAtSystemMasterStoreForTests();
    resetAtPhase2PipelineStoreForTests();
  });

  it("System Master registers the lifecycle monitor module", () => {
    expect(AT_SYSTEM_MASTER_OWNED_MODULES).toContain("position_lifecycle_monitor");
  });

  it("no allocation gate; lock blocked → POSITION_LOCK_BLOCKED terminal, no handoff", async () => {
    const validateHandoff = vi.fn(async () => ({ ok: true, handoff: { handoffId: "h" } }));
    const generateProposal = vi.fn(async () => ({ ok: true, proposal: { proposalId: "px", lifecycle: "PROPOSAL_READY" } }));
    const out = await runPhase2Downstream({
      record: intake(),
      analysisGeneration: getAtSystemMasterStore().get().analysisGeneration,
      store: getAtPhase2PipelineStore(root),
      service: {
        generateProposal,
        validateHandoff,
        runBrokerPrecheck: vi.fn(async () => ({ ok: true })),
        getProposalAllocationConfig: async () => ({ individualOrderAllocation: null }),
        riskBasis: "ACCOUNT_BALANCE",
        acquirePositionReservation: async () => ({ ok: false, code: "EXTERNAL_XAU_POSITION_PRESENT", message: "external" }),
      },
    });
    expect(generateProposal).toHaveBeenCalledWith({ autoLevels: true });
    expect(out.status).toBe("POSITION_LOCK_BLOCKED");
    expect(out.blockers).toEqual(["EXTERNAL_XAU_POSITION_PRESENT"]);
    expect(validateHandoff).not.toHaveBeenCalled();
    expect(out.placesOrders).toBe(false);
  });

  it("precheck blocked → unsubmitted reservation released", async () => {
    const release = vi.fn(async () => ({ released: true }));
    const out = await runPhase2Downstream({
      record: intake(),
      analysisGeneration: getAtSystemMasterStore().get().analysisGeneration,
      store: getAtPhase2PipelineStore(root),
      service: {
        generateProposal: async () => ({ ok: true, proposal: { proposalId: "py", lifecycle: "PROPOSAL_READY" } }),
        validateHandoff: async () => ({ ok: true, handoff: { handoffId: "h", lifecycle: "VALIDATED" } }),
        runBrokerPrecheck: async () => ({ ok: true, precheck: { precheckId: "c", outcome: "BLOCKED", blockers: ["RISK_SNAPSHOT_EXPIRED_BALANCE_CHANGED"] } }),
        riskBasis: "ACCOUNT_BALANCE",
        acquirePositionReservation: async () => ({ ok: true, reservationId: "r" }),
        releaseUnsubmittedReservation: release,
      },
    });
    expect(out.status).toBe("PRECHECK_BLOCKED");
    expect(release).toHaveBeenCalledWith({ proposalId: "py", reason: "PRECHECK_BLOCKED" });
  });
});
