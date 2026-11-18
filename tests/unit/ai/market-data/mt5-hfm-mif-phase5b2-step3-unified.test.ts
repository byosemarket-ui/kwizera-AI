/**
 * Phase 5B.2 Step 3 — unified quality assessment tests.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifUnifiedQuality,
  createDefaultMifQualityPolicyRegistry,
  MIF_POLICY_OBSERVATIONAL_HFM,
  MIF_POLICY_HFM_ANALYSIS_SHADOW,
  MIF_UNIFIED_QUALITY_CONTRACT_ID,
  assessMifDataIntegrity,
  assessMifQuoteQuality,
  assessMifInstrumentQuality,
  assessMifMultiTimeframeQuality,
  buildMifInstrumentStub,
  mifInstrumentFromHfmCatalog,
  MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
  baseCanonicalCandle,
  MIF_QI_POLICY_UNAVAILABLE,
  MIF_QI_REQUIRED_ASSESSMENT_MISSING,
  MIF_QI_POLICY_SUBSYSTEM_BLOCKED,
  computeUnifiedInputIdentity,
  type MifCanonicalCandle,
  type MifCanonicalQuote,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import type { HfmAnalysisDataQualityReport } from "../../../../ai/market-data/mt5-hfm/analysis/types";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";

function candle(openTimeSec: number, tf = "H1"): MifCanonicalCandle {
  const step = tf === "M15" ? 900 : 3600;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: tf,
    openTimeSec,
    closeTimeSec: openTimeSec + step,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    tickVolume: 1,
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
  });
}

function quote(): MifCanonicalQuote {
  return {
    contractId: MIF_MARKET_DATA_CONTRACT_ID,
    contractVersion: MIF_MARKET_DATA_CONTRACT_VERSION,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    bid: 2000,
    ask: 2000.5,
    last: null,
    spread: 0.5,
    spreadPoints: null,
    brokerSpreadPoints: null,
    tickVolume: null,
    realVolume: null,
    quoteTimestampSec: 1_700_000_000,
    quoteTimestampMs: null,
    receivedAt: "2023-11-14T22:13:20.000Z",
    availableAt: null,
    availabilityStatus: "KNOWN",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    status: "LIVE",
    sourceDialect: "hfm.canonical-quote",
    sourceProvenance: "test",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function catalogInst() {
  return mifInstrumentFromHfmCatalog({
    symbol: "XAUUSD",
    description: "Gold",
    digits: 2,
    point: 0.01,
    tickSize: 0.01,
    catalogVersion: "v1",
    classification: { category: "metal", confidence: "high" },
  } as HfmCatalogInstrument);
}

describe("Phase 5B.2 Step3 — unified assessment", () => {
  const registry = createDefaultMifQualityPolicyRegistry();

  it("VALID/WARNING observational assessment preserves subsystems and safety flags", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const u = assessMifUnifiedQuality({
      providerSymbol: "XAUUSD",
      consumerId: MIF_POLICY_OBSERVATIONAL_HFM.consumerId,
      policyId: MIF_POLICY_OBSERVATIONAL_HFM.policyId,
      policyVersion: MIF_POLICY_OBSERVATIONAL_HFM.policyVersion,
      policyRegistry: registry,
      dataIntegrity: integrity,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.contractId).toBe(MIF_UNIFIED_QUALITY_CONTRACT_ID);
    expect(u.scope).toBe("step3-unified-quality");
    expect(u.doesNotApproveAiReasoning).toBe(true);
    expect(u.notPhase2AiGate).toBe(true);
    expect(u.placesOrders).toBe(false);
    expect(u.subsystems.dataIntegrity?.status).toBe(integrity.status);
    expect(u.status === "VALID" || u.status === "WARNING").toBe(true);
    expect(u.diagnostics.overallStatusReason.length).toBeGreaterThan(0);
  });

  it("BLOCKED when policy missing or required assessments absent", () => {
    const missingPolicy = assessMifUnifiedQuality({
      providerSymbol: "XAUUSD",
      consumerId: "mif-observational",
      policyId: "does-not-exist",
      policyVersion: "9.9.9",
      policyRegistry: registry,
      dataIntegrity: assessMifDataIntegrity({
        candles: [candle(1_700_000_000)],
        providerSymbol: "XAUUSD",
        timeframe: "H1",
      }),
    });
    expect(missingPolicy.status).toBe("BLOCKED");
    expect(missingPolicy.findings.some((f) => f.code === MIF_QI_POLICY_UNAVAILABLE)).toBe(true);

    const missingRequired = assessMifUnifiedQuality({
      providerSymbol: "XAUUSD",
      consumerId: MIF_POLICY_HFM_ANALYSIS_SHADOW.consumerId,
      policyId: MIF_POLICY_HFM_ANALYSIS_SHADOW.policyId,
      policyVersion: MIF_POLICY_HFM_ANALYSIS_SHADOW.policyVersion,
      policyRegistry: registry,
      dataIntegrity: null,
      quote: null,
      instrument: null,
      multiTimeframe: null,
    });
    expect(missingRequired.status).toBe("BLOCKED");
    expect(missingRequired.findings.some((f) => f.code === MIF_QI_REQUIRED_ASSESSMENT_MISSING)).toBe(
      true,
    );
  });

  it("BLOCKED when integrity subsystem is BLOCKED; subsystem status preserved", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_003_600), candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(integrity.status).toBe("BLOCKED");
    const u = assessMifUnifiedQuality({
      providerSymbol: "XAUUSD",
      consumerId: MIF_POLICY_OBSERVATIONAL_HFM.consumerId,
      policyId: MIF_POLICY_OBSERVATIONAL_HFM.policyId,
      policyVersion: MIF_POLICY_OBSERVATIONAL_HFM.policyVersion,
      policyRegistry: registry,
      dataIntegrity: integrity,
    });
    expect(u.status).toBe("BLOCKED");
    expect(u.subsystems.dataIntegrity?.status).toBe("BLOCKED");
    expect(u.findings.some((f) => f.code === MIF_QI_POLICY_SUBSYSTEM_BLOCKED)).toBe(true);
  });

  it("full shadow consumer with all subsystems + Phase 2 shadow observational", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000), candle(1_700_003_600)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const q = assessMifQuoteQuality({
      quote: quote(),
      providerSymbol: "XAUUSD",
      requireQuote: true,
      freshnessProfile: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS,
      nowSec: 1_700_000_010,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const inst = assessMifInstrumentQuality({
      instrument: catalogInst(),
      providerSymbol: "XAUUSD",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mtf = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle(1_700_000_000, "H1")],
        M15: [candle(1_700_000_000, "M15")],
      },
      requirement: {
        consumerId: MIF_POLICY_HFM_ANALYSIS_SHADOW.consumerId,
        requiredTimeframes: ["H1", "M15"],
        candleStatePolicy: { mode: "closed_only" },
      },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const phase2: HfmAnalysisDataQualityReport = {
      status: "VALID",
      errors: [],
      warnings: [],
      approvedForAiReasoning: true,
      policyNote: "test",
    };
    const u = assessMifUnifiedQuality({
      providerSymbol: "XAUUSD",
      consumerId: MIF_POLICY_HFM_ANALYSIS_SHADOW.consumerId,
      policyId: MIF_POLICY_HFM_ANALYSIS_SHADOW.policyId,
      policyVersion: MIF_POLICY_HFM_ANALYSIS_SHADOW.policyVersion,
      policyRegistry: registry,
      dataIntegrity: integrity,
      quote: q,
      instrument: inst,
      multiTimeframe: mtf,
      phase2Quality: phase2,
      phase2SourceIdentity: "hfm-analysis-snapshot-v1:test",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(u.shadow).toBeTruthy();
    expect(u.shadow?.phase2ApprovedForAiReasoning).toBe(true);
    expect(u.shadow?.doesNotMutatePhase2).toBe(true);
    expect(phase2.approvedForAiReasoning).toBe(true);
    expect(u.doesNotApproveAiReasoning).toBe(true);
    expect(u.subsystems.quote?.status).toBe(q.status);
    expect(u.subsystems.multiTimeframe?.status).toBe(mtf.status);
  });

  it("status precedence BLOCKED > DEGRADED > WARNING > VALID", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_003_600), candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    const u = assessMifUnifiedQuality({
      providerSymbol: "XAUUSD",
      consumerId: MIF_POLICY_OBSERVATIONAL_HFM.consumerId,
      policyId: MIF_POLICY_OBSERVATIONAL_HFM.policyId,
      policyVersion: MIF_POLICY_OBSERVATIONAL_HFM.policyVersion,
      policyRegistry: registry,
      dataIntegrity: integrity,
      quote: assessMifQuoteQuality({
        quote: quote(),
        providerSymbol: "XAUUSD",
        requireQuote: false,
        freshnessProfile: null,
      }),
    });
    expect(u.status).toBe("BLOCKED");
  });

  it("deterministic identity ignores wall-clock; changes with policy/subsystem", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const base = {
      providerSymbol: "XAUUSD",
      consumerId: MIF_POLICY_OBSERVATIONAL_HFM.consumerId,
      policyId: MIF_POLICY_OBSERVATIONAL_HFM.policyId,
      policyVersion: MIF_POLICY_OBSERVATIONAL_HFM.policyVersion,
      policyRegistry: registry,
      dataIntegrity: integrity,
    };
    const a = assessMifUnifiedQuality({ ...base, assessmentTimestamp: "2024-01-01T00:00:00.000Z" });
    const b = assessMifUnifiedQuality({ ...base, assessmentTimestamp: "2025-01-01T00:00:00.000Z" });
    expect(a.inputIdentity).toBe(b.inputIdentity);

    const c = assessMifUnifiedQuality({
      ...base,
      policyVersion: "9.9.9",
    });
    expect(c.inputIdentity).not.toBe(a.inputIdentity);

    const idDirect = computeUnifiedInputIdentity({
      providerSymbol: "XAUUSD",
      consumerId: "mif-observational",
      policyId: "mif-observational-hfm",
      policyVersion: "1.0.0",
      dataIntegrityId: integrity.inputIdentity,
      quoteId: null,
      instrumentId: null,
      multiTimeframeId: null,
      shadowId: null,
      includeShadow: false,
    });
    expect(idDirect).toBe(a.inputIdentity);

    const stub = assessMifInstrumentQuality({
      instrument: buildMifInstrumentStub({ providerSymbol: "XAUUSD" }),
      providerSymbol: "XAUUSD",
    });
    const d = assessMifUnifiedQuality({ ...base, instrument: stub });
    expect(d.inputIdentity).not.toBe(a.inputIdentity);
  });
});
