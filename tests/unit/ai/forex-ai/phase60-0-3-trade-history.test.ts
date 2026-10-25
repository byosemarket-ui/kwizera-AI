/**
 * Phase 60.0.3 — durable trade history, mark enrichment, Summary NetPL contracts.
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
  enrichOpenTradesWithMarks,
  findMatchingOfferQuote,
  ingestBrokerTradeSnapshots,
  resolveTradeSide,
  selectMarkSide,
  TRADE_HISTORY_SCHEMA_VERSION,
  resetAtTradeHistoryStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/trade-history/index.ts";
import type { ForexConnectLiveQuote } from "../../../../ai/market-data/forexconnect/live-types.ts";
import {
  parseBrokerRoTables,
  parseTradeHistory,
} from "../../../../desktop/forex/trade-monitor/parse-broker-tables.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function quote(partial: Partial<ForexConnectLiveQuote> & { providerSymbol: string }): ForexConnectLiveQuote {
  const now = Date.now();
  return {
    provider: "FOREXCONNECT",
    canonicalSymbol: partial.canonicalSymbol ?? partial.providerSymbol.replace(/\W/g, "").toUpperCase(),
    displaySymbol: partial.displaySymbol ?? partial.providerSymbol,
    bid: partial.bid ?? 1.1,
    ask: partial.ask ?? 1.1002,
    mid: partial.mid ?? null,
    candlePrice: partial.candlePrice ?? partial.bid ?? 1.1,
    priceBasis: "bid",
    sourceTimestampMs: partial.sourceTimestampMs ?? now,
    receivedAtMs: partial.receivedAtMs ?? now,
    offerId: partial.offerId ?? "42",
    providerSymbol: partial.providerSymbol,
    eventSource: partial.eventSource ?? "offers-callback",
  };
}

describe("Phase 60.0.3 trade-history store idempotency", () => {
  let dir: string;
  let store: AtTradeHistoryStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-th-"));
    resetAtTradeHistoryStoreForTests();
    store = new AtTradeHistoryStore(dir);
  });

  afterEach(() => {
    resetAtTradeHistoryStoreForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("duplicate open snapshots do not create duplicate rows", async () => {
    const ingest = await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "T100",
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2650,
          floatingPl: 10,
        }],
      },
      closedTrades: { closedTrades: [] },
      observedAtUtc: "2026-10-25T10:00:00.000Z",
    });
    expect(ingest.openUpserted).toBe(1);
    const again = await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "T100",
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2650,
          floatingPl: 12,
        }],
      },
      closedTrades: { closedTrades: [] },
      observedAtUtc: "2026-10-25T10:01:00.000Z",
    });
    expect(again.openUpserted).toBe(1);
    expect(store.snapshot().records).toHaveLength(1);
    expect(store.snapshot().records[0]?.grossPl).toBe(12);
    expect(store.snapshot().records[0]?.lifecycleStatus).toBe("OPEN");
  });

  it("closed trade remains after disappearing from open Trades", async () => {
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "T200",
          accountIdMasked: "****1234",
          instrument: "EUR/USD",
          side: "SELL",
          amount: 10,
          openRate: 1.08,
        }],
      },
      observedAtUtc: "2026-10-25T11:00:00.000Z",
    });
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: { trades: [] },
      closedTrades: {
        closedTrades: [{
          tradeId: "T200",
          accountIdMasked: "****1234",
          instrument: "EUR/USD",
          side: "SELL",
          amount: 10,
          openRate: 1.08,
          closeRate: 1.075,
          grossPl: 50,
          commission: -1,
          rolloverInterest: 0,
          closeTime: "2026-10-25T12:00:00.000Z",
        }],
      },
      observedAtUtc: "2026-10-25T12:00:00.000Z",
    });
    // Open table empty again — must NOT erase closed evidence.
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: { trades: [] },
      closedTrades: { closedTrades: [] },
      observedAtUtc: "2026-10-25T13:00:00.000Z",
    });
    const row = store.snapshot().records.find((r) => r.tradeId === "T200");
    expect(row?.lifecycleStatus).toBe("CLOSED");
    expect(row?.closeRate).toBe(1.075);
    expect(row?.grossPl).toBe(50);
    expect(store.snapshot().records).toHaveLength(1);
  });

  it("reconnects / replayed closed events do not corrupt lifecycle", async () => {
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      closedTrades: {
        closedTrades: [{
          tradeId: "T300",
          accountIdMasked: "****9999",
          instrument: "GBP/USD",
          side: "BUY",
          amount: 5,
          openRate: 1.25,
          closeRate: 1.26,
          grossPl: 20,
          commission: -0.5,
          rolloverInterest: -0.1,
          closeTime: "2026-10-25T09:00:00.000Z",
        }],
      },
      observedAtUtc: "2026-10-25T09:05:00.000Z",
    });
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      closedTrades: {
        closedTrades: [{
          tradeId: "T300",
          accountIdMasked: "****9999",
          instrument: "GBP/USD",
          side: "BUY",
          amount: 5,
          openRate: 1.25,
          closeRate: 1.26,
          grossPl: 20,
          commission: -0.5,
          rolloverInterest: -0.1,
          closeTime: "2026-10-25T09:00:00.000Z",
        }],
      },
      observedAtUtc: "2026-10-25T09:10:00.000Z",
    });
    // Replay open for same id must not reopen a CLOSED record.
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "T300",
          accountIdMasked: "****9999",
          instrument: "GBP/USD",
          side: "BUY",
          amount: 5,
          openRate: 1.25,
        }],
      },
      observedAtUtc: "2026-10-25T09:15:00.000Z",
    });
    expect(store.snapshot().records).toHaveLength(1);
    expect(store.snapshot().records[0]?.lifecycleStatus).toBe("CLOSED");
  });

  it("missing tradeId fails safely without creating a row", async () => {
    const r = await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: null,
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
        }],
      },
    });
    expect(r.skippedMissingId).toBe(1);
    expect(store.snapshot().records).toHaveLength(0);
    expect(buildTradeHistoryRecordKey({
      environment: "DEMO",
      accountIdMasked: "****1",
      tradeId: "",
    })).toBeNull();
  });

  it("date filters and pagination are deterministic", async () => {
    for (let i = 0; i < 5; i += 1) {
      await ingestBrokerTradeSnapshots({
        environment: "DEMO",
        store,
        closedTrades: {
          closedTrades: [{
            tradeId: `T${i}`,
            accountIdMasked: "****1234",
            instrument: i % 2 === 0 ? "XAU/USD" : "EUR/USD",
            side: i % 2 === 0 ? "BUY" : "SELL",
            amount: 1,
            openRate: 1,
            closeRate: 2,
            grossPl: i,
            commission: 0,
            rolloverInterest: 0,
            closeTime: `2026-10-2${i}T12:00:00.000Z`,
          }],
        },
        observedAtUtc: `2026-10-2${i}T12:00:00.000Z`,
      });
    }
    const page1 = store.query({ limit: 2, offset: 0, status: "CLOSED" });
    const page2 = store.query({ limit: 2, offset: 2, status: "CLOSED" });
    expect(page1.records).toHaveLength(2);
    expect(page2.records).toHaveLength(2);
    expect(page1.records[0]?.recordKey).not.toBe(page2.records[0]?.recordKey);
    // Deterministic re-query.
    expect(store.query({ limit: 2, offset: 0, status: "CLOSED" }).records.map((r) => r.recordKey))
      .toEqual(page1.records.map((r) => r.recordKey));
    const xau = store.query({ instrument: "XAUUSD", status: "CLOSED" });
    expect(xau.records.every((r) => (r.instrument ?? "").includes("XAU"))).toBe(true);
    const buy = store.query({ direction: "BUY", status: "CLOSED" });
    expect(buy.records.every((r) => resolveTradeSide(r.side) === "BUY")).toBe(true);
  });

  it("account scope filter isolates masked accounts", async () => {
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      closedTrades: {
        closedTrades: [
          {
            tradeId: "A1",
            accountIdMasked: "****1111",
            instrument: "EUR/USD",
            side: "BUY",
            amount: 1,
            closeRate: 1.1,
            grossPl: 1,
            commission: 0,
            rolloverInterest: 0,
            closeTime: "2026-10-25T10:00:00.000Z",
          },
          {
            tradeId: "A2",
            accountIdMasked: "****2222",
            instrument: "EUR/USD",
            side: "BUY",
            amount: 1,
            closeRate: 1.1,
            grossPl: 2,
            commission: 0,
            rolloverInterest: 0,
            closeTime: "2026-10-25T11:00:00.000Z",
          },
        ],
      },
    });
    const all = store.query({ limit: 50 });
    expect(all.total).toBe(2);
    const scoped = all.records.filter((r) => r.accountIdMasked === "****1111");
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.tradeId).toBe("A1");
  });

  it("partial-close amount update keeps same tradeId key; new tradeId is a new row", async () => {
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "P1",
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 2,
          openRate: 2650,
        }],
      },
      observedAtUtc: "2026-10-25T08:00:00.000Z",
    });
    // Partial close: remainder keeps trade id with reduced amount; closed slice may share id.
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "P1",
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2650,
        }],
      },
      closedTrades: {
        closedTrades: [{
          tradeId: "P1",
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2650,
          closeRate: 2660,
          grossPl: 10,
          commission: 0,
          rolloverInterest: 0,
          closeTime: "2026-10-25T08:30:00.000Z",
        }],
      },
      observedAtUtc: "2026-10-25T08:30:00.000Z",
    });
    // With shared tradeId, CLOSED evidence wins (FXCM day closed row for that id).
    expect(store.snapshot().records).toHaveLength(1);
    expect(store.snapshot().records[0]?.lifecycleStatus).toBe("CLOSED");
    // Broker-specific new remainder trade id.
    await ingestBrokerTradeSnapshots({
      environment: "DEMO",
      store,
      openTrades: {
        trades: [{
          tradeId: "P1-REM",
          accountIdMasked: "****1234",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2650,
        }],
      },
      observedAtUtc: "2026-10-25T08:31:00.000Z",
    });
    expect(store.snapshot().records).toHaveLength(2);
    expect(store.getByKey(buildTradeHistoryRecordKey({
      environment: "DEMO",
      accountIdMasked: "****1234",
      tradeId: "P1-REM",
    })!)?.lifecycleStatus).toBe("OPEN");
  });
});

describe("Phase 60.0.3 mark enrichment", () => {
  it("maps offer by offerId and selects BUY→bid / SELL→ask", () => {
    const quotes = [
      quote({ providerSymbol: "XAU/USD", offerId: "7", bid: 2650.1, ask: 2650.4 }),
      quote({ providerSymbol: "EUR/USD", offerId: "1", bid: 1.08, ask: 1.0802 }),
    ];
    expect(selectMarkSide("BUY")).toBe("bid");
    expect(selectMarkSide("SELL")).toBe("ask");
    const matched = findMatchingOfferQuote(quotes, { offerId: "7", instrument: "XAU/USD" });
    expect(matched?.offerId).toBe("7");
    const buy = enrichOpenTradeMark(
      { tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "BUY", floatingPl: 5 },
      quotes,
      { nowMs: Date.now() },
    );
    expect(buy.markPrice).toBe(2650.1);
    expect(buy.markPriceSide).toBe("bid");
    expect(buy.markQuoteFreshness).toBe("QUOTE_RECEIVED");
    expect(buy.floatingPlProvenance).toBe("broker-trades-gross_pl");
    const sell = enrichOpenTradeMark(
      { tradeId: "2", offerId: "7", instrument: "XAU/USD", side: "SELL", floatingPl: -3 },
      quotes,
      { nowMs: Date.now() },
    );
    expect(sell.markPrice).toBe(2650.4);
    expect(sell.markPriceSide).toBe("ask");
  });

  it("rejects stale, crossed, missing, future-dated, and mismatched quotes as live", () => {
    const now = Date.now();
    const stale = enrichOpenTradeMark(
      { tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "BUY" },
      [quote({
        providerSymbol: "XAU/USD",
        offerId: "7",
        bid: 1,
        ask: 1.1,
        sourceTimestampMs: now - 60_000,
        receivedAtMs: now - 60_000,
      })],
      { nowMs: now, staleMs: 15_000 },
    );
    expect(stale.markQuoteFreshness).toBe("QUOTE_STALE");
    expect(stale.markPrice).toBeNull();

    const crossed = enrichOpenTradeMark(
      { tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "BUY" },
      [quote({ providerSymbol: "XAU/USD", offerId: "7", bid: 2, ask: 1 })],
      { nowMs: now },
    );
    expect(crossed.markQuoteFreshness).toBe("QUOTE_INVALID");
    expect(crossed.markPrice).toBeNull();

    const missing = enrichOpenTradeMark(
      { tradeId: "1", instrument: "XAU/USD", side: "BUY" },
      [],
      { nowMs: now },
    );
    expect(missing.markQuoteFreshness).toBe("QUOTE_NOT_RECEIVED");

    const future = enrichOpenTradeMark(
      { tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "BUY" },
      [quote({
        providerSymbol: "XAU/USD",
        offerId: "7",
        sourceTimestampMs: now + 60_000,
        receivedAtMs: now + 60_000,
      })],
      { nowMs: now },
    );
    expect(future.markQuoteFreshness).toBe("QUOTE_INVALID");

    const mismatch = enrichOpenTradeMark(
      { tradeId: "1", offerId: "99", instrument: "EUR/USD", side: "BUY" },
      [quote({ providerSymbol: "XAU/USD", offerId: "7", bid: 2650, ask: 2651 })],
      { nowMs: now },
    );
    // No matching offerId/symbol → not received (not live).
    expect(["QUOTE_NOT_RECEIVED", "INSTRUMENT_MISMATCH"]).toContain(mismatch.markQuoteFreshness);
    expect(mismatch.markPrice).toBeNull();

    const unknownSide = enrichOpenTradeMark(
      { tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "FLAT" },
      [quote({ providerSymbol: "XAU/USD", offerId: "7" })],
      { nowMs: now },
    );
    expect(unknownSide.markQuoteFreshness).toBe("SIDE_UNKNOWN");
  });

  it("does not invent local floating P/L and keeps broker provenance", () => {
    const rows = enrichOpenTradesWithMarks(
      [{ tradeId: "1", offerId: "7", instrument: "XAU/USD", side: "BUY", floatingPl: 9.5 }],
      [quote({ providerSymbol: "XAU/USD", offerId: "7", bid: 10, ask: 11 })],
    );
    expect(rows[0]?.floatingPl).toBe(9.5);
    expect(rows[0]?.floatingPlProvenance).toBe("broker-trades-gross_pl");
    expect(rows[0]?.locallyCalculatedFloatingPl).toBeNull();
    const noPl = enrichOpenTradesWithMarks(
      [{ tradeId: "2", offerId: "7", instrument: "XAU/USD", side: "BUY" }],
      [quote({ providerSymbol: "XAU/USD", offerId: "7", bid: 10, ask: 11 })],
    );
    expect(noPl[0]?.floatingPl).toBeNull();
    expect(noPl[0]?.floatingPlProvenance).toBe("unavailable");
  });
});

describe("Phase 60.0.3 UI parse + contracts", () => {
  it("parses mark freshness and history coverage without inventing win rate", () => {
    const parsed = parseBrokerRoTables({
      ok: true,
      historyAvailableFromUtc: "2026-10-25T08:00:00.000Z",
      accounts: { ok: true, accounts: [] },
      openPositions: {
        ok: true,
        count: 1,
        trades: [{
          tradeId: "T1",
          instrument: "XAU/USD",
          side: "BUY",
          markPrice: 2651,
          markPriceSide: "bid",
          markPriceSource: "forexconnect-offers.bid",
          markQuoteFreshness: "QUOTE_RECEIVED",
          floatingPl: 4,
          floatingPlProvenance: "broker-trades-gross_pl",
        }],
      },
      openWorkingOrders: { ok: true, count: 0, orders: [] },
      closedTrades: { ok: true, capabilityStatus: "AVAILABLE", count: 0, closedTrades: [] },
      instrumentSummaries: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        count: 1,
        summaries: [{
          instrument: "XAU/USD",
          netPl: 12,
          metricScope: "INSTRUMENT_SUMMARY",
          source: "forexconnect-summary",
        }],
      },
    });
    expect(parsed!.openPositions.trades[0]?.currentPrice).toBe(2651);
    expect(parsed!.openPositions.trades[0]?.markQuoteFreshness).toBe("QUOTE_RECEIVED");
    expect(parsed!.instrumentSummaries?.summaries[0]?.metricScope).toBe("INSTRUMENT_SUMMARY");
    expect(parsed!.historyAvailableFromUtc).toBe("2026-10-25T08:00:00.000Z");

    const staleParsed = parseBrokerRoTables({
      ok: true,
      accounts: { ok: true, accounts: [] },
      openPositions: {
        ok: true,
        trades: [{
          tradeId: "T2",
          side: "BUY",
          markPrice: 1.2,
          markQuoteFreshness: "QUOTE_STALE",
          currentPrice: 1.2,
        }],
      },
      openWorkingOrders: { ok: true, orders: [] },
      closedTrades: { ok: false, capabilityStatus: "UNSUPPORTED", closedTrades: [] },
    });
    // Stale marks must not surface as current live price.
    expect(staleParsed!.openPositions.trades[0]?.currentPrice).toBeNull();

    const hist = parseTradeHistory({
      ok: true,
      historyAvailableFromUtc: "2026-10-25T08:00:00.000Z",
      coverageNote: "partial",
      total: 1,
      limit: 25,
      offset: 0,
      records: [{
        recordKey: "DEMO|****1|T1",
        tradeId: "T1",
        lifecycleStatus: "CLOSED",
        grossPl: 3,
        observedAtUtc: "2026-10-25T08:00:00.000Z",
        source: "forexconnect-closed-trades",
      }],
    });
    expect(hist?.records[0]?.lifecycleStatus).toBe("CLOSED");
    expect(hist?.coverageNote).toBe("partial");
  });

  it("wires RO API, Summary, history endpoint, and forbids mutation helpers", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/trade-history");
    expect(api).toContain("enrichOpenTradesWithMarks");
    expect(api).toContain("ingestBrokerTradeSnapshots");
    expect(api).toContain("listSummary");
    expect(api).toMatch(/phase:\s*"60\.0\.[3456]"/);
    expect(api).toContain("INSTRUMENT_SUMMARY");
    // Phase 60.0.3+ RO routes must not call mutation helpers (demo-lifecycle may still mention grants elsewhere).
    const roSection = api.slice(
      api.indexOf("broker-ro-tables"),
      api.indexOf("/api/forex/automated-trading/status"),
    );
    expect(roSection).not.toMatch(/openTrueMarket|closeTrueMarket|createGrant|ALLOW_DEMO_MUTATION/);
    expect(roSection).toContain("pollQuotes");

    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("def summary_payload");
    expect(sidecar).toContain('path == "/summary"');
    expect(sidecar).toContain("INSTRUMENT_SUMMARY");
    expect(sidecar).toContain("NetPL");

    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("listSummary");
    expect(client).toContain("/summary");

    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain("trade-history");
    expect(page).toContain("historyAvailableFrom");
    expect(page).toContain("QUOTE_RECEIVED");
    expect(page).toMatch(/Partial history|partial if incomplete|history coverage/i);
    expect(page).toContain("forexconnect-summary");
    expect(page).toContain("metricScope");
    expect(page).not.toMatch(/openTrueMarket|createGrant|ALLOW_DEMO_MUTATION/);

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("getDisabledBrokerMutationAdapter");

    expect(TRADE_HISTORY_SCHEMA_VERSION).toBe("60.0.3");
  });
});
