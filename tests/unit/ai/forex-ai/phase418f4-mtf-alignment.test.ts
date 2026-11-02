/**
 * Phase 4.18F.4 — Multi-timeframe alignment + OpenAI evidence serialization.
 */
import { describe, expect, it } from "vitest";
import {
  computeMtfAlignment,
  MTF_ALIGNMENT_LADDER,
  type MtfTimeframeInput,
} from "../../../../ai/forex-ai/automated-trading/technical-intelligence/mtf-alignment.js";
import {
  buildMarketEvidenceBundle,
  marketEvidenceForModelPrompt,
  AT_MTF_EVIDENCE_TIMEFRAMES,
} from "../../../../ai/forex-ai/automated-trading/analysis/market-evidence-builder.js";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";

function rising(n: number, start = 100, step = 0.4): StrategyCandle[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const t0 = nowSec - n * 900;
  const out: StrategyCandle[] = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px + step;
    out.push({
      time: t0 + i * 900,
      open,
      high: Math.max(open, close) + 0.15,
      low: Math.min(open, close) - 0.15,
      close,
      closed: true,
    });
    px = close;
  }
  return out;
}

function falling(n: number, start = 200, step = 0.4): StrategyCandle[] {
  return rising(n, start, -step);
}

function tf(
  timeframe: string,
  bias: MtfTimeframeInput["bias"],
  extra: Partial<MtfTimeframeInput> = {},
): MtfTimeframeInput {
  return {
    timeframe,
    bias,
    available: true,
    closedBars: 80,
    sma9: 1.1,
    sma21: 1.0,
    atr: 0.01,
    atrMethod: "SMA_OF_TR",
    structureTrend: bias === "BULLISH" ? "BULLISH" : bias === "BEARISH" ? "BEARISH" : "RANGE",
    ...extra,
  };
}

describe("F.4 MTF ladder mappings", () => {
  it("exposes six supported timeframes", () => {
    expect([...MTF_ALIGNMENT_LADDER]).toEqual(["5m", "15m", "30m", "1h", "4h", "1d"]);
    expect([...AT_MTF_EVIDENCE_TIMEFRAMES]).toEqual(["5m", "15m", "30m", "1h", "4h", "1d"]);
  });
});

describe("F.4 MTF alignment engine", () => {
  it("classifies full bullish alignment", () => {
    const r = computeMtfAlignment({
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      timeframes: MTF_ALIGNMENT_LADDER.map((t) => tf(t, "BULLISH")),
    });
    expect(r.classification).toBe("FULL_BULLISH_ALIGNMENT");
    expect(r.legacyAgreement).toBe("AGREE_BULLISH");
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.matrix).toHaveLength(6);
  });

  it("classifies full bearish alignment", () => {
    const r = computeMtfAlignment({
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      timeframes: MTF_ALIGNMENT_LADDER.map((t) => tf(t, "BEARISH")),
    });
    expect(r.classification).toBe("FULL_BEARISH_ALIGNMENT");
    expect(r.legacyAgreement).toBe("AGREE_BEARISH");
  });

  it("classifies timeframe conflict when LTF bullish vs HTF bearish", () => {
    const r = computeMtfAlignment({
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      timeframes: [
        tf("5m", "BULLISH"),
        tf("15m", "BULLISH"),
        tf("30m", "BULLISH"),
        tf("1h", "BEARISH"),
        tf("4h", "BEARISH"),
        tf("1d", "BEARISH"),
      ],
    });
    expect(r.classification).toBe("TIMEFRAME_CONFLICT");
    expect(r.legacyAgreement).toBe("CONFLICT");
    expect(r.pairwise.some((p) => p.relation === "CONFLICT")).toBe(true);
  });

  it("treats missing HTF as insufficient — not conflict", () => {
    const r = computeMtfAlignment({
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      timeframes: [
        tf("5m", "BULLISH"),
        tf("15m", "BULLISH"),
        // no 30m/1h/4h/1d
      ],
    });
    expect(r.classification).toBe("INSUFFICIENT_TIMEFRAME_DATA");
    expect(r.legacyAgreement).toBe("INSUFFICIENT");
    expect(r.unavailableTimeframes.length).toBeGreaterThan(0);
  });

  it("reports stale timeframe data", () => {
    const r = computeMtfAlignment({
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      timeframes: MTF_ALIGNMENT_LADDER.map((t) => tf(t, "BULLISH", { stale: true, available: true })),
    });
    // Stale rows are not AVAILABLE for directional consensus → STALE or INSUFFICIENT
    expect(["STALE_TIMEFRAME_DATA", "INSUFFICIENT_TIMEFRAME_DATA"]).toContain(r.classification);
    expect(r.staleTimeframes.length).toBe(6);
  });

  it("reports partial bullish when HTF bullish and some LTF agree", () => {
    const r = computeMtfAlignment({
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      timeframes: [
        tf("5m", "BULLISH"),
        tf("15m", "RANGING"),
        tf("30m", "BULLISH"),
        tf("1h", "BULLISH"),
        tf("4h", "BULLISH"),
        tf("1d", "BULLISH"),
      ],
    });
    expect(["FULL_BULLISH_ALIGNMENT", "PARTIAL_BULLISH_ALIGNMENT"]).toContain(r.classification);
    expect(r.legacyAgreement).toBe("AGREE_BULLISH");
  });
});

