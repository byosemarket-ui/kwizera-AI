/**
 * Phase 60.0.1 / 60.0.2 — Trade Monitor contracts (no broker mutation).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FOREX_NAV,
  forexPathFor,
  parseForexRouteFromLocation,
  resolveForexLocation,
} from "../../../desktop/forex/forex-routes.ts";
import {
  formatOptionalNumber,
  formatSignedPl,
  formatSide,
  resolveQuoteFreshnessLabel,
} from "../../../desktop/forex/trade-monitor/format.ts";
import {
  parseBrokerRoTables,
  sumVerifiedClosedGrossPl,
  sumVerifiedFloatingPl,
} from "../../../desktop/forex/trade-monitor/parse-broker-tables.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 60 Trade Monitor routing and navigation", () => {
  it("registers Trade Monitor beside Automated Trading", () => {
    expect(forexPathFor("trade-monitor")).toBe("/forex/trade-monitor");
    expect(parseForexRouteFromLocation("/forex/trade-monitor")).toBe("trade-monitor");
    expect(parseForexRouteFromLocation("/forex/positions")).toBe("trade-monitor");
    expect(resolveForexLocation("/forex/trade-monitor").view).toBe("trade-monitor");
    const item = FOREX_NAV.find((n) => n.id === "trade-monitor");
    expect(item?.implemented).toBe(true);
    expect(item?.group).toBe("trading");
    const atIdx = FOREX_NAV.findIndex((n) => n.id === "automated-trading");
    const tmIdx = FOREX_NAV.findIndex((n) => n.id === "trade-monitor");
    expect(tmIdx).toBeGreaterThan(atIdx);
  });

  it("wires shell and page without mutation helpers", () => {
    const shell = read("desktop/forex/ForexShell.tsx");
    expect(shell).toContain("ForexTradeMonitorPage");
    expect(shell).toContain("ForexAutomatedTradingPage");
    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain('data-forex-page="trade-monitor"');
    expect(page).toContain('data-places-orders="false"');
    expect(page).toContain("/api/forex/automated-trading/broker-ro-tables");
    expect(page).not.toMatch(/openTrueMarket|openMarket|createGrant|ALLOW_DEMO_MUTATION/);
  });
});

describe("Phase 60.0.2 closed trades + P/L parsing", () => {
  it("maps open-trade gross_pl and closed-trade day history without inventing values", () => {
    const parsed = parseBrokerRoTables({
      ok: true,
      accounts: {
        ok: true,
        accounts: [{
          accountIdMasked: "****1234",
          accountCurrency: "USD",
          equity: 10_500,
          balance: 10_000,
          usedMargin: 200,
          usableMargin: 10_300,
          dayPl: 12.5,
          grossPl: null,
          equityIncludesFloatingPl: true,
        }],
      },
      openPositions: {
        ok: true,
        count: 1,
        trades: [{
          tradeId: "T-1",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2650,
          currentPrice: 2655,
          floatingPl: 50,
          floatingPlSource: "forexconnect-trades.gross_pl",
          grossPl: 50,
        }],
      },
      openWorkingOrders: {
        ok: true,
        count: 1,
        orders: [{
          orderId: "O-9",
          instrument: "XAU/USD",
          side: "SELL",
          amount: 1,
          rate: 2660,
          status: "Waiting",
        }],
      },
      closedTrades: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        historyScope: "CURRENT_TRADING_DAY",
        count: 1,
        closedTrades: [{
          tradeId: "C-1",
          instrument: "XAU/USD",
          side: "BUY",
          amount: 1,
          openRate: 2640,
          closeRate: 2650,
          grossPl: 100,
          commission: -2,
          rolloverInterest: -1,
          closeTime: "2026-10-25T12:00:00.000Z",
          source: "forexconnect-closed-trades",
        }],
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.openPositions.trades[0]?.floatingPl).toBe(50);
    expect(parsed!.openPositions.trades[0]?.currentPrice).toBe(2655);
    expect(parsed!.openWorkingOrders.orders[0]?.orderId).toBe("O-9");
    expect(parsed!.closedTrades.capabilityStatus).toBe("AVAILABLE");
    expect(parsed!.closedTrades.closedTrades[0]?.tradeId).toBe("C-1");
    expect(parsed!.closedTrades.closedTrades[0]?.netPl).toBe(97);
    expect(parsed!.closedTrades.closedTrades[0]?.historyScope).toBe("CURRENT_TRADING_DAY");
    expect(parsed!.accounts.accounts[0]?.dayPl).toBe(12.5);
    expect(sumVerifiedFloatingPl(parsed!.openPositions.trades)).toBe(50);
    expect(sumVerifiedClosedGrossPl(parsed!.closedTrades.closedTrades)).toBe(100);
  });

  it("keeps closed trades unavailable without inventing rows", () => {
    const parsed = parseBrokerRoTables({
      ok: true,
      accounts: { ok: true, accounts: [] },
      openPositions: { ok: true, count: 0, trades: [] },
      openWorkingOrders: { ok: true, count: 0, orders: [] },
      closedTrades: {
        ok: false,
        capabilityStatus: "UNSUPPORTED",
        code: "CLOSED_TRADES_UNSUPPORTED",
        count: 0,
        closedTrades: [],
      },
    });
    expect(parsed!.closedTrades.capabilityStatus).toBe("UNSUPPORTED");
    expect(parsed!.closedTrades.closedTrades).toEqual([]);
    expect(sumVerifiedFloatingPl([])).toBeNull();
    expect(sumVerifiedClosedGrossPl([{ grossPl: null }])).toBeNull();
  });

  it("does not fabricate verified zeros for missing P/L", () => {
    expect(formatOptionalNumber(null)).toBe("Unavailable");
    expect(formatSignedPl(null).tone).toBe("unknown");
    expect(formatSignedPl(12.5).tone).toBe("positive");
    expect(formatSignedPl(-3).tone).toBe("negative");
    expect(formatSide("B")).toBe("BUY");
  });

  it("maps quote freshness without treating CONNECTED as live prices", () => {
    expect(resolveQuoteFreshnessLabel({
      sessionStatus: "CONNECTED",
      streamState: "MARKET_INACTIVE",
      lastQuoteAt: null,
      updateCount: 0,
    })).toBe("MARKET_INACTIVE");
    expect(resolveQuoteFreshnessLabel({
      sessionStatus: "CONNECTED",
      streamState: "LIVE",
      lastQuoteAt: null,
      updateCount: 0,
    })).toBe("QUOTE_NOT_RECEIVED");
  });
});

describe("Phase 60.0.2 backend/sidecar contracts", () => {
  it("exposes ClosedTrades RO path and enriched trade fields", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("def closed_trades_payload");
    expect(sidecar).toContain('path == "/closed-trades"');
    expect(sidecar).toContain("CLOSED_TRADES");
    expect(sidecar).toContain("CURRENT_TRADING_DAY");
    expect(sidecar).toContain("gross_pl");
    expect(sidecar).toContain("floatingPl");
    expect(sidecar).not.toMatch(/true_market_open\(|create_order\(/);
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("listClosedTrades");
    expect(client).toContain("/closed-trades");
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("listClosedTrades");
    expect(api).toMatch(/phase:\s*"60\.0\.[23456]"/);
    expect(api).toContain("equityIncludesFloatingPl");
  });

  it("UI shows closed/history coverage and account P/L honesty", () => {
    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain("buildClosed24hBundle");
    expect(page).toContain('data-coverage="closed-24h"');
    expect(page).toContain("equityIncludesFloatingPl");
    expect(page).toMatch(/Partial history|Float P\/L/i);
    expect(page).toContain("READ-ONLY");
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-trade-monitor");
    expect(css).toContain(".fx-tm-table-wrap");
    expect(css).toContain(".fx-tm-strip");
  });

  it("preserves DisabledBrokerMutationAdapter on ordinary AT path", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("getDisabledBrokerMutationAdapter");
  });
});
