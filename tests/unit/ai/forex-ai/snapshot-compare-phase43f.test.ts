/**
 * Phase 43F — provider mode, model discovery/persistence, independent compare.
 */
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
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
  createForexOpenAiConfigStore,
  createOpenAiSnapshotAnalysisEngine,
  filterEligibleOpenAiModels,
  isOpenAiChatEligibleModel,
  OpenAiSnapshotAnalysisStore,
  resetForexOpenAiConfigStoreForTests,
  resetOpenAiInferenceGateForTests,
  resetOpenAiSnapshotAnalysisEngineForTests,
  resetOpenAiSnapshotAnalysisStoreForTests,
} from "../../../../ai/forex-ai/snapshot-openai/index.ts";
import {
  buildDeterministicComparison,
  createSnapshotCompareOrchestrator,
  resetSnapshotCompareOrchestratorForTests,
} from "../../../../ai/forex-ai/snapshot-compare/index.ts";
import type { LocalSnapshotAnalysisResult } from "../../../../ai/forex-ai/snapshot-local/types.ts";
import type { OpenAiSnapshotAnalysisResult } from "../../../../ai/forex-ai/snapshot-openai/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function makeSnapshot(): AnalysisMarketSnapshot {
  const start = Date.parse("2026-10-13T00:00:00.000Z");
  const candles = Array.from({ length: 16 }, (_, i) => {
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
      warnings: ["historical-only"],
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
    warnings: ["historical-only"],
    evidenceReady: true,
  };
  return {
    ...draft,
    snapshotId: "snap-compare-001",
    requestId: "req-cmp",
    createdAt: "2026-10-13T00:00:00.000Z",
    contentFingerprint: fingerprintAnalysisSnapshotPayload(
      buildAnalysisSnapshotFingerprintPayload(draft),
    ),
  };
}

function localAnalysis(partial: Partial<LocalSnapshotAnalysisResult> = {}): LocalSnapshotAnalysisResult {
  return {
    analysisId: "local-a1",
    schemaVersion: "forex-local-snapshot-analysis-v1",
    analysisProvider: "LOCAL",
    snapshotId: "snap-compare-001",
    contentFingerprint: "fp",
    provider: "BINANCE",
    instrument: "BTCUSDT",
    candleTimeframe: "15m",
    analysisPeriod: "6h",
    model: "llama3.2:1b",
    createdAt: "2026-10-13T00:00:00.000Z",
    status: "completed",
    dataQuality: "VALID_WITH_WARNINGS",
    marketBias: "BULLISH",
    marketStructureSummary: "up",
    keyEvidence: ["higher highs", "volume up"],
    bullishScenario: "cont",
    bearishScenario: "fail",
    decision: "BUY",
    decisionRationale: "structure",
    invalidationConditions: ["break low"],
    confidence: "medium",
    limitations: [],
    evidenceCategories: {
      structure: true,
      momentum: true,
      volatility: false,
      volume: true,
      quoteFreshness: true,
      gaps: false,
    },
    warnings: [],
    inferenceLatencyMs: 10,
    error: null,
    ...partial,
  } as LocalSnapshotAnalysisResult;
}

function openaiAnalysis(partial: Partial<OpenAiSnapshotAnalysisResult> = {}): OpenAiSnapshotAnalysisResult {
  return {
    ...localAnalysis({
      analysisId: "oai-a1",
      analysisProvider: "OPENAI" as never,
      model: "gpt-4o-mini",
      decision: "SELL",
      marketBias: "BEARISH",
      keyEvidence: ["lower highs", "volume up"],
    }),
    analysisProvider: "OPENAI",
    newsResearchStatus: "unavailable",
    newsSources: [],
    ...partial,
  } as OpenAiSnapshotAnalysisResult;
}

