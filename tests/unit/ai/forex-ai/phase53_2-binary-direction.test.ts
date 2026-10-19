/**
 * Phase 53.2 — Binary BUY/SELL direction + confidence validation.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AUTOMATED_EXECUTION_BANNER,
  AT_CONFIDENCE_LABEL,
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  normalizeAtOpenAiAnalysis,
  parseAtBinaryDirection,
  parseAtDirectionalConfidencePct,
  resolveAtForecastHorizon,
  resolveBinaryDirectionFromModel,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import type { AtRawCandle } from "../../../../ai/forex-ai/automated-trading/analysis/evidence.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function candles(n: number, base = 1.1): AtRawCandle[] {
  const out: AtRawCandle[] = [];
  const t0 = Math.floor(Date.now() / 1000) - n * 3600;
  for (let i = 0; i < n; i += 1) {
    const c = base + i * 0.0001;
    out.push({ time: t0 + i * 3600, open: c, high: c + 0.0005, low: c - 0.0005, close: c + 0.0002 });
  }
  return out;
}

function normalizeRaw(raw: Record<string, unknown>, extras?: Partial<Parameters<typeof normalizeAtOpenAiAnalysis>[0]>) {
  return normalizeAtOpenAiAnalysis({
    analysisId: "p532-1",
    raw: {
      directionalBias: "BULLISH",
      trendState: "UPTREND",
      trendStrength: "MODERATE",
      mtfAgreement: "AGREE_BULLISH",
      keyEvidence: ["Higher high on H1"],
      counterEvidence: ["H4 range"],
      structureNotes: ["H1 BOS up"],
      supportLevels: [{ price: 1.1002, timeframe: "1h", provenance: "swing low" }],
      resistanceLevels: [],
      scenarios: {
        bullish: { summary: "Continuation", supportingEvidence: ["HH"], confirmationConditions: ["break"], invalidationConditions: ["LL"] },
        bearish: { summary: "Reversal", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
      },
      dataQuality: "SUFFICIENT",
      limitations: ["No news"],
      explanation: "BUY lean from structure — not a trade order.",
      ...raw,
    },
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "EUR/USD",
    timeframes: ["1h", "4h"],
    primaryTimeframe: "1h",
    inputFingerprint: "fp-abc",
    modelRequested: "gpt-6-luna",
    modelUsed: "gpt-6-luna",
    modelVisionEligible: true,
    trigger: "manual",
    monitorConfigEpoch: null,
    chartImage: {
      available: true,
      imageHash: "imghash1",
      capturedAtUtc: new Date().toISOString(),
      source: "server-ohlc-render",
      note: "server chart",
      blocker: null,
      includedInOpenAiRequest: true,
    },
    candlesByTf: { "1h": candles(30), "4h": candles(25) },
    historicalOnly: false,
    createdAtUtc: new Date().toISOString(),
    latencyMs: 12,
    ...extras,
  });
}

describe("Phase 53.2 direction + confidence parsers", () => {
  it("accepts BUY and SELL only", () => {
    expect(parseAtBinaryDirection("BUY").ok).toBe(true);
    expect(parseAtBinaryDirection("SELL").ok).toBe(true);
    for (const bad of ["WAIT", "HOLD", "NEUTRAL", "BOTH", ""]) {
      const r = parseAtBinaryDirection(bad);
      expect(r.ok).toBe(false);
    }
  });

  it("rejects invalid confidence percentages", () => {
    expect(parseAtDirectionalConfidencePct(55).ok).toBe(true);
    expect(parseAtDirectionalConfidencePct(NaN).ok).toBe(false);
    expect(parseAtDirectionalConfidencePct(Infinity).ok).toBe(false);
    expect(parseAtDirectionalConfidencePct(-1).ok).toBe(false);
    expect(parseAtDirectionalConfidencePct(101).ok).toBe(false);
  });

  it("resolves forecast horizon from primary timeframe and rejects missing", () => {
    const ok = resolveAtForecastHorizon("15m");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.forecastHorizon).toMatch(/M15/);
      expect(ok.horizonMs).toBe(15 * 60_000);
    }
    expect(resolveAtForecastHorizon(null).ok).toBe(false);
    expect(resolveAtForecastHorizon("2h").ok).toBe(false);
  });

  it("rejects NEUTRAL bias without BUY/SELL direction", () => {
    const r = resolveBinaryDirectionFromModel({ directionalBias: "NEUTRAL" });
    expect(r.ok).toBe(false);
  });
});

describe("Phase 53.2 normalize binary contract", () => {
  it("accepts successful BUY with confidence", () => {
    const { result } = normalizeRaw({
      direction: "BUY",
      directionalConfidencePct: 68,
      directionalBias: "BULLISH",
    });
    expect(result.lifecycle).toBe("ANALYSIS_VALID");
    expect(result.direction).toBe("BUY");
    expect(result.directionalConfidencePct).toBe(68);
    expect(result.confidenceLabel).toBe(AT_CONFIDENCE_LABEL);
    expect(result.directionalConfidenceNote).toBe(AT_DIRECTIONAL_CONFIDENCE_NOTE);
    expect(result.forecastHorizon).toMatch(/H1/);
    expect(result.evidenceScoreIsWinProbability).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.chartImage?.includedInOpenAiRequest).toBe(true);
  });

  it("accepts successful SELL with confidence", () => {
    const { result } = normalizeRaw({
      direction: "SELL",
      directionalConfidencePct: 72.5,
      directionalBias: "BEARISH",
      trendState: "DOWNTREND",
      keyEvidence: ["Lower high"],
      structureNotes: ["CHoCH down"],
    });
    expect(result.lifecycle).toBe("ANALYSIS_VALID");
    expect(result.direction).toBe("SELL");
    expect(result.directionalBias).toBe("BEARISH");
    expect(result.directionalConfidencePct).toBe(72.5);
  });

  it("rejects WAIT/HOLD/NEUTRAL as successful directions", () => {
    for (const d of ["WAIT", "HOLD", "NEUTRAL"]) {
      const { result } = normalizeRaw({ direction: d, directionalConfidencePct: 60 });
      expect(result.lifecycle).toBe("ANALYSIS_INVALID");
      expect(result.direction).toBeNull();
      expect(result.blockers.some((b) => b.code === "DIRECTION_REJECTED")).toBe(true);
    }
  });

  it("rejects out-of-range confidence and does not keep a fabricated BUY", () => {
    const { result } = normalizeRaw({ direction: "BUY", directionalConfidencePct: 150 });
    expect(result.lifecycle).toBe("ANALYSIS_INVALID");
    expect(result.direction).toBeNull();
    expect(result.directionalConfidencePct).toBeNull();
  });

  it("marks insufficient data without inventing BUY/SELL", () => {
    const { result } = normalizeRaw(
      {
        direction: "WAIT",
        directionalConfidencePct: 10,
        dataQuality: "INSUFFICIENT",
        keyEvidence: [],
        structureNotes: [],
      },
    );
    expect(result.lifecycle).toBe("DATA_INSUFFICIENT");
    expect(result.direction).toBeNull();
  });

  it("requires forecast horizon (invalid primary timeframe)", () => {
    const { result } = normalizeRaw(
      { direction: "BUY", directionalConfidencePct: 55 },
      { primaryTimeframe: "2h", timeframes: ["2h"] },
    );
    expect(result.lifecycle).toBe("ANALYSIS_INVALID");
    expect(result.blockers.some((b) => b.code === "MISSING_FORECAST_HORIZON")).toBe(true);
    expect(result.direction).toBeNull();
  });

  it("records image unavailable distinctly from included", () => {
    const { result } = normalizeRaw(
      { direction: "BUY", directionalConfidencePct: 50 },
      {
        chartImage: {
          available: false,
          imageHash: null,
          capturedAtUtc: null,
          source: "none",
          note: "Chart unavailable",
          blocker: "CHART_RENDER_INSUFFICIENT",
          includedInOpenAiRequest: false,
        },
      },
    );
    expect(result.chartImage?.available).toBe(false);
    expect(result.chartImage?.includedInOpenAiRequest).toBe(false);
    expect(result.direction).toBe("BUY");
  });
});

describe("Phase 53.2 static contracts", () => {
  it("UI and API keep execution forbidden and show binary direction", () => {
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/PHASE 53(\.\d+)?/);
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("data-fx-at-binary-direction");
    expect(page).toContain("Estimated directional confidence — NOT CALIBRATED");
    expect(page).toContain("NOT CALIBRATED");
    expect(page).not.toMatch(/Place order|Submit order|Auto-enter/i);

    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    const prompts = read("ai/forex-ai/automated-trading/analysis/prompts.ts");
    expect(prompts).toContain("BUY or SELL");
    expect(prompts).toContain("WAIT, HOLD, NEUTRAL");
  });
});
