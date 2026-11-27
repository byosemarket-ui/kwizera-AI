import { describe, expect, it } from "vitest";
import {
  findBarByOpenTime,
  isValidOhlc,
  ohlcEqual,
  reconcileClosedBar,
  reconcileFormingBar,
  reconcileSeries,
  splitClosedAndForming,
  summarizeReconciliation,
  type OhlcBar,
} from "../../../../ai/market-data/mt5-hfm/ohlc-reconciliation";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bar = (t: number, o: number, h: number, l: number, c: number, closed?: boolean): OhlcBar => ({
  time: t,
  open: o,
  high: h,
  low: l,
  close: c,
  closed,
});

describe("C7 OHLC reconciliation", () => {
  it("validates OHLC geometry", () => {
    expect(isValidOhlc(bar(1, 10, 12, 9, 11))).toBe(true);
    expect(isValidOhlc(bar(1, 10, 9, 8, 11))).toBe(false);
    expect(isValidOhlc(null)).toBe(false);
  });

  it("matches exact closed candles", () => {
    const a = bar(100, 1.1, 1.2, 1.0, 1.15, true);
    const r = reconcileClosedBar({
      symbol: "EURUSD",
      timeframe: "M5",
      left: { source: "dump", observedAt: "2026-11-27T15:00:00.000Z", bar: a },
      right: { source: "copyrates", observedAt: "2026-11-27T15:00:00.200Z", bar: { ...a } },
    });
    expect(r.verdict).toBe("EXACT_MATCH");
    expect(ohlcEqual(a, a)).toBe(true);
  });

  it("detects timestamp mismatch", () => {
    const r = reconcileClosedBar({
      symbol: "XAUUSD",
      timeframe: "H1",
      left: { source: "dump", observedAt: "2026-11-27T15:00:00.000Z", bar: bar(100, 1, 2, 0.5, 1.5) },
      right: { source: "api", observedAt: "2026-11-27T15:00:00.000Z", bar: bar(200, 1, 2, 0.5, 1.5) },
    });
    expect(r.verdict).toBe("TIMESTAMP_MISMATCH");
  });

  it("exact-matches closed OHLC even when observation times differ", () => {
    const a = bar(100, 1, 2, 0.5, 1.5);
    const r = reconcileClosedBar({
      symbol: "EURUSD",
      timeframe: "M1",
      left: { source: "dump", observedAt: "2026-11-27T15:00:00.000Z", bar: a },
      right: { source: "api", observedAt: "2026-11-27T15:05:00.000Z", bar: a },
      maxStaleMs: 60_000,
    });
    expect(r.verdict).toBe("EXACT_MATCH");
  });

  it("classifies divergent closed OHLC with large observation skew as stale", () => {
    const r = reconcileClosedBar({
      symbol: "EURUSD",
      timeframe: "M1",
      left: { source: "dump", observedAt: "2026-11-27T15:00:00.000Z", bar: bar(100, 1, 2, 0.5, 1.5) },
      right: { source: "api", observedAt: "2026-11-27T15:05:00.000Z", bar: bar(100, 1, 2, 0.5, 1.4) },
      maxStaleMs: 60_000,
    });
    expect(r.verdict).toBe("STALE_SOURCE");
  });

  it("flags genuine closed OHLC mismatch", () => {
    const r = reconcileClosedBar({
      symbol: "GBPUSD",
      timeframe: "M15",
      left: { source: "dump", observedAt: "2026-11-27T15:00:00.000Z", bar: bar(100, 1, 2, 0.5, 1.5) },
      right: {
        source: "api",
        observedAt: "2026-11-27T15:00:00.100Z",
        bar: bar(100, 1, 2, 0.5, 1.4),
      },
    });
    expect(r.verdict).toBe("GENUINE_OHLC_MISMATCH");
  });

  it("handles missing and invalid sources", () => {
    expect(
      reconcileClosedBar({
        symbol: "USDJPY",
        timeframe: "H4",
        left: { source: "dump", observedAt: "2026-11-27T15:00:00.000Z", bar: null },
        right: { source: "api", observedAt: "2026-11-27T15:00:00.000Z", bar: bar(1, 1, 1, 1, 1) },
      }).verdict,
    ).toBe("MISSING_SOURCE");
    expect(
      reconcileClosedBar({
        symbol: "USDJPY",
        timeframe: "H4",
        left: {
          source: "dump",
          observedAt: "2026-11-27T15:00:00.000Z",
          bar: bar(1, 1, 0.5, 0.4, 0.9),
        },
        right: { source: "api", observedAt: "2026-11-27T15:00:00.000Z", bar: bar(1, 1, 1, 1, 1) },
      }).verdict,
    ).toBe("INVALID_OHLC");
  });

  it("classifies unsynchronized forming evolution without calling it exact", () => {
    const open = 1900;
    const r = reconcileFormingBar({
      symbol: "XAUUSD",
      timeframe: "M5",
      left: {
        source: "dump",
        observedAt: "2026-11-27T15:00:00.000Z",
        bar: bar(1000, open, 1905, 1898, 1902, false),
      },
      right: {
        source: "copyrates",
        observedAt: "2026-11-27T15:00:05.000Z",
        bar: bar(1000, open, 1908, 1895, 1896, false),
      },
      syncWindowMs: 1500,
    });
    expect(r.verdict).toBe("EXPECTED_FORMING_EVOLUTION");
  });

  it("refuses unsafe forming compare when open drifts across skew", () => {
    const r = reconcileFormingBar({
      symbol: "EURUSD",
      timeframe: "H1",
      left: {
        source: "dump",
        observedAt: "2026-11-27T15:00:00.000Z",
        bar: bar(1000, 1.1, 1.2, 1.0, 1.15, false),
      },
      right: {
        source: "api",
        observedAt: "2026-11-27T15:00:05.000Z",
        bar: bar(1000, 1.2, 1.3, 1.1, 1.25, false),
      },
      syncWindowMs: 1500,
    });
    expect(r.verdict).toBe("UNSAFE_FORMING_COMPARE");
  });

  it("splits series and reconciles closed + forming", () => {
    const left = [bar(1, 1, 2, 0.5, 1.5), bar(2, 1.5, 1.6, 1.4, 1.55, false)];
    const right = [bar(1, 1, 2, 0.5, 1.5), bar(2, 1.5, 1.7, 1.4, 1.6, false)];
    const { closed, forming } = reconcileSeries({
      symbol: "EURUSD",
      timeframe: "M3",
      leftSource: "dump",
      rightSource: "copyrates",
      leftObservedAt: "2026-11-27T15:00:00.000Z",
      rightObservedAt: "2026-11-27T15:00:03.000Z",
      leftBars: left,
      rightBars: right,
    });
    expect(closed).toHaveLength(1);
    expect(closed[0]?.verdict).toBe("EXACT_MATCH");
    expect(forming?.verdict).toBe("EXPECTED_FORMING_EVOLUTION");
    expect(findBarByOpenTime(left, 2)?.open).toBe(1.5);
    expect(splitClosedAndForming(left).forming?.time).toBe(2);
  });

  it("summarize marks genuine mismatches as blocking", () => {
    const s = summarizeReconciliation([
      {
        symbol: "XAUUSD",
        timeframe: "M1",
        candleOpenTime: 1,
        mode: "closed",
        verdict: "GENUINE_OHLC_MISMATCH",
        left: { source: "a", observedAt: "t", bar: null },
        right: { source: "b", observedAt: "t", bar: null },
        detail: "x",
      },
    ]);
    expect(s.blocking).toBe(true);
    expect(s.mismatches).toBe(1);
  });

  it("agent stream_snapshot syncs durable candle dump into cache", () => {
    const control = readFileSync(
      resolve("services/mt5-hfm-agent/mt5_control.py"),
      "utf8",
    );
    expect(control).toContain("_sync_periodic_candle_dump_cache");
    expect(control).toContain("candleCacheSync");
    expect(control).toContain("should_accept_incoming_snapshot");
    expect(control).toContain("ALREADY_CURRENT");
  });

  it("lifecycle ships controlled MT5 restart helper", () => {
    const script = readFileSync(
      resolve("services/mt5-hfm-lifecycle/bin/controlled-mt5-restart.sh"),
      "utf8",
    );
    expect(script).toContain("stop-mt5-demo.sh");
    expect(script).toContain("prepare-demo-login-ini.sh");
    expect(script).toContain("kwizera-mt5-hfm-demo.service");
    expect(script).toContain("refuse_duplicate");
  });
});
