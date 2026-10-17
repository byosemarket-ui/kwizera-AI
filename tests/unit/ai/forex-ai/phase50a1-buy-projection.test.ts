/**
 * Phase 50A.1 — Bullish price projection + chart boundary contracts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BULLISH_PROJECTION_METHOD,
  BULLISH_PROJECTION_TITLE,
  buildBullishPriceProjection,
  cloneCandles,
  extractPriceCandidates,
  parseModelBullishProjectionHint,
  priceWithinScale,
  validateCaptureInstrumentConsistency,
  buildMtfRoster,
  parseMtfReasoningFromModel,
} from "../../../../ai/forex-ai/multi-image-openai/index.ts";
import type { MultiImageCaptureRef } from "../../../../ai/forex-ai/multi-image-openai/types.ts";
import type { LocalSnapshotEvidencePackage } from "../../../../ai/forex-ai/snapshot-local/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function ref(partial: Partial<MultiImageCaptureRef> & { captureId: string; timeframe: string }): MultiImageCaptureRef {
  return {
    capturedAtUtc: "2026-10-17T11:00:00.000Z",
    capturedAtLocal: "local",
    mode: "MANUAL",
    instrument: { symbol: "XAU/USD", displaySymbol: "XAU/USD", provider: "FOREXCONNECT" },
    quote: {
      bid: 4168.3,
      ask: null,
      mid: null,
      lastPrice: 4168.3,
      feedHealth: "LIVE",
      lastGenuinePriceChangeAt: null,
      lastGenuinePriceChangeAgeMs: null,
    },
    candleWindow: {
      closedCount: 200,
      formingCount: 1,
      totalCount: 201,
      firstOpenTimeSec: 1,
      lastOpenTimeSec: 200,
    },
    marketSnapshot: { snapshotId: null, contentFingerprint: null },
    image: { mimeType: "image/png", width: 100, height: 50, byteLength: 1000 },
    hasImage: true,
    ...partial,
  };
}

function makeEvidence(candles: Array<{ t: number; o: number; h: number; l: number; c: number }>): LocalSnapshotEvidencePackage {
  return {
    schemaVersion: "forex-local-snapshot-evidence-v1",
    snapshotId: "snap-test",
    contentFingerprint: "fp-test",
    provider: "FOREXCONNECT",
    instrument: {
      providerSymbol: "XAU/USD",
      displaySymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
    },
    candleTimeframe: "15m",
    analysisPeriod: "6h",
    requestedRange: { startUtc: "2026-10-17T00:00:00.000Z", endUtc: "2026-10-17T12:00:00.000Z" },
    returnedRange: { startUtc: "2026-10-17T00:00:00.000Z", endUtc: "2026-10-17T12:00:00.000Z" },
    priceBasis: "mid",
    environment: "test",
    quoteFreshness: "LIVE",
    marketStatus: "LIVE",
    candleCount: candles.length,
    candlesRequestedEstimate: candles.length,
    candles: candles.map((c) => ({ ...c, v: null, closed: true })),
    dataGaps: [],
    warnings: [],
    validationStatus: "VALID",
    evidenceReady: true,
    detectorSummary: "fixture",
    categories: {
      snapshotMeta: true,
      candles: true,
      quote: true,
      validation: true,
      patterns: false,
      structure: false,
      knowledge: false,
      unavailable: [],
    },
  };
}

describe("Phase 50A.1 price extraction / scale", () => {
  it("extracts prices and rejects off-scale targets", () => {
    expect(extractPriceCandidates("hold above 4156–4160 toward 4172-4180")).toEqual(
      expect.arrayContaining([4156, 4160, 4172, 4180]),
    );
    expect(priceWithinScale(4180, 4168, [])).toBe(true);
    expect(priceWithinScale(9000, 4168, [])).toBe(false);
  });
});

describe("Phase 50A.1 bullish projection builder", () => {
  it("builds a valid bullish projection from structured evidence without mutating candles", () => {
    const captures = [
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "15m" }),
    ];
    const roster = buildMtfRoster(captures);
    const mtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "ALIGNED",
        bullishScenario: "VISIBLE_IN_IMAGE: continuation toward 4180",
        keyLevels: [
          { level: "4156", provenance: "CONFIRMED_BY_DATA", captureId: "a", timeframe: "5m" },
          { level: "4180", provenance: "CONFIRMED_BY_DATA", captureId: "b", timeframe: "15m" },
          { level: "4195", provenance: "VISIBLE_IN_IMAGE", captureId: "b", timeframe: "15m" },
        ],
        invalidationConditions: ["Break below 4156"],
      },
    }, roster);

    const base = 1000;
    const candles = Array.from({ length: 20 }, (_, i) => ({
      t: base + i * 900,
      o: 4160 + i * 0.2,
      h: 4162 + i * 0.2,
      l: 4158 + i * 0.2,
      c: 4161 + i * 0.2,
    }));
    const before = cloneCandles(candles.map((c) => ({ ...c })));
    const evidence = makeEvidence(candles);

    const hint = parseModelBullishProjectionHint({
      bullishProjection: {
        targetZoneLow: 4180,
        targetZoneHigh: 4195,
        invalidationPrice: 4156,
        forecastHorizon: "8 × 15m scenario bars",
        evidence: ["CONFIRMED_BY_DATA resistance cluster"],
      },
    });

    const proj = buildBullishPriceProjection({
      decision: "BUY",
      marketBias: "BULLISH",
      directionalConfidencePercent: 71,
      supportsBuyHypothesis: true,
      mtf,
      captures,
      provenance: {
        captureTime: { note: "cap", captures },
        analysisTime: {
          note: "at",
          snapshotId: "snap-test",
          contentFingerprint: "fp",
          quoteFreshness: "LIVE",
          feedHealth: "LIVE",
          bid: 4168.3,
          ask: null,
          lastPrice: 4168.3,
          observedAtUtc: new Date().toISOString(),
          provider: "FOREXCONNECT",
          symbol: "XAU/USD",
        },
        onlineResearch: { included: false, note: "none" },
      },
      evidence,
      modelHint: hint,
      dataQuality: "adequate",
      bullishScenario: mtf.bullishScenario ?? "",
      bearishScenario: "",
      invalidationConditions: mtf.invalidationConditions,
      keyEvidence: ["CONFIRMED_BY_DATA: bid 4168.3"],
    });

    expect(proj.available).toBe(true);
    expect(proj.title).toBe(BULLISH_PROJECTION_TITLE);
    expect(proj.method).toBe(BULLISH_PROJECTION_METHOD);
    expect(proj.instrument).toBe("XAU/USD");
    expect(proj.provider).toBe("FOREXCONNECT");
    expect(proj.timeframe).toBe("15m");
    expect(proj.reference.price).toBe(4168.3);
    expect(proj.target?.zoneLow).toBe(4180);
    expect(proj.target?.zoneHigh).toBe(4195);
    expect(proj.projectedMovement?.absolute).toBeGreaterThan(0);
    expect(proj.invalidation?.price).toBe(4156);
    expect(proj.dataStatus).toBe("LIVE");
    expect(proj.targetProbabilityNote).toMatch(/not the probability/i);
    expect(proj.directionalConfidencePercent).toBe(71);
    expect(proj.chart).not.toBeNull();
    expect(proj.chart!.historical).toHaveLength(20);
    expect(proj.chart!.projected?.length).toBeGreaterThan(1);
    expect(proj.chart!.boundaryIndex).toBe(19);
    expect(proj.chart!.targetZone).toEqual({ low: 4180, high: 4195 });
    expect(proj.chart!.invalidationLine).toBe(4156);
    // Historical candles unchanged vs input
    expect(proj.chart!.historical).toEqual(before);
    expect(evidence.candles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }))).toEqual(before);
  });

  it("does not fabricate a target when evidence is insufficient", () => {
    const captures = [ref({ captureId: "a", timeframe: "5m", quote: {
      bid: null, ask: null, mid: null, lastPrice: null,
      feedHealth: "MARKET_INACTIVE",
      lastGenuinePriceChangeAt: null,
      lastGenuinePriceChangeAgeMs: null,
    } })];
    const roster = buildMtfRoster(captures);
    const mtf = parseMtfReasoningFromModel({
      mtfReasoning: { timeframeAgreement: "INSUFFICIENT", keyLevels: [], missingEvidence: ["no levels"] },
    }, roster);

    const proj = buildBullishPriceProjection({
      decision: "WAIT",
      marketBias: "UNCERTAIN",
      directionalConfidencePercent: 40,
      supportsBuyHypothesis: false,
      mtf,
      captures,
      provenance: {
        captureTime: { note: "cap", captures },
        analysisTime: {
          note: "at",
          snapshotId: null,
          contentFingerprint: null,
          quoteFreshness: null,
          feedHealth: null,
          bid: null,
          ask: null,
          lastPrice: null,
          observedAtUtc: null,
          provider: null,
          symbol: null,
        },
        onlineResearch: { included: false, note: "none" },
      },
      evidence: null,
      modelHint: parseModelBullishProjectionHint(null),
      dataQuality: "poor",
      bullishScenario: "",
      bearishScenario: "",
      invalidationConditions: [],
      keyEvidence: [],
    });

    expect(proj.available).toBe(false);
    expect(proj.target).toBeNull();
    expect(proj.projectedMovement).toBeNull();
    expect(proj.unavailableReason).toMatch(/BUY-side|hypothesis|reference|target/i);
  });

  it("rejects mismatched screenshots and labels historical-only honestly", () => {
    const mixed = validateCaptureInstrumentConsistency([
      ref({ captureId: "a", timeframe: "5m" }),
      ref({
        captureId: "b",
        timeframe: "15m",
        instrument: { symbol: "ADA/USDC", displaySymbol: "ADA/USDC", provider: "BINANCE" },
      }),
    ]);
    expect(mixed.ok).toBe(false);
    expect(mixed.code).toBe("INSTRUMENT_MISMATCH");

    const captures = [ref({ captureId: "a", timeframe: "15m" })];
    const roster = buildMtfRoster(captures);
    const mtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "SINGLE_TIMEFRAME",
        keyLevels: [
          { level: "4180", provenance: "CONFIRMED_BY_DATA", captureId: "a", timeframe: "15m" },
          { level: "4150", provenance: "CONFIRMED_BY_DATA", captureId: "a", timeframe: "15m" },
        ],
      },
    }, roster);
    const candles = Array.from({ length: 10 }, (_, i) => ({
      t: 1000 + i * 900,
      o: 4160,
      h: 4165,
      l: 4155,
      c: 4162,
    }));
    const proj = buildBullishPriceProjection({
      decision: "BUY",
      marketBias: "BULLISH",
      directionalConfidencePercent: 60,
      supportsBuyHypothesis: true,
      mtf,
      captures,
      provenance: {
        captureTime: { note: "cap", captures },
        analysisTime: {
          note: "historical only",
          snapshotId: "snap",
          contentFingerprint: "fp",
          quoteFreshness: "HISTORICAL_ONLY",
          feedHealth: "HISTORICAL_ONLY",
          bid: 4162,
          ask: null,
          lastPrice: 4162,
          observedAtUtc: "2026-10-17T10:00:00.000Z",
          provider: "FOREXCONNECT",
          symbol: "XAU/USD",
        },
        onlineResearch: { included: false, note: "none" },
      },
      evidence: makeEvidence(candles),
      modelHint: parseModelBullishProjectionHint({}),
      dataQuality: "historical",
      bullishScenario: "bullish",
      bearishScenario: "",
      invalidationConditions: [],
      keyEvidence: [],
    });
    expect(proj.dataStatus).toBe("HISTORICAL_ONLY");
    expect(proj.limitations.join(" ")).toMatch(/HISTORICAL_ONLY|not.*live entry/i);
  });

  it("does not label stale capture feeds as LIVE even when snapshot quote says LIVE", () => {
    const captures = [
      ref({
        captureId: "a",
        timeframe: "15m",
        quote: {
          bid: 4162,
          ask: null,
          mid: null,
          lastPrice: 4162,
          feedHealth: "NO_RECENT_MARKET_UPDATES",
          lastGenuinePriceChangeAt: null,
          lastGenuinePriceChangeAgeMs: null,
        },
      }),
    ];
    const roster = buildMtfRoster(captures);
    const mtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "ALIGNED",
        keyLevels: [
          { level: "4180", provenance: "CONFIRMED_BY_DATA", captureId: "a", timeframe: "15m" },
          { level: "4150", provenance: "CONFIRMED_BY_DATA", captureId: "a", timeframe: "15m" },
        ],
        bullishScenario: "VISIBLE_IN_IMAGE: bullish continuation",
      },
    }, roster);
    const candles = Array.from({ length: 12 }, (_, i) => ({
      t: 1_700_000_000 + i * 900,
      o: 4160,
      h: 4165,
      l: 4155,
      c: 4162,
    }));
    const proj = buildBullishPriceProjection({
      decision: "BUY",
      marketBias: "BULLISH",
      directionalConfidencePercent: 65,
      supportsBuyHypothesis: true,
      mtf,
      captures,
      provenance: {
        captureTime: { note: "cap", captures },
        analysisTime: {
          note: "stale snapshot still labeled LIVE at creation",
          snapshotId: "snap",
          contentFingerprint: "fp",
          quoteFreshness: "LIVE",
          feedHealth: "LIVE",
          bid: 4162,
          ask: null,
          lastPrice: 4162,
          observedAtUtc: "2026-10-16T15:36:17.000Z",
          provider: "FOREXCONNECT",
          symbol: "XAU/USD",
        },
        onlineResearch: { included: false, note: "none" },
      },
      evidence: makeEvidence(candles),
      modelHint: parseModelBullishProjectionHint({}),
      dataQuality: "mixed",
      bullishScenario: "bullish",
      bearishScenario: "",
      invalidationConditions: [],
      keyEvidence: ["CONFIRMED_BY_DATA: close 4162"],
    });
    expect(proj.dataStatus).toBe("NO_RECENT_MARKET_UPDATES");
    expect(proj.dataStatus).not.toBe("LIVE");
    expect(proj.chart?.historical.length).toBe(12);
    expect(proj.chart?.projected).not.toBeNull();
  });
});

describe("Phase 50A.1 wiring contracts", () => {
  it("wires projection into engine, prompts, UI, and meta phase", () => {
    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("buildBullishPriceProjection");
    expect(engine).toContain("parseModelBullishProjectionHint");
    expect(engine).toContain("priceProjection");
    expect(engine).toContain("enrichEvidenceCandlesFromHistory");

    const prompts = read("ai/forex-ai/multi-image-openai/prompts.ts");
    expect(prompts).toContain("bullishProjection");
    expect(prompts).toContain("target-hit probability");

    const ui = read("desktop/forex/SnapshotAiResultPanels.tsx");
    expect(ui).toContain("BuyPriceProjectionPanel");
    expect(ui).toContain("priceProjection");

    const panel = read("desktop/forex/capture-library/BuyPriceProjectionPanel.tsx");
    expect(panel).toContain("data-fx-buy-projection");
    expect(panel).toContain("data-fx-buy-projection-chart");
    expect(panel).toContain("data-fx-projected-path");
    expect(panel).toContain("data-fx-hist-candle");
    expect(panel).toContain("scenario →");
    expect(panel).toContain("targetProbabilityNote");
    expect(read("ai/forex-ai/multi-image-openai/bullish-projection.ts")).toMatch(/not the probability/i);

    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-buy-projection");
    expect(css).toContain("@media (max-width: 640px)");

    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    expect(api).toContain('phase: "50A.1"');

    // Risk / modes intact
    expect(engine).toContain("enrichAnalysisWithPositionRisk");
    expect(engine).toContain("CONFIRMATION_REQUIRED");
    expect(read("desktop/forex/ForexAiAnalysisPage.tsx")).toMatch(/Local|OpenAI|Compare/);
  });
});
