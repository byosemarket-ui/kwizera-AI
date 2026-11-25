/**
 * Regression: RSI/ROC numerics + DTI/regime conflict packaging.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  assessMifMomentum,
  baseCanonicalCandle,
  rateOfChange,
  wilderRsi,
  type MifCanonicalCandle,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import { mapDeepTechnicalTrendRegime } from "../../../../ai/market-data/mt5-hfm/mif/analysis/deep-technical-intelligence/map-regime-labels.js";
import {
  classifyRegimeDtiStructureConflict,
} from "../../../../ai/market-data/mt5-hfm/mif/production-integration/engine-conflict.js";
import { buildProductionEvidenceRefs } from "../../../../ai/market-data/mt5-hfm/mif/production-integration/build-evidence.js";
import { adaptDetectionEvidenceRefToEvidence } from "../../../../ai/market-data/mt5-hfm/mif/market-evidence/adapters/from-opportunity.js";
import type { MifMarketRegimeAssessment } from "../../../../ai/market-data/mt5-hfm/mif/analysis/regime/types.js";
import type { MifMarketStructureAssessment } from "../../../../ai/market-data/mt5-hfm/mif/analysis/market-structure/types.js";
import type { MifDeepTechnicalIntelligenceAssessment } from "../../../../ai/market-data/mt5-hfm/mif/analysis/deep-technical-intelligence/types.js";

const T0 = 1_700_000_000;
const STEP = 3600;

function downTrendSeries(n = 40): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 2000 - i * 0.8;
    const close = base;
    const open = close + 0.2;
    const openTimeSec = T0 + i * STEP;
    out.push(
      baseCanonicalCandle({
        providerSymbol: "XAUUSD",
        timeframe: "H1",
        openTimeSec,
        closeTimeSec: openTimeSec + STEP,
        open,
        high: Math.max(open, close) + 0.5,
        low: Math.min(open, close) - 0.5,
        close,
        tickVolume: 10,
        realVolume: null,
        collapsedVolume: null,
        volumeType: "tick",
        spread: null,
        candleState: "CLOSED",
        priceBasis: "bid",
        timebase: "BROKER_SERVER",
        timezoneOffsetSec: null,
        brokerTimestampSec: openTimeSec,
        receivedAt: null,
        availableAt: null,
        availabilityStatus: "KNOWN",
        sourceDialect: "hfm.historical-bar",
        sourceProvenance: "test",
        sourceMode: "HISTORICAL",
        sourceDataQuality: "ok",
        validation: { status: "ok", errors: [], warnings: [] },
        instrument: null,
      }),
    );
  }
  return out;
}

describe("HFM evidence numeric delivery", () => {
  it("Wilder RSI / ROC match independent calculation on identical closed series", () => {
    const candles = downTrendSeries(40);
    const closes = candles.map((c) => c.close);
    const indepRoc = rateOfChange(closes, 14).value;
    const indepRsi = wilderRsi(closes, 14).value;
    const q = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mom = assessMifMomentum({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const roc = mom.indicators.find((i) => i.indicatorId === "ROC")?.value ?? null;
    const rsi = mom.indicators.find((i) => i.indicatorId === "RSI")?.value ?? null;
    expect(roc).toBeCloseTo(indepRoc!, 10);
    expect(rsi).toBeCloseTo(indepRsi!, 10);
    expect(mom.sourceCandleState).toBe("CLOSED");
    expect(mom.sourceTipOpenTimeSec).toBe(candles[candles.length - 1]!.openTimeSec);
  });

  it("buildProductionEvidenceRefs includes RSI/ROC measurements for momentum family", () => {
    const candles = downTrendSeries(40);
    const q = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mom = assessMifMomentum({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const refs = buildProductionEvidenceRefs({
      primaryTimeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      dataQualityStatus: "VALID",
      integrity: q,
      regime: null,
      fibonacci: null,
      chartPatterns: null,
      harmonic: null,
      mtf: null,
      momentum: mom,
      primaryCandles: candles,
    });
    const me = refs.find((r) => r.family === "MOMENTUM" && r.presence === "PRESENT");
    expect(me).toBeTruthy();
    expect(me!.measurements?.some((m) => m.id === "rsi" && typeof m.value === "number")).toBe(true);
    expect(me!.measurements?.some((m) => m.id === "roc" && typeof m.value === "number")).toBe(true);
    expect(me!.measurements?.find((m) => m.id === "rsiMethod")?.value).toBe("Wilder");
    expect(me!.candleState).toBe("CLOSED");

    const umep = adaptDetectionEvidenceRefToEvidence(me!, {
      providerSymbol: "XAUUSD",
      observedAt: "2024-01-01T00:00:00.000Z",
      snapshotId: "snap-test",
    });
    expect(umep.measurements.some((m) => m.id === "rsi" && typeof m.value === "number")).toBe(true);
    expect(umep.levels).toBeDefined();
  });

  it("DTI does not force RANGE_BOUND over TRENDING regime via structure bias", () => {
    const regime = {
      structure: "TRENDING",
      direction: "DOWN",
      volatility: "NORMAL",
      status: "VALID",
      compositeLabel: "TRENDING_DOWN",
    } as unknown as MifMarketRegimeAssessment;
    const structure = {
      bias: "RANGING",
      status: "WARNING",
    } as unknown as MifMarketStructureAssessment;
    const mapped = mapDeepTechnicalTrendRegime({ regime, marketStructure: structure });
    expect(mapped.label).not.toBe("RANGE_BOUND");
    expect(mapped.direction).toBe("BEARISH");
  });

  it("classifies regime TRENDING vs structure RANGING as DIFFERENT_METHODOLOGY when DTI was range", () => {
    const report = classifyRegimeDtiStructureConflict({
      regime: {
        engineId: "mif-market-regime",
        structure: "TRENDING",
        direction: "DOWN",
        volatility: "NORMAL",
        timeframe: "H1",
        assessmentId: "reg1",
      } as unknown as MifMarketRegimeAssessment,
      marketStructure: {
        engineId: "mif-market-structure",
        bias: "RANGING",
        timeframe: "H1",
        assessmentId: "ms1",
      } as unknown as MifMarketStructureAssessment,
      deepTechnical: {
        engineId: "mif-deep-technical-intelligence",
        overallRegimeLabel: "RANGE_BOUND",
        timeframe: "H1",
        assessmentId: "dti1",
      } as unknown as MifDeepTechnicalIntelligenceAssessment,
    });
    expect(report.kind).toBe("DIFFERENT_METHODOLOGY");
    expect(report.resolutionStatus).toBe("EXPLAINED");
  });
});
