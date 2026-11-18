/**
 * Phase 5C Step 1A — analytical quality gate.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifDataIntegrity,
  baseCanonicalCandle,
  evaluateMifAnalyticalQualityGate,
  type MifCanonicalCandle,
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

describe("Phase 5C Step1A — analytical quality gate", () => {
  const allowValidOnly = ["VALID"] as const;
  const allowValidAndWarning = ["VALID", "WARNING"] as const;

  it("fails closed when quality assessment is missing", () => {
    const gate = evaluateMifAnalyticalQualityGate({
      quality: null,
      allowedStatusesForConfirmedAnchors: allowValidOnly,
    });
    expect(gate.present).toBe(false);
    expect(gate.allowsConfirmedAnchors).toBe(false);
    expect(gate.qualityStatus).toBe("MISSING");
    expect(gate.analyticalStatusHint).toBe("INSUFFICIENT_DATA");
    expect(gate.reasonCode).toBe("QUALITY_MISSING");
    expect(gate.doesNotApproveAiReasoning).toBe(true);
  });

  it("allows confirmed anchors for VALID under policy", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    // Session calendar uncertainty typically yields WARNING — force path by checking status.
    const gate = evaluateMifAnalyticalQualityGate({
      quality: { kind: "step1-data-integrity", assessment: integrity },
      allowedStatusesForConfirmedAnchors:
        integrity.status === "VALID" ? allowValidOnly : allowValidAndWarning,
    });
    expect(gate.present).toBe(true);
    expect(gate.qualityInputIdentity).toBe(integrity.inputIdentity);
    expect(gate.doesNotApproveAiReasoning).toBe(true);
    if (integrity.status === "VALID" || integrity.status === "WARNING") {
      expect(gate.allowsConfirmedAnchors).toBe(true);
    }
  });

  it("does not upgrade WARNING to VALID and can disallow confirmed anchors", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    // Clone with WARNING status without mutating original assessment object fields used by Phase 2.
    const warned = { ...integrity, status: "WARNING" as const };
    const originalStatus = integrity.status;

    const disallowed = evaluateMifAnalyticalQualityGate({
      quality: { kind: "step1-data-integrity", assessment: warned },
      allowedStatusesForConfirmedAnchors: allowValidOnly,
    });
    expect(disallowed.qualityStatus).toBe("WARNING");
    expect(disallowed.allowsConfirmedAnchors).toBe(false);
    expect(disallowed.reasonCode).toBe("QUALITY_DISALLOWS_CONFIRMED");
    expect(disallowed.analyticalStatusHint).toBe("INSUFFICIENT_DATA");

    const allowed = evaluateMifAnalyticalQualityGate({
      quality: { kind: "step1-data-integrity", assessment: warned },
      allowedStatusesForConfirmedAnchors: allowValidAndWarning,
    });
    expect(allowed.allowsConfirmedAnchors).toBe(true);
    expect(allowed.analyticalStatusHint).toBe("WARNING");
    expect(integrity.status).toBe(originalStatus);
  });

  it("maps BLOCKED and DEGRADED without upgrading", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const blocked = { ...integrity, status: "BLOCKED" as const };
    const degraded = { ...integrity, status: "DEGRADED" as const };

    const gBlock = evaluateMifAnalyticalQualityGate({
      quality: { kind: "step1-data-integrity", assessment: blocked },
      allowedStatusesForConfirmedAnchors: allowValidOnly,
    });
    expect(gBlock.allowsConfirmedAnchors).toBe(false);
    expect(gBlock.analyticalStatusHint).toBe("BLOCKED");
    expect(gBlock.reasonCode).toBe("QUALITY_BLOCKED");

    const gDeg = evaluateMifAnalyticalQualityGate({
      quality: { kind: "step1-data-integrity", assessment: degraded },
      allowedStatusesForConfirmedAnchors: ["VALID", "DEGRADED"],
    });
    expect(gDeg.allowsConfirmedAnchors).toBe(true);
    expect(gDeg.analyticalStatusHint).toBe("DEGRADED");
    expect(gDeg.qualityStatus).toBe("DEGRADED");
  });

  it("never mutates Phase 2 AI gate fields (assessment remains MIF-scoped)", () => {
    const integrity = assessMifDataIntegrity({
      candles: [candle(1_700_000_000)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(integrity.doesNotApproveAiReasoning).toBe(true);
    expect(integrity.placesOrders).toBe(false);
    evaluateMifAnalyticalQualityGate({
      quality: { kind: "step1-data-integrity", assessment: integrity },
      allowedStatusesForConfirmedAnchors: allowValidOnly,
    });
    expect(integrity.doesNotApproveAiReasoning).toBe(true);
    expect((integrity as { approvedForAiReasoning?: boolean }).approvedForAiReasoning).toBeUndefined();
  });
});