describe("F.4 evidence builder + OpenAI serialization", () => {
  it("builds alignment matrix across six TFs and serializes for OpenAI", () => {
    const candlesByTf: Record<string, StrategyCandle[]> = {
      "5m": rising(80),
      "15m": rising(80),
      "30m": rising(80),
      "1h": rising(80, 100, 0.2),
      "4h": rising(80, 100, 0.15),
      "1d": rising(80, 100, 0.1),
    };
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf,
      quote: {
        instrument: "EUR/USD",
        bid: 130,
        ask: 130.1,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 500,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "f4",
      },
      pointSize: 0.0001,
    });

    expect(bundle.evidenceVersion).toBe("4.18F.4");
    expect(bundle.multiTimeframe.alignment).not.toBeNull();
    expect(bundle.multiTimeframe.alignment!.matrix).toHaveLength(6);
    expect(bundle.placesOrders).toBe(false);
    expect(bundle.acceptsForExecution).toBe(false);

    const prompt = marketEvidenceForModelPrompt(bundle);
    expect(prompt.timeframeMatrix).toBeTruthy();
    const matrix = prompt.timeframeMatrix as Array<{ timeframe: string }>;
    expect(matrix.map((r) => r.timeframe)).toEqual(["5m", "15m", "30m", "1h", "4h", "1d"]);
    const mtf = prompt.multiTimeframe as { alignment: { classification: string } };
    expect(mtf.alignment.classification).toBeTruthy();
    const delivery = prompt.openaiEvidenceDelivery as {
      mtfMatrixIncluded: boolean;
      timeframeKeysInRequest: string[];
      atrMethodLabel: string;
    };
    expect(delivery.mtfMatrixIncluded).toBe(true);
    expect(delivery.timeframeKeysInRequest).toEqual(["5m", "15m", "30m", "1h", "4h", "1d"]);
    expect(delivery.atrMethodLabel).toBe("SMA_OF_TR");
    expect(prompt.placesOrders).toBe(false);
    expect(prompt.mutatesBroker).toBe(false);
  });

  it("surfaces conflict when lower TFs rise and higher TFs fall", () => {
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: {
        "5m": rising(80),
        "15m": rising(80),
        "30m": rising(80),
        "1h": falling(80, 200, 0.5),
        "4h": falling(80, 200, 0.4),
        "1d": falling(80, 200, 0.3),
      },
      quote: {
        instrument: "XAU/USD",
        bid: 2000,
        ask: 2000.3,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 500,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "f4c",
      },
      pointSize: 0.01,
    });
    const cls = bundle.multiTimeframe.alignment?.classification;
    // Rising LTF vs falling HTF should conflict or mixed — never invent FULL alignment.
    expect(cls).not.toBe("FULL_BULLISH_ALIGNMENT");
    expect(cls).not.toBe("FULL_BEARISH_ALIGNMENT");
    expect(bundle.multiTimeframe.alignment?.mutatesBroker).toBe(false);
  });

  it("isolates instruments — no cross contamination", () => {
    const a = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": rising(60), "1h": rising(60) },
      quote: {
        instrument: "EUR/USD",
        bid: 1.1,
        ask: 1.1001,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 100,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "a",
      },
    });
    const b = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": falling(60, 2500, 1), "1h": falling(60, 2500, 1) },
      quote: {
        instrument: "XAU/USD",
        bid: 2500,
        ask: 2500.3,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 100,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "b",
      },
    });
    expect(a.identity.instrument).toBe("EUR/USD");
    expect(b.identity.instrument).toBe("XAU/USD");
    expect(a.multiTimeframe.alignment?.instrument).toBe("EUR/USD");
    expect(b.multiTimeframe.alignment?.instrument).toBe("XAU/USD");
  });
});
