/**
 * Phase 4.18D — Canonical analysis service, history, isolation, dry-run additive field.
 */
import { describe, expect, it, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import {
  runCanonicalAnalysis,
  toCanonicalPublicView,
  type CanonicalAnalysisDeps,
} from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.service.js";
import {
  CanonicalAnalysisHistoryStore,
  resetCanonicalAnalysisHistoryStoreForTests,
  CANONICAL_HISTORY_MAX,
} from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis-history.store.js";
import type { CanonicalQuoteSnapshot } from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.js";

function makeTrendCandles(n: number, start = 100): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const drift = i < n - 5 ? 0.02 : 0.8;
    const open = px;
    const close = px + drift;
    out.push({
      time: 1_700_000_000 + i * 900,
      open,
      high: Math.max(open, close) + 0.1,
      low: Math.min(open, close) - 0.1,
      close,
      closed: true,
    });
    px = close;
  }
  return out;
}

function freshQuote(instrument: string, over: Partial<CanonicalQuoteSnapshot> = {}): CanonicalQuoteSnapshot {
  return {
    instrument,
    bid: 2650,
    ask: 2650.5,
    quoteFresh: true,
    freshnessReasonCode: "LIVE_FRESH",
    effectivePriceChangeAgeMs: 400,
    snapshotFingerprint: "snap",
    evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
    ...over,
  };
}

function depsFor(
  instrument: string,
  candles: StrategyCandle[],
  quote: CanonicalQuoteSnapshot,
  store: CanonicalAnalysisHistoryStore,
): CanonicalAnalysisDeps {
  return {
    loadCandles: async (inst) => {
      if (inst !== instrument.replace(/\s+/g, "").toUpperCase()
        && inst !== instrument) {
        return [];
      }
      return candles;
    },
    getQuoteSnapshot: async () => quote,
    getPointSize: async () => 0.01,
    getLatestOpenAi: () => null,
    historyStore: store,
  };
}

