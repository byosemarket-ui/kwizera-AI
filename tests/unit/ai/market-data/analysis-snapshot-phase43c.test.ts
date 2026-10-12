/**
 * Phase 43C — analysis period / candle timeframe integration.
 */
import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ANALYSIS_PERIOD_IDS,
  ANALYSIS_SNAPSHOT_MAX_CANDLES,
  canResampleTimeframe,
  classifyGapReason,
  estimateCandleCount,
  estimateCandleCountForPeriod,
  listAffordablePeriodTimeframePairs,
  parseAnalysisPeriodId,
  preferResampleSource,
  rejectResampleReason,
  resampleCandles,
  resolveAndValidateRequestShape,
  resolveAnalysisWindow,
  resolveCustomAnalysisWindow,
  resetAnalysisSnapshotEngineForTests,
  resetAnalysisSnapshotStoreForTests,
} from "../../../../ai/market-data/analysis-snapshot/index.ts";
import type { AnalysisSnapshotCandle } from "../../../../ai/market-data/analysis-snapshot/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function srcCandle(timeSec: number, open: number, high: number, low: number, close: number, vol: number | null = 1): AnalysisSnapshotCandle {
  return {
    time: timeSec,
    open,
    high,
    low,
    close,
    volume: vol,
    isClosed: true,
    resampled: false,
  };
}

