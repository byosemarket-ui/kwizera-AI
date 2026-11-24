/**
 * Engine capability audit — Phase 05/06 evidence delivery + closed-candle labeling.
 */
import { describe, it, expect } from "vitest";
import { buildProductionEvidenceRefs } from "../../../../ai/market-data/mt5-hfm/mif/production-integration/build-evidence";
import type { MifCanonicalCandle } from "../../../../ai/market-data/mt5-hfm/mif/canonical/candle";
import { buildHfmReasoningSystemPrompt, buildHfmReasoningUserPrompt } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/prompts";
import { HFM_REASONING_PROMPT_VERSION } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/constants";

function candle(partial: Partial<MifCanonicalCandle> & { openTimeSec: number; candleState: MifCanonicalCandle["candleState"] }): MifCanonicalCandle {
  return {
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: "M5",
    openTimeSec: partial.openTimeSec,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    tickVolume: 10,
    realVolume: null,
    spread: 2,
    timebase: "BROKER_SERVER",
    candleState: partial.candleState,
    source: "test",
    ...partial,
  } as MifCanonicalCandle;
}

describe("engine evidence delivery remediation", () => {
  it("labels catalog evidence CLOSED when closed history exists under a FORMING tip", () => {
    const primaryCandles = [
      candle({ openTimeSec: 100, candleState: "CLOSED" }),
      candle({ openTimeSec: 200, candleState: "CLOSED" }),
      candle({ openTimeSec: 300, candleState: "FORMING" }),
    ];
    const refs = buildProductionEvidenceRefs({
      primaryTimeframe: "M5",
      assessmentTimestamp: "2026-11-24T00:00:00.000Z",
      dataQualityStatus: "VALID",
      integrity: null,
      regime: null,
      fibonacci: null,
      chartPatterns: null,
      harmonic: null,
      mtf: null,
      primaryCandles,
      buyerSellerPressure: null,
      deepTechnicalIntelligence: null,
      candlestickPatterns: null,
    });
    const withState = refs.filter((r) => r.candleState != null);
    expect(withState.length).toBeGreaterThan(0);
    expect(withState.every((r) => r.candleState === "CLOSED" || r.candleState === "FORMING")).toBe(true);
    // Default grounding prefers CLOSED when closed bars exist
    expect(withState.filter((r) => r.candleState === "CLOSED").length).toBeGreaterThan(0);
  });

  it("projects Phase 05/06 supplemental evidence ids into production refs", () => {
    const primaryCandles = [
      candle({ openTimeSec: 100, candleState: "CLOSED" }),
      candle({ openTimeSec: 200, candleState: "FORMING" }),
    ];
    const refs = buildProductionEvidenceRefs({
      primaryTimeframe: "M5",
      assessmentTimestamp: "2026-11-24T00:00:00.000Z",
      dataQualityStatus: "WARNING",
      integrity: null,
      regime: null,
      fibonacci: null,
      chartPatterns: null,
      harmonic: null,
      mtf: null,
      primaryCandles,
      buyerSellerPressure: {
        contractId: "kwizera.mif.buyer-seller-pressure.v1",
        contractVersion: "1.0.0",
        engineId: "mif-buyer-seller-pressure",
        engineVersion: "1.0.0",
        policyVersion: "1.0.0",
        assessmentId: "bsp-1",
        inputIdentity: "bsp-in",
        status: "VALID",
        dominantSide: "SELLERS",
        dataClassification: "CANDLE_STRUCTURE_PROXY",
        provisional: false,
      } as never,
      deepTechnicalIntelligence: {
        contractId: "kwizera.mif.deep-technical-intelligence.v1",
        contractVersion: "1.0.0",
        engineId: "mif-deep-technical-intelligence",
        engineVersion: "1.0.0",
        policyVersion: "1.0.0",
        assessmentId: "dti-1",
        inputIdentity: "dti-in",
        status: "VALID",
        mtf: { alignment: "BEARISH_ALIGNED" },
        overallRegimeLabel: "TRENDING_DOWN",
        confluence: { grade: "MODERATE" },
      } as never,
      candlestickPatterns: {
        contractId: "kwizera.mif.candlestick-patterns.v1",
        contractVersion: "1.0.0",
        engineId: "mif-candlestick-patterns",
        engineVersion: "1.0.0",
        assessmentId: "csp-1",
        inputIdentity: "csp-in",
        status: "VALID",
        detections: [{ patternId: "engulfing_bearish" }],
        patternIds: ["engulfing_bearish"],
      } as never,
    });

    const ids = refs.map((r) => r.evidenceId);
    expect(ids).toContain("ume.buyer_seller_pressure");
    expect(ids).toContain("ume.deep_technical_intelligence");
    expect(ids).toContain("ume.candlestick_patterns");

    const bsp = refs.find((r) => r.evidenceId === "ume.buyer_seller_pressure");
    expect(bsp?.family).toBe("BUYER_SELLER_PRESSURE");
    expect(bsp?.presence).toBe("PRESENT");
    expect(bsp?.candleState).toBe("CLOSED");

    const dti = refs.find((r) => r.evidenceId === "ume.deep_technical_intelligence");
    expect(dti?.family).toBe("DEEP_TECHNICAL_INTELLIGENCE");
    expect(dti?.presence).toBe("PRESENT");

    const csp = refs.find((r) => r.evidenceId === "ume.candlestick_patterns");
    expect(csp?.family).toBe("CANDLESTICK_PATTERN");
    expect(csp?.presence).toBe("PRESENT");
  });

  it("requires PROVIDED marketOverview/timeframeAnalysis in prompts when evidence is complete", () => {
    expect(HFM_REASONING_PROMPT_VERSION).toBe("hfm-ai-reasoning-prompt-v1.2.1");
    const sys = buildHfmReasoningSystemPrompt();
    expect(sys).toMatch(/marketOverview and timeframeAnalysis/);
    expect(sys).toMatch(/MUST be PROVIDED/);
    expect(sys).not.toMatch(/omit that timeframe block/);
    const user = buildHfmReasoningUserPrompt("{}");
    expect(user).toMatch(/marketOverview MUST be PROVIDED/);
    expect(user).toMatch(/PROVIDED objects H1, M30, M15, M5/);
  });
});