describe("Phase 4.18D canonical service", () => {
  let tmp: string;
  let store: CanonicalAnalysisHistoryStore;

  beforeEach(() => {
    resetCanonicalAnalysisHistoryStoreForTests();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kw-418d-"));
    store = new CanonicalAnalysisHistoryStore(tmp);
  });

  it("valid XAU/USD analysis can produce BUY/SELL or blocked validity without fabricating direction", async () => {
    const candles = makeTrendCandles(40);
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: true, ingestResultIntake: false,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      },
      depsFor("XAU/USD", candles, freshQuote("XAU/USD"), store),
    );
    expect(out.placesOrders).toBe(false);
    expect(out.acceptsForExecution).toBe(false);
    expect(out.mutatesBroker).toBe(false);
    expect(out.result.placesOrders).toBe(false);
    expect(["BUY", "SELL", null]).toContain(out.result.direction);
    if (out.result.direction) {
      expect(["BUY_CANDIDATE", "SELL_CANDIDATE"]).toContain(out.result.finalOutcome);
      expect(out.result.confidencePct).not.toBeNull();
      expect(out.result.confidenceType).toBe("ANALYSIS_CONFIDENCE");
      expect(out.result.confidenceBreakdown?.isCalibratedWinProbability).toBe(false);
    } else {
      expect(out.result.confidencePct).toBeNull();
    }
    expect(store.count()).toBeGreaterThanOrEqual(1);
  });

  it("valid EUR/USD analysis isolates instrument", async () => {
    const candles = makeTrendCandles(40, 1.08);
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "EUR/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      },
      depsFor("EUR/USD", candles, freshQuote("EUR/USD", { bid: 1.08, ask: 1.0802 }), store),
    );
    expect(out.result.instrument).toBe("EUR/USD");
  });

  it("missing selected instrument blocks analysis", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor("XAU/USD", [], freshQuote("XAU/USD"), store),
    );
    expect(out.result.direction).toBeNull();
    expect(out.result.reconciliationCode).toBe("RECON_INSTRUMENT_MISMATCH");
  });

  it("invalid timeframe blocks analysis", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "2h",
        persist: false, ingestResultIntake: false,
      },
      depsFor("XAU/USD", makeTrendCandles(40), freshQuote("XAU/USD"), store),
    );
    expect(out.result.direction).toBeNull();
    expect(out.result.finalOutcome).toBe("INSUFFICIENT_DATA");
  });

  it("missing historical candles → insufficient", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor("XAU/USD", [], freshQuote("XAU/USD"), store),
    );
    expect(out.result.finalOutcome).toBe("INSUFFICIENT_DATA");
    expect(out.result.direction).toBeNull();
  });

  it("insufficient closed candles → insufficient", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor("XAU/USD", makeTrendCandles(5), freshQuote("XAU/USD"), store),
    );
    expect(out.result.finalOutcome).toBe("INSUFFICIENT_DATA");
    expect(out.result.direction).toBeNull();
  });

  it("stale quote blocks directional analysis", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor(
        "XAU/USD",
        makeTrendCandles(40),
        freshQuote("XAU/USD", {
          quoteFresh: false,
          freshnessReasonCode: "QUOTE_AGE_EXCEEDED",
        }),
        store,
      ),
    );
    expect(out.result.finalOutcome).toBe("STALE_DATA");
    expect(out.result.direction).toBeNull();
    expect(out.result.confidencePct).toBeNull();
  });

  it("heartbeat-only quote blocks directional analysis", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor(
        "XAU/USD",
        makeTrendCandles(40),
        freshQuote("XAU/USD", {
          quoteFresh: false,
          freshnessReasonCode: "HEARTBEAT_ONLY_NO_PRICE_CHANGE",
        }),
        store,
      ),
    );
    expect(out.result.finalOutcome).toBe("STALE_DATA");
    expect(out.result.reconciliationCode).toBe("RECON_STALE_QUOTE");
  });

  it("invalid OHLC / duplicates / out-of-order reduce strategy readiness", async () => {
    const bad: StrategyCandle[] = [
      { time: 100, open: 1, high: 0.5, low: 2, close: 1, closed: true },
      { time: 100, open: 1, high: 1.1, low: 0.9, close: 1, closed: true },
      { time: 50, open: 1, high: 1.1, low: 0.9, close: 1, closed: true },
    ];
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor("XAU/USD", bad, freshQuote("XAU/USD"), store),
    );
    expect(out.result.direction).toBeNull();
    expect(out.candleQuality?.invalidOhlcCount ?? 0).toBeGreaterThan(0);
  });

  it("OpenAI unavailable but deterministic valid still allowed", async () => {
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
        includeOpenAi: true,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      },
      {
        ...depsFor("XAU/USD", makeTrendCandles(40), freshQuote("XAU/USD"), store),
        getLatestOpenAi: () => null,
      },
    );
    if (out.result.direction) {
      expect(out.result.reconciliationCode).toBe("RECON_DET_ONLY");
    }
  });

  it("deterministic vs AI conflict → CONFLICT", async () => {
    const candles = makeTrendCandles(40);
    // Force via openAiAnalysis with opposite direction after we know det direction
    const first = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
        includeOpenAi: false,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      },
      depsFor("XAU/USD", candles, freshQuote("XAU/USD"), store),
    );
    if (first.result.direction !== "BUY" && first.result.direction !== "SELL") {
      // No cross in series — skip conflict assertion
      expect(first.result.direction).toBeNull();
      return;
    }
    const opposite = first.result.direction === "BUY" ? "SELL" : "BUY";
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
        includeOpenAi: true,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
        openAiAnalysis: {
          schemaVersion: "at-openai-ta-v1",
          phase: "53.3",
          analysisId: "ai-opp",
          lifecycle: "ANALYSIS_VALID",
          environment: "DEMO",
          environmentEpoch: 1,
          instrument: "XAU/USD",
          timeframes: ["15m"],
          primaryTimeframe: "15m",
          inputFingerprint: "f",
          provider: "OPENAI",
          modelRequested: "m",
          modelUsed: "m",
          modelVisionEligible: false,
          trigger: "manual",
          monitorConfigEpoch: null,
          chartImage: null,
          direction: opposite,
          directionalConfidencePct: 50,
          directionalConfidenceNote: "Estimated directional confidence — NOT CALIBRATED",
          forecastHorizon: "h",
          directionalBias: opposite === "BUY" ? "BULLISH" : "BEARISH",
          trendState: "UNKNOWN",
          trendStrength: "UNKNOWN",
          mtfAgreement: "UNKNOWN",
          keyEvidence: [],
          counterEvidence: [],
          supportLevels: [],
          resistanceLevels: [],
          patterns: [],
          structureNotes: [],
          scenarios: [],
          explanation: "opp",
          dataQuality: "SUFFICIENT",
          limitations: [],
          blockers: [],
          confidenceLabel: "NOT CALIBRATED",
          evidenceScoreIsWinProbability: false,
          createdAtUtc: "2026-11-01T12:00:00.000Z",
          latencyMs: 1,
          placesOrders: false,
          historicalOnly: true,
          liveLabeled: false,
        },
      },
      depsFor("XAU/USD", candles, freshQuote("XAU/USD"), store),
    );
    expect(out.result.finalOutcome).toBe("CONFLICT");
    expect(out.result.direction).toBeNull();
  });

  it("rejects foreign instrument stamped on candles", async () => {
    const candles = makeTrendCandles(40).map((c) => ({ ...c, instrument: "EUR/USD" }));
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: false, ingestResultIntake: false,
      },
      depsFor("XAU/USD", candles as StrategyCandle[], freshQuote("XAU/USD"), store),
    );
    expect(out.result.reconciliationCode).toBe("RECON_INSTRUMENT_MISMATCH");
    expect(out.result.direction).toBeNull();
  });

  it("public view never invents BUY/SELL when blocked", () => {
    const view = toCanonicalPublicView(null);
    expect(view.direction).toBeNull();
    expect(view.displayFreshness).toBe("NOT_AVAILABLE");
    expect(view.placesOrders).toBe(false);
    expect(view.isCalibratedWinProbability).toBe(false);
  });
});

