/**
 * Phase 60.0.5 — Trade Monitor final integration / regression / readiness.
 * Read-only: never asserts broker mutation helpers.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AtTradeHistoryStore,
  buildTradeHistoryRecordKey,
  enrichOpenTradeMark,
  ingestBrokerTradeSnapshots,
  isCurrentRequest,
  mergeClosedSourcesWithoutDoubleCount,
  nextRequestId,
  reconcileTradeMonitorSources,
  resetAtTradeHistoryStoreForTests,
  safeFiniteNumber,
  selectMarkSide,
} from "../../../../ai/forex-ai/automated-trading/trade-history/index.ts";
import {
  computeRealizedPl,
  computeWinRate,
  buildPerformanceSummary,
} from "../../../../ai/forex-ai/automated-trading/trade-history/performance.ts";
import { parseBrokerRoTables } from "../../../../desktop/forex/trade-monitor/parse-broker-tables.ts";
import {
  formatOptionalNumber,
  formatSignedPl,
  resolveQuoteFreshnessLabel,
} from "../../../../desktop/forex/trade-monitor/format.ts";
import {
  forexPathFor,
  parseForexRouteFromLocation,
} from "../../../../desktop/forex/forex-routes.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/** Local net helper used only if export missing — assert components never invent zeros. */
function realizedNetRequiresAllComponents(
  row: { grossPl?: number | null; commission?: number | null; rolloverInterest?: number | null; netPl?: number | null },
): number | null {
  if (row.netPl != null && Number.isFinite(row.netPl)) return row.netPl;
  const g = safeFiniteNumber(row.grossPl);
  const c = safeFiniteNumber(row.commission);
  const r = safeFiniteNumber(row.rolloverInterest);
  if (g == null || c == null || r == null) return null;
  return g + c + r;
}

describe("Phase 60.0.5 safe number + request races", () => {
  it("never coerces null/empty to zero", () => {
    expect(safeFiniteNumber(null)).toBeNull();
    expect(safeFiniteNumber(undefined)).toBeNull();
    expect(safeFiniteNumber("")).toBeNull();
    expect(safeFiniteNumber("  ")).toBeNull();
    expect(safeFiniteNumber(0)).toBe(0);
    expect(safeFiniteNumber("12.5")).toBe(12.5);
  });

  it("gates stale responses by request id", () => {
    let active = 0;
    active = nextRequestId(active);
    expect(active).toBe(1);
    const stale = 1;
    active = nextRequestId(active);
    expect(isCurrentRequest(active, stale)).toBe(false);
    expect(isCurrentRequest(active, 2)).toBe(true);
  });
});

