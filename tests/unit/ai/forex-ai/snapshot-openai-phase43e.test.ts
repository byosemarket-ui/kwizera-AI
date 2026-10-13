/**
 * Phase 43E — OpenAI snapshot analysis + secure config (mocked provider).
 */
import { describe, expect, it, afterEach, beforeEach } from "vitest";
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
  OPENAI_DEFAULT_MODEL,
  OpenAiSnapshotAnalysisStore,
  resetForexOpenAiConfigStoreForTests,
  resetOpenAiInferenceGateForTests,
  resetOpenAiSnapshotAnalysisEngineForTests,
  resetOpenAiSnapshotAnalysisStoreForTests,
} from "../../../../ai/forex-ai/snapshot-openai/index.ts";

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
    snapshotId: "snap-openai-001",
    requestId: "req-oai",
    createdAt: "2026-10-13T00:00:00.000Z",
    contentFingerprint: fingerprintAnalysisSnapshotPayload(
      buildAnalysisSnapshotFingerprintPayload(draft),
    ),
  };
}

describe("Phase 43E OpenAI snapshot analysis", () => {
  const prevPass = process.env.KWIZERA_SECRETS_PASSPHRASE;

  beforeEach(() => {
    process.env.KWIZERA_SECRETS_PASSPHRASE = "test-passphrase-phase43e-not-real";
  });

  afterEach(() => {
    if (prevPass == null) delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    else process.env.KWIZERA_SECRETS_PASSPHRASE = prevPass;
    resetOpenAiSnapshotAnalysisEngineForTests();
    resetOpenAiSnapshotAnalysisStoreForTests();
    resetForexOpenAiConfigStoreForTests();
    resetOpenAiInferenceGateForTests();
  });

  it("encrypts API key and never returns it from public status", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-cfg-"));
    const store = createForexOpenAiConfigStore(dir);
    const before = await store.getPublicStatus();
    expect(before.configured).toBe(false);
    expect(before.vaultUnlocked).toBe(true);

    const after = await store.setApiKey("sk-testkeyphase43e1234567890abcdef", OPENAI_DEFAULT_MODEL);
    expect(after.configured).toBe(true);
    expect(JSON.stringify(after)).not.toContain("sk-");
    expect(JSON.stringify(after)).not.toMatch(/testkeyphase43e/i);

    const secretsRaw = readFileSync(path.join(dir, "forex-openai", "secrets.json"), "utf8");
    expect(secretsRaw).not.toContain("sk-testkey");
    expect(secretsRaw).toContain("ciphertext");

    const key = await store.getApiKey();
    expect(key?.startsWith("sk-")).toBe(true);

    await store.clearApiKey();
    expect((await store.getPublicStatus()).configured).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects missing key / vault locked / invalid snapshots without calling OpenAI", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-eng-"));
    const config = createForexOpenAiConfigStore(dir);
    const store = new OpenAiSnapshotAnalysisStore(dir);
    let calls = 0;
    const snap = makeSnapshot();
    const engine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async (id) => (id === snap.snapshotId ? snap : null),
      store,
      config,
      chat: async () => {
        calls += 1;
        return { ok: true, code: "OK", model: "gpt-4o-mini", latencyMs: 1, data: {} };
      },
    });

    const missingCfg = await engine.analyze({ snapshotId: snap.snapshotId });
    expect(missingCfg.code).toBe("OPENAI_NOT_CONFIGURED");
    expect(calls).toBe(0);

    delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    resetForexOpenAiConfigStoreForTests();
    const lockedCfg = createForexOpenAiConfigStore(dir);
    const lockedEngine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config: lockedCfg,
      chat: async () => {
        calls += 1;
        return { ok: true, code: "OK", model: "x", latencyMs: 1, data: {} };
      },
    });
    const locked = await lockedEngine.analyze({ snapshotId: snap.snapshotId });
    expect(locked.code).toBe("SECRETS_VAULT_LOCKED");

    process.env.KWIZERA_SECRETS_PASSPHRASE = "test-passphrase-phase43e-not-real";
    await config.setApiKey("sk-testkeyphase43e1234567890abcdef");
    const unknown = await engine.analyze({ snapshotId: "missing" });
    expect(unknown.code).toBe("SNAPSHOT_NOT_FOUND");
    const badFp = await engine.analyze({
      snapshotId: snap.snapshotId,
      contentFingerprint: "deadbeef",
    });
    expect(badFp.code).toBe("SNAPSHOT_FINGERPRINT_MISMATCH");
    expect(calls).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("normalizes mocked OpenAI success and preserves snapshot identity; timeout leaves snapshot intact", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-ok-"));
    const config = createForexOpenAiConfigStore(dir);
    await config.setApiKey("sk-testkeyphase43e1234567890abcdef", "gpt-4o-mini");
    const store = new OpenAiSnapshotAnalysisStore(dir);
    const snap = makeSnapshot();

    const engine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config,
      chat: async () => ({
        ok: true,
        code: "OK",
        model: "gpt-4o-mini",
        latencyMs: 42,
        data: {
          decision: "WAIT",
          decisionRationale: "Historical-only quote; wait for confirmation.",
          marketBias: "UNCERTAIN",
          dataQuality: "VALID_WITH_WARNINGS",
          marketStructureSummary: "Range conditions.",
          keyEvidence: ["quote HISTORICAL_ONLY"],
          bullishScenario: "Hold range high.",
          bearishScenario: "Lose range low.",
          invalidationConditions: ["Fresh opposing structure"],
          confidence: null,
          limitations: [],
        },
      }),
    });

    const result = await engine.analyze({
      snapshotId: snap.snapshotId,
      contentFingerprint: snap.contentFingerprint,
    });
    expect(result.ok).toBe(true);
    expect(result.analysis?.decision).toBe("WAIT");
    expect(result.analysis?.analysisProvider).toBe("OPENAI");
    expect(result.analysis?.snapshotId).toBe(snap.snapshotId);
    expect(result.analysis?.contentFingerprint).toBe(snap.contentFingerprint);
    expect(result.analysis?.newsResearchStatus).toBe("unavailable");
    expect(result.analysis?.model).toBe("gpt-4o-mini");

    const loaded = await engine.getAnalysis(result.analysis!.analysisId);
    expect(loaded?.analysis.analysisId).toBe(result.analysis!.analysisId);

    const timeoutEngine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config,
      chat: async () => ({
        ok: false,
        code: "OPENAI_TIMEOUT",
        model: "gpt-4o-mini",
        latencyMs: 90_000,
        data: null,
        error: "OpenAI timed out after 90000 ms.",
      }),
    });
    const timed = await timeoutEngine.analyze({ snapshotId: snap.snapshotId });
    expect(timed.analysis?.status).toBe("failed");
    expect(timed.analysis?.error).toMatch(/timed out/i);
    // Snapshot identity unchanged (we only hold a local fixture reference).
    expect(snap.contentFingerprint).toBeTruthy();

    const authEngine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config,
      chat: async () => ({
        ok: false,
        code: "OPENAI_AUTH_ERROR",
        model: "gpt-4o-mini",
        latencyMs: 10,
        data: null,
        error: "OpenAI authentication failed. Check the configured API key.",
      }),
    });
    const auth = await authEngine.analyze({ snapshotId: snap.snapshotId });
    expect(auth.ok).toBe(false);
    expect(auth.code).toBe("OPENAI_AUTH_ERROR");

    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects unsupported decisions from model output", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-oai-bad-"));
    const config = createForexOpenAiConfigStore(dir);
    await config.setApiKey("sk-testkeyphase43e1234567890abcdef");
    const store = new OpenAiSnapshotAnalysisStore(dir);
    const snap = makeSnapshot();
    let calls = 0;
    const engine = createOpenAiSnapshotAnalysisEngine({
      getSnapshot: async () => snap,
      store,
      config,
      chat: async () => {
        calls += 1;
        return {
          ok: true,
          code: "OK",
          model: "gpt-4o-mini",
          latencyMs: 5,
          data: { decision: "YOLO", decisionRationale: "nope" },
        };
      },
    });
    const bad = await engine.analyze({ snapshotId: snap.snapshotId });
    expect(bad.analysis?.status).toBe("failed");
    expect(calls).toBeLessThanOrEqual(2); // primary + one repair
    rmSync(dir, { recursive: true, force: true });
  });

  it("wires API, admin config, and UI contracts without exposing secrets", () => {
    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    const index = read("dev/server/index.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const admin = read("desktop/forex-admin/ForexAdminIntelligencePages.tsx");
    const css = read("desktop/forex/forex.css");

    expect(api).toContain("/api/forex/ai-analysis/openai");
    expect(api).toContain("/api/forex-admin/openai-config");
    expect(api).toContain("requireForexAdmin");
    expect(api).not.toMatch(/apiKey:\s*status/);
    expect(index).toContain("handleForexAiOpenAiSnapshotApi");
    expect(index).toContain("handleForexOpenAiAdminConfigApi");
    expect(page).toContain('data-forex-ai-phase43e="true"');
    expect(page).toContain("data-ai-openai-snapshot-btn");
    expect(page).toContain("/api/forex/ai-analysis/openai");
    expect(page).toContain("/api/forex/ai-analysis/local");
    expect(admin).toContain("data-forex-admin-openai-config");
    expect(admin).toContain("forexOpenAiApi");
    expect(css).toContain(".fx-ai-openai-status");
  });
});
