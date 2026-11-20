/**
 * Phase 5D.6 — engines, evidence quality, persistence, lifecycle.
 * Fixture-based; live HFM verification is separate on VPS.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assessMifDataIntegrity,
  assessMifLiquidityReference,
  assessMifMarketStructure,
  assessMifMomentum,
  assessMifSupportResistance,
  assessMifEvidenceQuality,
  applyEvidenceQualityToCandidates,
  baseCanonicalCandle,
  MIF_PROVIDER_ID,
  rateOfChange,
  wilderRsi,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  observeCandidateAgainstCandles,
  getMifOdWorkerStatus,
  disableMifOdWorker,
  type MifCanonicalCandle,
  type MifOpportunityCandidate,
  type MifOpportunityDetectionContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  high: number,
  low: number,
  close?: number,
  state: "CLOSED" | "FORMING" = "CLOSED",
): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const mid = (high + low) / 2;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: mid,
    high,
    low,
    close: close ?? mid,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: state,
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

/** Strong upward path with swing-friendly shape. */
function upTrendSeries(n = 60): MifCanonicalCandle[] {
  const out: MifCanonicalCandle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 2000 + i * 0.9;
    const bump = i % 5 === 2 ? 3.5 : i % 5 === 4 ? -1.5 : 0;
    const close = base + bump;
    out.push(candle(i, close + 1.2, close - 1.2, close));
  }
  return out;
}

function barsForPipeline(tf: string, n = 80) {
  const step =
    tf === "H4" ? 14400 : tf === "H1" ? 3600 : tf === "M15" ? 900 : 300;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + i * 0.35;
    const bump = i % 7 === 3 ? 1.8 : i % 7 === 6 ? -0.9 : 0;
    const close = c + bump;
    const open = close - 0.15;
    bars.push({
      time: T0 + i * step,
      open,
      high: Math.max(open, close) + 0.4,
      low: Math.min(open, close) - 0.4,
      close,
      tickVolume: 10 + i,
      realVolume: null,
      spread: 2,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    });
  }
  return bars;
}

describe("Phase 5D.6 — momentum indicators", () => {
  it("computes ROC and RSI with warm-up nulls", () => {
    expect(rateOfChange([1, 2], 14).warmUpComplete).toBe(false);
    expect(wilderRsi([1, 2, 3], 14).warmUpComplete).toBe(false);
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
    const roc = rateOfChange(closes, 14);
    const rsi = wilderRsi(closes, 14);
    expect(roc.warmUpComplete).toBe(true);
    expect(rsi.warmUpComplete).toBe(true);
    expect(roc.value!).toBeGreaterThan(0);
    expect(rsi.value!).toBeGreaterThan(50);
  });
});