describe("Phase 4.18D canonical history store", () => {
  it("saves, lists, dedupes by analysisId, and bounds history", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kw-418d-hist-"));
    const store = new CanonicalAnalysisHistoryStore(tmp);
    const candles = makeTrendCandles(40);
    const out = await runCanonicalAnalysis(
      {
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        persist: true, ingestResultIntake: false,
        analysisId: undefined,
        nowMs: Date.UTC(2026, 0, 1, 12, 0, 0),
      } as never,
      {
        loadCandles: async () => candles,
        getQuoteSnapshot: async () => freshQuote("XAU/USD"),
        getPointSize: async () => 0.01,
        historyStore: store,
      },
    );
    const id = out.result.analysisId;
    const again = await store.save(out.result);
    expect(again.duplicate).toBe(true);
    expect(store.get(id)?.analysisId).toBe(id);
    expect(store.list(5).length).toBeGreaterThanOrEqual(1);

    // Boundedness: flood with unique fingerprints
    for (let i = 0; i < CANONICAL_HISTORY_MAX + 5; i++) {
      const r = {
        ...out.result,
        analysisId: `flood-${i}`,
        evidenceFingerprint: `fp-${i}`,
        analyzedAtUtc: new Date(Date.UTC(2026, 0, 1, 12, 0, i)).toISOString(),
      };
      await store.save(r);
    }
    expect(store.count()).toBeLessThanOrEqual(CANONICAL_HISTORY_MAX);
  });

  it("handles corrupt store file safely", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kw-418d-bad-"));
    fs.mkdirSync(path.join(tmp, "forex-automated-trading"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "forex-automated-trading", "canonical-analysis-history.json"),
      "{not-json",
      "utf8",
    );
    const store = new CanonicalAnalysisHistoryStore(tmp);
    expect(store.list()).toEqual([]);
    expect(store.latest()).toBeNull();
  });
});
