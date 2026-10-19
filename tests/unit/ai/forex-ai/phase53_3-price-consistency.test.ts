/**
 * Phase 53.3 fix — quote/OHLC price-scale consistency and chart/evidence binding.
 * Lightweight unit checks only.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertQuoteCandlePriceScale,
  AT_PRICE_SCALE_RATIO_MAX,
  AT_PRICE_SCALE_RATIO_MIN,
  evidenceForModelPrompt,
  renderAtMarketChartPng,
  validateCandleOhlcRelationships,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function candlesAround(base: number, n = 24, periodSec = 900) {
  const t0 = Math.floor(Date.now() / 1000) - n * periodSec;
  return Array.from({ length: n }, (_, i) => {
    const c = base + i * (base * 0.00001);
    return {
      time: t0 + i * periodSec,
      open: c,
      high: c * 1.0002,
      low: c * 0.9998,
      close: c * 1.0001,
    };
  });
}

describe("price-scale consistency", () => {
  it("passes when XAU-scale quote and candles agree", () => {
    const r = assertQuoteCandlePriceScale({
      bid: 4168.97,
      ask: 4169.27,
      quoteFresh: true,
      candles: candlesAround(4165),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scaleRatio).not.toBeNull();
      expect(r.scaleRatio!).toBeGreaterThanOrEqual(AT_PRICE_SCALE_RATIO_MIN);
      expect(r.scaleRatio!).toBeLessThanOrEqual(AT_PRICE_SCALE_RATIO_MAX);
    }
  });

  it("blocks ~0.84 candles against ~4169 quote with PRICE_SCALE_MISMATCH", () => {
    const r = assertQuoteCandlePriceScale({
      bid: 4168.97,
      ask: 4169.27,
      quoteFresh: true,
      candles: candlesAround(0.84),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("PRICE_SCALE_MISMATCH");
      expect(r.message).toMatch(/incompatible/i);
      expect(r.scaleRatio).not.toBeNull();
      expect(r.scaleRatio!).toBeLessThan(AT_PRICE_SCALE_RATIO_MIN);
    }
  });

  it("passes coherent FX-scale quote and candles", () => {
    const r = assertQuoteCandlePriceScale({
      bid: 1.0841,
      ask: 1.0843,
      quoteFresh: true,
      candles: candlesAround(1.0835),
    });
    expect(r.ok).toBe(true);
  });

  it("rejects invalid OHLC relationships", () => {
    const r = validateCandleOhlcRelationships([
      { time: 1, open: 10, high: 9, low: 8, close: 9 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_OHLC");
  });
});

describe("evidence / prompt authority", () => {
  it("marks structured OHLC as authoritative and forbids pixel price inference", () => {
    const prompts = read("ai/forex-ai/automated-trading/analysis/prompts.ts");
    expect(prompts).toMatch(/Absolute prices MUST come from the EVIDENCE JSON/i);
    expect(prompts).toMatch(/never from estimating chart pixel/i);

    const evidence = read("ai/forex-ai/automated-trading/analysis/evidence.ts");
    expect(evidence).toMatch(/authoritative absolute prices/i);
    expect(evidence).toMatch(/Do not infer absolute prices from chart pixel/i);

    const note = evidenceForModelPrompt(
      {
        fingerprint: "fp",
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframes: ["15m"],
        candles: [],
        bid: 4169,
        ask: 4169.3,
        quoteFresh: true,
        feedStatus: "LIVE",
        historicalOnly: false,
        verificationIdentityStatus: "ACCOUNT_VERIFIED",
        warnings: [],
        builtAtUtc: new Date().toISOString(),
      },
      { "15m": candlesAround(4165, 5) },
    );
    expect(String(note.note)).toMatch(/authoritative absolute prices/i);
  });

  it("monitor worker passes the same candlesByTf used for the chart", () => {
    const worker = read("ai/forex-ai/automated-trading/monitoring/worker.ts");
    expect(worker).toMatch(/candlesByTf:\s*\{\s*\[tf\]:\s*evidenceCandles\s*\}/);
    expect(worker).toMatch(/Same candle snapshot for chart PNG and OpenAI evidence/);
  });

  it("engine prefers supplied candles and runs price-scale gate", () => {
    const engine = read("ai/forex-ai/automated-trading/analysis/engine.ts");
    expect(engine).toMatch(/candlesByTf\?:/);
    expect(engine).toMatch(/assertQuoteCandlePriceScale/);
    expect(engine).toMatch(/PRICE_SCALE_MISMATCH|scaleCheck\.code/);
  });
});

describe("chart axis labels", () => {
  it("renders XAU-scale charts with absolute price labels in the PNG path", () => {
    const rendered = renderAtMarketChartPng({
      instrument: "XAU/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      observationUtc: new Date().toISOString(),
      candles: candlesAround(4165, 40, 900),
    });
    expect(rendered.ok).toBe(true);
    if (rendered.ok) {
      expect(rendered.imageHash).toMatch(/^[a-f0-9]{24}$/);
      expect(rendered.byteLength).toBeGreaterThan(200);
    }
    const src = read("ai/forex-ai/automated-trading/monitoring/chart-render.ts");
    expect(src).toMatch(/formatAxisPrice/);
    expect(src).toMatch(/padL = 56/);
  });
});
