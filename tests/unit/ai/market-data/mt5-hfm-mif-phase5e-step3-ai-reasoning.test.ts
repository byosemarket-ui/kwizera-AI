/**
 * Phase 5E Step 3 — AI Market Reasoning.
 * Uses fixture model content / injected chat; live OpenAI verified separately on VPS.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MIF_PROVIDER_ID,
  MIF_AI_MARKET_REASONING_CONTRACT_ID,
  MIF_AI_MARKET_REASONING_PROMPT_VERSION,
  buildMifAiReasoningContext,
  validateAndGroundMifAiReasoningOutput,
  runMifAiMarketReasoning,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  getMifOdWorkerStatus,
  type MifProductionIntegrationResult,
  type MifAiReasoningContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function bars(n = 80) {
  const T0 = 1_700_000_000;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + i * 0.35;
    const bump = i % 7 === 3 ? 1.8 : i % 7 === 6 ? -0.9 : 0;
    const close = c + bump;
    out.push({
      time: T0 + i * 3600,
      open: close - 0.15,
      high: close + 0.4,
      low: close - 0.4,
      close,
      tickVolume: 10,
      realVolume: null,
      spread: 2,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    });
  }
  return out;
}

function validOutputJson(ctx: MifAiReasoningContext): string {
  const eid = ctx.availableEvidenceIds[0] ?? "dq";
  return JSON.stringify({
    marketOverview: "HFM_MT5 XAUUSD analytical overview from context.",
    higherTimeframeAnalysis: "Higher TF regime from snapshots.",
    intermediateTimeframeAnalysis: "Intermediate structure noted.",
    lowerTimeframeAnalysis: "Lower TF development noted.",
    marketStructureAnalysis: "Structure derived from engines.",
    marketRegimeAnalysis: "Regime from context summaries.",
    liquidityAnalysis: "Liquidity refs only as candle-derived.",
    momentumAnalysis: "Momentum from engine notes.",
    displacementAnalysis: "Displacement CLOSED vs FORMING respected.",
    patternAnalysis: "Patterns only if present in evidence.",
    opportunityAnalysis: "Candidates listed in context.",
    rankingInterpretation:
      "Ranking score measures analytical setup quality only; it is distinct from historical probability and is not win probability.",
    probabilityInterpretation:
      ctx.probability?.probability == null
        ? `Probability unavailable (${ctx.probability?.sampleStatus ?? "null"}); null is not zero.`
        : `Source probability=${ctx.probability.probability}`,
    evidenceSummary: "Evidence summarized from supplied refs.",
    bullishScenario: {
      side: "BULLISH",
      status: "WAITING_FOR_CONFIRMATION",
      summary: "Bullish path needs confirmation.",
      supportingEvidenceRefs: [eid],
      contradictingEvidenceRefs: [],
      missingEvidence: ["levels"],
      confirmationConditions: ["CLOSED bullish confirmation"],
      invalidationConditions: ["Bearish structure break"],
      claimKinds: ["ENGINE_DERIVED", "AI_INTERPRETATION"],
      priceContextStatus: "LEVELS_NOT_PROVIDED",
      priceContextNotes: ["No inventing prices"],
    },
    bearishScenario: {
      side: "BEARISH",
      status: "DEVELOPING",
      summary: "Bearish path also considered.",
      supportingEvidenceRefs: [],
      contradictingEvidenceRefs: [eid],
      missingEvidence: [],
      confirmationConditions: ["CLOSED bearish confirmation"],
      invalidationConditions: ["Bullish reclaim"],
      claimKinds: ["HYPOTHESIS"],
      priceContextStatus: "LEVELS_NOT_PROVIDED",
      priceContextNotes: [],
    },
    scenarioComparison: "Neither forced; waiting for confirmation.",
    confirmationConditions: ["CLOSED confirmation"],
    invalidationConditions: ["Opposite structure break"],
    missingInformation: ["Exact levels not provided"],
    contradictions: ["Possible MTF conflict preserved"],
    reasoningConclusion: "Analytical only; no execution.",
    reasoningLimitations: ["AI interpretation bounded by context"],
    evidenceSupportStatus: "MODERATE_EVIDENCE_SUPPORT",
    citedEvidenceRefs: [eid],
  });
}

describe("Phase 5E Step 3 — context builder", () => {
  it("builds deterministic HFM_MT5 context identity", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5e3-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
    try {
      const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
        providerSymbol: "XAUUSD",
        primaryTimeframe: "H1",
        timeframes: ["H1", "H4"],
        series: [
          { timeframe: "H1", bars: bars(80) },
          { timeframe: "H4", bars: bars(80) },
        ],
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        maxCandleAgeSec: null,
      });
      const a = buildMifAiReasoningContext({ result: r });
      const b = buildMifAiReasoningContext({ result: r });
      expect(a.providerId).toBe(MIF_PROVIDER_ID);
      expect(a.contextIdentity).toBe(b.contextIdentity);
      expect(a.ranking?.isWinProbability).toBe(false);
      expect(a.doesNotApproveAiReasoning).toBe(true);
      if (a.probability?.probability == null) {
        expect(a.knownLimitations.some((l) => /null≠zero|null/.test(l))).toBe(true);
      }
    } finally {
      __setMifOpportunityStorageForTests(null);
      delete process.env.KWIZERA_STORAGE_ROOT;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("Phase 5E Step 3 — grounding validation", () => {
  function miniCtx(overrides?: Partial<MifAiReasoningContext>): MifAiReasoningContext {
    return {
      contextVersion: "v",
      contextIdentity: "id",
      providerId: "HFM_MT5",
      providerSymbol: "XAUUSD",
      analysisTimestamp: "2024-06-01T00:00:00.000Z",
      analysisRunId: "run1",
      primaryTimeframe: "H1",
      dataQualityStatus: "VALID",
      analysisStatus: "OK",
      mtfRelation: "ALIGNMENT",
      timeframeSnapshots: [],
      availableEvidenceIds: ["ev1", "ev2"],
      evidenceSummaries: [
        {
          evidenceId: "ev1",
          family: "MARKET_STRUCTURE",
          presence: "PRESENT",
          qualityStatus: "VALID",
          candleState: "CLOSED",
          notes: "bias=BULLISH",
        },
      ],
      candidates: [],
      structuredLevels: {
        entryPrice: null,
        targetPrice: null,
        invalidationPrice: null,
        source: "NONE",
        hasAnyFinite: false,
        candidateId: null,
      },
      ranking: {
        rankingRunId: "rank1",
        rankedCount: 0,
        top: [],
        isWinProbability: false,
      },
      probability: {
        assessmentId: null,
        candidateId: null,
        probability: null,
        rawEmpiricalFrequency: null,
        sampleStatus: "LEVELS_NOT_PROVIDED",
        calibrationStatus: "UNCALIBRATED",
        reliabilityStatus: "UNAVAILABLE",
        targetEvent: "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON",
        isWinProbability: false,
        limitations: [],
      },
      evidenceIntelligence: null,
      contextSummary: null,
      knownLimitations: [],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      ...overrides,
    };
  }

  it("accepts grounded valid output", () => {
    const ctx = miniCtx();
    const v = validateAndGroundMifAiReasoningOutput(validOutputJson(ctx), ctx);
    expect(v.ok).toBe(true);
    expect(v.output?.bullishScenario.side).toBe("BULLISH");
    expect(v.output?.bearishScenario.side).toBe("BEARISH");
  });

  it("rejects fabricated evidence references", () => {
    const ctx = miniCtx();
    const bad = JSON.parse(validOutputJson(ctx));
    bad.citedEvidenceRefs = ["fake-id-not-in-context"];
    bad.bullishScenario.supportingEvidenceRefs = ["fake-id-not-in-context"];
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(bad), ctx);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /unknown_evidence|cited_unknown/.test(e))).toBe(true);
  });

  it("rejects null probability misrepresented as zero win probability", () => {
    const ctx = miniCtx();
    const bad = JSON.parse(validOutputJson(ctx));
    bad.probabilityInterpretation = "Win probability is 0% based on missing sample";
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(bad), ctx);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /null_probability_misrepresented/.test(e))).toBe(true);
  });

  it("rejects ranking labeled as win probability", () => {
    const ctx = miniCtx();
    const bad = JSON.parse(validOutputJson(ctx));
    bad.rankingInterpretation = "Ranking score is the win probability of success";
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(bad), ctx);
    expect(v.ok).toBe(false);
  });

  it("rejects invented execution price language", () => {
    const ctx = miniCtx();
    const bad = JSON.parse(validOutputJson(ctx));
    bad.reasoningConclusion = "Enter at 2050 with stop loss=2000 take profit=2100";
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(bad), ctx);
    expect(v.ok).toBe(false);
  });

  it("rejects invalid JSON", () => {
    const v = validateAndGroundMifAiReasoningOutput("not-json", miniCtx());
    expect(v.ok).toBe(false);
  });

  it("downgrades CONFIRMED without supporting evidence", () => {
    const ctx = miniCtx();
    const bad = JSON.parse(validOutputJson(ctx));
    bad.bullishScenario.status = "CONFIRMED";
    bad.bullishScenario.supportingEvidenceRefs = [];
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(bad), ctx);
    expect(v.output?.bullishScenario.status).toBe("WAITING_FOR_CONFIRMATION");
    expect(v.errors.some((e) => /confirmed_without_supporting/.test(e))).toBe(true);
  });

  it("keeps both bullish and bearish scenarios without forcing direction", () => {
    const ctx = miniCtx();
    const v = validateAndGroundMifAiReasoningOutput(validOutputJson(ctx), ctx);
    expect(v.ok).toBe(true);
    expect(v.output?.bullishScenario.status).not.toBe("CONFIRMED");
    expect(v.output?.bearishScenario.side).toBe("BEARISH");
    expect(v.output?.reasoningConclusion).toMatch(/Analytical only/i);
  });
});

describe("Phase 5E Step 3 — engine with fixture / injected chat", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5e3e-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    delete process.env.KWIZERA_STORAGE_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns SUCCESS with fixture grounded output and persists", async () => {
    const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1"],
      series: [{ timeframe: "H1", bars: bars(80) }],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null,
    });
    const ctx = buildMifAiReasoningContext({ result: r });
    const run = await runMifAiMarketReasoning({
      result: r,
      fixtureModelContent: validOutputJson(ctx),
      calculatedAt: "2024-06-01T00:00:00.000Z",
    });
    expect(run.contractId).toBe(MIF_AI_MARKET_REASONING_CONTRACT_ID);
    expect(run.promptVersion).toBe(MIF_AI_MARKET_REASONING_PROMPT_VERSION);
    expect(run.placesOrders).toBe(false);
    expect(run.doesNotApproveAiReasoning).toBe(true);
    expect(run.isWinProbability).toBe(false);
    expect(run.executionReadiness).toBe(false);
    expect(["SUCCESS", "PARTIAL_RESULT"]).toContain(run.status);
    expect(run.output?.bullishScenario).toBeTruthy();
    expect(run.output?.bearishScenario).toBeTruthy();

    const store = new MifOpportunityStorage(tmp);
    await store.persistAiMarketReasoning(run);
    const got = await store.getAiMarketReasoning(run.reasoningRunId);
    expect(got?.reasoningRunId).toBe(run.reasoningRunId);
    expect(getMifOdWorkerStatus().enabled).toBe(false);
  });

  it("maps model unavailable from injected chat failure", async () => {
    const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
      providerSymbol: "XAUUSD",
      primaryTimeframe: "H1",
      timeframes: ["H1"],
      series: [{ timeframe: "H1", bars: bars(80) }],
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      maxCandleAgeSec: null,
    });
    const run = await runMifAiMarketReasoning({
      result: r,
      chatJson: async () => ({
        ok: false,
        code: "OPENAI_TIMEOUT",
        model: null,
        data: null,
        error: "timeout",
      }),
    });
    // Without fixture, engine tries vault; if vault unlocked may call chatJson.
    // If vault locked → MODEL_UNAVAILABLE; if chat injected used → MODEL_TIMEOUT.
    expect(["MODEL_UNAVAILABLE", "MODEL_TIMEOUT"]).toContain(run.status);
    expect(run.output).toBeNull();
  });

  it("blocks on BLOCKED data quality without calling model", async () => {
    const r = {
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      requestId: "blocked-run",
      processingTimestamp: "2024-06-01T00:00:00.000Z",
      dataQualityStatus: "BLOCKED",
      analysisStatus: "FAILED_UPSTREAM_DATA",
      evidenceRefs: [],
      detection: { candidates: [], outcomes: [] },
      ranking: null,
      probabilityIntelligence: null,
      timeframeSnapshots: [],
      mtfRelation: null,
      primaryTimeframe: "H1",
      contextSummary: null,
    } as unknown as MifProductionIntegrationResult;
    const run = await runMifAiMarketReasoning({
      result: r,
      fixtureModelContent: "{}",
    });
    expect(run.status).toBe("BLOCKED_BY_DATA_QUALITY");
  });
});

describe("Phase 5E Step 3 — API surface", () => {
  it("registers ai-reasoning routes", () => {
    const api = fs.readFileSync(
      path.join(process.cwd(), "dev/server/mt5-hfm-mif-api.ts"),
      "utf8",
    );
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/ai-reasoning");
    expect(api).toContain("runMifAiMarketReasoning");
    expect(api).toContain("doesNotApproveAiReasoning: true");
  });
});