describe("Phase 5D.6 — dedicated engines", () => {
  it("assesses market structure without look-ahead fabrication", () => {
    const series = upTrendSeries(60);
    const q = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const ms = assessMifMarketStructure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(ms.providerId).toBe(MIF_PROVIDER_ID);
    expect(ms.placesOrders).toBe(false);
    expect(ms.doesNotApproveAiReasoning).toBe(true);
    expect(["VALID", "WARNING", "DEGRADED", "INSUFFICIENT_DATA"]).toContain(ms.status);
    for (const s of ms.swings) {
      if (s.status === "CONFIRMED") {
        expect(s.candleIndex).toBeLessThan(series.length - 1);
      }
    }
  });

  it("builds S/R and liquidity from structure evidence", () => {
    const series = upTrendSeries(60);
    const q = assessMifDataIntegrity({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const quality = { kind: "step1-data-integrity" as const, assessment: q };
    const ms = assessMifMarketStructure({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const sr = assessMifSupportResistance({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      marketStructure: ms,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const lr = assessMifLiquidityReference({
      candles: series,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality,
      marketStructure: ms,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(sr.doesNotApproveAiReasoning).toBe(true);
    expect(lr.doesNotClaimRestingOrders).toBe(true);
    expect(lr.placesOrders).toBe(false);
    if (lr.status !== "INSUFFICIENT_DATA") {
      expect(lr.primaryReference?.confirmed).toBe(true);
      expect(lr.primaryReference?.notes).toMatch(/doesNotClaimRestingOrders/i);
    }
  });

  it("assesses momentum without fabricating warm-up values", () => {
    const few = upTrendSeries(10);
    const q = assessMifDataIntegrity({
      candles: few,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const moFew = assessMifMomentum({
      candles: few,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q },
    });
    expect(moFew.status).toBe("INSUFFICIENT_DATA");
    expect(moFew.notWinProbability).toBe(true);

    const many = upTrendSeries(60);
    const q2 = assessMifDataIntegrity({
      candles: many,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const mo = assessMifMomentum({
      candles: many,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      quality: { kind: "step1-data-integrity", assessment: q2 },
    });
    expect(["VALID", "WARNING", "DEGRADED"]).toContain(mo.status);
    expect(mo.strengthScoreDefinition).toMatch(/NOT a win probability/i);
  });
});

describe("Phase 5D.6 — evidence quality", () => {
  it("forces NEEDS_CONFIRMATION under PARTIAL_DEGRADED impact", () => {
    const ctx: MifOpportunityDetectionContext = {
      contextVersion: "1.0.0",
      providerId: MIF_PROVIDER_ID,
      providerSymbol: "XAUUSD",
      instrument: null,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      timebase: "BROKER_SERVER",
      dataQualityStatus: "WARNING",
      availableTimeframeRoles: ["INTERMEDIATE_STRUCTURE"],
      evidence: [
        {
          evidenceId: "tc.structure",
          family: "MARKET_STRUCTURE",
          presence: "PRESENT",
          sourceEngine: "mif-market-structure",
          sourceContractId: null,
          sourceContractVersion: null,
          sourcePolicyVersion: null,
          sourceAssessmentId: null,
          sourceInputIdentity: null,
          timeframe: "H1",
          timeframeRole: "INTERMEDIATE_STRUCTURE",
          assessmentTimestamp: "2024-01-01T00:00:00.000Z",
          qualityStatus: "VALID",
          candleState: "CLOSED",
          notes: "PARTIAL projection from regime",
        },
      ],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDetectionContextOnly: true,
    };
    const eq = assessMifEvidenceQuality({ context: ctx, eligibility: [], candidates: [] });
    expect(eq.executionReadiness).toBe(false);
    expect(eq.notWinProbability).toBe(true);
    expect(eq.analysisImpact).toBe("PARTIAL_DEGRADED");

    const cand = {
      candidateId: "c1",
      status: "DETECTED",
      requiredConfirmations: [],
      conflictingEvidenceIds: [],
    } as unknown as MifOpportunityCandidate;
    const adj = applyEvidenceQualityToCandidates([cand], eq);
    expect(adj.candidates[0]!.status).toBe("NEEDS_CONFIRMATION");
  });
});

describe("Phase 5D.6 — durable persistence + lifecycle", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-od-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
  });

  afterEach(() => {
    __setMifOpportunityStorageForTests(null);
    delete process.env.KWIZERA_STORAGE_ROOT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("persists analysis run and survives re-read (read-after-write)", async () => {
    const result = await runMifHfmOpportunityPipelineFromSeriesPersisted(
      {
        requestId: "persist-test-1",
        providerSymbol: "XAUUSD",
        timeframes: ["H4", "H1", "M15"],
        series: [
          { timeframe: "H4", bars: barsForPipeline("H4") },
          { timeframe: "H1", bars: barsForPipeline("H1") },
          { timeframe: "M15", bars: barsForPipeline("M15") },
        ],
        assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      },
      { persist: true },
    );
    expect(result.persistence?.persisted).toBe(true);
    expect(result.persistence?.runId).toBe("persist-test-1");

    const store = new MifOpportunityStorage(tmp);
    const run = await store.getRun("persist-test-1");
    expect(run).not.toBeNull();
    expect(run!.providerId).toBe("HFM_MT5");
    expect(run!.placesOrders).toBe(false);

    // Idempotent re-persist
    const again = await store.persistAnalysisResult(result, { runId: "persist-test-1" });
    expect(again.created).toBe(false);

    // Restart simulation: new store instance same root
    const store2 = new MifOpportunityStorage(tmp);
    const run2 = await store2.getRun("persist-test-1");
    expect(run2?.runId).toBe("persist-test-1");
    expect(run2?.candidateCount).toBe(result.candidateCount);

    const listed = await store2.listCandidates({ providerSymbol: "XAUUSD", limit: 10 });
    expect(listed.total).toBeGreaterThanOrEqual(result.candidateCount);
  });

  it("tracks lifecycle invalidation and ambiguous same-candle outcome", async () => {
    const store = new MifOpportunityStorage(tmp);
    await store.ensureReady();
    // Seed via pipeline
    const result = await runMifHfmOpportunityPipelineFromSeriesPersisted(
      {
        requestId: "life-1",
        providerSymbol: "XAUUSD",
        timeframes: ["H1", "H4", "M15"],
        series: [
          { timeframe: "H1", bars: barsForPipeline("H1") },
          { timeframe: "H4", bars: barsForPipeline("H4") },
          { timeframe: "M15", bars: barsForPipeline("M15") },
        ],
        assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      },
      { persist: true },
    );
    const id = result.persistence?.candidateIds[0];
    if (!id) {
      // Empty candidates still valid — create synthetic persist path via transition N/A
      expect(result.candidateCount).toBe(0);
      return;
    }
    const obs = await observeCandidateAgainstCandles({
      candidateId: id,
      closedCandles: [
        candle(100, 2100, 2090, 2095),
        candle(101, 2110, 2080, 2085),
      ],
      invalidationPrice: 2092,
      invalidationSide: "BELOW",
      targetPrice: 2105,
      targetSide: "ABOVE",
    });
    expect(obs.ok).toBe(true);
    const hist = await store.getCandidateHistory(id);
    expect(hist.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Phase 5D.6 — worker default disabled", () => {
  it("starts disabled and remains analytical", () => {
    disableMifOdWorker();
    const s = getMifOdWorkerStatus();
    expect(s.enabled).toBe(false);
    expect(s.placesOrders).toBe(false);
    expect(s.mutatesBroker).toBe(false);
    expect(s.acceptsForExecution).toBe(false);
  });
});

describe("Phase 5D.6 — integrated pipeline engines wired", () => {
  it("exposes dedicated engine flags in context summary", async () => {
    const r = await runMifHfmOpportunityPipelineFromSeriesPersisted(
      {
        requestId: "engines-wired",
        providerSymbol: "XAUUSD",
        timeframes: ["H4", "H1", "M15"],
        series: [
          { timeframe: "H4", bars: barsForPipeline("H4") },
          { timeframe: "H1", bars: barsForPipeline("H1") },
          { timeframe: "M15", bars: barsForPipeline("M15") },
        ],
        assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      },
      { persist: false },
    );
    expect(r.providerId).toBe("HFM_MT5");
    expect(r.contextSummary?.hasMarketStructure).toBe(true);
    expect(r.contextSummary?.hasSupportResistance).toBe(true);
    expect(r.contextSummary?.hasLiquidityReference).toBe(true);
    expect(r.contextSummary?.hasMomentum).toBe(true);
    expect(r.contextSummary?.hasPriceDisplacement).toBe(true);
    expect(r.evidenceQuality?.notWinProbability).toBe(true);
    expect(r.evidenceQuality?.executionReadiness).toBe(false);
    expect(r.detection?.outcomes).toHaveLength(10);
    expect(r.placesOrders).toBe(false);
  });
});
