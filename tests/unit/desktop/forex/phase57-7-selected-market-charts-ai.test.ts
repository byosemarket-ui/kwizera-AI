/**
 * Phase 57.7 — Selected-market → charts → AI analysis certification regressions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSelectedMarket,
  readMarketQuery,
  compactMarketSymbol,
} from "../../../../desktop/forex/market-data/selected-market.ts";
import {
  normalizeDataQuality,
  normalizeMarketBias,
  normalizeLocalAnalysisFromModel,
  parseLocalAiDecision,
} from "../../../../ai/forex-ai/snapshot-local/validate-result.ts";
import type { LocalSnapshotEvidencePackage } from "../../../../ai/forex-ai/snapshot-local/types.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 57.7 selected-market identity", () => {
  it("maps Binance compact symbols without inventing FXCM", () => {
    expect(parseSelectedMarket("BTCUSDT")).toEqual({
      venue: "binance-spot",
      symbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      provider: "BINANCE",
    });
    expect(parseSelectedMarket("ethusdt")?.symbol).toBe("ETHUSDT");
  });

  it("keeps FOREXCONNECT exact symbols and rejects silent FX without provider", () => {
    expect(parseSelectedMarket("EUR/USD", "FOREXCONNECT")?.provider).toBe("FOREXCONNECT");
    expect(parseSelectedMarket("EUR/USD")?.venue).toBe("unsupported");
  });

  it("URL query restores symbol+timeframe; Binance omits provider by design", () => {
    const q = readMarketQuery("?symbol=ETHUSDT&timeframe=15m");
    expect(q.selected?.symbol).toBe("ETHUSDT");
    expect(q.selected?.provider).toBe("BINANCE");
    expect(q.timeframe).toBe("15m");
    expect(compactMarketSymbol("ETH/USDT")).toBe("ETHUSDT");
  });
});

describe("Phase 57.7 candle client race / live labeling guards", () => {
  it("useUnifiedCandles uses generation token to drop stale responses", () => {
    const hook = read("desktop/forex/market-data/use-unified-candles.ts");
    expect(hook).toContain("generation");
    expect(hook).toMatch(/if \(gen !== generation\.current\) return/);
    expect(hook).toContain("sameSeriesKey");
  });

  it("unified candle client does not mark HISTORICAL series as live", () => {
    const client = read("desktop/forex/market-data/studio-unified-candles-client.ts");
    expect(client).toContain('const live = connectionState.toUpperCase() === "LIVE"');
    expect(client).toContain("/api/forex/market-data/candles");
  });
});

describe("Phase 57.7 AI schema-echo normalization", () => {
  it("rejects schema-echo marketBias and dataQuality placeholders", () => {
    expect(normalizeMarketBias("BULLISH|BEARISH|NEUTRAL|UNCERTAIN")).toBe("UNCERTAIN");
    expect(normalizeMarketBias("string")).toBe("UNCERTAIN");
    expect(normalizeMarketBias("BULLISH")).toBe("BULLISH");
    expect(normalizeDataQuality("string", "VALID_WITH_WARNINGS")).toBe("VALID_WITH_WARNINGS");
    expect(normalizeDataQuality("VALID", "FALLBACK")).toBe("VALID");
  });

  it("normalizeLocalAnalysisFromModel prefers evidence validation over schema echo", () => {
    const evidence = {
      snapshotId: "snap-1",
      contentFingerprint: "fp",
      provider: "BINANCE",
      instrument: {
        providerSymbol: "ETHUSDT",
        canonicalSymbol: "ETHUSDT",
        displaySymbol: "ETH/USDT",
        marketType: "CRYPTO",
      },
      candleTimeframe: "15m",
      analysisPeriod: "24h",
      evidenceReady: true,
      validationStatus: "VALID_WITH_WARNINGS",
      quoteFreshness: "HISTORICAL_ONLY",
      warnings: ["Live quote unavailable"],
      categories: {
        snapshotMeta: true,
        candles: true,
        quote: true,
        validation: true,
        patterns: true,
        structure: true,
        knowledge: false,
        unavailable: ["knowledge"],
      },
    } as unknown as LocalSnapshotEvidencePackage;

    const normalized = normalizeLocalAnalysisFromModel({
      raw: {
        decision: "WAIT",
        dataQuality: "string",
        marketBias: "BULLISH|BEARISH|NEUTRAL|UNCERTAIN",
        decisionRationale: "Range-bound; wait.",
        limitations: [],
      },
      evidence,
      analysisId: "a1",
      model: "llama3.2:1b",
      inferenceLatencyMs: 100,
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.analysis.dataQuality).toBe("VALID_WITH_WARNINGS");
    expect(normalized.analysis.marketBias).toBe("UNCERTAIN");
    expect(normalized.analysis.instrument).toBe("ETH/USDT");
    expect(normalized.analysis.decision).toBe("WAIT");
    expect(normalized.analysis.limitations.some((l) => /not a broker order/i.test(l))).toBe(true);
  });

  it("parseLocalAiDecision never invents BUY from vague text", () => {
    expect(parseLocalAiDecision("WAIT")).toBe("WAIT");
    expect(parseLocalAiDecision("maybe long")).toBeNull();
  });
});

describe("Phase 57.7 AI page wiring + safety boundaries", () => {
  it("AI Analysis page uses snapshotSeq stale discard and selected symbol", () => {
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    expect(page).toContain("snapshotRequestSeq");
    expect(page).toContain("localAiRequestSeq");
    expect(page).toContain("/api/forex/analysis-snapshot");
    expect(page).toContain("/api/forex/ai-analysis/local");
    expect(page).toContain("setSnapshotStale(true)");
    expect(page).toContain("selectedMarket?.symbol");
  });

  it("local engine rejects instrument/provider mismatch against snapshot", () => {
    const engine = read("ai/forex-ai/snapshot-local/engine.ts");
    expect(engine).toContain("SNAPSHOT_IDENTITY_MISMATCH");
    expect(engine).toContain("Instrument does not match snapshot");
    expect(engine).not.toMatch(/placesOrders\s*[:=]\s*true/);
  });

  it("automation service hard-codes placesOrders and acceptsForExecution false", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toMatch(/placesOrders:\s*false/);
    expect(service).toMatch(/acceptsForExecution:\s*false/);
    expect(service).not.toMatch(/placesOrders:\s*true/);
    expect(service).not.toMatch(/acceptsForExecution:\s*true/);
  });
});
