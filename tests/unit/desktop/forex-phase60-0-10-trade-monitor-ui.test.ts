/**
 * Phase 60.0.10 — Trade Monitor compact UI + view filtering.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildAllViewRows,
  buildClosed24hBundle,
  filterClosedDayWithin24h,
  isClosedWithinRolling24h,
  TRADE_MONITOR_VIEWS,
} from "../../../desktop/forex/trade-monitor/view-filter.ts";
import type {
  TradeMonitorClosedTradeRow,
  TradeMonitorHistoryRecord,
  TradeMonitorPositionRow,
} from "../../../desktop/forex/trade-monitor/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const now = Date.parse("2026-10-26T12:00:00.000Z");

function closedRow(
  partial: Partial<TradeMonitorClosedTradeRow> & { tradeId: string; closeTime: string },
): TradeMonitorClosedTradeRow {
  return {
    tradeId: partial.tradeId,
    accountIdMasked: "****1",
    instrument: partial.instrument ?? "XAU/USD",
    side: partial.side ?? "BUY",
    amount: 1,
    openRate: 100,
    closeRate: 101,
    openTime: null,
    closeTime: partial.closeTime,
    grossPl: 10,
    commission: null,
    rolloverInterest: null,
    netPl: null,
    plBasis: "gross",
    historyScope: "CURRENT_TRADING_DAY",
    source: "forexconnect-closed-trades",
  };
}

function hist(
  partial: Partial<TradeMonitorHistoryRecord> & { tradeId: string; recordKey: string },
): TradeMonitorHistoryRecord {
  return {
    recordKey: partial.recordKey,
    tradeId: partial.tradeId,
    accountIdMasked: "****1",
    instrument: partial.instrument ?? "EUR/USD",
    side: "SELL",
    amount: 1,
    openRate: 1.1,
    closeRate: 1.09,
    openTime: null,
    closeTime: partial.closeTime ?? "2026-10-26T10:00:00.000Z",
    grossPl: -5,
    commission: null,
    rolloverInterest: null,
    netPl: null,
    lifecycleStatus: partial.lifecycleStatus ?? "CLOSED",
    source: "persisted-history",
    observedAtUtc: "2026-10-26T10:00:00.000Z",
    historyScopeNote: null,
  };
}

describe("Phase 60.0.10 view selector contracts", () => {
  it("exposes four views LIVE / CLOSED <24H / HISTORY / ALL", () => {
    expect(TRADE_MONITOR_VIEWS.map((v) => v.id)).toEqual([
      "live",
      "closed_24h",
      "history",
      "all",
    ]);
    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain('data-phase="60.0.10"');
    expect(page).toContain("fx-tm-view-tab");
    expect(page).toContain("fx-tm-strip");
    expect(TRADE_MONITOR_VIEWS.find((v) => v.id === "closed_24h")?.label).toBe("CLOSED <24H");
    expect(page).toContain("TRADE_MONITOR_VIEWS");
    expect(page).not.toMatch(/openTrueMarket|createGrant|ALLOW_DEMO_MUTATION/);
    expect(page).toContain('data-places-orders="false"');
  });

  it("filters CLOSED <24H by close timestamp, not trading-day alone", () => {
    expect(isClosedWithinRolling24h("2026-10-26T11:00:00.000Z", now)).toBe(true);
    expect(isClosedWithinRolling24h("2026-10-25T12:00:00.000Z", now)).toBe(true);
    expect(isClosedWithinRolling24h("2026-10-25T11:59:00.000Z", now)).toBe(false);
    expect(isClosedWithinRolling24h(null, now)).toBe(false);
    expect(isClosedWithinRolling24h("not-a-date", now)).toBe(false);

    const day = [
      closedRow({ tradeId: "in", closeTime: "2026-10-26T10:00:00.000Z" }),
      closedRow({ tradeId: "out", closeTime: "2026-10-20T10:00:00.000Z" }),
      closedRow({ tradeId: "bad", closeTime: "" }),
    ];
    // empty closeTime -> Date.parse("") is NaN -> excluded
    day[2] = { ...day[2], closeTime: null };
    expect(filterClosedDayWithin24h(day, now).map((r) => r.tradeId)).toEqual(["in"]);

    const bundle = buildClosed24hBundle({
      dayClosed: day,
      historyRecords: [
        hist({ tradeId: "h1", recordKey: "k1", closeTime: "2026-10-26T09:00:00.000Z" }),
        hist({ tradeId: "h2", recordKey: "k2", closeTime: "2026-10-01T09:00:00.000Z" }),
      ],
      nowMs: now,
      historyAvailableFromUtc: "2026-10-01T00:00:00.000Z",
    });
    expect(bundle.tradeIds.sort()).toEqual(["****1|h1", "****1|in"].sort());
    expect(bundle.coverageNote).toMatch(/Rolling 24h/);
    expect(bundle.coverageNote).not.toMatch(/all-time/);
  });

  it("ALL does not merge identical tradeIds across different accounts", () => {
    const openA: TradeMonitorPositionRow[] = [{
      tradeId: "T9",
      accountIdMasked: "****AAAA",
      instrument: "XAU/USD",
      side: "BUY",
      amount: 1,
      openRate: 100,
      stopLoss: null,
      takeProfit: null,
      currentPrice: null,
      currentPriceSource: null,
      markPrice: null,
      markPriceSide: null,
      markPriceSource: null,
      markQuoteFreshness: null,
      markQuoteAgeMs: null,
      floatingPl: 1,
      floatingPlSource: null,
      floatingPlProvenance: null,
      commission: null,
      rolloverInterest: null,
      openTime: "2026-10-26T08:00:00.000Z",
      updatedAt: null,
      status: "OPEN",
      plBasis: "gross",
      source: "forexconnect-trades",
    }];
    const rows = buildAllViewRows({
      openTrades: openA,
      dayClosed: [],
      historyRecords: [
        hist({
          tradeId: "T9",
          recordKey: "other-acct",
          closeTime: "2026-10-26T09:00:00.000Z",
        }),
      ],
    });
    // hist() defaults accountIdMasked to ****1 — different from ****AAAA
    expect(rows.filter((r) => r.tradeId === "T9")).toHaveLength(2);
    expect(rows.some((r) => r.lifecycle === "OPEN")).toBe(true);
    expect(rows.some((r) => r.lifecycle === "CLOSED")).toBe(true);
  });

  it("ALL dedupes by account-scoped tradeId and keeps OPEN over CLOSED", () => {
    const open: TradeMonitorPositionRow[] = [{
      tradeId: "T1",
      accountIdMasked: "****1",
      instrument: "XAU/USD",
      side: "BUY",
      amount: 1,
      openRate: 100,
      stopLoss: null,
      takeProfit: null,
      currentPrice: 101,
      currentPriceSource: null,
      markPrice: 101,
      markPriceSide: "bid",
      markPriceSource: null,
      markQuoteFreshness: "QUOTE_RECEIVED",
      markQuoteAgeMs: 100,
      floatingPl: 5,
      floatingPlSource: "gross_pl",
      floatingPlProvenance: null,
      commission: null,
      rolloverInterest: null,
      openTime: "2026-10-26T08:00:00.000Z",
      updatedAt: null,
      status: "OPEN",
      plBasis: "gross",
      source: "forexconnect-trades",
    }];
    const rows = buildAllViewRows({
      openTrades: open,
      dayClosed: [closedRow({ tradeId: "T1", closeTime: "2026-10-26T11:00:00.000Z" })],
      historyRecords: [
        hist({ tradeId: "T1", recordKey: "k", lifecycleStatus: "CLOSED" }),
        hist({ tradeId: "T2", recordKey: "k2", closeTime: "2026-10-26T09:00:00.000Z" }),
      ],
    });
    const t1 = rows.find((r) => r.tradeId === "T1");
    expect(t1?.lifecycle).toBe("OPEN");
    expect(t1?.plKind).toBe("floating");
    expect(rows.some((r) => r.tradeId === "T2" && r.lifecycle === "CLOSED")).toBe(true);
  });

  it("CSS scopes compact strip and responsive card/table switch", () => {
    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-tm-strip");
    expect(css).toContain(".fx-tm-view-scroll");
    expect(css).toContain(".fx-tm-desktop-only");
    expect(css).toContain(".fx-tm-mobile-only");
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toContain("overflow-x: clip");
  });
});
