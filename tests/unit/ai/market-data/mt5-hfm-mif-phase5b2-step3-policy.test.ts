/**
 * Phase 5B.2 Step 3 — policy registry & evaluation tests.
 */
import { describe, it, expect } from "vitest";
import {
  MifQualityPolicyRegistry,
  createDefaultMifQualityPolicyRegistry,
  validateMifQualityPolicy,
  evaluateMifQualityPolicy,
  MIF_POLICY_OBSERVATIONAL_HFM,
  MIF_POLICY_HFM_ANALYSIS_SHADOW,
  assessMifDataIntegrity,
  baseCanonicalCandle,
  MIF_QI_REQUIRED_ASSESSMENT_MISSING,
  MIF_QI_POLICY_SUBSYSTEM_BLOCKED,
  type MifCanonicalCandle,
  type MifQualityPolicy,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function candle(openTimeSec: number): MifCanonicalCandle {
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + 3600,
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

describe("Phase 5B.2 Step3 — policy registry", () => {
  it("registers built-in policies and rejects duplicates/invalid", () => {
    const reg = createDefaultMifQualityPolicyRegistry();
    expect(reg.get(MIF_POLICY_OBSERVATIONAL_HFM.policyId, MIF_POLICY_OBSERVATIONAL_HFM.policyVersion)).toBeTruthy();
    expect(reg.get(MIF_POLICY_HFM_ANALYSIS_SHADOW.policyId, "1.0.0")).toBeTruthy();
    expect(() => reg.register(MIF_POLICY_OBSERVATIONAL_HFM)).toThrow(/duplicate/);

    const bad: MifQualityPolicy = {
      ...MIF_POLICY_OBSERVATIONAL_HFM,
      policyId: "",
      requireDataIntegrity: false,
      requireQuote: false,
      requireInstrument: false,
      requireMultiTimeframe: false,
    };
    const v = validateMifQualityPolicy(bad);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.issues.some((i) => i.code === "POLICY_MISSING_ID")).toBe(true);
    expect(v.issues.some((i) => i.code === "POLICY_CONTRADICTORY_REQUIREMENTS")).toBe(true);

    expect(validateMifQualityPolicy({
      ...MIF_POLICY_OBSERVATIONAL_HFM,
      providerId: "BINANCE" as "HFM_MT5",
    }).ok).toBe(false);

    const empty = new MifQualityPolicyRegistry();
    expect(empty.get("nope", "1")).toBeNull();
  });

  it("does not invent universal thresholds in built-in policies", () => {
    expect(MIF_POLICY_OBSERVATIONAL_HFM.expectedQuoteFreshnessProfileId).toBeNull();
    const { result } = evaluateMifQualityPolicy({
      policy: MIF_POLICY_OBSERVATIONAL_HFM,
      dataIntegrity: assessMifDataIntegrity({
        candles: [candle(1_700_000_000)],
        providerSymbol: "XAUUSD",
        timeframe: "H1",
        assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      }),
      quote: null,
      instrument: null,
      multiTimeframe: null,
    });
    expect(result.decisions.some((d) => d.reasonCode === "NO_UNIVERSAL_THRESHOLD")).toBe(true);
    expect(result.decisions.some((d) => d.outcome === "unconfigured")).toBe(true);
  });
});

describe("Phase 5B.2 Step3 — policy evaluation", () => {
  it("passes when required integrity is VALID/WARNING", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const { result, findings } = evaluateMifQualityPolicy({
      policy: MIF_POLICY_OBSERVATIONAL_HFM,
      dataIntegrity: integrity,
      quote: null,
      instrument: null,
      multiTimeframe: null,
    });
    expect(result.missingRequiredSubsystems).toEqual([]);
    expect(findings.some((f) => f.code === MIF_QI_REQUIRED_ASSESSMENT_MISSING)).toBe(false);
    expect(result.derivedStatus === "VALID" || result.derivedStatus === "WARNING").toBe(true);
  });

  it("blocks when required assessment missing", () => {
    const { result, findings } = evaluateMifQualityPolicy({
      policy: MIF_POLICY_HFM_ANALYSIS_SHADOW,
      dataIntegrity: null,
      quote: null,
      instrument: null,
      multiTimeframe: null,
    });
    expect(result.missingRequiredSubsystems).toContain("data_integrity");
    expect(result.missingRequiredSubsystems).toContain("quote");
    expect(findings.some((f) => f.code === MIF_QI_REQUIRED_ASSESSMENT_MISSING)).toBe(true);
    expect(result.derivedStatus).toBe("BLOCKED");
  });

  it("maps subsystem BLOCKED into policy blocked finding", () => {
    const integrity = assessMifDataIntegrity({
      candles: [
        candle(1_700_003_600),
        candle(1_700_000_000), // out of order
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(integrity.status).toBe("BLOCKED");
    const { findings, result } = evaluateMifQualityPolicy({
      policy: MIF_POLICY_OBSERVATIONAL_HFM,
      dataIntegrity: integrity,
      quote: null,
      instrument: null,
      multiTimeframe: null,
    });
    expect(findings.some((f) => f.code === MIF_QI_POLICY_SUBSYSTEM_BLOCKED)).toBe(true);
    expect(result.derivedStatus).toBe("BLOCKED");
  });
});
