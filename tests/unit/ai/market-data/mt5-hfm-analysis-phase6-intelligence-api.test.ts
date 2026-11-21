/**
 * Phase 6 — read-only intelligence/scenario public summaries (no OHLC/secrets).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HfmAnalysisStorage,
  __setHfmAnalysisStorageForTests,
  buildPublicIntelligenceSummary,
  buildPublicScenarioSummary,
  HFM_INTELLIGENCE_PUBLIC_MAX_EVIDENCE,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";
import { getMifOdWorkerStatus } from "../../../../ai/market-data/mt5-hfm/mif/index";
import { OPENAI_AI_MAX_CONCURRENT } from "../../../../ai/forex-ai/snapshot-openai/concurrency";

const SNAP = "snap-phase6-aaaa-bbbb-cccc-dddddddddddd";

function makeOrch(overrides?: Record<string, unknown>) {
  const items = Array.from({ length: 3 }, (_, i) => ({
    contractId: "kwizera.mif.unified-market-evidence.v1",
    contractVersion: "1.0.0",
    evidenceId: `ev-${i}`,
    signalId: null,
    analysisId: null,
    sourceEngine: "test",
    engineVersion: "1",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframe: "M15",
    instrument: null,
    evidenceType: "MARKET_STRUCTURE",
    direction: "BULLISH",
    eventTime: null,
    observedAt: new Date().toISOString(),
    candleStatus: "CLOSED",
    levels: [{ id: `l-${i}`, kind: "SUPPORT", price: 2000 + i, side: "LOW", note: null }],
    measurements: [],
    supportingEvidenceIds: [],
    conflictingEvidenceIds: [],
    warnings: [],
    limitations: [],
    validFrom: null,
    validUntil: null,
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: 0.5,
      scale: "0-1",
      isWinProbability: false,
      isCalibratedPrediction: null,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "test",
    },
    provenance: {
      sourceAssessmentId: `sa-${i}`,
      sourceInputIdentity: null,
      sourceContractId: null,
      sourceContractVersion: null,
      sourceCandidateId: null,
      runId: null,
      snapshotId: SNAP,
      datasetId: null,
      contentHash: null,
      sourceFingerprint: `fp-${i}`,
      snapshotIdSourceVerified: true,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalEvidenceOnly: true,
    notExecutable: true,
  }));
  return {
    contractId: "kwizera.mif.intelligence-orchestration.v1",
    contractVersion: "1.0.0",
    correlationId: "c1",
    snapshotId: SNAP,
    snapshotHash: "h".repeat(64),
    hashVersion: "hfm-analysis-snapshot-v1",
    snapshotIdSourceVerified: true,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    timeframePack: ["H4", "H1", "M30", "M15", "M5"],
    candleTipStates: { M5: "FORMING" },
    mifRequestId: "r1",
    mifRunId: "run1",
    evidencePackageId: "ep1",
    evidencePackage: {
      contractId: "kwizera.mif.market-evidence-package.v1",
      contractVersion: "1.0.0",
      packageId: "ep1",
      analysisId: null,
      runId: null,
      snapshotId: SNAP,
      snapshotIdSourceVerified: true,
      providerId: "HFM_MT5",
      providerSymbol: "XAUUSD",
      assembledAt: new Date().toISOString(),
      items,
      relations: [],
      droppedDuplicateCount: 0,
      warnings: [],
      limitations: [],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalEvidencePackageOnly: true,
      notExecutable: true,
    },
    scenarioPackage: null,
    scenarioPackageId: null,
    orchestrationStatus: "COMPLETE",
    completeness: {
      expectedTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      presentTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      missingTimeframes: [],
      enginesCompleted: [],
      enginesSkipped: [],
      rankingIncluded: true,
      probabilityIncluded: false,
      scenarioIncluded: false,
      evidenceItemCount: 3,
      evidenceTrustedComplete: true,
      notes: [],
    },
    warnings: [],
    failureReason: null,
    timingsMs: { validateMs: 1, seriesAdaptMs: 1, pipelineMs: 1, assembleMs: 1, persistMs: 1, totalMs: 5 },
    capturedAt: new Date().toISOString(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOrchestrationOnly: true,
    notExecutable: true,
    ...overrides,
  };
}

function makeScenario() {
  const side = (dir: "BULLISH" | "BEARISH") => ({
    scenarioId: `sc-${dir.toLowerCase()}`,
    setupFingerprint: `fp-${dir}`,
    side: dir,
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    status: "WAITING_FOR_CONFIRMATION",
    lifecycleState: "WATCHING",
    thesis: `${dir} thesis`,
    rationale: "r",
    supportingEvidenceIds: ["ev-0"],
    conflictingEvidenceIds: [],
    missingConfirmations: ["confirm"],
    invalidationConditions: ["entryPrice=2000"],
    contributingCandidateIds: [],
    contributingStrategyIds: [],
    levels: {
      status: "AVAILABLE_FROM_SOURCE",
      entry: { kind: "ENTRY", price: 2000, side: "AT", provenance: "t", source: "CANDIDATE_NOTES" },
      invalidation: { kind: "INVALIDATION", price: 1995, side: "BELOW", provenance: "t", source: "CANDIDATE_NOTES" },
      targets: [{ kind: "TARGET", price: 2010, side: "ABOVE", provenance: "t", source: "CANDIDATE_NOTES" }],
      riskReward: 2,
      notes: [],
    },
    evidenceCompleteness: {
      supportingCount: 1,
      conflictingCount: 0,
      uniqueAssessmentCount: 1,
      incompleteEvidence: false,
      formingOnlyConfirmationBlocked: false,
      trustedConfirmed: true,
    },
    warnings: [],
    assessmentTimestamp: new Date().toISOString(),
    snapshotId: SNAP,
    snapshotIdSourceVerified: true,
    analyticalScenarioOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  });
  return {
    contractId: "kwizera.mif.scenario-package.v1",
    contractVersion: "1.0.0",
    engineId: "mif-hfm-scenario-intelligence",
    engineVersion: "1.0.0",
    packageId: "sp1",
    providerId: "HFM_MT5",
    providerSymbol: "XAUUSD",
    snapshotId: SNAP,
    snapshotHash: "h".repeat(64),
    snapshotIdSourceVerified: true,
    assessmentTimestamp: new Date().toISOString(),
    bullishScenario: side("BULLISH"),
    bearishScenario: side("BEARISH"),
    outcome: "BALANCED_CONFLICT",
    strongerSide: null,
    comparisonExplanation: "balanced",
    timeframeContext: {
      expectedTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      presentTimeframes: ["H4", "H1", "M30", "M15", "M5"],
      missingTimeframes: [],
      tipStates: {},
      higherTimeframeContext: [],
      intermediateStructure: [],
      lowerTimeframeFormation: [],
      conflictNotes: [],
    },
    warnings: [],
    completenessTrusted: true,
    analyticalPackageOnly: true,
    notExecutable: true,
    doesNotApproveAiReasoning: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

describe("Phase 6 — intelligence public summaries", () => {
  it("returns bounded evidence without inventing snapshot identity", () => {
    const many = makeOrch();
    const items = Array.from({ length: 100 }, (_, i) => ({
      ...(many.evidencePackage as { items: unknown[] }).items[0],
      evidenceId: `ev-x-${i}`,
    }));
    (many.evidencePackage as { items: unknown[] }).items = items;
    const built = buildPublicIntelligenceSummary({
      snapshotId: SNAP,
      expectedSymbol: "XAUUSD",
      orchestration: many,
    });
    expect(built.ok).toBe(true);
    expect(built.summary?.evidence).toBeTruthy();
    const ev = built.summary!.evidence as { itemCount: number; truncated: boolean; totalAvailable: number };
    expect(ev.itemCount).toBe(HFM_INTELLIGENCE_PUBLIC_MAX_EVIDENCE);
    expect(ev.truncated).toBe(true);
    expect(ev.totalAvailable).toBe(100);
    expect(JSON.stringify(built.summary)).not.toMatch(/apiKey|KWIZERA_SECRETS|sk-/i);
  });

  it("rejects snapshot mismatch", () => {
    const orch = makeOrch({ snapshotId: "other" });
    const built = buildPublicIntelligenceSummary({
      snapshotId: SNAP,
      orchestration: orch,
    });
    expect(built.ok).toBe(false);
    expect(built.status).toBe("MISMATCH");
  });

  it("rejects symbol mismatch", () => {
    const orch = makeOrch({ providerSymbol: "EURUSD" });
    const built = buildPublicIntelligenceSummary({
      snapshotId: SNAP,
      expectedSymbol: "XAUUSD",
      orchestration: orch,
    });
    expect(built.ok).toBe(false);
    expect(built.code).toBe("SYMBOL_MISMATCH");
  });

  it("handles missing intelligence", () => {
    const built = buildPublicIntelligenceSummary({
      snapshotId: SNAP,
      orchestration: null,
    });
    expect(built.found).toBe(false);
    expect(built.status).toBe("NOT_FOUND");
  });

  it("builds dual scenario summary", () => {
    const built = buildPublicScenarioSummary({
      snapshotId: SNAP,
      expectedSymbol: "XAUUSD",
      scenarioPackage: makeScenario(),
    });
    expect(built.ok).toBe(true);
    expect(built.summary?.bullishScenario).toBeTruthy();
    expect(built.summary?.bearishScenario).toBeTruthy();
    expect(built.summary?.outcome).toBe("BALANCED_CONFLICT");
  });
});

describe("Phase 6 — storage round-trip", () => {
  let tmp: string;
  let store: HfmAnalysisStorage;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-p6-"));
    store = new HfmAnalysisStorage(tmp);
    __setHfmAnalysisStorageForTests(store);
    await store.ensureReady();
  });

  afterEach(async () => {
    __setHfmAnalysisStorageForTests(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("loads exact snapshot packages", async () => {
    await store.saveIntelligenceOrchestration(SNAP, makeOrch());
    await store.saveScenarioPackage(SNAP, makeScenario());
    const orch = await store.loadIntelligenceOrchestration(SNAP);
    const sc = await store.loadScenarioPackage(SNAP);
    const intel = buildPublicIntelligenceSummary({ snapshotId: SNAP, orchestration: orch });
    const scen = buildPublicScenarioSummary({ snapshotId: SNAP, scenarioPackage: sc });
    expect(intel.ok).toBe(true);
    expect(scen.ok).toBe(true);
    expect(await store.loadScenarioPackage("missing")).toBeNull();
  });
});

describe("Phase 6 — safety constants", () => {
  it("keeps OD disabled and OpenAI concurrency 1", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
    expect(OPENAI_AI_MAX_CONCURRENT).toBe(1);
  });

  it("API routes include intelligence and scenario paths", async () => {
    const api = await fs.readFile(
      path.join(process.cwd(), "dev/server/mt5-hfm-analysis-api.ts"),
      "utf8",
    );
    expect(api).toMatch(/analysis\\\/intelligence\\\//);
    expect(api).toMatch(/analysis\\\/scenario\\\//);
    expect(api).toContain("buildPublicIntelligenceSummary");
    expect(api).toContain("buildPublicScenarioSummary");
  });
});
