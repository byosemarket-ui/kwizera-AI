/**
 * Phase 53 — Independent AT OpenAI technical analysis (no broker orders, no Local AI fallback).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  AtOpenAiAnalysisEngine,
  AT_CONFIDENCE_LABEL,
  AUTOMATED_EXECUTION_BANNER,
  buildEvidenceBundle,
  normalizeAtOpenAiAnalysis,
  validatePriceLevel,
  resetAtOpenAiAnalysisEngineForTests,
  resetAtOpenAiAnalysisStoreForTests,
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

describe("Phase 53 evidence & validation", () => {
  it("builds fingerprint and labels historical-only when quote not fresh", () => {
    const built = buildEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      candlesByTf: { H1: candles(30), H4: candles(25) },
      verification: null,
    });
    expect(built.ok).toBe(true);
    if (!built.ok || !built.evidence) return;
    expect(built.evidence.historicalOnly).toBe(true);
    expect(built.evidence.fingerprint.length).toBeGreaterThan(8);
    expect(built.evidence.warnings.some((w) => /historical/i.test(w))).toBe(true);
  });

  it("rejects insufficient candle history", () => {
    const built = buildEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      candlesByTf: { H1: candles(5) },
      verification: null,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe("DATA_INSUFFICIENT");
  });

  it("rejects fabricated price levels outside snapshot", () => {
    const prices = [1.1, 1.11, 1.12];
    const bad = validatePriceLevel({ price: 9.99, provenance: "invented" }, prices, 0.01);
    expect(bad.verifiedAgainstSnapshot).toBe(false);
    expect(bad.price).toBeNull();
    const good = validatePriceLevel({ price: 1.11, provenance: "H1 swing" }, prices, 0.01);
    expect(good.verifiedAgainstSnapshot).toBe(true);
  });

  it("normalizes model output with NOT CALIBRATED confidence", () => {
    const { result } = normalizeAtOpenAiAnalysis({
      analysisId: "a1",
      raw: {
        direction: "BUY",
        directionalConfidencePct: 61,
        directionalBias: "BULLISH",
        trendState: "UPTREND",
        trendStrength: "MODERATE",
        mtfAgreement: "CONFLICT",
        keyEvidence: ["Higher highs on H1"],
        counterEvidence: ["H4 still range"],
        structureNotes: ["H1 BOS"],
        supportLevels: [{ price: 1.1002, timeframe: "H1", provenance: "swing low" }],
        resistanceLevels: [{ price: 99, timeframe: "H1", provenance: "fabricated" }],
        scenarios: {
          bullish: { summary: "Continuation", supportingEvidence: ["HH"], confirmationConditions: ["break"], invalidationConditions: ["LL"] },
          bearish: { summary: "Reversal", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
        },
        dataQuality: "SUFFICIENT",
        limitations: ["No news"],
        explanation: "Bias lean only — not a trade order.",
      },
      environment: "DEMO",
      environmentEpoch: 2,
      instrument: "EUR/USD",
      timeframes: ["1h", "4h"],
      primaryTimeframe: "1h",
      inputFingerprint: "abc",
      modelRequested: "gpt-4o-mini",
      modelUsed: "gpt-4o-mini",
      candlesByTf: { "1h": candles(30), "4h": candles(25) },
      historicalOnly: true,
      createdAtUtc: new Date().toISOString(),
      latencyMs: 12,
    });
    expect(result.confidenceLabel).toBe(AT_CONFIDENCE_LABEL);
    expect(result.direction).toBe("BUY");
    expect(result.directionalConfidencePct).toBe(61);
    expect(result.evidenceScoreIsWinProbability).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.liveLabeled).toBe(false);
    expect(result.provider).toBe("OPENAI");
    expect(result.dataQuality).toBe("HISTORICAL_ONLY");
    expect(result.resistanceLevels[0]?.verifiedAgainstSnapshot).toBe(false);
    expect(result.supportLevels.some((l) => l.verifiedAgainstSnapshot)).toBe(true);
  });

  it("forces UNKNOWN trend when structure evidence is empty", () => {
    const { result } = normalizeAtOpenAiAnalysis({
      analysisId: "a2",
      raw: {
        direction: "BUY",
        directionalConfidencePct: 40,
        directionalBias: "BULLISH",
        trendState: "UPTREND",
        keyEvidence: [],
      },
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      timeframes: ["1h"],
      primaryTimeframe: "1h",
      inputFingerprint: "x",
      modelRequested: "gpt-4o-mini",
      modelUsed: "gpt-4o-mini",
      candlesByTf: { "1h": candles(30) },
      historicalOnly: true,
      createdAtUtc: new Date().toISOString(),
      latencyMs: 1,
    });
    expect(result.trendState).toBe("UNKNOWN");
  });
});

describe("Phase 53 engine configuration & isolation", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p53-"));
    resetAtOpenAiAnalysisStoreForTests();
    resetAtOpenAiAnalysisEngineForTests();
  });

  afterEach(() => {
    resetAtOpenAiAnalysisEngineForTests();
    resetAtOpenAiAnalysisStoreForTests();
  });

  it("fails closed when OpenAI is not configured and never mentions Ollama", async () => {
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: {
        getPublicStatus: async () => ({
          configured: false,
          vaultUnlocked: false,
          model: "gpt-4o-mini",
          modelEligible: true,
          updatedAt: null,
          lastValidatedAt: null,
          lastValidationStatus: "never",
          verificationDisplay: "NOT_VERIFIED",
          lastVerificationNote: null,
          modelsDiscoveredAt: null,
          eligibleModelCount: null,
          note: "test",
        }),
        getApiKey: async () => null,
      } as never,
      loadCandles: async () => candles(40),
    });
    const res = await engine.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      verification: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("OPENAI_NOT_CONFIGURED");
    expect(res.message.toLowerCase()).not.toContain("ollama");
    expect(res.message.toLowerCase()).not.toContain("local ai");
  });

  it("runs OpenAI path with injected chat and stores independent history", async () => {
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          vaultUnlocked: true,
          model: "gpt-4o-mini",
          modelEligible: true,
          updatedAt: null,
          lastValidatedAt: null,
          lastValidationStatus: "ok",
          verificationDisplay: "VERIFIED",
          lastVerificationNote: null,
          modelsDiscoveredAt: null,
          eligibleModelCount: 1,
          note: "test",
        }),
        getApiKey: async () => "sk-test-key-not-real-xxxxxxxxxxxx",
      } as never,
      loadCandles: async () => candles(40),
      chat: async () => ({
        ok: true,
        code: "OK",
        model: "gpt-4o-mini-2024",
        latencyMs: 5,
        data: {
          direction: "BUY",
          directionalConfidencePct: 58,
          directionalBias: "BULLISH",
          trendState: "RANGE",
          trendStrength: "WEAK",
          mtfAgreement: "INSUFFICIENT",
          keyEvidence: ["Range mid bias up"],
          counterEvidence: [],
          structureNotes: ["No clear BOS"],
          supportLevels: [],
          resistanceLevels: [],
          scenarios: {
            bullish: { summary: "Break up", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
            bearish: { summary: "Break down", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
          },
          dataQuality: "PARTIAL",
          limitations: ["Weekend"],
          explanation: "BUY lean within range — not an order.",
        },
      }),
    });
    const res = await engine.analyze({
      environment: "DEMO",
      environmentEpoch: 4,
      instrument: "EUR/USD",
      timeframes: ["1h"],
      verification: null,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.analysis.modelUsed).toBe("gpt-4o-mini-2024");
    expect(res.analysis.environmentEpoch).toBe(4);
    expect(res.analysis.direction).toBe("BUY");
    expect(res.analysis.directionalConfidencePct).toBe(58);
    expect(engine.listHistory(5)).toHaveLength(1);
    expect(engine.getLatest()?.analysisId).toBe(res.analysis.analysisId);
  });

  it("protects against duplicate in-flight analysis", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          vaultUnlocked: true,
          model: "gpt-4o-mini",
          modelEligible: true,
          updatedAt: null,
          lastValidatedAt: null,
          lastValidationStatus: "ok",
          verificationDisplay: "VERIFIED",
          lastVerificationNote: null,
          modelsDiscoveredAt: null,
          eligibleModelCount: 1,
          note: "test",
        }),
        getApiKey: async () => "sk-test-key-not-real-xxxxxxxxxxxx",
      } as never,
      loadCandles: async () => candles(40),
      chat: async () => {
        await gate;
        return {
          ok: true,
          code: "OK" as const,
          model: "gpt-4o-mini",
          latencyMs: 1,
          data: {
            direction: "SELL",
            directionalConfidencePct: 51,
            directionalBias: "BEARISH",
            trendState: "UNKNOWN",
            keyEvidence: ["x"],
            structureNotes: ["y"],
          },
        };
      },
    });
    const p1 = engine.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      verification: null,
    });
    await new Promise((r) => setTimeout(r, 20));
    const p2 = await engine.analyze({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      verification: null,
    });
    expect(p2.ok).toBe(false);
    if (!p2.ok) expect(p2.code).toBe("ANALYSIS_IN_FLIGHT");
    release();
    await p1;
  });
});

describe("Phase 53 static contracts", () => {
  it("registers OpenAI AT endpoints and keeps execution forbidden", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/openai/analyze");
    expect(api).toContain("/api/forex/automated-trading/openai/status");
    expect(api).toContain("/api/forex/automated-trading/openai/history");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("data-fx-at-openai-ta");
    expect(page).toContain("Run Analysis Now");
    expect(page).toContain("NOT CALIBRATED");
    expect(page).not.toMatch(/localStorage\.setItem\([^)]*openai|sk-/i);

    const engine = read("ai/forex-ai/automated-trading/analysis/engine.ts");
    expect(engine).toContain("No Local AI fallback");
    expect(engine).not.toMatch(/getLocalAi|from ["'].*ollama/i);
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/PHASE 5[34](\.\d+)?/);

    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/ai-analysis");
    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/charts");
    expect(read("ai/forex-ai/automated-trading/verification-engine.ts")).toContain("assembleVerificationResult");
  });
});
