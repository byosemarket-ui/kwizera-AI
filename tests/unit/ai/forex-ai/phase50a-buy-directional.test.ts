/**
 * Phase 50A — BUY directional score, instrument consistency, policy, wiring.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BULLISH_BUY_MIN_SCORE,
  DIRECTIONAL_CONFIDENCE_LABEL,
  applyBuyDirectionalPolicy,
  buildMtfRoster,
  computeBullishDirectionalScore,
  parseMtfReasoningFromModel,
  shouldForceWaitForMtf,
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

describe("Phase 50A instrument consistency", () => {
  it("rejects mixed instruments before OpenAI spend", () => {
    const ok = validateCaptureInstrumentConsistency([
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "15m" }),
    ]);
    expect(ok.ok).toBe(true);

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

    const snapMismatch = validateCaptureInstrumentConsistency(
      [ref({ captureId: "a", timeframe: "5m" })],
      "EUR/USD",
      "FOREXCONNECT",
    );
    expect(snapMismatch.ok).toBe(false);
    expect(snapMismatch.code).toBe("SNAPSHOT_INSTRUMENT_MISMATCH");
  });
});

describe("Phase 50A bullish directional score", () => {
  it("supports BUY for aligned bullish evidence and blocks weak/contradictory BUY", () => {
    const captures = [
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "1h" }),
    ];
    const roster = buildMtfRoster(captures);
    const strongMtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "ALIGNED",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: higher highs and higher lows uptrend",
        intermediateStructure: "VISIBLE_IN_IMAGE: bullish continuation",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: bullish reclaim of support",
        agreementSummary: "Timeframes agree bullish",
        bullishScenario: "INFERENCE: continuation above support",
        bearishScenario: "INFERENCE: only if support breaks",
        keyLevels: [{ level: "4160", provenance: "CONFIRMED_BY_DATA", captureId: "a", timeframe: "5m" }],
        missingEvidence: [],
      },
    }, roster);

    const strong = computeBullishDirectionalScore({
      decision: "BUY",
      marketBias: "BULLISH",
      mtf: strongMtf,
      captures,
      hasAnalysisTimeSnapshot: true,
      quoteFreshness: "LIVE",
      feedHealth: "LIVE",
      keyEvidence: [
        "VISIBLE_IN_IMAGE: higher lows",
        "CONFIRMED_BY_DATA: bid 4168.3",
      ],
      bullishScenario: "bullish continuation",
      bearishScenario: "invalid if support breaks",
    });
    expect(strong.percent).toBeGreaterThanOrEqual(BULLISH_BUY_MIN_SCORE);
    expect(strong.supportsBuy).toBe(true);
    expect(strong.display).toContain(DIRECTIONAL_CONFIDENCE_LABEL);
    expect(applyBuyDirectionalPolicy({ decision: "BUY", score: strong }).decision).toBe("BUY");

    const weakMtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "INSUFFICIENT",
        conflictSummary: "unclear",
        missingEvidence: ["no snapshot", "no quote"],
      },
    }, roster);
    const weak = computeBullishDirectionalScore({
      decision: "BUY",
      marketBias: "UNCERTAIN",
      mtf: weakMtf,
      captures: captures.map((c) => ({
        ...c,
        quote: { ...c.quote, feedHealth: "MARKET_INACTIVE" },
      })),
      hasAnalysisTimeSnapshot: false,
      quoteFreshness: null,
      feedHealth: null,
      keyEvidence: [],
      bullishScenario: "",
      bearishScenario: "bearish rejection risk",
    });
    expect(weak.supportsBuy).toBe(false);
    expect(applyBuyDirectionalPolicy({ decision: "BUY", score: weak }).decision).toBe("WAIT");

    // Never upgrade WAIT → BUY
    expect(applyBuyDirectionalPolicy({ decision: "WAIT", score: strong }).decision).toBe("WAIT");
  });

  it("does not force WAIT solely for INSUFFICIENT MTF agreement", () => {
    const roster = buildMtfRoster([
      ref({ captureId: "a", timeframe: "5m" }),
      ref({ captureId: "b", timeframe: "15m" }),
    ]);
    const insufficient = parseMtfReasoningFromModel({
      mtfReasoning: { timeframeAgreement: "INSUFFICIENT" },
    }, roster);
    expect(shouldForceWaitForMtf("BUY", insufficient)).toBe(false);
  });
});

describe("Phase 50A request/image wiring contracts", () => {
  it("submits screenshots as image_url parts and wires BUY UI + confirm gate", () => {
    const body = buildOpenAiMultimodalChatJsonBody({
      model: "gpt-6-luna",
      system: "sys",
      userText: "user",
      images: [{ mimeType: "image/png", base64: "AAAA" }],
    });
    const user = (body.messages as Array<{ content: unknown }>)[1].content as Array<{ type: string }>;
    expect(user.some((p) => p.type === "image_url")).toBe(true);

    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("validateCaptureInstrumentConsistency");
    expect(engine).toContain("computeBullishDirectionalScore");
    expect(engine).toContain("applyBinaryDirectionalClassification");
    expect(engine).toContain("imagesSubmittedAsImageUrl: true");
    expect(engine).toContain("CONFIRMATION_REQUIRED");
    expect(engine).toContain("openAiChatMultimodalJson");

    const prompts = read("ai/forex-ai/multi-image-openai/prompts.ts");
    expect(prompts).toContain("directionalConfidencePercent");
    expect(prompts).toContain("BUY or SELL");
    expect(prompts).toContain("image_url inputs");

    const ui = read("desktop/forex/SnapshotAiResultPanels.tsx");
    expect(ui).toContain("data-fx-directional-classification");
    expect(ui).toContain("directionalConfidenceLabel");
    expect(ui).toContain("not a calibrated win probability");
    expect(read("ai/forex-ai/multi-image-openai/bullish-score.ts")).toContain(DIRECTIONAL_CONFIDENCE_LABEL);

    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    expect(api).toMatch(/phase:\s*"50(?:A(?:\.1)?|[BC])"/);
  });
});
