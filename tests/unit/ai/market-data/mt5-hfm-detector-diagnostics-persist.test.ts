/**
 * Detector outcome diagnostics must persist (not status-only).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  runMifOpportunityDetection,
  MIF_PROVIDER_ID,
  type MifOpportunityDetectionContext,
  type MifProductionIntegrationResult,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

describe("HFM detector diagnostics persistence", () => {
  let tmp: string;
  let store: MifOpportunityStorage;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-diag-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    store = new MifOpportunityStorage(tmp);
    __setMifOpportunityStorageForTests(store);
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("runMifOpportunityDetection returns diagnostics for all 10 detectors", () => {
    const ctx: MifOpportunityDetectionContext = {
      contextVersion: "1.0.0",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      instrument: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      timebase: "BROKER_SERVER",
      dataQualityStatus: "VALID",
      availableTimeframeRoles: [
        "PRIMARY_DIRECTION",
        "INTERMEDIATE_STRUCTURE",
        "SETUP_DEVELOPMENT",
        "OPPORTUNITY_TRIGGER",
        "LOWER_TIMEFRAME_CONFIRMATION",
      ],
      evidence: [],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDetectionContextOnly: true,
    };
    const run = runMifOpportunityDetection({ context: ctx });
    expect(run.outcomes.length).toBeGreaterThanOrEqual(10);
    for (const o of run.outcomes) {
      expect(typeof o.diagnostics).toBe("string");
      expect(o.diagnostics.length).toBeGreaterThan(0);
      expect(o.status).toBeTruthy();
    }
  });

  it("persisted run stores diagnostics and reasonCodes", async () => {
    const fakeResult = {
      requestId: "req-diag-1",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      requestedTimeframes: ["H1"],
      resolvedTimeframes: ["H1"],
      primaryTimeframe: "H1",
      marketDataTimestamp: "2024-01-01T00:00:00.000Z",
      processingTimestamp: "2024-01-01T00:00:01.000Z",
      candleTimestampSec: null,
      candleLifecycle: null,
      dataFreshness: "LIVE",
      dataQualityStatus: "VALID",
      analysisStatus: "OK_EMPTY_CANDIDATES",
      candidateCount: 0,
      contractId: "kwizera.mif.production-integration.v1",
      contractVersion: "1.0.0",
      engineId: "mif-production-integration",
      engineVersion: "1.0.0",
      availableTimeframeRoles: [],
      timeframeSnapshots: [],
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      warnings: [],
      errors: [],
      failureCodes: [],
      detection: {
        outcomes: [
          {
            strategyId: "TREND_CONTINUATION",
            detectorId: "mif.detector.trend-continuation",
            detectorVersion: "1.0.0",
            status: "INSUFFICIENT_EVIDENCE",
            evaluationTimestamp: "2024-01-01T00:00:00.000Z",
            eligibility: null,
            evidenceValidation: null,
            candidate: null,
            reasonCodes: ["INSUFFICIENT_EVIDENCE"],
            warnings: ["optional missing"],
            diagnostics: "market structure evidence absent or unusable",
            placesOrders: false as const,
            mutatesBroker: false as const,
            acceptsForExecution: false as const,
            doesNotApproveAiReasoning: true as const,
            analyticalOutcomeOnly: true as const,
          },
        ],
        candidates: [],
      },
      placesOrders: false as const,
      mutatesBroker: false as const,
      acceptsForExecution: false as const,
      doesNotApproveAiReasoning: true as const,
    } as unknown as MifProductionIntegrationResult;

    const { run } = await store.persistAnalysisResult(fakeResult, {
      runId: "run-diag-test",
      analysisStartedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(run.detectorOutcomes[0]!.diagnostics).toMatch(/market structure/i);
    expect(run.detectorOutcomes[0]!.reasonCodes?.[0]).toBeTruthy();
    expect(run.detectorOutcomes[0]!.status).toBe("INSUFFICIENT_EVIDENCE");

    const loaded = await store.getRun("run-diag-test");
    expect(loaded!.detectorOutcomes[0]!.diagnostics).toMatch(/market structure/i);
  });
});
