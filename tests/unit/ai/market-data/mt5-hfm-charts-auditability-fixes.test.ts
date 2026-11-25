/**
 * Charts Analyze Now auditability fixes:
 * A) OD persistence parity + snapshot linkage + idempotency
 * B) Prompt provenance / numeric measurement subset
 * C) observedFacts serialization (no [object Object])
 * D) Scenario directional geometry validation
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  MIF_PROVIDER_ID,
  buildScenarioLevels,
  validateScenarioLevelGeometry,
  type MifOpportunityCandidate,
  type MifProductionIntegrationResult,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  buildHfmPromptProvenance,
  extractPromptMeasurementSubset,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/prompt-provenance";
import { normalizeHfmReasoningRawPayload } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/validate-response";
import {
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/constants";

describe("FIX A — Charts OD persistence parity", () => {
  let tmp: string;
  let store: MifOpportunityStorage;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-charts-od-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    store = new MifOpportunityStorage(tmp);
    __setMifOpportunityStorageForTests(store);
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function fakeResult(overrides?: Partial<MifProductionIntegrationResult>): MifProductionIntegrationResult {
    return {
      requestId: "req-charts-1",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      requestedTimeframes: ["H1", "M15"],
      resolvedTimeframes: ["H1", "M15"],
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
            strategyId: "PULLBACK",
            detectorId: "mif.detector.pullback",
            detectorVersion: "1.0.0",
            status: "NO_CANDIDATE",
            evaluationTimestamp: "2024-01-01T00:00:00.000Z",
            eligibility: null,
            evidenceValidation: { ok: false, missingRequired: ["pb.resume_closed"], failed: [], warnings: [], duplicateSourceAssessmentIds: [], reasonCodes: ["INSUFFICIENT_EVIDENCE"], explanation: "missing" },
            candidate: null,
            reasonCodes: ["NO_CANDIDATE"],
            warnings: ["FORMING tip"],
            diagnostics: "waiting for closed resumption",
            placesOrders: false as const,
            mutatesBroker: false as const,
            acceptsForExecution: false as const,
            doesNotApproveAiReasoning: true as const,
            analyticalOutcomeOnly: true as const,
          },
          {
            strategyId: "BREAKOUT",
            detectorId: "mif.detector.breakout",
            detectorVersion: "1.0.0",
            status: "INELIGIBLE",
            evaluationTimestamp: "2024-01-01T00:00:00.000Z",
            eligibility: null,
            evidenceValidation: { ok: false, missingRequired: ["bo.regime"], failed: [], warnings: [], duplicateSourceAssessmentIds: [], reasonCodes: ["INELIGIBLE"], explanation: "regime" },
            candidate: null,
            reasonCodes: ["INELIGIBLE"],
            warnings: [],
            diagnostics: "regime dimensions incompatible",
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
      ...overrides,
    } as unknown as MifProductionIntegrationResult;
  }

  it("persists run with snapshotId linkage and detector diagnostics", async () => {
    const snap = "snap-charts-audit-1";
    const { run, created } = await store.persistAnalysisResult(fakeResult(), {
      runId: snap,
      snapshotId: snap,
      snapshotHash: "hash-1",
      chartsCorrelationId: snap,
      provenanceSource: "CHARTS_ANALYZE_NOW",
      analysisStartedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(created).toBe(true);
    expect(run.snapshotId).toBe(snap);
    expect(run.snapshotHash).toBe("hash-1");
    expect(run.provenance?.source).toBe("CHARTS_ANALYZE_NOW");
    expect(run.detectorOutcomes).toHaveLength(2);
    expect(run.detectorOutcomes[0]!.diagnostics).toMatch(/closed resumption/i);
    expect(run.detectorOutcomes[0]!.reasonCodes).toContain("NO_CANDIDATE");
    expect(run.detectorOutcomes[0]!.missingEvidence).toContain("pb.resume_closed");
    expect(run.detectorOutcomes[1]!.status).toBe("INELIGIBLE");

    const bySnap = await store.getRunBySnapshotId(snap);
    expect(bySnap?.runId).toBe(snap);
    expect(bySnap?.detectorOutcomes[0]!.diagnostics).toBeTruthy();
  });

  it("idempotent re-persist does not duplicate run", async () => {
    const snap = "snap-idem-1";
    const first = await store.persistAnalysisResult(fakeResult(), {
      runId: snap,
      snapshotId: snap,
      provenanceSource: "CHARTS_ANALYZE_NOW",
    });
    const second = await store.persistAnalysisResult(fakeResult(), {
      runId: snap,
      snapshotId: snap,
      provenanceSource: "CHARTS_ANALYZE_NOW",
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.run.runId).toBe(first.run.runId);
  });

  it("persists actual candidate with snapshotId; does not invent candidates for rejections", async () => {
    const snap = "snap-cand-1";
    const candId = "cand-real-1";
    const withCand = fakeResult({
      analysisStatus: "OK_WITH_CANDIDATES",
      candidateCount: 1,
      detection: {
        outcomes: [
          {
            strategyId: "PULLBACK",
            detectorId: "mif.detector.pullback",
            detectorVersion: "1.0.0",
            status: "CANDIDATE_PRODUCED",
            evaluationTimestamp: "2024-01-01T00:00:00.000Z",
            eligibility: null,
            evidenceValidation: null,
            candidate: {
              candidateId: candId,
              strategyId: "PULLBACK",
              detectorId: "mif.detector.pullback",
              providerId: MIF_PROVIDER_ID,
              providerSymbol: "XAUUSD",
              direction: "BEARISH",
              status: "DETECTED",
              timeframeRoles: ["INTERMEDIATE_STRUCTURE"],
              assessmentTimestamp: "2024-01-01T00:00:00.000Z",
              supportingEvidenceIds: [],
              conflictingEvidenceIds: [],
              requiredConfirmations: ["pb.resume_closed"],
              invalidationConditions: ["invalidationPrice=3512.49"],
              knownLimitations: [],
              thesis: "test",
              rationale: "test",
              quality: null,
              regimeAssessmentId: null,
              mtfAssessmentId: null,
              doesNotApproveAiReasoning: true,
              analyticalCandidateOnly: true,
              notExecutable: true,
            },
            reasonCodes: ["CANDIDATE_PRODUCED"],
            warnings: [],
            diagnostics: "pullback detected",
            placesOrders: false as const,
            mutatesBroker: false as const,
            acceptsForExecution: false as const,
            doesNotApproveAiReasoning: true as const,
            analyticalOutcomeOnly: true as const,
          },
          {
            strategyId: "RANGE",
            detectorId: "mif.detector.range",
            detectorVersion: "1.0.0",
            status: "INELIGIBLE",
            evaluationTimestamp: "2024-01-01T00:00:00.000Z",
            eligibility: null,
            evidenceValidation: null,
            candidate: null,
            reasonCodes: ["INELIGIBLE"],
            warnings: [],
            diagnostics: "ineligible",
            placesOrders: false as const,
            mutatesBroker: false as const,
            acceptsForExecution: false as const,
            doesNotApproveAiReasoning: true as const,
            analyticalOutcomeOnly: true as const,
          },
        ],
        candidates: [
          {
            candidateId: candId,
            strategyId: "PULLBACK",
            detectorId: "mif.detector.pullback",
            providerId: MIF_PROVIDER_ID,
            providerSymbol: "XAUUSD",
            direction: "BEARISH",
            status: "DETECTED",
            timeframeRoles: ["INTERMEDIATE_STRUCTURE"],
            assessmentTimestamp: "2024-01-01T00:00:00.000Z",
            supportingEvidenceIds: [],
            conflictingEvidenceIds: [],
            requiredConfirmations: ["pb.resume_closed"],
            invalidationConditions: ["invalidationPrice=3512.49"],
            knownLimitations: [],
            thesis: "test",
            rationale: "test",
            quality: null,
            regimeAssessmentId: null,
            mtfAssessmentId: null,
            doesNotApproveAiReasoning: true,
            analyticalCandidateOnly: true,
            notExecutable: true,
          },
        ],
      },
    } as Partial<MifProductionIntegrationResult>);

    const { candidates, run } = await store.persistAnalysisResult(withCand, {
      runId: snap,
      snapshotId: snap,
      provenanceSource: "CHARTS_ANALYZE_NOW",
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.snapshotId).toBe(snap);
    expect(candidates[0]!.candidateId).toBe(candId);
    expect(run.detectorOutcomes.find((o) => o.strategyId === "RANGE")?.candidateId ?? null).toBeNull();
  });
});

describe("FIX B — prompt provenance", () => {
  it("digest matches rendered prompt and captures RSI/ROC/ATR subset", () => {
    const system = "SYSTEM_RULES";
    const unified = {
      deterministicEvidence: {
        evidencePackageId: "umep:test",
        items: [
          {
            evidenceId: "me.momentum",
            timeframe: "H1",
            sourceEngine: "momentum",
            candleStatus: "CLOSED",
            measurements: [
              { id: "rsi", value: 33.47068675172568, unit: "index_0_100" },
              { id: "roc", value: -0.7147498375568637, unit: "percent" },
              { id: "rsiMethod", value: "Wilder" },
              { id: "symbol", value: "XAUUSD" },
            ],
            levels: [],
            conflictingEvidenceIds: [],
            warnings: [],
            limitations: [],
          },
          {
            evidenceId: "me.displacement",
            timeframe: "H1",
            sourceEngine: "displacement",
            candleStatus: "FORMING",
            measurements: [
              { id: "atr", value: 17.944285714285634, unit: "price" },
              { id: "atrMethod", value: "SMA_OF_TR" },
            ],
            levels: [{ kind: "SWING_LOW", price: 3512.49, side: "LOW" }],
            conflictingEvidenceIds: ["pb.mtf"],
            warnings: ["conflictKind=DIRECTIONAL"],
            limitations: [],
          },
        ],
      },
      scenarioPackage: {
        bearishScenario: {
          levels: { status: "LEVELS_PARTIAL" },
          conflictingEvidenceIds: ["ume.deep_technical_intelligence"],
        },
      },
    };
    const user = JSON.stringify(unified);
    const prov = buildHfmPromptProvenance({
      systemPrompt: system,
      userPrompt: user,
      unifiedJson: unified,
      model: "gpt-test",
      analysisId: "an-1",
      snapshotId: "snap-1",
      evidencePackageId: "umep:test",
      scenarioPackageId: "scen-1",
      unifiedInputIdentity: "uid-1",
    });
    const expected = createHash("sha256")
      .update(system, "utf8")
      .update("\n---\n", "utf8")
      .update(user, "utf8")
      .digest("hex");
    expect(prov.promptDigest).toBe(expected);
    expect(prov.promptVersion).toBe(HFM_REASONING_PROMPT_VERSION);
    expect(prov.containsSecrets).toBe(false);
    const ids = prov.numericMeasurements.map((m) => m.measurementId);
    expect(ids).toContain("rsi");
    expect(ids).toContain("roc");
    expect(ids).toContain("atr");
    expect(prov.numericMeasurements.find((m) => m.measurementId === "rsi")?.value).toBe(33.47068675172568);
    expect(prov.levelRefs.some((l) => l.price === 3512.49)).toBe(true);
    expect(prov.conflictEvidenceIds).toEqual(
      expect.arrayContaining(["pb.mtf", "ume.deep_technical_intelligence"]),
    );

    const subset = extractPromptMeasurementSubset(unified);
    expect(subset.numericMeasurements.some((m) => m.measurementId === "rsi")).toBe(true);
  });
});

describe("FIX C — observedFacts serialization", () => {
  const expected = {
    symbol: "XAUUSD",
    contextId: "ctx-1",
    snapshotId: "snap-1",
    snapshotHash: "hash-1",
    model: "gpt-test",
    analysisId: "an-1",
  };

  it("coerces object facts to readable strings (never [object Object])", () => {
    const { payload } = normalizeHfmReasoningRawPayload(
      {
        schemaVersion: HFM_REASONING_SCHEMA_VERSION,
        promptVersion: HFM_REASONING_PROMPT_VERSION,
        provider: "HFM_MT5",
        symbol: "XAUUSD",
        contextId: "ctx-1",
        snapshotId: "snap-1",
        snapshotHash: "hash-1",
        model: "gpt-test",
        analysisId: "an-1",
        decision: {
          action: "WAITING_FOR_CONFIRMATION",
          confidence: 50,
          confidenceLabel: "MODERATE",
          summary: "Waiting",
        },
        evidence: {
          observedFacts: [
            { text: "H1 RSI below 40", evidenceId: "me.momentum" },
            { summary: "Bearish structure at swing low" },
            "plain string fact",
            null,
            {},
            { value: 33.47, note: "rsi" },
          ],
          interpretations: [{ summary: "Pullback may continue" }],
          uncertainties: [],
          missingData: [],
          dataQualityWarnings: [],
        },
      },
      expected,
    );
    const ev = (payload as { evidence?: { observedFacts?: string[]; interpretations?: string[] } }).evidence;
    const facts = ev?.observedFacts ?? [];
    expect(facts.every((f) => !String(f).includes("[object Object]"))).toBe(true);
    expect(facts.some((f) => String(f).includes("H1 RSI below 40"))).toBe(true);
    expect(facts).toContain("plain string fact");
    const inter = ev?.interpretations ?? [];
    expect(inter.some((s) => String(s).includes("Pullback may continue"))).toBe(true);
  });

  it("handles empty array, null, and malformed [object Object] string", () => {
    const empty = normalizeHfmReasoningRawPayload(
      {
        schemaVersion: HFM_REASONING_SCHEMA_VERSION,
        evidence: { observedFacts: [], interpretations: [], uncertainties: [], missingData: [] },
      },
      expected,
    );
    expect(
      (empty.payload as { evidence?: { observedFacts?: string[] } }).evidence?.observedFacts,
    ).toEqual([]);

    const malformed = normalizeHfmReasoningRawPayload(
      {
        schemaVersion: HFM_REASONING_SCHEMA_VERSION,
        evidence: {
          observedFacts: "[object Object]",
          interpretations: null,
          uncertainties: undefined,
        },
      },
      expected,
    );
    expect(
      (malformed.payload as { evidence?: { observedFacts?: string[] } }).evidence?.observedFacts,
    ).toEqual([]);
  });
});

describe("FIX D — scenario geometry", () => {
  function cand(conds: string[]): MifOpportunityCandidate {
    return {
      candidateId: "c1",
      strategyId: "PULLBACK",
      detectorId: "d1",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      direction: "BEARISH",
      status: "DETECTED",
      timeframeRoles: ["INTERMEDIATE_STRUCTURE"],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      requiredConfirmations: ["pb.resume_closed"],
      invalidationConditions: conds,
      knownLimitations: [],
      thesis: "t",
      rationale: "r",
      quality: null,
      regimeAssessmentId: null,
      mtfAssessmentId: null,
      doesNotApproveAiReasoning: true,
      analyticalCandidateOnly: true,
      notExecutable: true,
    };
  }

  it("rejects crossed bearish inv/target geometry without fabricating entry", () => {
    const levels = buildScenarioLevels({
      side: "BEARISH",
      candidates: [
        cand([
          "invalidationPrice=3512.49",
          "invalidationSide=ABOVE",
          "targetPrice=3513.345",
          "targetSide=BELOW",
        ]),
      ],
    });
    expect(levels.status).toBe("LEVELS_INVALID_GEOMETRY");
    expect(levels.entry).toBeNull();
    expect(levels.riskReward).toBeNull();
    expect(levels.invalidation?.price).toBe(3512.49);
    expect(levels.targets[0]?.price).toBe(3513.345);
    expect(levels.notes.some((n) => n.includes("GEOMETRY_INVALID"))).toBe(true);
  });

  it("keeps valid partial when entry missing but geometry coherent", () => {
    const levels = buildScenarioLevels({
      side: "BEARISH",
      candidates: [
        cand([
          "invalidationPrice=3520",
          "invalidationSide=ABOVE",
          "targetPrice=3500",
          "targetSide=BELOW",
        ]),
      ],
    });
    expect(levels.status).toBe("LEVELS_PARTIAL");
    expect(levels.entry).toBeNull();
    expect(levels.notes.some((n) => n.includes("LEVELS_PARTIAL"))).toBe(true);
  });

  it("validateScenarioLevelGeometry distinguishes incomplete vs invalid", () => {
    expect(
      validateScenarioLevelGeometry({
        side: "BEARISH",
        entryPrice: null,
        invalidationPrice: 3520,
        targetPrice: 3500,
      })?.ok,
    ).toBe(true);
    expect(
      validateScenarioLevelGeometry({
        side: "BEARISH",
        entryPrice: null,
        invalidationPrice: 3512.49,
        targetPrice: 3513.345,
      })?.ok,
    ).toBe(false);
  });

  it("FORMING/WAITING safeguards: LEVELS_NOT_PROVIDED stays when no prices", () => {
    const levels = buildScenarioLevels({ side: "BULLISH", candidates: [cand([])] });
    expect(levels.status).toBe("LEVELS_NOT_PROVIDED");
    expect(levels.entry).toBeNull();
  });
});
