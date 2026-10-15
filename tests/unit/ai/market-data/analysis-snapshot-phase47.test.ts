/**
 * Phase 47 — Candle-aligned analysis windows and closed-candle coverage integrity.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  alignAnalysisWindowToCandleTimeframe,
  estimateCandleCount,
  resolveAnalysisWindow,
  resolveAndValidateRequestShape,
} from "../../../../ai/market-data/analysis-snapshot/periods.ts";
import { computeCoverageRatio } from "../../../../ai/market-data/analysis-snapshot/validate.ts";
import { formatLocalEvidenceForPrompt } from "../../../../ai/forex-ai/snapshot-local/evidence-from-snapshot.ts";
import type { LocalSnapshotEvidencePackage } from "../../../../ai/forex-ai/snapshot-local/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 47 window alignment", () => {
  it("aligns mid-hour now so 6h @ 1h expects exactly 6 completed opens", () => {
    const now = Date.parse("2026-10-15T13:37:00.000Z");
    const raw = resolveAnalysisWindow("6h", now);
    const aligned = alignAnalysisWindowToCandleTimeframe(raw, "1h");
    expect(aligned.endUtc).toBe("2026-10-15T13:00:00.000Z");
    expect(aligned.startUtc).toBe("2026-10-15T07:00:00.000Z");
    expect(estimateCandleCount("1h", aligned.endMs - aligned.startMs)).toBe(6);

    const shaped = resolveAndValidateRequestShape({
      candleTimeframe: "1h",
      analysisPeriod: "6h",
      nowMs: now,
    });
    expect(shaped.ok).toBe(true);
    if (shaped.ok) {
      expect(shaped.value.requestedRange.startUtc).toBe("2026-10-15T07:00:00.000Z");
      expect(shaped.value.requestedRange.endUtc).toBe("2026-10-15T13:00:00.000Z");
      expect(shaped.value.candlesRequestedEstimate).toBe(6);
    }
  });

  it("uses exact division for aligned spans (not ceil inflation)", () => {
    expect(estimateCandleCount("1h", 6 * 60 * 60_000)).toBe(6);
    expect(estimateCandleCount("15m", 6 * 60 * 60_000)).toBe(24);
    expect(estimateCandleCount("5m", 30 * 60_000)).toBe(6);
    // Non-aligned residual still ceils.
    expect(estimateCandleCount("1h", 6 * 60 * 60_000 + 1)).toBe(7);
  });

  it("documents half-open completed coverage (open in [start, end))", () => {
    const startSec = Date.parse("2026-10-15T07:00:00.000Z") / 1000;
    const endSec = Date.parse("2026-10-15T13:00:00.000Z") / 1000;
    const opens = [7, 8, 9, 10, 11, 12].map((h) => startSec + (h - 7) * 3600);
    expect(opens.every((t) => t >= startSec && t < endSec)).toBe(true);
    expect(opens).toHaveLength(6);
    // Forming tip at endSec is excluded from completed coverage.
    expect(endSec < endSec).toBe(false);
    const closed = opens.map((time) => ({
      time,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: null,
      isClosed: true,
      resampled: false,
    }));
    expect(computeCoverageRatio(closed, 6)).toBe(1);
    expect(computeCoverageRatio(closed.slice(0, 5), 6)).toBeCloseTo(5 / 6, 5);
  });
});

describe("Phase 47 OpenAI evidence prompt honesty", () => {
  it("includes closed/expected coverage and subset disclosure", () => {
    const pkg: LocalSnapshotEvidencePackage = {
      schemaVersion: "forex-local-snapshot-evidence-v1",
      snapshotId: "11111111-2222-3333-4444-555555555555",
      contentFingerprint: "abcdef0123456789",
      provider: "FOREXCONNECT",
      instrument: {
        providerSymbol: "XAU/USD",
        canonicalSymbol: "XAUUSD",
        displaySymbol: "XAU/USD",
      },
      candleTimeframe: "1h",
      analysisPeriod: "6h",
      requestedRange: {
        startUtc: "2026-10-15T07:00:00.000Z",
        endUtc: "2026-10-15T13:00:00.000Z",
      },
      returnedRange: {
        startUtc: "2026-10-15T07:00:00.000Z",
        endUtc: "2026-10-15T12:00:00.000Z",
      },
      priceBasis: "bid",
      environment: "demo",
      quoteFreshness: "LIVE",
      marketStatus: "OPEN",
      candleCount: 7,
      candlesRequestedEstimate: 6,
      closedCandleCount: 6,
      expectedClosedCandles: 6,
      formingCandleCount: 1,
      historicalCoverageRatio: 1,
      windowBoundaryPolicy: "candle_aligned_half_open",
      candles: [
        { t: 1, o: 1, h: 1, l: 1, c: 1, v: null, closed: true },
        { t: 2, o: 1, h: 1, l: 1, c: 1, v: null, closed: true },
      ],
      evidenceCandleSubset: true,
      dataGaps: [],
      warnings: [],
      validationStatus: "VALID",
      evidenceReady: true,
      detectorSummary: "DETECTOR_EVIDENCE: none",
      categories: {
        snapshotMeta: true,
        candles: true,
        quote: true,
        validation: true,
        patterns: false,
        structure: false,
        knowledge: false,
        unavailable: ["patterns_empty", "knowledge"],
      },
    };
    const prompt = formatLocalEvidenceForPrompt(pkg);
    expect(prompt).toMatch(/closed=6\/6/);
    expect(prompt).toMatch(/forming=1/);
    expect(prompt).toMatch(/coverage=100%/);
    expect(prompt).toMatch(/subset of 6 closed/);
    expect(prompt).toMatch(/not every candle\/tick/);
  });
});

describe("Phase 47 wiring", () => {
  it("engine stores closed/expected/forming diagnostics and UI shows them", () => {
    const engine = read("ai/market-data/analysis-snapshot/engine.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const periods = read("ai/market-data/analysis-snapshot/periods.ts");
    expect(periods).toMatch(/alignAnalysisWindowToCandleTimeframe/);
    expect(periods).toMatch(/candle_aligned|half-open|half_open/i);
    expect(engine).toMatch(/closedCandleCount/);
    expect(engine).toMatch(/windowBoundaryPolicy/);
    expect(engine).toMatch(/c\.time < endSec/);
    expect(page).toMatch(/data-ai-snapshot-coverage/);
    expect(page).toMatch(/closedCandleCount/);
  });
});
