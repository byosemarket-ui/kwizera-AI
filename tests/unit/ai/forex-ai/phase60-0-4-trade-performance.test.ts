/**
 * Phase 60.0.4 — performance analytics + reconciliation (pure, no broker mutation).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildPerformanceSummary,
  computeFloatingPl,
  computePlPercentOfEquity,
  computeRealizedPl,
  computeWinRate,
  dedupeClosedTradesForAnalytics,
  detectPartialCoverage,
  filterClosedInPeriod,
  mergeClosedSourcesWithoutDoubleCount,
  reconcileTradeMonitorSources,
} from "../../../../ai/forex-ai/automated-trading/trade-history/index.ts";
import {
  formatMetricCurrency,
  formatMetricRatio,
  parseTradePerformance,
} from "../../../../desktop/forex/trade-monitor/performance-view.ts";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 60.0.4 realized / floating separation", () => {
  it("sums realized gross for closed period only and keeps floating separate", () => {
    const closed = [
      {
        recordKey: "a",
        tradeId: "1",
        lifecycleStatus: "CLOSED",
        grossPl: 10,
        closeTime: "2026-10-25T12:00:00.000Z",
      },
      {
        recordKey: "b",
        tradeId: "2",
        lifecycleStatus: "CLOSED",
        grossPl: -4,
        closeTime: "2026-10-25T13:00:00.000Z",
      },
      {
        recordKey: "c",
        tradeId: "3",
        lifecycleStatus: "OPEN",
        grossPl: 99,
        closeTime: null,
      },
    ];
    const inPeriod = filterClosedInPeriod(closed, "2026-10-25T00:00:00.000Z", "2026-10-25T23:59:59.000Z");
    expect(inPeriod).toHaveLength(2);
    const realized = computeRealizedPl(inPeriod, {
      currency: "USD",
      basis: "gross",
      partialCoverage: true,
    });
    expect(realized.value).toBe(6);
    expect(realized.availability).toBe("PARTIAL");

    const floating = computeFloatingPl(
      [{ tradeId: "3", floatingPl: 99, currency: "USD" }],
      "USD",
    );
    expect(floating.value).toBe(99);
    expect(floating.scope).toBe("current_snapshot");
  });

  it("does not treat missing P/L as zero", () => {
    const realized = computeRealizedPl(
      [{ lifecycleStatus: "CLOSED", closeTime: "2026-10-25T12:00:00.000Z", grossPl: null }],
      { currency: "USD", basis: "gross", partialCoverage: false },
    );
    expect(realized.value).toBeNull();
    expect(realized.availability).toBe("UNAVAILABLE");
  });

  it("rejects mixed currencies", () => {
    const floating = computeFloatingPl(
      [
        { floatingPl: 1, currency: "USD" },
        { floatingPl: 2, currency: "EUR" },
      ],
      null,
    );
    expect(floating.value).toBeNull();
    expect(floating.availability).toBe("UNAVAILABLE");
  });
});

describe("Phase 60.0.4 win rate and P/L percent", () => {
  it("excludes zero-P/L from win-rate denominator", () => {
    const { winRate, zeroResultCount, profitableCount, losingCount } = computeWinRate(
      [
        { lifecycleStatus: "CLOSED", grossPl: 5, closeTime: "2026-10-25T10:00:00.000Z" },
        { lifecycleStatus: "CLOSED", grossPl: -2, closeTime: "2026-10-25T11:00:00.000Z" },
        { lifecycleStatus: "CLOSED", grossPl: 0, closeTime: "2026-10-25T12:00:00.000Z" },
      ],
      { partialCoverage: true, currency: "USD" },
    );
    expect(profitableCount.value).toBe(1);
    expect(losingCount.value).toBe(1);
    expect(zeroResultCount.value).toBe(1);
    expect(winRate.value).toBe(0.5);
    expect(winRate.availability).toBe("PARTIAL");
  });

  it("does not fabricate win rate without outcomes", () => {
    const { winRate } = computeWinRate([], { partialCoverage: true, currency: "USD" });
    expect(winRate.value).toBeNull();
    expect(winRate.availability).toBe("UNAVAILABLE");
  });

  it("validates equity denominator for P/L percent", () => {
    const realized = computeRealizedPl(
      [{ lifecycleStatus: "CLOSED", grossPl: 50, closeTime: "2026-10-25T12:00:00.000Z" }],
      { currency: "USD", basis: "gross", partialCoverage: true },
    );
    expect(computePlPercentOfEquity(realized, 0, "USD", {
      equityIncludesFloatingPl: true,
      partialCoverage: true,
    }).value).toBeNull();
    expect(computePlPercentOfEquity(realized, null, "USD", {
      equityIncludesFloatingPl: true,
      partialCoverage: true,
    }).value).toBeNull();
    const ok = computePlPercentOfEquity(realized, 10_000, "USD", {
      equityIncludesFloatingPl: true,
      partialCoverage: true,
    });
    expect(ok.value).toBeCloseTo(0.5, 5);
    expect(ok.availability).toBe("PARTIAL");
  });
});

describe("Phase 60.0.4 reconciliation", () => {
  it("dedupes and avoids double-counting day vs persisted closed", () => {
    const deduped = dedupeClosedTradesForAnalytics([
      { recordKey: "k1", tradeId: "T1", grossPl: 1 },
      { recordKey: "k1", tradeId: "T1", grossPl: 1 },
    ]);
    expect(deduped).toHaveLength(1);
    const merged = mergeClosedSourcesWithoutDoubleCount({
      persistedClosed: [{ tradeId: "T1", recordKey: "k1", grossPl: 10 }],
      dayClosed: [{ tradeId: "T1", grossPl: 10 }, { tradeId: "T2", grossPl: 3 }],
    });
    expect(merged.map((m) => m.tradeId).sort()).toEqual(["T1", "T2"]);
    expect(merged.find((m) => m.tradeId === "T1")?.source).toBe("persisted");
  });

  it("does not infer closure when history OPEN is missing from broker", () => {
    const snap = reconcileTradeMonitorSources({
      openTrades: [{ tradeId: "OPEN1" }],
      closedDayTrades: [],
      historyRecords: [
        { tradeId: "OPEN1", lifecycleStatus: "OPEN" },
        { tradeId: "GHOST", lifecycleStatus: "OPEN" },
        { tradeId: "DONE", lifecycleStatus: "CLOSED" },
      ],
      activeOrders: [{ orderId: "O1" }],
      instrumentSummaries: [{ instrument: "XAU/USD", netPl: 5 }],
    });
    expect(snap.historyOpenMissingFromBroker).toContain("GHOST");
    expect(snap.findings.some((f) => f.code === "HISTORY_OPEN_ABSENT_FROM_BROKER")).toBe(true);
    expect(snap.notes.some((n) => n.includes("does not imply"))).toBe(true);
    expect(snap.summaryInstrumentCount).toBe(1);
    expect(snap.placesOrders).toBe(false);
  });

  it("flags open overlapping closed without merging P/L scopes", () => {
    const snap = reconcileTradeMonitorSources({
      openTrades: [{ tradeId: "X" }],
      closedDayTrades: [{ tradeId: "X" }],
      historyRecords: [{ tradeId: "X", lifecycleStatus: "CLOSED" }],
      activeOrders: [],
      instrumentSummaries: [],
    });
    expect(snap.openOverlappingClosedKeys).toContain("X");
  });
});

describe("Phase 60.0.4 coverage + summary builder", () => {
  it("marks period before coverage start as partial", () => {
    const c = detectPartialCoverage({
      fromUtc: "2026-01-01T00:00:00.000Z",
      historyAvailableFromUtc: "2026-10-25T08:00:00.000Z",
    });
    expect(c.partial).toBe(true);
    expect(c.note).toMatch(/before historyAvailableFromUtc/i);
  });

  it("builds labeled summary without inventing win rate on empty set", () => {
    const summary = buildPerformanceSummary({
      openTrades: [{ tradeId: "1", floatingPl: 2, currency: "USD" }],
      activeOrderCount: 3,
      closedTrades: [],
      period: {
        fromUtc: "2026-10-25T00:00:00.000Z",
        toUtc: "2026-10-25T23:59:59.000Z",
        historyAvailableFromUtc: "2026-10-25T08:00:00.000Z",
        accountCurrency: "USD",
        equity: 10_000,
        equityIncludesFloatingPl: true,
      },
      periodLabel: "today_utc",
    });
    expect(summary.floatingPl.value).toBe(2);
    expect(summary.realizedGrossPl.value).toBeNull();
    expect(summary.winRate.value).toBeNull();
    expect(summary.activeOrderCount.value).toBe(3);
    expect(summary.openTradeCount.value).toBe(1);
    expect(summary.coverage.partial).toBe(true);
    expect(summary.placesOrders).toBe(false);
    expect(summary.combinedLabeledPl.definition).toMatch(/Not equity/);
  });
});

describe("Phase 60.0.4 contracts + UI helpers", () => {
  it("wires trade-performance API and forbids mutation on RO routes", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/trade-performance");
    expect(api).toContain("buildPerformanceSummary");
    expect(api).toContain("reconcileTradeMonitorSources");
    expect(api).toMatch(/phase:\s*"60\.0\.[456]"/);
    const ro = api.slice(
      api.indexOf("broker-ro-tables"),
      api.indexOf("/api/forex/automated-trading/status"),
    );
    expect(ro).not.toMatch(/openTrueMarket|createGrant|ALLOW_DEMO_MUTATION/);

    const page = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(page).toContain("trade-performance");
    expect(page).toMatch(/data-phase="60\.0\.(?:[456]|10|11)"/);
    expect(page).toContain("AbortController");
    expect(page).toContain("Partial history");
    expect(page).not.toMatch(/openTrueMarket|createGrant/);

    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-tm-banner.is-partial");
    expect(css).toContain(".fx-tm-avail-chip");

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("getDisabledBrokerMutationAdapter");
  });

  it("formats unavailable metrics without inventing zeros", () => {
    expect(formatMetricCurrency({
      id: "x",
      label: "x",
      value: null,
      availability: "UNAVAILABLE",
    }).tone).toBe("unknown");
    expect(formatMetricRatio({
      id: "w",
      label: "w",
      value: 0.5,
      availability: "PARTIAL",
    }).text).toContain("%");
    const parsed = parseTradePerformance({
      ok: true,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      performance: {
        schemaVersion: "60.0.4",
        period: { fromUtc: null, toUtc: null, label: "all" },
        historyAvailableFromUtc: null,
        coverage: { availability: "PARTIAL", partial: true, note: "n" },
        openTradeCount: { id: "o", label: "o", value: 0, availability: "AVAILABLE" },
        activeOrderCount: { id: "a", label: "a", value: 0, availability: "AVAILABLE" },
        floatingPl: { id: "f", label: "f", value: null, availability: "UNAVAILABLE" },
        realizedGrossPl: { id: "r", label: "r", value: null, availability: "UNAVAILABLE" },
        realizedNetPl: { id: "n", label: "n", value: null, availability: "UNAVAILABLE" },
        closedTradeCount: { id: "c", label: "c", value: null, availability: "UNAVAILABLE" },
        profitableCount: { id: "p", label: "p", value: null, availability: "UNAVAILABLE" },
        losingCount: { id: "l", label: "l", value: null, availability: "UNAVAILABLE" },
        zeroResultCount: { id: "z", label: "z", value: null, availability: "UNAVAILABLE" },
        winRate: { id: "w", label: "w", value: null, availability: "UNAVAILABLE" },
        plPercentOfEquity: { id: "pct", label: "pct", value: null, availability: "UNAVAILABLE" },
        combinedLabeledPl: { id: "comb", label: "comb", value: null, availability: "UNAVAILABLE" },
        evaluatedAtUtc: "2026-10-25T12:00:00.000Z",
      },
    });
    expect(parsed?.performance.schemaVersion).toBe("60.0.4");
  });
});
