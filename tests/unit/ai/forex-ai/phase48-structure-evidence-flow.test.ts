/**
 * Phase 48 — structure sample vs coverage, OpenAI evidence contract, ticket blockers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  STRUCTURE_MIN_CLOSED_CANDLES,
  estimateCandleCountForPeriod,
  isStructureSampleSufficient,
  listAffordablePeriodTimeframePairs,
} from "../../../../ai/market-data/analysis-snapshot/periods.ts";
import { buildStructureEvidenceFromSnapshot } from "../../../../ai/forex-ai/snapshot-plans/structure-from-snapshot.ts";
import { buildEvidenceFromSnapshot } from "../../../../ai/forex-ai/snapshot-local/evidence-from-snapshot.ts";
import { primaryTicketBlocker } from "../../../../ai/forex-ai/analysis-response/openai-assistant-items.ts";
import { contractSpecFromForexConnectMetadata } from "../../../../ai/forex-ai/position-sizing/contract-spec.ts";
import { buildOpenAiSystemPrompt } from "../../../../ai/forex-ai/snapshot-openai/prompts.ts";
import type { AnalysisMarketSnapshot } from "../../../../ai/market-data/analysis-snapshot/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function minimalSnapshot(overrides: Partial<AnalysisMarketSnapshot> & {
  closedCount: number;
  expected: number;
  tf?: string;
  period?: string;
}): AnalysisMarketSnapshot {
  const closed = Array.from({ length: overrides.closedCount }, (_, i) => ({
    time: 1_700_000_000 + i * 14_400,
    open: 4000 + i,
    high: 4001 + i,
    low: 3999 + i,
    close: 4000.5 + i,
    volume: 1,
    isClosed: true,
    resampled: false,
  }));
  const forming = {
    time: 1_700_000_000 + overrides.closedCount * 14_400,
    open: 4010,
    high: 4011,
    low: 4009,
    close: 4010.5,
    volume: 1,
    isClosed: false,
    resampled: false,
  };
  return {
    schemaVersion: "forex-analysis-market-snapshot-v1",
    snapshotId: "snap-phase48",
    requestId: "req",
    createdAt: "2026-10-16T15:36:17.966Z",
    contentFingerprint: "fp".padEnd(64, "a"),
    provider: "FOREXCONNECT",
    instrument: {
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      displaySymbol: "XAU/USD",
      marketType: "FOREX",
    },
    environment: "demo",
    priceBasis: "bid",
    candleTimeframe: (overrides.tf ?? "4h") as never,
    analysisPeriod: (overrides.period ?? "6h") as never,
    requestedRange: {
      startMs: 0,
      endMs: 1,
      startUtc: "2026-10-16T09:00:00.000Z",
      endUtc: "2026-10-16T15:00:00.000Z",
    },
    returnedRange: null,
    candleCount: closed.length + 1,
    candlesRequestedEstimate: overrides.expected,
    candles: [...closed, forming],
    latestQuote: {
      provider: "FOREXCONNECT",
      providerSymbol: "XAU/USD",
      canonicalSymbol: "XAUUSD",
      bid: 4010,
      ask: 4011,
      mid: 4010.5,
      last: 4010,
      priceBasis: "bid",
      providerEventTimestamp: null,
      providerEventTimestampAvailable: false,
      serverReceiptTimestamp: "2026-10-16T15:36:17.000Z",
      ageMs: 100,
      freshness: "LIVE",
      source: "forexconnect",
      environment: "demo",
    },
    marketStatus: "LIVE",
    freshness: {
      quote: "LIVE",
      historicalCoverageRatio: overrides.closedCount / Math.max(1, overrides.expected),
      formingCandlePresent: true,
      closedCandleCount: overrides.closedCount,
      expectedClosedCandles: overrides.expected,
      formingCandleCount: 1,
      windowBoundaryPolicy: "candle_aligned_half_open",
      structureSampleSufficient: isStructureSampleSufficient(overrides.closedCount),
    },
    validation: {
      status: "VALID",
      checks: [],
      warnings: [],
      errors: [],
    },
    dataGaps: [],
    sourceMetadata: {
      historicalSourceMode: "HISTORICAL_LIVE",
      seriesNote: null,
      seriesErrorCode: null,
      resampled: false,
      sourceTimeframe: null,
    },
    warnings: [],
    evidenceReady: true,
    ...overrides,
  } as AnalysisMarketSnapshot;
}

describe("Phase 48 structure evidence vs coverage", () => {
  it("6h @ 4h expects exactly 2 closed candles (production XAU case)", () => {
    expect(estimateCandleCountForPeriod("4h", "6h")).toBe(2);
    expect(isStructureSampleSufficient(2)).toBe(false);
    expect(STRUCTURE_MIN_CLOSED_CANDLES).toBe(5);
    const pair = listAffordablePeriodTimeframePairs().find(
      (p) => p.analysisPeriod === "6h" && p.candleTimeframe === "4h",
    );
    expect(pair?.estimate).toBe(2);
    expect(pair?.structureSampleSufficient).toBe(false);
  });

  it("100% coverage with 2 closed candles still marks structure unusable", () => {
    const snap = minimalSnapshot({ closedCount: 2, expected: 2 });
    expect(snap.freshness.historicalCoverageRatio).toBe(1);
    expect(snap.freshness.structureSampleSufficient).toBe(false);
    const structure = buildStructureEvidenceFromSnapshot(snap);
    expect(structure.dataUsable).toBe(false);
    expect(structure.insufficientHistory).toBe(true);
    expect(structure.warnings[0]).toMatch(/have 2, need ≥5/);
    const evidence = buildEvidenceFromSnapshot(snap);
    expect(evidence.categories.unavailable).toEqual(expect.arrayContaining(["structure", "patterns"]));
    expect(evidence.detectorSummary).toMatch(/Prefer WAIT/);
  });

  it("6h @ 1h yields structure-sufficient sample size", () => {
    expect(estimateCandleCountForPeriod("1h", "6h")).toBe(6);
    expect(isStructureSampleSufficient(6)).toBe(true);
  });
});

describe("Phase 48 OpenAI contract and ticket blockers", () => {
  it("system prompt requires for/against scenarios and WAIT when structure missing", () => {
    const prompt = buildOpenAiSystemPrompt();
    expect(prompt).toMatch(/strongest evidence for AND against/i);
    expect(prompt).toMatch(/structure\/pattern detectors are unavailable/);
    expect(prompt).toMatch(/never invent swings/i);
  });

  it("primary ticket blocker prefers structure/WAIT over Side must be BUY or SELL", () => {
    const blocker = primaryTicketBlocker({
      intent: "WAIT",
      unsuitableReasons: [
        "Insufficient closed candles for structure/pattern detectors (have 2, need ≥5).",
      ],
      stopLoss: { price: null, unavailableReason: "Stop loss not derived — missing swing structure." },
      takeProfit: { prices: [], unavailableReason: "Take profit not derived." },
      entryZone: { unavailableReason: "WAIT — market direction/evidence does not support a directional entry zone." },
      positionRisk: {
        blockingReasons: [
          "Side must be BUY or SELL for monetary risk sizing.",
          "Plan intent is WAIT — not risk-eligible for execution sizing.",
        ],
        contract: { verified: true, unavailableReason: null },
      },
    } as never);
    expect(blocker).toMatch(/Insufficient closed candles|structure/i);
    expect(blocker).not.toMatch(/Side must be BUY or SELL/);
  });

  it("XAU ForexConnect PointSize+PipCost verifies without inventing ounces", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      metadata: {
        pointSize: 0.01,
        pipCost: 0.01,
        baseUnitSize: 1,
        mmrPerLot: 4.79,
        lotStep: 1,
        instrumentTypeLabel: "Bullion",
      },
      quoteCurrency: "USD",
    });
    expect(spec.verified).toBe(true);
    expect(spec.convention).toBe("fx_pip_cost_lot");
    expect(spec.quantityUnit).toBe("lots");
  });

  it("wiring: snapshot engine, UI structure label, account enrich preserved", () => {
    const engine = read("ai/market-data/analysis-snapshot/engine.ts");
    expect(engine).toContain("structureSampleSufficient");
    expect(engine).toContain("STRUCTURE_MIN_CLOSED_CANDLES");

    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    expect(page).toContain("structureSampleSufficient");
    expect(page).toContain('? "insufficient"');
    expect(page).toContain('? "ready"');

    const enrich = read("ai/forex-ai/position-sizing/enrich.ts");
    expect(enrich).toContain("fetchForexConnectAccountSnapshot");
    expect(enrich).toContain("applyAccountSnapshotToRiskSettings");
    expect(enrich).toContain('accountDataSource !== "forexconnect"');

    const attach = read("ai/forex-ai/position-sizing/attach-risk.ts");
    expect(attach).toContain("put upstream plan/structure blockers first");
  });
});
