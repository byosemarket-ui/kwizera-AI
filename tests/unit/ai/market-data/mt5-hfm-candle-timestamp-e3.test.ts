import { describe, expect, it, beforeEach } from "vitest";
import {
  normalizeHfmCandleOpenTime,
  noteHfmCandleOffsetObservation,
  resetHfmCandleOffsetHistoryForTests,
  selectOffsetForBrokerCandle,
  enrichBarsWithCandleTimeProvenance,
  isTrustedCandleUtc,
  HFM_CANDLE_LIVE_OFFSET_MAX_AGE_SEC,
} from "../../../../ai/market-data/mt5-hfm/candle-timestamp";
import { resetHfmTrustedBrokerUtcOffsetForTests } from "../../../../ai/market-data/mt5-hfm/quote-timestamp";
import { normalizeHistoricalBar } from "../../../../ai/market-data/mt5-hfm/analysis/normalizer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

beforeEach(() => {
  resetHfmCandleOffsetHistoryForTests();
  resetHfmTrustedBrokerUtcOffsetForTests();
});

describe("Engine 3 candle open-time normalization", () => {
  it("subtracts positive broker UTC offset correctly", () => {
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: 1795814100,
      brokerUtcOffsetSec: 7200,
      offsetStatus: "NORMALIZED",
      offsetTrust: "LIVE_OPEN_SESSION",
      offsetObservedAtBrokerSec: 1795814200,
      offsetObservedAtGmtSec: 1795807000,
      timestampSource: "mt5_copyrates",
    });
    expect(r.openTimeUtc).toBe(1795806900);
    expect(r.brokerOpenTime).toBe(1795814100);
    expect(r.timestampNormalizationStatus).toBe("NORMALIZED");
  });

  it("supports negative and zero offsets", () => {
    const neg = normalizeHfmCandleOpenTime({
      brokerOpenTime: 1_700_000_000,
      brokerUtcOffsetSec: -3600,
      offsetStatus: "NORMALIZED",
      offsetTrust: "LIVE_OPEN_SESSION",
      offsetObservedAtBrokerSec: 1_700_000_100,
      offsetObservedAtGmtSec: 1_700_003_700,
    });
    expect(neg.openTimeUtc).toBe(1_700_003_600);
    const zero = normalizeHfmCandleOpenTime({
      brokerOpenTime: 1_700_000_000,
      brokerUtcOffsetSec: 0,
      offsetStatus: "NORMALIZED",
      offsetTrust: "LIVE_OPEN_SESSION",
      offsetObservedAtBrokerSec: 1_700_000_100,
      offsetObservedAtGmtSec: 1_700_000_100,
    });
    expect(zero.openTimeUtc).toBe(1_700_000_000);
  });

  it("returns null UTC for null/untrusted/invalid offsets", () => {
    expect(
      normalizeHfmCandleOpenTime({
        brokerOpenTime: 1795814100,
        brokerUtcOffsetSec: null,
        offsetStatus: "UNAVAILABLE",
      }).openTimeUtc,
    ).toBeNull();
    expect(
      normalizeHfmCandleOpenTime({
        brokerOpenTime: 1795814100,
        brokerUtcOffsetSec: 7200,
        offsetStatus: "UNRELIABLE",
        offsetReason: "OFFSET_ABS_EXCEEDS_14H",
      }).openTimeUtc,
    ).toBeNull();
    expect(
      normalizeHfmCandleOpenTime({
        brokerOpenTime: 1795814100,
        brokerUtcOffsetSec: 20 * 3600,
        offsetStatus: "NORMALIZED",
      }).timestampNormalizationStatus,
    ).toBe("UNRELIABLE");
  });

  it("rejects millisecond-scale broker opens and double normalization", () => {
    expect(
      normalizeHfmCandleOpenTime({
        brokerOpenTime: 1795814100_000,
        brokerUtcOffsetSec: 7200,
        offsetStatus: "NORMALIZED",
      }).timestampNormalizationReason,
    ).toBe("MISSING_OR_INVALID_BROKER_OPEN_TIME");
    expect(
      normalizeHfmCandleOpenTime({
        brokerOpenTime: 1795806900,
        brokerUtcOffsetSec: 7200,
        offsetStatus: "NORMALIZED",
        alreadyNormalizedUtc: true,
      }).timestampNormalizationReason,
    ).toBe("REFUSE_DOUBLE_NORMALIZATION");
  });

  it("does not apply live offset to very old historical candles", () => {
    const obsBroker = 1_800_000_000;
    noteHfmCandleOffsetObservation({
      offsetSec: 7200,
      observedAtGmtSec: obsBroker - 7200,
      observedAtBrokerSec: obsBroker,
      status: "NORMALIZED",
    });
    const old = obsBroker - HFM_CANDLE_LIVE_OFFSET_MAX_AGE_SEC - 10_000;
    // Within Engine 1 max age from observation → historical path may still apply.
    // Force live trust path:
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: old,
      brokerUtcOffsetSec: 7200,
      offsetStatus: "NORMALIZED",
      offsetTrust: "LIVE_OPEN_SESSION",
      offsetObservedAtBrokerSec: obsBroker,
      offsetObservedAtGmtSec: obsBroker - 7200,
      preferLiveOffset: true,
    });
    expect(r.openTimeUtc).toBeNull();
    expect(r.timestampNormalizationReason).toBe("LIVE_OFFSET_TOO_OLD_FOR_CANDLE");
  });

  it("refuses conflicting offset observations in the same coverage window (DST ambiguity)", () => {
    const candle = 1_700_000_000;
    noteHfmCandleOffsetObservation({
      offsetSec: 7200,
      observedAtGmtSec: candle + 1000,
      observedAtBrokerSec: candle + 8200,
      status: "NORMALIZED",
    });
    noteHfmCandleOffsetObservation({
      offsetSec: 10800,
      observedAtGmtSec: candle + 2000,
      observedAtBrokerSec: candle + 12_800,
      status: "NORMALIZED",
    });
    const selected = selectOffsetForBrokerCandle(candle);
    expect(selected).toBeNull();
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: candle,
      preferLiveOffset: false,
      timestampSource: "mt5_copyrates",
    });
    expect(r.openTimeUtc).toBeNull();
    expect(r.timestampNormalizationStatus).toBe("UNAVAILABLE");
    expect(r.timestampNormalizationReason).toMatch(/AMBIGUOUS|UNAVAILABLE/);
  });

  it("normalizes bars within a trusted observation window", () => {
    noteHfmCandleOffsetObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_700_092_800,
      observedAtBrokerSec: 1_700_100_000,
      status: "NORMALIZED",
    });
    const bars = enrichBarsWithCandleTimeProvenance(
      [
        { time: 1_700_099_700, open: 1, high: 2, low: 0.5, close: 1.5 },
        { time: 1_700_099_800, open: 1, high: 2, low: 0.5, close: 1.5 },
      ],
      { timestampSource: "mt5_copyrates" },
    );
    expect(bars[0]!.openTimeUtc).toBe(1_700_099_700 - 7200);
    expect(bars[0]!.brokerOpenTime).toBe(1_700_099_700);
    expect(bars[0]!.time).toBe(1_700_099_700);
  });

  it("analysis normalizer does not label broker time as UTC", () => {
    noteHfmCandleOffsetObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_700_092_800,
      observedAtBrokerSec: 1_700_100_000,
      status: "NORMALIZED",
    });
    const n = normalizeHistoricalBar("EURUSD", "M5", {
      time: 1_700_099_700,
      open: 1.1,
      high: 1.2,
      low: 1.0,
      close: 1.15,
      tickVolume: 10,
      realVolume: null,
      spread: 1,
      validationStatus: "ok",
      provenance: "native",
      brokerOpenTime: 1_700_099_700,
      openTimeUtc: 1_700_092_500,
      brokerUtcOffsetSec: 7200,
      timestampNormalizationStatus: "NORMALIZED",
      timestampNormalizationReason: null,
      timestampSource: "mt5_copyrates",
      offsetObservedAtGmtSec: 1_700_092_800,
      offsetObservedAtBrokerSec: 1_700_100_000,
      offsetTrust: "TRUSTED_HISTORICAL",
      timestampObservedAt: null,
    });
    expect(n.timestamp).toBe(1_700_099_700);
    expect(n.brokerOpenTime).toBe(1_700_099_700);
    expect(n.openTimeUtc).toBe(1_700_092_500);
    expect(n.sourceTimestamp).toBe(1_700_099_700);
  });

  it("ships chart tooltip broker/UTC domain fix and 12-TF contract", () => {
    const workspace = readFileSync(
      resolve("desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx"),
      "utf8",
    );
    expect(workspace).toContain("(Broker)");
    expect(workspace).toContain("(UTC)");
    expect(workspace).not.toMatch(
      /new Date\(crosshair\.time \* 1000\)\.toISOString\(\)\.replace\("\.000Z", "Z"\)/,
    );
    const contract = readFileSync(
      resolve("ai/market-data/mt5-hfm/charts-analysis-contract.ts"),
      "utf8",
    );
    for (const tf of ["M1", "M3", "M5", "M15", "M30", "H1", "H2", "H4", "H6", "H12", "D1", "W1"]) {
      expect(contract).toContain(`"${tf}"`);
    }
    const candleTs = readFileSync(
      resolve("ai/market-data/mt5-hfm/candle-timestamp.ts"),
      "utf8",
    );
    expect(candleTs).toContain("normalizeHfmCandleOpenTime");
    expect(candleTs).toContain("REFUSE_DOUBLE_NORMALIZATION");
    expect(candleTs).toContain("OFFSET_TRANSITION_OR_DST_AMBIGUOUS");
  });
});