describe("Phase 43F model policy + persistence", () => {
  const prevPass = process.env.KWIZERA_SECRETS_PASSPHRASE;

  beforeEach(() => {
    process.env.KWIZERA_SECRETS_PASSPHRASE = "test-passphrase-phase43f-not-real";
  });

  afterEach(() => {
    if (prevPass == null) delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    else process.env.KWIZERA_SECRETS_PASSPHRASE = prevPass;
    resetForexOpenAiConfigStoreForTests();
    resetOpenAiSnapshotAnalysisEngineForTests();
    resetOpenAiSnapshotAnalysisStoreForTests();
    resetOpenAiInferenceGateForTests();
    resetSnapshotCompareOrchestratorForTests();
  });

  it("filters eligible chat models and rejects embeddings", () => {
    expect(isOpenAiChatEligibleModel("gpt-4o-mini")).toBe(true);
    expect(isOpenAiChatEligibleModel("gpt-4.1")).toBe(true);
    expect(isOpenAiChatEligibleModel("text-embedding-3-small")).toBe(false);
    expect(isOpenAiChatEligibleModel("whisper-1")).toBe(false);
    const filtered = filterEligibleOpenAiModels([
      { id: "gpt-4o-mini", created: 1, ownedBy: "openai" },
      { id: "text-embedding-3-large", created: 2, ownedBy: "openai" },
      { id: "dall-e-3", created: 3, ownedBy: "openai" },
    ]);
    expect(filtered.map((m) => m.id)).toEqual(["gpt-4o-mini"]);
  });

  it("persists selected model across reload and never silently replaces it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-model-"));
    const store = createForexOpenAiConfigStore(dir);
    await store.setApiKey("sk-testkeyphase43f1234567890abcdef", "gpt-4o");
    expect((await store.getModel())).toBe("gpt-4o");

    await store.setModel("gpt-4o-mini");
    expect((await store.getModel())).toBe("gpt-4o-mini");

    resetForexOpenAiConfigStoreForTests();
    const reloaded = createForexOpenAiConfigStore(dir);
    expect(await reloaded.getModel()).toBe("gpt-4o-mini");

    await expect(store.setModel("text-embedding-3-small")).rejects.toMatchObject({
      code: "MODEL_NOT_ELIGIBLE",
    });
    expect(await store.getModel()).toBe("gpt-4o-mini");

    await store.saveDiscoveredModels([
      { id: "gpt-4o-mini", created: 1, ownedBy: "openai", eligible: true },
    ]);
    const cached = await store.getDiscoveredModels();
    expect(cached.models[0]?.id).toBe("gpt-4o-mini");
    expect(JSON.stringify(cached)).not.toMatch(/sk-/);

    rmSync(dir, { recursive: true, force: true });
  });

  it("OpenAI engine uses saved model and does not fall back when ineligible", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-use-"));
    const config = createForexOpenAiConfigStore(dir);
    await config.setApiKey("sk-testkeyphase43f1234567890abcdef", "gpt-4o");
    const store = new OpenAiSnapshotAnalysisStore(dir);
    const snap = makeSnapshot();
    const seenModels: string[] = [];

    const engine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config,
      chat: async (input) => {
        seenModels.push(input.model);
        return {
          ok: true,
          code: "OK",
          model: input.model,
          latencyMs: 5,
          data: {
            decision: "WAIT",
            decisionRationale: "wait",
            marketBias: "UNCERTAIN",
            dataQuality: "VALID_WITH_WARNINGS",
            marketStructureSummary: "range",
            keyEvidence: ["quote HISTORICAL_ONLY"],
            bullishScenario: "a",
            bearishScenario: "b",
            invalidationConditions: ["x"],
            confidence: null,
            limitations: [],
          },
        };
      },
    });

    const result = await engine.analyze({ snapshotId: snap.snapshotId });
    expect(result.ok).toBe(true);
    expect(seenModels[0]).toBe("gpt-4o");
    expect(result.analysis?.model).toBe("gpt-4o");

    // Force an ineligible saved model by writing config directly (simulates stale selection).
    const cfgPath = path.join(dir, "forex-openai", "config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
    cfg.model = "text-embedding-3-small";
    const { writeFileSync } = await import("node:fs");
    writeFileSync(cfgPath, JSON.stringify(cfg));
    resetForexOpenAiConfigStoreForTests();
    const badConfig = createForexOpenAiConfigStore(dir);
    const badEngine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config: badConfig,
      chat: async (input) => {
        seenModels.push(input.model);
        return { ok: true, code: "OK", model: input.model, latencyMs: 1, data: {} };
      },
    });
    const bad = await badEngine.analyze({ snapshotId: snap.snapshotId });
    expect(bad.code).toBe("MODEL_NOT_ELIGIBLE");
    expect(seenModels.length).toBe(1); // chat not called again
    expect(await badConfig.getModel()).toBe("text-embedding-3-small"); // selection retained

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Phase 43F independent compare + comparison", () => {
  afterEach(() => {
    resetSnapshotCompareOrchestratorForTests();
  });

  it("comparison shows disagreement without fabricating consensus", () => {
    const local = {
      ok: true as const,
      code: "OK" as const,
      error: null,
      latencyMs: 10,
      analysis: localAnalysis(),
    };
    const openai = {
      ok: true as const,
      code: "OK" as const,
      error: null,
      latencyMs: 20,
      analysis: openaiAnalysis(),
    };
    const c = buildDeterministicComparison(local, openai);
    expect(c.decisionsAgree).toBe(false);
    expect(c.localDecision).toBe("BUY");
    expect(c.openaiDecision).toBe("SELL");
    expect(c.sharedEvidence.some((e) => /volume/i.test(e))).toBe(true);
    expect(c.note).toMatch(/disagree/i);
    expect(c.note).not.toMatch(/consensus trade/i);
  });

  it("partial success when one provider fails; originals unchanged", async () => {
    const snap = makeSnapshot();
    const localAnalyze = vi.fn(async () => ({
      ok: true,
      code: "OK",
      error: null,
      latencyMs: 12,
      analysis: localAnalysis({
        snapshotId: snap.snapshotId,
        contentFingerprint: snap.contentFingerprint,
      }),
      evidence: null,
    }));
    const openaiAnalyze = vi.fn(async () => ({
      ok: false,
      code: "OPENAI_NOT_CONFIGURED",
      error: "OpenAI API key is not configured.",
      latencyMs: 2,
      analysis: null,
      evidence: null,
    }));

    const orch = createSnapshotCompareOrchestrator({
      getSnapshot: async () => snap,
      localEngine: { analyze: localAnalyze } as never,
      openaiEngine: { analyze: openaiAnalyze } as never,
    });

    const result = await orch.compare({
      snapshotId: snap.snapshotId,
      contentFingerprint: snap.contentFingerprint,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("PARTIAL_SUCCESS");
    expect(result.compare?.status).toBe("partial_local_ok");
    expect(result.compare?.localResult.ok).toBe(true);
    expect(result.compare?.openaiResult.ok).toBe(false);
    expect(localAnalyze).toHaveBeenCalledTimes(1);
    expect(openaiAnalyze).toHaveBeenCalledTimes(1);
    const localArgs = localAnalyze.mock.calls[0]![0] as { snapshotId: string; contentFingerprint: string };
    const openaiArgs = openaiAnalyze.mock.calls[0]![0] as { snapshotId: string; contentFingerprint: string };
    expect(localArgs.snapshotId).toBe(openaiArgs.snapshotId);
    expect(localArgs.contentFingerprint).toBe(openaiArgs.contentFingerprint);
    // Neither engine receives the other's result object.
    expect(JSON.stringify(localArgs)).not.toContain("openaiResult");
    expect(JSON.stringify(openaiArgs)).not.toContain("localResult");
    expect(snap.contentFingerprint).toBeTruthy();
  });

  it("both-failed is represented safely; fingerprint mismatch rejected", async () => {
    const snap = makeSnapshot();
    const orch = createSnapshotCompareOrchestrator({
      getSnapshot: async () => snap,
      localEngine: {
        analyze: async () => ({
          ok: false,
          code: "LOCAL_AI_ERROR",
          error: "down",
          latencyMs: 1,
          analysis: null,
          evidence: null,
        }),
      } as never,
      openaiEngine: {
        analyze: async () => ({
          ok: false,
          code: "OPENAI_ERROR",
          error: "down",
          latencyMs: 1,
          analysis: null,
          evidence: null,
        }),
      } as never,
    });
    const both = await orch.compare({ snapshotId: snap.snapshotId });
    expect(both.ok).toBe(false);
    expect(both.code).toBe("BOTH_FAILED");
    expect(both.compare?.status).toBe("both_failed");

    const badFp = await orch.compare({
      snapshotId: snap.snapshotId,
      contentFingerprint: "deadbeef",
    });
    expect(badFp.code).toBe("SNAPSHOT_FINGERPRINT_MISMATCH");
    expect(badFp.compare).toBeNull();
  });
});

