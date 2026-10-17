/**
 * Phase 50B — Binary BUY/SELL directional classification.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BINARY_DIRECTION_METHOD,
  DIRECTIONAL_CONFIDENCE_LABEL,
  applyBinaryDirectionalClassification,
  buildMtfRoster,
  canCompleteDirectionalClassification,
  computeBearishDirectionalScore,
  computeBullishDirectionalScore,
  parseMtfReasoningFromModel,
  validateCaptureInstrumentConsistency,
} from "../../../../ai/forex-ai/multi-image-openai/index.ts";
import type { MultiImageCaptureRef } from "../../../../ai/forex-ai/multi-image-openai/types.ts";
import { buildOpenAiMultimodalChatJsonBody } from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";

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

function scorePair(opts: {
  captures: MultiImageCaptureRef[];
  mtfRaw: Record<string, unknown>;
  marketBias: string;
  keyEvidence: string[];
  bullishScenario: string;
  bearishScenario: string;
  modelDecision: string;
}) {
  const roster = buildMtfRoster(opts.captures);
  const mtf = parseMtfReasoningFromModel({ mtfReasoning: opts.mtfRaw }, roster);
  const input = {
    decision: opts.modelDecision,
    marketBias: opts.marketBias,
    mtf,
    captures: opts.captures,
    hasAnalysisTimeSnapshot: true,
    quoteFreshness: "LIVE",
    feedHealth: "LIVE",
    keyEvidence: opts.keyEvidence,
    bullishScenario: opts.bullishScenario,
    bearishScenario: opts.bearishScenario,
  };
  const bullish = computeBullishDirectionalScore(input);
  const bearish = computeBearishDirectionalScore(input);
  const binary = applyBinaryDirectionalClassification({
    modelDecision: opts.modelDecision,
    marketBias: opts.marketBias,
    bullish,
    bearish,
    mtf,
    keyEvidence: opts.keyEvidence,
    bullishScenario: opts.bullishScenario,
    bearishScenario: opts.bearishScenario,
    captures: opts.captures,
  });
  return { bullish, bearish, binary, mtf };
}

describe("Phase 50B binary directional classifier", () => {
  it("returns BUY for strong bullish evidence", () => {
    const captures = [
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "1h" }),
    ];
    const { binary } = scorePair({
      captures,
      modelDecision: "WAIT",
      marketBias: "BULLISH",
      bullishScenario: "bullish continuation above support",
      bearishScenario: "only if support breaks",
      keyEvidence: [
        "VISIBLE_IN_IMAGE: higher highs and higher lows",
        "CONFIRMED_BY_DATA: bid 4168.3",
      ],
      mtfRaw: {
        timeframeAgreement: "ALIGNED",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: higher highs and higher lows uptrend",
        intermediateStructure: "VISIBLE_IN_IMAGE: bullish continuation",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: bullish reclaim of support",
        bullishScenario: "INFERENCE: continuation",
        bearishScenario: "INFERENCE: only if support breaks",
        missingEvidence: [],
      },
    });
    expect(binary.direction).toBe("BUY");
    expect(binary.bullishScore).toBeGreaterThan(binary.bearishScore);
    expect(binary.directionalConfidencePercent).toBeGreaterThan(50);
    expect(binary.scoreMethod).toBe(BINARY_DIRECTION_METHOD);
    expect(binary.display).toContain(DIRECTIONAL_CONFIDENCE_LABEL);
  });

  it("returns SELL for strong bearish evidence", () => {
    const captures = [
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "1h" }),
    ];
    const { binary } = scorePair({
      captures,
      modelDecision: "WAIT",
      marketBias: "BEARISH",
      bullishScenario: "only if resistance breaks",
      bearishScenario: "bearish continuation below resistance",
      keyEvidence: [
        "VISIBLE_IN_IMAGE: lower highs and lower lows",
        "CONFIRMED_BY_DATA: breakdown",
      ],
      mtfRaw: {
        timeframeAgreement: "ALIGNED",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: lower highs and lower lows downtrend",
        intermediateStructure: "VISIBLE_IN_IMAGE: bearish continuation",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: rejection and breakdown",
        bullishScenario: "INFERENCE: only if resistance breaks",
        bearishScenario: "INFERENCE: bearish continuation",
        missingEvidence: [],
      },
    });
    expect(binary.direction).toBe("SELL");
    expect(binary.bearishScore).toBeGreaterThan(binary.bullishScore);
    expect(["BUY", "SELL"]).toContain(binary.direction);
  });

  it("mixed evidence returns the stronger score with reduced confidence when margin is thin", () => {
    const captures = [
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "15m" }),
    ];
    const { binary } = scorePair({
      captures,
      modelDecision: "WAIT",
      marketBias: "NEUTRAL",
      bullishScenario: "bullish rebound attempt",
      bearishScenario: "bearish rejection risk",
      keyEvidence: [
        "VISIBLE_IN_IMAGE: rebound",
        "VISIBLE_IN_IMAGE: rejection near highs",
      ],
      mtfRaw: {
        timeframeAgreement: "MIXED",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: recovery within range",
        intermediateStructure: "VISIBLE_IN_IMAGE: pullback and rejection",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: small bullish reclaim",
        conflictSummary: "recovery conflicts with pullback",
        missingEvidence: [],
      },
    });
    expect(["BUY", "SELL"]).toContain(binary.direction);
    expect(binary.direction).not.toBe("WAIT" as never);
    if (binary.margin < 8) {
      expect(binary.confidenceBand === "LOW" || binary.directionalConfidencePercent <= 56).toBe(true);
    }
  });

  it("weak but valid evidence still produces one directional lean without high confidence", () => {
    const captures = [
      ref({
        captureId: "a",
        timeframe: "5m",
        quote: {
          bid: 4168,
          ask: null,
          mid: null,
          lastPrice: 4168,
          feedHealth: "MARKET_INACTIVE",
          lastGenuinePriceChangeAt: null,
          lastGenuinePriceChangeAgeMs: null,
        },
      }),
    ];
    const { binary } = scorePair({
      captures,
      modelDecision: "WAIT",
      marketBias: "UNCERTAIN",
      bullishScenario: "",
      bearishScenario: "bearish risk if lows break",
      keyEvidence: [],
      mtfRaw: {
        timeframeAgreement: "INSUFFICIENT",
        higherTimeframeContext: null,
        conflictSummary: "unclear",
        missingEvidence: ["no snapshot", "no quote"],
        bearishScenario: "INFERENCE: bearish if lows break",
      },
    });
    expect(["BUY", "SELL"]).toContain(binary.direction);
    expect(binary.confidenceBand).toBe("LOW");
    expect(binary.directionalConfidencePercent).toBeLessThan(70);
    expect(binary.lowConfidenceNote).toMatch(/Low directional confidence/i);
  });

  it("invalid critical inputs produce a genuine classification error", () => {
    expect(canCompleteDirectionalClassification({
      captures: [],
      imageCount: 0,
      analysisStatus: "completed",
      analysisError: null,
    }).ok).toBe(false);

    expect(canCompleteDirectionalClassification({
      captures: [ref({ captureId: "a", timeframe: "5m" })],
      imageCount: 0,
      analysisStatus: "completed",
      analysisError: null,
    }).ok).toBe(false);

    expect(canCompleteDirectionalClassification({
      captures: [ref({ captureId: "a", timeframe: "5m" })],
      imageCount: 2,
      analysisStatus: "failed",
      analysisError: "OpenAI multimodal request failed.",
    }).ok).toBe(false);

    expect(canCompleteDirectionalClassification({
      captures: [ref({ captureId: "a", timeframe: "5m" })],
      imageCount: 2,
      analysisStatus: "completed",
      analysisError: null,
    }).ok).toBe(true);
  });

  it("never returns WAIT as directional decision and does not claim win probability", () => {
    const captures = [ref({ captureId: "a", timeframe: "15m" }), ref({ captureId: "b", timeframe: "1h" })];
    const { binary } = scorePair({
      captures,
      modelDecision: "WAIT",
      marketBias: "UNCERTAIN",
      bullishScenario: "bullish",
      bearishScenario: "bearish",
      keyEvidence: ["VISIBLE_IN_IMAGE: mixed"],
      mtfRaw: { timeframeAgreement: "CONFLICTING", conflictSummary: "conflict" },
    });
    expect(binary.direction).not.toBe("WAIT" as never);
    expect(binary.direction).not.toBe("UNCERTAIN" as never);
    expect(binary.directionalConfidenceLabel).toBe(DIRECTIONAL_CONFIDENCE_LABEL);
    expect(binary.display).not.toMatch(/win probability of a trade/i);
  });

  it("rejects mismatched screenshots and keeps historical-only honesty contracts", () => {
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

    const proj = read("ai/forex-ai/multi-image-openai/bullish-projection.ts");
    expect(proj).toContain("HISTORICAL_ONLY");
    expect(proj).toContain("NO_RECENT_MARKET_UPDATES");
  });
});

describe("Phase 50B wiring contracts", () => {
  it("wires binary classifier, prompts, UI, model path, and risk gates", () => {
    const body = buildOpenAiMultimodalChatJsonBody({
      model: "gpt-6-luna",
      system: "sys",
      userText: "user",
      images: [{ mimeType: "image/png", base64: "AAAA" }],
    });
    const user = (body.messages as Array<{ content: unknown }>)[1].content as Array<{ type: string }>;
    expect(user.some((p) => p.type === "image_url")).toBe(true);

    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("applyBinaryDirectionalClassification");
    expect(engine).toContain("computeBearishDirectionalScore");
    expect(engine).not.toContain("applyBuyDirectionalPolicy");
    expect(engine).not.toContain("shouldForceWaitForMtf");
    expect(engine).toContain("directionalClassification");
    expect(engine).toContain("CONFIRMATION_REQUIRED");
    expect(engine).toContain("enrichAnalysisWithPositionRisk");
    expect(engine).toContain("openAiChatMultimodalJson");

    const prompts = read("ai/forex-ai/multi-image-openai/prompts.ts");
    expect(prompts).toContain("decision to exactly BUY or SELL");
    expect(prompts).toContain('"decision":"BUY|SELL"');

    const ui = read("desktop/forex/SnapshotAiResultPanels.tsx");
    expect(ui).toContain("data-fx-directional-classification");
    expect(ui).toContain("data-fx-direction-value");
    expect(ui).toContain("bullishScore");
    expect(ui).toContain("bearishScore");
    expect(ui).toContain("BuyPriceProjectionPanel");

    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    expect(api).toContain('phase: "50B"');

    expect(read("desktop/forex/ForexAiAnalysisPage.tsx")).toMatch(/Local|OpenAI|Compare/);
  });
});
