/**
 * P8.E F2 — P8.D / F1 census confidence bucket parity (fixtures only).
 */
import { describe, it, expect } from "vitest";
import {
  classifyAnalyticalConfidenceBucket,
  classifyCalibrationCensusBucket,
  classifyCanonicalConfidenceBucket,
  classifyConfidenceBucketFromProvenance,
  coerceConfidenceBucketFilter,
  normalizeChartsAnalyticalConfidence,
  resolveCanonicalConfidence0to100,
  validateAnalyticsFilters,
  buildChartsPerformanceAnalytics,
} from "../../../../ai/market-data/mt5-hfm/analysis/prediction-outcome/index";

describe("P8.E F2 F1 normalizer parity examples", () => {
  const cases: Array<{ raw: unknown; canonical: number; bucket: string }> = [
    { raw: 0, canonical: 0, bucket: "<50" },
    { raw: 0.25, canonical: 25, bucket: "<50" },
    { raw: 0.5, canonical: 50, bucket: "50–<75" },
    { raw: 0.74, canonical: 74, bucket: "50–<75" },
    { raw: 0.75, canonical: 75, bucket: ">=75" },
    { raw: 50, canonical: 50, bucket: "50–<75" },
    { raw: 75, canonical: 75, bucket: ">=75" },
    { raw: 100, canonical: 100, bucket: ">=75" },
    { raw: 1, canonical: 100, bucket: ">=75" }, // F1: (0,1] fraction
  ];

  for (const c of cases) {
    it(`raw ${JSON.stringify(c.raw)} → ${c.canonical} → ${c.bucket}`, () => {
      const n = normalizeChartsAnalyticalConfidence(c.raw);
      expect(n.ok).toBe(true);
      if (!n.ok) return;
      expect(n.confidence).toBe(c.canonical);
      expect(classifyCanonicalConfidenceBucket(n.confidence)).toBe(c.bucket);
      expect(classifyCalibrationCensusBucket(n.confidence)).toBe(c.bucket);
      expect(classifyAnalyticalConfidenceBucket(c.raw as number)).toBe(c.bucket);
    });
  }

  it("null/invalid → UNKNOWN in both classifiers", () => {
    expect(classifyAnalyticalConfidenceBucket(null)).toBe("UNKNOWN");
    expect(classifyCalibrationCensusBucket(null)).toBe("UNKNOWN");
    expect(classifyAnalyticalConfidenceBucket(-1)).toBe("UNKNOWN");
    expect(classifyAnalyticalConfidenceBucket(101)).toBe("UNKNOWN");
    expect(classifyAnalyticalConfidenceBucket(Number.NaN)).toBe("UNKNOWN");
  });
});

describe("P8.E F2 no double-normalize of F1 provenance", () => {
  it("uses analyticalConfidence as-is when confidenceScale is percent", () => {
    const v = resolveCanonicalConfidence0to100({
      analyticalConfidence: 76,
      confidenceScale: "percent",
      rawAnalyticalConfidence: 0.76,
    });
    expect(v).toBe(76);
    expect(classifyConfidenceBucketFromProvenance({
      analyticalConfidence: 76,
      confidenceScale: "percent",
      rawAnalyticalConfidence: 0.76,
    })).toBe(">=75");
  });

  it("does not treat canonical 76 as fraction when scale is present", () => {
    // Old P8.D bug path: 76 > 1 → 0.76 → would mis-bucket if re-scaled.
    const bucket = classifyConfidenceBucketFromProvenance({
      analyticalConfidence: 76,
      confidenceScale: "fraction",
      rawAnalyticalConfidence: 0.76,
    });
    expect(bucket).toBe(">=75");
  });

  it("invalid scale → UNKNOWN", () => {
    expect(
      classifyConfidenceBucketFromProvenance({
        analyticalConfidence: 80,
        confidenceScale: "invalid",
      }),
    ).toBe("UNKNOWN");
  });

  it("legacy bare analyticalConfidence uses F1 normalizer", () => {
    expect(
      classifyConfidenceBucketFromProvenance({
        analyticalConfidence: 0.4,
      }),
    ).toBe("<50");
    expect(
      classifyConfidenceBucketFromProvenance({
        analyticalConfidence: 80,
      }),
    ).toBe(">=75");
  });
});

describe("P8.E F2 filter coercion and analytics breakdown", () => {
  it("accepts canonical and legacy filter tokens", () => {
    expect(coerceConfidenceBucketFilter(">=75")).toBe(">=75");
    expect(coerceConfidenceBucketFilter("≥0.75")).toBe(">=75");
    expect(coerceConfidenceBucketFilter("<0.5")).toBe("<50");
    expect(coerceConfidenceBucketFilter("0.5–0.75")).toBe("50–<75");
    expect(coerceConfidenceBucketFilter("AT_LEAST_75")).toBe(">=75");
    expect(validateAnalyticsFilters({ confidenceBucket: "≥0.75" }).ok).toBe(true);
    const v = validateAnalyticsFilters({ confidenceBucket: "≥0.75" });
    if (v.ok) expect(v.filters.confidenceBucket).toBe(">=75");
  });

  it("breakdown uses canonical bucket keys", () => {
    const report = buildChartsPerformanceAnalytics({
      evaluations: [
        {
          predictionId: "p1",
          evaluationId: "e1",
          resultKind: "TARGET_REACHED",
          entryTrigger: { status: "TRIGGERED" },
          computationTimestamp: "2026-11-01T00:00:00.000Z",
          evaluatorVersion: "1.0.0",
          signedRPolicyVersion: "1.0.0",
          realizedSignedRMultiple: 1,
          mae: 0.01,
          mfe: 0.02,
          provenance: {
            symbol: "EURUSD",
            timeframe: "H1",
            direction: "BUY",
            setupFingerprint: "s",
            analyticalConfidence: 80,
            confidenceScale: "percent",
            confidenceSource: "REASONING_STORE",
            pitManifestId: "pit",
            datasetId: "ds",
            datasetContentHash: "h",
          },
        } as any,
      ],
    });
    expect(report.breakdowns.analyticalConfidence.some((r) => r.key === ">=75")).toBe(true);
    expect(report.breakdowns.analyticalConfidence.some((r) => r.key === "≥0.75")).toBe(false);
  });
});
