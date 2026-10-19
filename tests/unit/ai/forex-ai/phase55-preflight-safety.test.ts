/**
 * Phase 55 — Preflight safety & contract regression (static + focused).
 * Does not claim live FXCM/OpenAI E2E success.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AUTOMATED_EXECUTION_BANNER,
  MARKET_QUOTE_STALE_MS,
  assertQuoteCandlePriceScale,
  evaluateVerificationQuoteFreshness,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 55 preflight — execution isolation", () => {
  it("keeps execution banner, API order rejection, and no broker order helpers", () => {
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/NOT IMPLEMENTED/i);
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/PHASE 5/);

    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");
    expect(api).toMatch(/order|position\/close|submit|execute/i);
    expect(api).not.toMatch(/bridge\.(place|submit|create|close).*Order/i);

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);
    expect(service).toMatch(/placesOrders:\s*false/);

    const decision = read("ai/forex-ai/automated-trading/decision/engine.ts");
    expect(decision).toContain("acceptsForExecution: false");
    expect(decision).toContain("placesOrders: false");
    expect(decision).toContain("ACCEPTED_FOR_REVIEW");
  });

  it("preserves OpenAI-only AT path (no Local AI/Ollama fallback)", () => {
    const engine = read("ai/forex-ai/automated-trading/analysis/engine.ts");
    expect(engine).toMatch(/No Local AI fallback/i);
    expect(engine).toContain("openAiChatMultimodalJson");
    expect(engine).not.toMatch(/ollama|getLocalAi|localAiChat/i);
    expect(engine).toMatch(/includedInOpenAiRequest/);
  });

  it("preserves Fix 1 price-scale gate and Fix 2 freshness threshold", () => {
    expect(MARKET_QUOTE_STALE_MS).toBe(15_000);
    const scale = assertQuoteCandlePriceScale({
      bid: 4168.97,
      ask: 4169.27,
      quoteFresh: true,
      candles: Array.from({ length: 24 }, (_, i) => ({
        time: i,
        open: 0.84,
        high: 0.85,
        low: 0.83,
        close: 0.84,
      })),
    });
    expect(scale.ok).toBe(false);
    if (!scale.ok) expect(scale.code).toBe("PRICE_SCALE_MISMATCH");

    const now = Date.now();
    const stale = evaluateVerificationQuoteFreshness(
      {
        identityStatus: "ACCOUNT_VERIFIED",
        environmentSelected: "DEMO",
        environmentConnected: "DEMO",
        environmentMatches: true,
        connectionStatus: "CONNECTED",
        environmentEpoch: 1,
        account: {
          accountIdMasked: "••••0000",
          environment: "DEMO",
          accountCurrency: "USD",
          balance: 1,
          equity: 1,
          equityDerived: false,
          equityDerivation: null,
          usedMargin: 0,
          usableMargin: 1,
          fetchedAtUtc: new Date(now).toISOString(),
          ageMs: 0,
          isFresh: true,
          fields: {
            accountCurrency: true,
            balance: true,
            equity: true,
            usedMargin: true,
            usableMargin: true,
          },
          missingFields: [],
          snapshotCode: "ok",
        },
        instrument: {
          symbol: "XAU/USD",
          displaySymbol: "XAU/USD",
          provider: "FOREXCONNECT",
          recognized: true,
          level: "ELIGIBLE_FOR_FUTURE_RISK",
          instrumentType: "forex",
          baseAsset: "XAU",
          quoteAsset: "USD",
          pointSize: 0.001,
          pipCostAccount: null,
          contractMultiplier: null,
          baseUnitSize: null,
          quantityMin: null,
          quantityStep: null,
          quantityUnit: null,
          marginRate: null,
          marginPerLotAccount: null,
          contractVerified: true,
          contractSource: "fc",
          unavailableReason: null,
        },
        market: {
          bid: 1,
          ask: 1.1,
          spread: 0.1,
          feedStatus: "LIVE",
          sourceTimestampMs: now,
          receivedAtMs: now,
          priceChangeAgeMs: 500,
          receiptAgeMs: 200,
          updateCount: 3,
          marketSession: "ACTIVE",
        },
        readiness: {
          environmentVerified: true,
          accountIdentityVerified: true,
          accountMetadataSufficient: true,
          instrumentMetadataVerified: true,
          marketDataHealthVerified: true,
          riskEngineVerified: false,
          executionImplemented: false,
          readyForFutureAnalysis: true,
          readyForTrading: false,
        },
        blockers: [],
        verifiedAtUtc: new Date(now - 60_000).toISOString(),
        placesOrders: false,
      },
      { nowMs: now },
    );
    expect(stale.fresh).toBe(false);
  });

  it("Phase 54 decision engine still rejects SUPERSEDED analysis (regression present)", () => {
    const phase54 = read("tests/unit/ai/forex-ai/phase54-trading-decision.test.ts");
    expect(phase54).toMatch(/SUPERSEDED/);
    expect(phase54).toMatch(/acceptsForExecution/);
    expect(phase54).toMatch(/ACCEPTED_FOR_REVIEW/);
    const engine = read("ai/forex-ai/automated-trading/decision/engine.ts");
    expect(engine).toMatch(/SUPERSEDED/);
    expect(engine).toMatch(/acceptsForExecution:\s*false/);
  });
});
