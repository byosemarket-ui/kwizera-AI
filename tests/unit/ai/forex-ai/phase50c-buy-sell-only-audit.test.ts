/**
 * Phase 50C — BUY/SELL-only enforcement, UI/guidance separation, WAIT path classification.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  NON_DIRECTIONAL_DECISION_TOKENS,
  applyBinaryDirectionalClassification,
  buildMtfRoster,
  canCompleteDirectionalClassification,
  computeBearishDirectionalScore,
  computeBullishDirectionalScore,
  enforceBinaryDecisionOnCompletedAnalysis,
  isBuyOrSellDecision,
  isNonDirectionalDecisionToken,
  parseMtfReasoningFromModel,
  syntheticMtfFromAnalysisText,
  validateCaptureInstrumentConsistency,
} from "../../../../ai/forex-ai/multi-image-openai/index.ts";
import { buildOpenAiAssistantGuidanceItems } from "../../../../ai/forex-ai/analysis-response/openai-assistant-items.ts";
import { buildGuidedAnalysisResponse } from "../../../../ai/forex-ai/analysis-response/build-guided-response.ts";
import type { MultiImageCaptureRef } from "../../../../ai/forex-ai/multi-image-openai/types.ts";

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

describe("Phase 50C binary enforcement", () => {
  it("converts completed WAIT-like model output into exactly one BUY or SELL", () => {
    const binary = enforceBinaryDecisionOnCompletedAnalysis({
      decision: "WAIT",
      marketBias: "BEARISH",
      status: "completed",
      error: null,
      keyEvidence: ["VISIBLE_IN_IMAGE: lower highs and lower lows", "CONFIRMED_BY_DATA: breakdown"],
      bullishScenario: "only if resistance breaks",
      bearishScenario: "bearish continuation below resistance",
      marketStructureSummary: "Lower highs and lower lows downtrend",
      candleTimeframe: "1h",
      hasAnalysisTimeSnapshot: true,
      quoteFreshness: "LIVE",
      feedHealth: "LIVE",
    });
    expect(binary).not.toBeNull();
    expect(isBuyOrSellDecision(binary!.direction)).toBe(true);
    expect(isNonDirectionalDecisionToken(binary!.direction)).toBe(false);
    expect(binary!.direction).toBe("SELL");
  });

  it("strong bullish → BUY; strong bearish → SELL; mixed → stronger lean", () => {
    const captures = [ref({ captureId: "a", timeframe: "5m" }), ref({ captureId: "b", timeframe: "1h" })];
    const bullishMtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "ALIGNED",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: higher highs and higher lows uptrend",
        intermediateStructure: "VISIBLE_IN_IMAGE: bullish continuation",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: bullish reclaim",
        bullishScenario: "continuation",
        bearishScenario: "only if support breaks",
      },
    }, buildMtfRoster(captures));
    const bullishIn = {
      decision: "WAIT",
      marketBias: "BULLISH",
      mtf: bullishMtf,
      captures,
      hasAnalysisTimeSnapshot: true,
      quoteFreshness: "LIVE",
      feedHealth: "LIVE",
      keyEvidence: ["VISIBLE_IN_IMAGE: higher highs"],
      bullishScenario: "bullish continuation",
      bearishScenario: "only if support breaks",
    };
    const buy = applyBinaryDirectionalClassification({
      modelDecision: "WAIT",
      marketBias: "BULLISH",
      bullish: computeBullishDirectionalScore(bullishIn),
      bearish: computeBearishDirectionalScore(bullishIn),
      mtf: bullishMtf,
      keyEvidence: bullishIn.keyEvidence,
      bullishScenario: bullishIn.bullishScenario,
      bearishScenario: bullishIn.bearishScenario,
      captures,
    });
    expect(buy.direction).toBe("BUY");

    const bearishMtf = parseMtfReasoningFromModel({
      mtfReasoning: {
        timeframeAgreement: "ALIGNED",
        higherTimeframeContext: "VISIBLE_IN_IMAGE: lower highs and lower lows downtrend",
        intermediateStructure: "VISIBLE_IN_IMAGE: bearish continuation",
        lowerTimeframeSetup: "VISIBLE_IN_IMAGE: rejection and breakdown",
        bullishScenario: "only if resistance breaks",
        bearishScenario: "bearish continuation",
      },
    }, buildMtfRoster(captures));
    const bearishIn = {
      ...bullishIn,
      marketBias: "BEARISH",
      mtf: bearishMtf,
      keyEvidence: ["VISIBLE_IN_IMAGE: lower lows"],
      bullishScenario: "only if resistance breaks",
      bearishScenario: "bearish continuation",
    };
    const sell = applyBinaryDirectionalClassification({
      modelDecision: "WAIT",
      marketBias: "BEARISH",
      bullish: computeBullishDirectionalScore(bearishIn),
      bearish: computeBearishDirectionalScore(bearishIn),
      mtf: bearishMtf,
      keyEvidence: bearishIn.keyEvidence,
      bullishScenario: bearishIn.bullishScenario,
      bearishScenario: bearishIn.bearishScenario,
      captures,
    });
    expect(sell.direction).toBe("SELL");
  });

  it("invalid input stays an error; blocked readiness does not erase direction in guidance", () => {
    expect(canCompleteDirectionalClassification({
      captures: [],
      imageCount: 0,
      analysisStatus: "completed",
      analysisError: null,
    }).ok).toBe(false);

    const guided = buildGuidedAnalysisResponse({
      source: {
        decision: "BUY",
        marketBias: "BULLISH",
        decisionRationale: "lean buy",
        marketStructureSummary: "hh/hl",
        keyEvidence: ["VISIBLE_IN_IMAGE: higher lows"],
        bullishScenario: "continuation",
        bearishScenario: "if support breaks",
        invalidationConditions: ["break support"],
        dataQuality: "limited",
        status: "completed",
        analysisProvider: "OPENAI",
        instrument: "XAU/USD",
        provider: "FOREXCONNECT",
        planBundle: null,
      },
      tradeAllocation: null,
    });
    expect(guided.finalDecision.summary).toMatch(/Directional decision: BUY/);
    expect(guided.finalDecision.summary).not.toMatch(/Provider decision: WAIT/);
    expect(guided.finalDecision.nextAction).toMatch(/Direction BUY|Directional lean is BUY|entry|risk/i);
    expect(guided.finalDecision.nextAction).not.toMatch(/^WAIT and continue/i);

    const items = buildOpenAiAssistantGuidanceItems({
      plan: {
        planId: "p1",
        planKind: "PULLBACK",
        intent: "WAIT",
        lifecycle: "CANDIDATE",
        lifecycleNote: "Awaiting confirmation",
        marketDirection: "BULLISH",
        entryZone: {
          lower: null,
          upper: null,
          reference: null,
          rationale: "",
          unavailableReason: "WAIT — zones withheld",
        },
        confirmationRequired: ["hold support"],
        confirmationStatus: "PENDING",
        stopLoss: { price: null, rationale: "", unavailableReason: "n/a" },
        takeProfit: { prices: [], rationale: "", unavailableReason: "n/a" },
        invalidationConditions: [],
        expiryConditions: [],
        riskReward: { ratio: null, risk: null, reward: null, unavailableReason: "n/a" },
        unsuitableReasons: [],
        positionRisk: {
          riskEligible: false,
          blockingReasons: ["Stop-loss unavailable"],
          accountCurrency: null,
          positionSize: null,
          positionSizeUnit: null,
          contract: { verified: false, convention: null, unavailableReason: "n/a" },
          netLossAccount: null,
          rewardRiskRatio: null,
          minRewardRiskRatio: null,
          margin: { unavailableReason: "n/a" },
          costs: { unavailableReason: "n/a", totalCostsAccount: null },
        },
      } as never,
      analysisDecision: "BUY",
      marketDirection: "BULLISH",
      supportingEvidence: ["higher lows"],
      contradictingEvidence: ["range resistance"],
    });
    const directionItem = items.items.find((i) => i.tone === "direction" || /Market Direction/i.test(i.title));
    expect(directionItem?.value).toBe("BUY");
    expect(directionItem?.value).not.toMatch(/WAIT/);
    expect(items.finalSummary.directionOrWait).toBe("BUY");
    expect(items.items.find((i) => i.tone === "action" || /Final action/i.test(i.title))?.value)
      .toMatch(/Direction BUY|confirmation|risk/i);
  });

  it("rejects instrument mismatch and keeps projection/risk/confirm contracts", () => {
    expect(validateCaptureInstrumentConsistency([
      ref({ captureId: "a", timeframe: "5m" }),
      ref({
        captureId: "b",
        timeframe: "15m",
        instrument: { symbol: "ADA/USDC", displaySymbol: "ADA/USDC", provider: "BINANCE" },
      }),
    ]).code).toBe("INSTRUMENT_MISMATCH");

    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("applyBinaryDirectionalClassification");
    expect(engine).toContain("CONFIRMATION_REQUIRED");
    expect(engine).toContain("enrichAnalysisWithPositionRisk");
    expect(engine).toContain("analysisDecision: enriched.decision");
    expect(engine).toContain("never WAIT");
    expect(engine).not.toContain("downgraded to WAIT");

    const snapEngine = read("ai/forex-ai/snapshot-openai/engine.ts");
    expect(snapEngine).toContain("enforceBinaryDecisionOnCompletedAnalysis");
    expect(snapEngine).toContain("analysisDecision: enriched.decision");

    expect(read("ai/forex-ai/multi-image-openai/bullish-projection.ts")).toContain("phase50a1-scenario-path-v1");
    expect(read("desktop/forex/ForexAiAnalysisPage.tsx")).toMatch(/Local|OpenAI|Compare/);
    expect(read("dev/server/forex-ai-openai-snapshot-api.ts")).toContain('phase: "50C"');
  });
});

describe("Phase 50C WAIT reference classification (static)", () => {
  it("classifies remaining WAIT/UNCERTAIN references without obsolete directional gates", () => {
    const roots = [
      "ai/forex-ai/multi-image-openai",
      "ai/forex-ai/snapshot-openai",
      "ai/forex-ai/analysis-response",
      "desktop/forex/SnapshotAiResultPanels.tsx",
    ];
    const hits: Array<{ file: string; line: string; class: string }> = [];

    function walk(rel: string) {
      const abs = path.join(root, rel);
      const st = statSync(abs);
      if (st.isDirectory()) {
        for (const name of readdirSync(abs)) {
          if (name.endsWith(".ts") || name.endsWith(".tsx")) walk(path.join(rel, name));
        }
        return;
      }
      const text = readFileSync(abs, "utf8");
      text.split(/\r?\n/).forEach((line, i) => {
        if (!/\bWAIT\b|UNCERTAIN|NO_TRADE|NOT_READY|WAITING/.test(line)) return;
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return;
        let classification = "review";
        if (/entry|readiness|confirmation|ticket|lifecycle|riskEligible|BLOCKED|intent === \"WAIT\"|plan\.intent/i.test(line)) {
          classification = "entry_or_risk";
        } else if (/feed|HISTORICAL|STALE|MARKET_INACTIVE|dataStatus|quoteFreshness|failed\.decision|status === \"failed\"/i.test(line)) {
          classification = "data_or_error";
        } else if (/marketBias|NEUTRAL|UNCERTAIN|bias_uncertain|SIDEWAYS/i.test(line)) {
          classification = "bias_not_decision";
        } else if (/Prefer WAIT|decision must be.*WAIT|forces WAIT|downgraded to WAIT/i.test(line)) {
          classification = "obsolete_directional";
        } else if (/never return WAIT|never WAIT|BUY\|SELL|binary|Phase 50[BC]/i.test(line)) {
          classification = "enforcement_comment";
        } else if (/SUBSCRIBED_WAITING|connectionState/i.test(line)) {
          classification = "connection_state";
        }
        hits.push({ file: `${rel}:${i + 1}`, line: line.trim().slice(0, 140), class: classification });
      });
    }

    for (const r of roots) walk(r);

    const obsolete = hits.filter((h) => h.class === "obsolete_directional");
    expect(obsolete, JSON.stringify(obsolete, null, 2)).toEqual([]);

    // Multi-image engine must not assign WAIT on completed success path.
    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("completed valid classification is always BUY or SELL");
    expect(shouldForceWaitGone(engine)).toBe(true);

    expect(NON_DIRECTIONAL_DECISION_TOKENS).toContain("WAIT");
    expect(syntheticMtfFromAnalysisText({ timeframe: "15m" }).timeframeAgreement).toBe("SINGLE_TIMEFRAME");
  });
});

function shouldForceWaitGone(engineSrc: string): boolean {
  return !/shouldForceWaitForMtf\(/.test(engineSrc);
}
