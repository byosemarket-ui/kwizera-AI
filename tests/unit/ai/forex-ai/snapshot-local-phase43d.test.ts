/**
 * Phase 43D — Local AI analysis from immutable market snapshots.
 */
import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type AnalysisMarketSnapshot,
} from "../../../../ai/market-data/analysis-snapshot/types.ts";
import {
  buildAnalysisSnapshotFingerprintPayload,
  fingerprintAnalysisSnapshotPayload,
} from "../../../../ai/market-data/analysis-snapshot/fingerprint.ts";
import {
  LOCAL_AI_MAX_CONCURRENT,
  LOCAL_AI_MAX_QUEUE,
  LocalAiInferenceGate,
  MAX_EVIDENCE_CANDLES,
  buildEvidenceFromSnapshot,
  createLocalSnapshotAnalysisEngine,
  normalizeLocalAnalysisFromModel,
  parseLocalAiDecision,
  resetLocalAiInferenceGateForTests,
  resetLocalSnapshotAnalysisEngineForTests,
  resetLocalSnapshotAnalysisStoreForTests,
  verifySnapshotFingerprint,
  LocalSnapshotAnalysisStore,
} from "../../../../ai/forex-ai/snapshot-local/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function makeSnapshot(overrides?: Partial<AnalysisMarketSnapshot>): AnalysisMarketSnapshot {
  const start = Date.parse("2026-10-13T00:00:00.000Z");
  const candles = Array.from({ length: 24 }, (_, i) => {
    const px = 1.1 + i * 0.001;
    return {
      time: Math.floor(start / 1000) + i * 15 * 60,
      open: px,
      high: px + 0.002,
      low: px - 0.002,
      close: px + 0.001,
      volume: 10,
      isClosed: true,
      resampled: false,
    };
  });
  const draft = {
    schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
    provider: "BINANCE" as const,
    instrument: {
      providerSymbol: "BTCUSDT",
      canonicalSymbol: "BTCUSDT",
      displaySymbol: "BTCUSDT",
      marketType: "CRYPTO" as const,
    },
    environment: "public",
    priceBasis: "last" as const,
    candleTimeframe: "15m" as const,
    analysisPeriod: "6h" as const,
    requestedRange: {
      startMs: start,
      endMs: start + 6 * 60 * 60_000,
      startUtc: new Date(start).toISOString(),
      endUtc: new Date(start + 6 * 60 * 60_000).toISOString(),
    },
    returnedRange: {
      startMs: candles[0]!.time * 1000,
      endMs: candles[candles.length - 1]!.time * 1000,
      startUtc: new Date(candles[0]!.time * 1000).toISOString(),
      endUtc: new Date(candles[candles.length - 1]!.time * 1000).toISOString(),
    },
    candleCount: candles.length,
    candlesRequestedEstimate: 24,
    candles,
    latestQuote: {
      provider: "BINANCE" as const,
      providerSymbol: "BTCUSDT",
      canonicalSymbol: "BTCUSDT",
      bid: null,
      ask: null,
      mid: null,
      last: null,
      priceBasis: null,
      providerEventTimestamp: null,
      providerEventTimestampAvailable: false,
      serverReceiptTimestamp: null,
      ageMs: null,
      freshness: "HISTORICAL_ONLY" as const,
      source: "binance-spot-public",
      environment: "public",
    },
    marketStatus: "HISTORICAL_ONLY",
    freshness: {
      quote: "HISTORICAL_ONLY" as const,
      historicalCoverageRatio: 1,
      formingCandlePresent: false,
    },
    validation: {
      status: "VALID_WITH_WARNINGS" as const,
      checks: [],
      warnings: ["Live quote unavailable for this instrument; snapshot is historical-only."],
      errors: [],
    },
    dataGaps: [],
    sourceMetadata: {
      historicalSourceMode: "HISTORICAL",
      seriesNote: null,
      seriesErrorCode: null,
      resampled: false,
      sourceTimeframe: "15m" as const,
    },
    warnings: ["Live quote unavailable for this instrument; snapshot is historical-only."],
    evidenceReady: true,
    ...overrides,
  };
  const contentFingerprint = fingerprintAnalysisSnapshotPayload(
    buildAnalysisSnapshotFingerprintPayload(draft),
  );
  return {
    ...draft,
    snapshotId: overrides?.snapshotId ?? "snap-test-001",
    requestId: overrides?.requestId ?? "req-1",
    createdAt: overrides?.createdAt ?? "2026-10-13T00:00:00.000Z",
    contentFingerprint: overrides?.contentFingerprint ?? contentFingerprint,
  };
}