describe("Phase 43C period & timeframe integration", () => {
  afterEach(() => {
    resetAnalysisSnapshotEngineForTests();
    resetAnalysisSnapshotStoreForTests();
  });

  it("maps each preset period to a correct UTC window (independent of timeframe)", () => {
    const now = Date.parse("2026-10-13T12:00:00.000Z");
    const six = resolveAnalysisWindow("6h", now);
    expect(six.startUtc).toBe("2026-10-13T06:00:00.000Z");
    expect(six.endUtc).toBe("2026-10-13T12:00:00.000Z");

    const fiveMin = resolveAnalysisWindow("5m", now);
    expect(fiveMin.startUtc).toBe("2026-10-13T11:55:00.000Z");

    const threeDay = resolveAnalysisWindow("3d", now);
    expect(threeDay.startUtc).toBe("2026-10-10T12:00:00.000Z");

    const a = resolveAndValidateRequestShape({
      candleTimeframe: "1h",
      analysisPeriod: "6h",
      nowMs: now,
    });
    const b = resolveAndValidateRequestShape({
      candleTimeframe: "5m",
      analysisPeriod: "6h",
      nowMs: now,
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.requestedRange.startUtc).toBe(b.value.requestedRange.startUtc);
      expect(a.value.requestedRange.endUtc).toBe(b.value.requestedRange.endUtc);
      expect(a.value.candleTimeframe).toBe("1h");
      expect(b.value.candleTimeframe).toBe("5m");
      expect(a.value.candlesRequestedEstimate).toBe(6);
      expect(b.value.candlesRequestedEstimate).toBe(72);
    }
  });

  it("supports expanded periods and rejects invalid / expensive combinations", () => {
    expect(ANALYSIS_PERIOD_IDS).toContain("5m");
    expect(ANALYSIS_PERIOD_IDS).toContain("12h");
    expect(ANALYSIS_PERIOD_IDS).toContain("6d");
    expect(ANALYSIS_PERIOD_IDS).toContain("custom");
    expect(parseAnalysisPeriodId("4h")).toBe("4h");
    expect(parseAnalysisPeriodId("99d")).toBeNull();

    const expensive = resolveAndValidateRequestShape({
      candleTimeframe: "1m",
      analysisPeriod: "7d",
    });
    expect(expensive.ok).toBe(false);
    if (!expensive.ok) expect(expensive.code).toBe("REQUEST_TOO_EXPENSIVE");

    const badTf = resolveAndValidateRequestShape({
      candleTimeframe: "3m",
      analysisPeriod: "2h",
    });
    expect(badTf.ok).toBe(false);
    if (!badTf.ok) expect(badTf.code).toBe("UNSUPPORTED_TIMEFRAME");

    const ok = resolveAndValidateRequestShape({
      candleTimeframe: "15m",
      analysisPeriod: "12h",
      nowMs: Date.parse("2026-10-13T00:00:00.000Z"),
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.candlesRequestedEstimate).toBeLessThanOrEqual(ANALYSIS_SNAPSHOT_MAX_CANDLES);
      expect(ok.value.requestedRange.startUtc).toBe("2026-10-12T12:00:00.000Z");
    }

    const pairs = listAffordablePeriodTimeframePairs();
    expect(pairs.every((p) => p.estimate <= ANALYSIS_SNAPSHOT_MAX_CANDLES)).toBe(true);
    expect(pairs.some((p) => p.analysisPeriod === "6h" && p.candleTimeframe === "15m")).toBe(true);
    expect(pairs.some((p) => p.analysisPeriod === "7d" && p.candleTimeframe === "1m")).toBe(false);
  });

  it("validates custom UTC ranges without silently extending them", () => {
    const custom = resolveCustomAnalysisWindow(
      "2026-10-13T00:00:00.000Z",
      "2026-10-13T06:00:00.000Z",
    );
    expect(custom.ok).toBe(true);
    if (custom.ok) {
      expect(custom.value.startUtc).toBe("2026-10-13T00:00:00.000Z");
      expect(custom.value.endUtc).toBe("2026-10-13T06:00:00.000Z");
    }

    const shaped = resolveAndValidateRequestShape({
      candleTimeframe: "1h",
      analysisPeriod: "custom",
      rangeStartUtc: "2026-10-13T00:00:00.000Z",
      rangeEndUtc: "2026-10-13T06:00:00.000Z",
    });
    expect(shaped.ok).toBe(true);
    if (shaped.ok) {
      expect(shaped.value.analysisPeriod).toBe("custom");
      expect(shaped.value.candlesRequestedEstimate).toBe(6);
    }

    const inverted = resolveAndValidateRequestShape({
      candleTimeframe: "1h",
      analysisPeriod: "custom",
      rangeStartUtc: "2026-10-13T06:00:00.000Z",
      rangeEndUtc: "2026-10-13T00:00:00.000Z",
    });
    expect(inverted.ok).toBe(false);

    const tooLong = resolveAndValidateRequestShape({
      candleTimeframe: "1h",
      analysisPeriod: "custom",
      rangeStartUtc: "2026-09-01T00:00:00.000Z",
      rangeEndUtc: "2026-10-13T00:00:00.000Z",
    });
    expect(tooLong.ok).toBe(false);
  });

  it("resamples finer→coarser correctly and rejects impossible resampling", () => {
    expect(canResampleTimeframe("1m", "5m")).toBe(true);
    expect(canResampleTimeframe("5m", "1m")).toBe(false);
    expect(canResampleTimeframe("15m", "1h")).toBe(true);
    expect(rejectResampleReason("1h", "15m")).toMatch(/coarser/i);
    expect(preferResampleSource("1h", ["1m", "5m", "15m", "1h"])).toBe("1m");

    const base = Date.parse("2026-10-13T00:00:00.000Z") / 1000;
    const source: AnalysisSnapshotCandle[] = [];
    for (let i = 0; i < 5; i += 1) {
      const o = 100 + i;
      source.push(srcCandle(base + i * 60, o, o + 1, o - 1, o + 0.5, 10));
    }
    const result = resampleCandles(source, "1m", "5m");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candles).toHaveLength(1);
      const c = result.candles[0]!;
      expect(c.time).toBe(base);
      expect(c.open).toBe(100);
      expect(c.close).toBe(104.5);
      expect(c.high).toBe(105);
      expect(c.low).toBe(99);
      expect(c.volume).toBe(50);
      expect(c.resampled).toBe(true);
      expect(c.incompleteAggregation).toBe(false);
      expect(c.isClosed).toBe(true);
    }

    const incomplete = resampleCandles(source.slice(0, 3), "1m", "5m");
    expect(incomplete.ok).toBe(true);
    if (incomplete.ok) {
      expect(incomplete.candles[0]!.incompleteAggregation).toBe(true);
      expect(incomplete.candles[0]!.isClosed).toBe(false);
    }

    const bad = resampleCandles(source, "1h", "15m");
    expect(bad.ok).toBe(false);
  });

  it("classifies forex weekend gaps as market closures vs data gaps", () => {
    expect(classifyGapReason(
      "2026-10-10T00:00:00.000Z", // Saturday
      "2026-10-11T12:00:00.000Z",
      "FOREX",
    )).toBe("MARKET_CLOSURE");
    expect(classifyGapReason(
      "2026-10-13T00:00:00.000Z", // Tuesday
      "2026-10-13T02:00:00.000Z",
      "FOREX",
    )).toBe("DATA_GAP");
    expect(classifyGapReason(
      "2026-10-10T00:00:00.000Z",
      "2026-10-11T12:00:00.000Z",
      "CRYPTO",
    )).toBe("DATA_GAP");
  });

  it("keeps continuous candle estimates as upper-bound math only", () => {
    expect(estimateCandleCount("15m", 6 * 60 * 60_000)).toBe(24);
    expect(estimateCandleCountForPeriod("1h", "24h")).toBe(24);
    expect(estimateCandleCount("1m", 7 * 24 * 60 * 60_000)).toBeGreaterThan(ANALYSIS_SNAPSHOT_MAX_CANDLES);
  });

  it("wires page controls to snapshot API with independent period/timeframe UI", () => {
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const css = read("desktop/forex/forex.css");
    const api = read("dev/server/forex-analysis-snapshot-api.ts");

    expect(page).toContain('data-forex-ai-phase43c="true"');
    expect(page).toContain("data-ai-candle-timeframe");
    expect(page).toContain("data-ai-analysis-period");
    expect(page).toContain("data-ai-snapshot-config");
    expect(page).toContain("candleTimeframe: candleTf");
    expect(page).toContain("analysisPeriod");
    expect(page).toContain("rangeStartUtc");
    expect(page).toContain("snapshotRequestSeq");
    expect(page).toContain("STALE_SELECTION");
    expect(page).toContain("/api/forex/ai/analyze");
    expect(page).toContain("/api/forex/ai/multi-timeframe");
    expect(page).toContain("/api/forex/ai/decision");
    expect(page).toContain('const CANDLE_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]');
    expect(page).not.toMatch(/CANDLE_TIMEFRAMES = \[[^\]]*"(2m|3m|2h|6h|12h)"/);

    expect(api).toContain("affordablePairs");
    expect(api).toContain("rangeStartUtc");
    expect(api).toContain("listAffordablePeriodTimeframePairs");

    expect(css).toContain(".fx-ai-snapshot-config");
    expect(css).toContain(".fx-ai-custom-range");
    expect(css).toContain('@media (max-width: 480px)');
  });
});