describe("Phase 60.0.5 identity / environment isolation", () => {
  let dir: string;
  let store: AtTradeHistoryStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-th5-"));
    resetAtTradeHistoryStoreForTests();
    store = new AtTradeHistoryStore(dir);
  });

  afterEach(() => {
    resetAtTradeHistoryStoreForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not merge same tradeId across environments or accounts", async () => {
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "T1",
          accountIdMasked: "****1111",
          instrument: "EUR/USD",
          side: "BUY",
          amount: null,
          openRate: 1.1,
        }],
      },
    });
    await ingestBrokerTradeSnapshots({
      environment: "LIVE",
      store,
      openTrades: {
        trades: [{
          tradeId: "T1",
          accountIdMasked: "****1111",
          instrument: "EUR/USD",
          side: "BUY",
          amount: 1,
          openRate: 1.1,
        }],
      },
    });
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "T1",
          accountIdMasked: "****2222",
          instrument: "EUR/USD",
          side: "BUY",
          amount: 2,
          openRate: 1.1,
        }],
      },
    });
    expect(store.snapshot().records).toHaveLength(3);
    const demoA = buildTradeHistoryRecordKey({
      environment: "DEMO",
      accountIdMasked: "****1111",
      tradeId: "T1",
    });
    expect(store.getByKey(demoA!)?.amount).toBeNull(); // null amount not invented as 0
    expect(store.query({ environment: "DEMO", accountIdMasked: "****1111" }).total).toBe(1);
    expect(store.query({ environment: "LIVE" }).total).toBe(1);
  });

  it("keeps OPEN/CLOSED/ORDERS separation and does not infer closure", () => {
    const snap = reconcileTradeMonitorSources({
      openTrades: [{ tradeId: "A" }],
      closedDayTrades: [{ tradeId: "B" }],
      historyRecords: [
        { tradeId: "A", lifecycleStatus: "OPEN" },
        { tradeId: "C", lifecycleStatus: "OPEN" },
      ],
      activeOrders: [{ orderId: "O1" }],
      instrumentSummaries: [],
    });
    expect(snap.openTradeCount).toBe(1);
    expect(snap.activeOrderCount).toBe(1);
    expect(snap.historyOpenMissingFromBroker).toContain("C");
    expect(snap.findings.some((f) => f.message.includes("not inferred"))).toBe(true);
  });

  it("parse layer does not invent zero P/L from null fields", () => {
    const parsed = parseBrokerRoTables({
      ok: true,
      accounts: { ok: true, accounts: [] },
      openPositions: {
        ok: true,
        trades: [{
          tradeId: "T",
          side: "BUY",
          amount: null,
          floatingPl: null,
          grossPl: null,
          markQuoteFreshness: "QUOTE_NOT_RECEIVED",
        }],
      },
      openWorkingOrders: { ok: true, orders: [{ orderId: "O1" }] },
      closedTrades: { ok: true, capabilityStatus: "AVAILABLE", closedTrades: [] },
    });
    expect(parsed!.openPositions.trades[0]?.floatingPl).toBeNull();
    expect(parsed!.openPositions.trades[0]?.amount).toBeNull();
    expect(parsed!.openWorkingOrders.orders).toHaveLength(1);
    expect(parsed!.closedTrades.closedTrades).toEqual([]);
    // Empty closed array ≠ complete history signal in UI contract note (API).
    expect(formatSignedPl(null).tone).toBe("unknown");
    expect(formatOptionalNumber(null)).toBe("Unavailable");
  });
});