describe("Phase 43D local snapshot AI", () => {
  afterEach(() => {
    resetLocalSnapshotAnalysisEngineForTests();
    resetLocalSnapshotAnalysisStoreForTests();
    resetLocalAiInferenceGateForTests();
  });

  it("builds a bounded evidence package from a valid snapshot", () => {
    const snap = makeSnapshot();
    expect(verifySnapshotFingerprint(snap)).toBe(true);
    const evidence = buildEvidenceFromSnapshot(snap);
    expect(evidence.snapshotId).toBe(snap.snapshotId);
    expect(evidence.contentFingerprint).toBe(snap.contentFingerprint);
    expect(evidence.candles.length).toBeLessThanOrEqual(MAX_EVIDENCE_CANDLES);
    expect(evidence.categories.snapshotMeta).toBe(true);
    expect(evidence.categories.knowledge).toBe(false);
    expect(evidence.categories.unavailable).toContain("knowledge");
    expect(evidence.quoteFreshness).toBe("HISTORICAL_ONLY");
  });

  it("rejects missing / unknown snapshot and fingerprint mismatch", async () => {
    const snap = makeSnapshot();
    const dir = mkdtempSync(path.join(tmpdir(), "fx-local-ai-"));
    const store = new LocalSnapshotAnalysisStore(dir);
    const engine = createLocalSnapshotAnalysisEngine({
      getSnapshot: async (id) => (id === snap.snapshotId ? snap : null),
      store,
      generateStructured: async () => {
        throw new Error("should not call model");
      },
    });

    const missing = await engine.analyze({ snapshotId: "" });
    expect(missing.ok).toBe(false);
    expect(missing.code).toBe("INVALID_REQUEST");

    const unknown = await engine.analyze({ snapshotId: "missing" });
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe("SNAPSHOT_NOT_FOUND");

    const badFp = await engine.analyze({
      snapshotId: snap.snapshotId,
      contentFingerprint: "deadbeef",
    });
    expect(badFp.ok).toBe(false);
    expect(badFp.code).toBe("SNAPSHOT_FINGERPRINT_MISMATCH");

    const badProvider = await engine.analyze({
      snapshotId: snap.snapshotId,
      provider: "FOREXCONNECT",
    });
    expect(badProvider.ok).toBe(false);
    expect(badProvider.code).toBe("SNAPSHOT_IDENTITY_MISMATCH");

    rmSync(dir, { recursive: true, force: true });
  });

  it("validates decisions and does not fabricate numerics; rejects bad JSON decisions", () => {
    expect(parseLocalAiDecision("BUY")).toBe("BUY");
    expect(parseLocalAiDecision("hold")).toBe("WAIT");
    expect(parseLocalAiDecision("maybe")).toBeNull();

    const evidence = buildEvidenceFromSnapshot(makeSnapshot());
    const bad = normalizeLocalAnalysisFromModel({
      raw: { decision: "MOON", decisionRationale: "x" },
      evidence,
      analysisId: "a1",
      model: "llama3.2:1b",
      inferenceLatencyMs: 10,
    });
    expect(bad.ok).toBe(false);

    const ok = normalizeLocalAnalysisFromModel({
      raw: {
        decision: "WAIT",
        decisionRationale: "Conflicting structure; wait for confirmation.",
        marketBias: "UNCERTAIN",
        dataQuality: "VALID_WITH_WARNINGS",
        marketStructureSummary: "No clear BOS.",
        keyEvidence: ["historical-only quote"],
        bullishScenario: "Hold above last swing.",
        bearishScenario: "Break of last low.",
        invalidationConditions: ["Fresh opposing BOS"],
        confidence: 0.91,
        limitations: [],
      },
      evidence,
      analysisId: "a2",
      model: "llama3.2:1b",
      inferenceLatencyMs: 12,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.analysis.decision).toBe("WAIT");
      expect(ok.analysis.confidence).toContain("unverified");
      expect(ok.analysis.limitations.some((l) => /calibrated/i.test(l))).toBe(true);
      expect(ok.analysis.snapshotId).toBe(evidence.snapshotId);
    }
  });

  it("returns NO_TRADE without inference when evidence is not ready; timeout does not alter snapshot", async () => {
    const fingerprinted = makeSnapshot({
      evidenceReady: false,
      validation: {
        status: "INSUFFICIENT_DATA",
        checks: [],
        warnings: [],
        errors: ["Insufficient completed candles for the requested analysis period."],
      },
    });

    const dir = mkdtempSync(path.join(tmpdir(), "fx-local-ai-"));
    const store = new LocalSnapshotAnalysisStore(dir);
    let modelCalls = 0;
    const engine = createLocalSnapshotAnalysisEngine({
      getSnapshot: async () => fingerprinted,
      store,
      generateStructured: async () => {
        modelCalls += 1;
        return {
          ok: false,
          code: "OLLAMA_TIMEOUT",
          model: "llama3.2:1b",
          latencyMs: 120_000,
          data: null,
          error: "timeout",
        };
      },
    });

    const result = await engine.analyze({ snapshotId: fingerprinted.snapshotId });
    expect(result.ok).toBe(true);
    expect(result.analysis?.decision).toBe("NO_TRADE");
    expect(modelCalls).toBe(0);
    expect(verifySnapshotFingerprint(fingerprinted)).toBe(true);

    // Ready snapshot + timeout path
    const ready = makeSnapshot();
    const engine2 = createLocalSnapshotAnalysisEngine({
      getSnapshot: async () => ready,
      store,
      generateStructured: async () => ({
        ok: false,
        code: "OLLAMA_TIMEOUT",
        model: "llama3.2:1b",
        latencyMs: 120_000,
        data: null,
        error: "timeout",
      }),
    });
    const timed = await engine2.analyze({ snapshotId: ready.snapshotId });
    expect(timed.analysis?.status).toBe("failed");
    expect(timed.analysis?.error).toMatch(/timed out/i);
    expect(verifySnapshotFingerprint(ready)).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });

  it("persists analysis ids and bounds concurrent duplicate work", async () => {
    const snap = makeSnapshot();
    const dir = mkdtempSync(path.join(tmpdir(), "fx-local-ai-"));
    const store = new LocalSnapshotAnalysisStore(dir);
    let calls = 0;
    const engine = createLocalSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      generateStructured: async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return {
          ok: true,
          code: "OK",
          model: "llama3.2:1b",
          latencyMs: 30,
          data: {
            decision: "WAIT",
            decisionRationale: "Await confirmation after historical-only quote.",
            marketBias: "NEUTRAL",
            dataQuality: "VALID_WITH_WARNINGS",
            marketStructureSummary: "Range.",
            keyEvidence: ["quote HISTORICAL_ONLY"],
            bullishScenario: "Hold range high.",
            bearishScenario: "Lose range low.",
            invalidationConditions: ["Live quote flips bias"],
            confidence: null,
            limitations: [],
          },
        };
      },
    });

    const [a, b] = await Promise.all([
      engine.analyze({ snapshotId: snap.snapshotId }),
      engine.analyze({ snapshotId: snap.snapshotId }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(calls).toBe(1); // coalesced
    expect(a.analysis?.analysisId).toBeTruthy();
    expect(a.analysis?.snapshotId).toBe(snap.snapshotId);

    const loaded = await engine.getAnalysis(a.analysis!.analysisId);
    expect(loaded?.analysis.analysisId).toBe(a.analysis!.analysisId);
    expect(loaded?.analysis.contentFingerprint).toBe(snap.contentFingerprint);

    expect(LOCAL_AI_MAX_CONCURRENT).toBe(1);
    expect(LOCAL_AI_MAX_QUEUE).toBe(2);
    const gate = new LocalAiInferenceGate();
    await expect(Promise.all([
      gate.runExclusive("x1", async () => {
        await new Promise((r) => setTimeout(r, 40));
        return 1;
      }),
      gate.runExclusive("x2", async () => 2),
      gate.runExclusive("x3", async () => 3),
      gate.runExclusive("x4", async () => 4),
    ])).rejects.toThrow(/queue is full/i);

    rmSync(dir, { recursive: true, force: true });
  });

  it("wires API and frontend Local AI snapshot contracts", () => {
    const api = read("dev/server/forex-ai-local-snapshot-api.ts");
    const index = read("dev/server/index.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const css = read("desktop/forex/forex.css");

    expect(api).toContain("/api/forex/ai-analysis/local");
    expect(index).toContain("handleForexAiLocalSnapshotApi");
    expect(page).toContain('data-forex-ai-phase43d="true"');
    expect(page).toContain("data-ai-local-snapshot-btn");
    expect(page).toContain("/api/forex/ai-analysis/local");
    expect(page).toContain("/api/forex/ai/analyze");
    expect(page).toContain("/api/forex/ai/multi-timeframe");
    expect(page).toContain("/api/forex/ai/decision");
    expect(css).toContain(".fx-ai-local-result");
  });
});