describe("Phase 43F wiring + security contracts", () => {
  it("wires compare API, model discovery, provider mode UI, and admin CSS", () => {
    const compareApi = read("dev/server/forex-ai-compare-snapshot-api.ts");
    const openaiApi = read("dev/server/forex-ai-openai-snapshot-api.ts");
    const index = read("dev/server/index.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const admin = read("desktop/forex-admin/ForexAdminIntelligencePages.tsx");
    const adminCss = read("desktop/forex-admin/forex-admin.css");
    const fxCss = read("desktop/forex/forex.css");
    const clientApi = read("desktop/forex-admin/api.ts");

    expect(compareApi).toContain("/api/forex/ai-analysis/compare");
    expect(index).toContain("handleForexAiCompareSnapshotApi");
    expect(openaiApi).toContain("/api/forex-admin/openai-config/models/refresh");
    expect(openaiApi).toContain("listOpenAiModels");
    expect(openaiApi).toContain("requireForexAdmin");
    expect(openaiApi).not.toMatch(/apiKey:\s*status/);
    expect(openaiApi).not.toContain("Bearer ${");
    expect(page).toContain("kwizera.forex.aiProviderMode");
    expect(page).toContain('data-ai-provider-mode');
    expect(page).toContain("/api/forex/ai-analysis/compare");
    expect(page).toContain("Compare Both");
    expect(admin).toContain("refreshModels");
    expect(admin).toContain("fxa-openai-select");
    expect(adminCss).toContain(".fxa-openai-config");
    expect(fxCss).toContain(".fx-ai-provider-mode");
    expect(clientApi).toContain("refreshModels");
    expect(clientApi).toContain("/api/forex-admin/openai-config/models/refresh");
  });

  it("does not commit secrets or broker order hooks in 43F modules", () => {
    const orch = read("ai/forex-ai/snapshot-compare/orchestrator.ts");
    const openaiApi = read("dev/server/forex-ai-openai-snapshot-api.ts");
    expect(orch).not.toMatch(/placeOrder|broker.*order|executeTrade/i);
    expect(openaiApi).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(orch).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
  });
});