describe("Phase 60.0.5 financial + quote integrity", () => {
  it("realized net requires all components; missing commission is not zero", () => {
    expect(realizedNetRequiresAllComponents({
      grossPl: 10,
      commission: null,
      rolloverInterest: -1,
    })).toBeNull();
    const net = computeRealizedPl(
      [{
        lifecycleStatus: "CLOSED",
        closeTime: "2026-10-25T12:00:00.000Z",
        grossPl: 10,
        commission: null,
        rolloverInterest: 0,
      }],
      { currency: "USD", basis: "net", partialCoverage: true },
    );
    expect(net.value).toBeNull();
    expect(net.availability).toBe("UNAVAILABLE");
  });

  it("win rate excludes break-even; invalid equity blocks percent", () => {
    const { winRate, zeroResultCount } = computeWinRate(
      [
        { lifecycleStatus: "CLOSED", grossPl: 1, closeTime: "2026-10-25T10:00:00.000Z" },
        { lifecycleStatus: "CLOSED", grossPl: 0, closeTime: "2026-10-25T11:00:00.000Z" },
        { lifecycleStatus: "CLOSED", grossPl: -1, closeTime: "2026-10-25T12:00:00.000Z" },
      ],
      { partialCoverage: true, currency: "USD" },
    );
    expect(winRate.value).toBe(0.5);
    expect(zeroResultCount.value).toBe(1);
    const summary = buildPerformanceSummary({
      openTrades: [],
      activeOrderCount: 0,
      closedTrades: [
        { lifecycleStatus: "CLOSED", grossPl: 50, closeTime: "2026-10-25T12:00:00.000Z" },
      ],
      period: {
        fromUtc: "2026-10-25T00:00:00.000Z",
        toUtc: "2026-10-25T23:59:59.000Z",
        historyAvailableFromUtc: "2026-10-25T08:00:00.000Z",
        accountCurrency: "USD",
        equity: 0,
        equityIncludesFloatingPl: true,
      },
    });
    expect(summary.plPercentOfEquity.value).toBeNull();
    expect(summary.combinedLabeledPl.definition).toMatch(/Not equity/i);
  });

  it("BUY→bid SELL→ask; stale quotes never live; no fabricated floating", () => {
    expect(selectMarkSide("BUY")).toBe("bid");
    expect(selectMarkSide("SELL")).toBe("ask");
    const now = Date.now();
    const stale = enrichOpenTradeMark(
      { tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "BUY", floatingPl: null },
      [{
        provider: "FOREXCONNECT",
        providerSymbol: "XAU/USD",
        canonicalSymbol: "XAUUSD",
        displaySymbol: "XAU/USD",
        bid: 2650,
        ask: 2651,
        mid: null,
        candlePrice: 2650,
        priceBasis: "bid",
        offerId: "7",
        sourceTimestampMs: now - 60_000,
        receivedAtMs: now - 60_000,
      }],
      { nowMs: now, staleMs: 15_000 },
    );
    expect(stale.markQuoteFreshness).toBe("QUOTE_STALE");
    expect(stale.markPrice).toBeNull();
    expect(stale.floatingPl).toBeNull();
    expect(stale.floatingPlProvenance).toBe("unavailable");
    expect(resolveQuoteFreshnessLabel({
      sessionStatus: "CONNECTED",
      streamState: "LIVE",
      lastQuoteAt: null,
      updateCount: 0,
    })).toBe("QUOTE_NOT_RECEIVED");
  });

  it("duplicate closed sources do not double-count", () => {
    const merged = mergeClosedSourcesWithoutDoubleCount({
      persistedClosed: [{ tradeId: "T", recordKey: "k", grossPl: 10 }],
      dayClosed: [{ tradeId: "T", grossPl: 10 }],
    });
    expect(merged).toHaveLength(1);
  });
});

describe("Phase 60.0.5 routes, auth, safety contracts", () => {
  it("registers Trade Monitor routes separately from Automated Trading", () => {
    expect(forexPathFor("trade-monitor")).toBe("/forex/trade-monitor");
    expect(parseForexRouteFromLocation("/forex/positions")).toBe("trade-monitor");
    expect(parseForexRouteFromLocation("/forex/automated-trading")).toBe("automated-trading");
  });

  it("API remains admin-gated RO without mutation on Trade Monitor paths", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("requireForexAdmin");
    expect(api).toContain("/api/forex/automated-trading/trade-history");
    expect(api).toContain("/api/forex/automated-trading/trade-performance");
    expect(api).toContain("INVALID_ACCOUNT_SCOPE");
    expect(api).toContain("emptyClosedIsNotCompleteHistory");
    expect(api).toMatch(/phase:\s*"60\.0\.[56]"/);
    const ro = api.slice(
      api.indexOf("broker-ro-tables"),
      api.indexOf("/api/forex/automated-trading/status"),
    );
    expect(ro).not.toMatch(/openTrueMarket|closeTrueMarket|createGrant|ALLOW_DEMO_MUTATION/);
    expect(ro).toContain("placesOrders: false");
    expect(ro).toContain("pollQuotes");
    expect(ro).not.toMatch(/subscribeOffers|new ForexConnect/);

    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toMatch(/data-phase="60\.0\.[56]"/);
    expect(page).toContain("AbortController");
    expect(page).toContain('data-places-orders="false"');
    expect(page).not.toMatch(/openTrueMarket|createGrant/);

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("getDisabledBrokerMutationAdapter");

    const auth = read("dev/server/forex-admin-auth.ts");
    expect(auth).toContain("assertAdminAccess");
    expect(auth).toContain("placesOrders: false");
  });
});
