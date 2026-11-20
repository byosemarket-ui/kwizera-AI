/**
 * Phase 5E Step 4 — production integration audit tests.
 * Price/level grounding, ten-strategy registry, provider isolation, Admin UI wiring.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MIF_PROVIDER_ID,
  MIF_IMPLEMENTED_OPPORTUNITY_DETECTORS,
  getDefaultMifOpportunityDetectorRegistry,
  buildMifAiReasoningContext,
  validateAndGroundMifAiReasoningOutput,
  groundPriceContextStatus,
  runMifAiMarketReasoning,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  getMifOdWorkerStatus,
  MIF_AI_MARKET_REASONING_PROMPT_VERSION,
  type MifAiReasoningContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  FOREX_ADMIN_NAV,
  parseForexAdminRouteFromLocation,
} from "../../../../desktop/forex-admin/forex-admin-routes";

const TEN_STRATEGIES = [
  "TREND_CONTINUATION",
  "PULLBACK",
  "REVERSAL",
  "BREAKOUT",
  "BREAKOUT_RETEST",
  "RANGE",
  "LIQUIDITY_SWEEP",
  "SUPPLY_DEMAND",
  "MOMENTUM_EXPANSION",
  "PATTERN_COMPLETION",
] as const;

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
    availableEvidenceIds: ["ev1"],
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

function baseOutput(ctx: MifAiReasoningContext, priceStatus = "LEVELS_NOT_PROVIDED") {
  return {
    marketOverview: "overview",
    higherTimeframeAnalysis: "htf",
    intermediateTimeframeAnalysis: "itf",
    lowerTimeframeAnalysis: "ltf",
    marketStructureAnalysis: "structure",
    marketRegimeAnalysis: "regime",
    liquidityAnalysis: "liq",
    momentumAnalysis: "mom",
    displacementAnalysis: "disp",
    patternAnalysis: "pat",
    opportunityAnalysis: "opp",
    rankingInterpretation: "Ranking score measures setup quality only.",
    probabilityInterpretation: "Probability unavailable; null is not zero.",
    evidenceSummary: "ev",
    bullishScenario: {
      side: "BULLISH",
      status: "WAITING_FOR_CONFIRMATION",
      summary: "bull",
      supportingEvidenceRefs: [ctx.availableEvidenceIds[0]],
      contradictingEvidenceRefs: [],
      missingEvidence: [],
      confirmationConditions: ["CLOSED"],
      invalidationConditions: ["break"],
      claimKinds: ["AI_INTERPRETATION"],
      priceContextStatus: priceStatus,
      priceContextNotes: [],
    },
    bearishScenario: {
      side: "BEARISH",
      status: "DEVELOPING",
      summary: "bear",
      supportingEvidenceRefs: [],
      contradictingEvidenceRefs: [ctx.availableEvidenceIds[0]],
      missingEvidence: [],
      confirmationConditions: ["CLOSED"],
      invalidationConditions: ["reclaim"],
      claimKinds: ["HYPOTHESIS"],
      priceContextStatus: priceStatus,
      priceContextNotes: [],
    },
    scenarioComparison: "both",
    confirmationConditions: ["CLOSED"],
    invalidationConditions: ["opp"],
    missingInformation: [],
    contradictions: [],
    reasoningConclusion: "Analytical only",
    reasoningLimitations: [],
    evidenceSupportStatus: "MODERATE_EVIDENCE_SUPPORT",
    citedEvidenceRefs: [ctx.availableEvidenceIds[0]],
  };
}

describe("Phase 5E Step 4 — structured price/level grounding", () => {
  it("downgrades AVAILABLE_FROM_SOURCE when structured levels absent", () => {
    const ctx = miniCtx();
    const raw = baseOutput(ctx, "AVAILABLE_FROM_SOURCE");
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(raw), ctx);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /price_available_without_structured/.test(e))).toBe(true);
    expect(v.output?.bullishScenario.priceContextStatus).toBe("LEVELS_NOT_PROVIDED");
  });

  it("accepts AVAILABLE_FROM_SOURCE when structured levels exist", () => {
    const ctx = miniCtx({
      structuredLevels: {
        entryPrice: 2000,
        targetPrice: 2050,
        invalidationPrice: 1980,
        source: "CANDIDATE_NOTES",
        hasAnyFinite: true,
        candidateId: "c1",
      },
    });
    const raw = baseOutput(ctx, "AVAILABLE_FROM_SOURCE");
    raw.bullishScenario.priceContextNotes = ["entry=2000", "target=2050"];
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(raw), ctx);
    expect(v.ok).toBe(true);
    expect(v.output?.bullishScenario.priceContextStatus).toBe("AVAILABLE_FROM_SOURCE");
  });

  it("rejects invented numeric prices in notes not present in structured levels", () => {
    const ctx = miniCtx({
      structuredLevels: {
        entryPrice: 2000,
        targetPrice: null,
        invalidationPrice: null,
        source: "CANDIDATE_NOTES",
        hasAnyFinite: true,
        candidateId: "c1",
      },
    });
    const raw = baseOutput(ctx, "AVAILABLE_FROM_SOURCE");
    raw.bullishScenario.priceContextNotes = ["target=9999"];
    const v = validateAndGroundMifAiReasoningOutput(JSON.stringify(raw), ctx);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /invented_price_in_notes=9999/.test(e))).toBe(true);
  });

  it("groundPriceContextStatus helper returns LEVELS_NOT_PROVIDED for empty source", () => {
    const errors: string[] = [];
    const status = groundPriceContextStatus(
      "AVAILABLE_FROM_SOURCE",
      miniCtx(),
      "BULLISH",
      [],
      errors,
    );
    expect(status).toBe("LEVELS_NOT_PROVIDED");
    expect(errors[0]).toMatch(/price_available_without_structured/);
  });

  it("context builder exposes structuredLevels=LEVELS_NOT_PROVIDED without inventing prices", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5e4-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
    try {
      const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
        providerSymbol: "XAUUSD",
        primaryTimeframe: "H1",
        timeframes: ["H1"],
        series: [{ timeframe: "H1", bars: bars(80) }],
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        maxCandleAgeSec: null,
      });
      expect(r.providerId).toBe(MIF_PROVIDER_ID);
      const ctx = buildMifAiReasoningContext({ result: r });
      expect(ctx.structuredLevels.hasAnyFinite).toBe(false);
      expect(ctx.structuredLevels.source).toBe("NONE");
      expect(ctx.knownLimitations.some((l) => /structuredLevels=LEVELS_NOT_PROVIDED/.test(l))).toBe(
        true,
      );
    } finally {
      __setMifOpportunityStorageForTests(null);
      delete process.env.KWIZERA_STORAGE_ROOT;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("Phase 5E Step 4 — ten-strategy integration audit", () => {
  it("registers exactly ten implemented detectors covering all strategies", () => {
    expect(MIF_IMPLEMENTED_OPPORTUNITY_DETECTORS).toHaveLength(10);
    const reg = getDefaultMifOpportunityDetectorRegistry();
    const ids = reg.listDetectors().map((d) => d.strategyId).sort();
    expect(ids).toEqual([...TEN_STRATEGIES].sort());
    for (const s of TEN_STRATEGIES) {
      const found = reg.findByStrategyId(s);
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found[0]!.providerId === undefined || found[0]!.placesOrders === false).toBe(true);
      expect(found[0]!.placesOrders).toBe(false);
      expect(found[0]!.mutatesBroker).toBe(false);
      expect(found[0]!.acceptsForExecution).toBe(false);
      expect(found[0]!.doesNotApproveAiReasoning).toBe(true);
    }
  });

  it("pipeline remains HFM_MT5-only with worker disabled", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-5e4p-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
    try {
      const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
        providerSymbol: "XAUUSD",
        primaryTimeframe: "H1",
        timeframes: ["H1"],
        series: [{ timeframe: "H1", bars: bars(80) }],
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        maxCandleAgeSec: null,
      });
      expect(r.providerId).toBe("HFM_MT5");
      expect(r.placesOrders).toBe(false);
      expect(r.mutatesBroker).toBe(false);
      expect(r.acceptsForExecution).toBe(false);
      const ctx = buildMifAiReasoningContext({ result: r });
      expect(ctx.providerId).toBe("HFM_MT5");
      // Ensure fixture cites a real evidence id when available
      const eid = ctx.availableEvidenceIds[0] ?? "dq";
      if (!ctx.availableEvidenceIds.includes(eid) && eid === "dq") {
        // no evidence — AI should return INSUFFICIENT_CONTEXT rather than fabricate
        const emptyRun = await runMifAiMarketReasoning({
          result: r,
          fixtureModelContent: "{}",
          calculatedAt: "2024-06-01T00:00:00.000Z",
        });
        expect(["INSUFFICIENT_CONTEXT", "BLOCKED_BY_DATA_QUALITY", "INVALID_MODEL_OUTPUT"]).toContain(
          emptyRun.status,
        );
      } else {
        const out = baseOutput({
          ...ctx,
          availableEvidenceIds: ctx.availableEvidenceIds.length
            ? ctx.availableEvidenceIds
            : [eid],
        }, "LEVELS_NOT_PROVIDED");
        const run = await runMifAiMarketReasoning({
          result: r,
          fixtureModelContent: JSON.stringify(out),
          calculatedAt: "2024-06-01T00:00:00.000Z",
        });
        expect(["SUCCESS", "PARTIAL_RESULT", "INSUFFICIENT_CONTEXT"]).toContain(run.status);
        expect(run.providerId).toBe("HFM_MT5");
        expect(run.doesNotApproveAiReasoning).toBe(true);
        expect(run.executionReadiness).toBe(false);
        expect(run.promptVersion).toBe(MIF_AI_MARKET_REASONING_PROMPT_VERSION);
      }
      expect(getMifOdWorkerStatus().enabled).toBe(false);
    } finally {
      __setMifOpportunityStorageForTests(null);
      delete process.env.KWIZERA_STORAGE_ROOT;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("Phase 5E Step 4 — ForexAdmin UI wiring", () => {
  it("registers HFM Market Intel route and page wiring", () => {
    expect(parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm/mif").view).toBe("mt5-hfm-mif");
    expect(FOREX_ADMIN_NAV.some((n) => n.id === "mt5-hfm-mif" && n.implemented)).toBe(true);
    const page = fs.readFileSync(
      path.join(process.cwd(), "desktop/forex-admin/ForexAdminMt5HfmMifPage.tsx"),
      "utf8",
    );
    expect(page).toContain("mt5HfmMifAiReasoning");
    expect(page).toContain("Ranking (setup quality — not win probability)");
    expect(page).toContain("null (not zero)");
    expect(page).toContain("doesNotApprove");
    const pages = fs.readFileSync(
      path.join(process.cwd(), "desktop/forex-admin/ForexAdminPages.tsx"),
      "utf8",
    );
    expect(pages).toContain("ForexAdminMt5HfmMifPage");
    expect(pages).toContain("mt5-hfm-mif");
    const api = fs.readFileSync(path.join(process.cwd(), "desktop/forex-admin/api.ts"), "utf8");
    expect(api).toContain("mt5HfmMifOpportunityDetection");
    expect(api).toContain("mt5HfmMifCandidatesList");
  });

  it("API surface enforces HFM_MT5 and safety flags for AI reasoning", () => {
    const api = fs.readFileSync(
      path.join(process.cwd(), "dev/server/mt5-hfm-mif-api.ts"),
      "utf8",
    );
    expect(api).toContain("PROVIDER_NOT_ALLOWED");
    expect(api).toContain("HFM_MT5 only");
    expect(api).toContain("doesNotApproveAiReasoning: true");
    expect(api).not.toContain("FXCM");
    expect(api).not.toContain("Binance");
  });
});
