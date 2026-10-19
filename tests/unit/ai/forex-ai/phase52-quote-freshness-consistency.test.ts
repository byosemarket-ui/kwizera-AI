/**
 * Integration Fix 2 — worker/verification quote-freshness consistency.
 * Focused unit tests only (no full app).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  evaluateVerificationQuoteFreshness,
  isVerificationMarketQuoteFresh,
  MARKET_QUOTE_STALE_MS,
  withEvaluatedMarketReadiness,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import type { AutomatedTradingVerificationResult } from "../../../../ai/forex-ai/automated-trading/verification-types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function sample(over: Partial<AutomatedTradingVerificationResult> = {}): AutomatedTradingVerificationResult {
  const now = Date.now();
  return {
    identityStatus: "ACCOUNT_VERIFIED",
    environmentSelected: "DEMO",
    environmentConnected: "DEMO",
    environmentMatches: true,
    connectionStatus: "CONNECTED",
    environmentEpoch: 1,
    account: {
      accountIdMasked: "••••9634",
      environment: "DEMO",
      accountCurrency: "USD",
      balance: 1,
      equity: 1,
      equityDerived: false,
      equityDerivation: null,
      usedMargin: 0,
      usableMargin: 1,
      fetchedAtUtc: new Date(now).toISOString(),
      ageMs: 100,
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
      bid: 4160.1,
      ask: 4160.4,
      spread: 0.3,
      feedStatus: "LIVE",
      sourceTimestampMs: now - 400,
      receivedAtMs: now - 200,
      priceChangeAgeMs: 500,
      receiptAgeMs: 200,
      updateCount: 12,
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
    verifiedAtUtc: new Date(now).toISOString(),
    placesOrders: false,
    ...over,
  };
}

describe("canonical quote freshness contract", () => {
  it("accepts fresh LIVE Bid/Ask with recent genuine price change", () => {
    const now = Date.now();
    const v = sample({ verifiedAtUtc: new Date(now).toISOString() });
    const ev = evaluateVerificationQuoteFreshness(v, { nowMs: now, expectedInstrument: "XAU/USD" });
    expect(ev.fresh).toBe(true);
    expect(ev.reasonCode).toBe("LIVE_FRESH");
    expect(ev.freshnessThresholdMs).toBe(MARKET_QUOTE_STALE_MS);
    expect(isVerificationMarketQuoteFresh(v, { nowMs: now })).toBe(true);
  });

  it("ages a frozen LIVE snapshot past the threshold into STALE", () => {
    const verifiedAt = Date.now() - 20_000;
    const v = sample({
      verifiedAtUtc: new Date(verifiedAt).toISOString(),
      market: {
        ...sample().market,
        feedStatus: "LIVE",
        priceChangeAgeMs: 1_000,
        receiptAgeMs: 500,
        updateCount: 8,
      },
    });
    const now = verifiedAt + 20_000;
    const ev = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(ev.fresh).toBe(false);
    expect(["QUOTE_AGE_EXCEEDED", "HEARTBEAT_ONLY_NO_PRICE_CHANGE"]).toContain(ev.reasonCode);
    expect(ev.effectivePriceChangeAgeMs).toBeGreaterThan(MARKET_QUOTE_STALE_MS);
  });

  it("treats receipt-only (heartbeat) as not fresh when price change is stale", () => {
    const now = Date.now();
    const verifiedAt = now - 2_000;
    const v = sample({
      verifiedAtUtc: new Date(verifiedAt).toISOString(),
      market: {
        ...sample().market,
        feedStatus: "LIVE",
        priceChangeAgeMs: 14_000,
        receiptAgeMs: 200,
        updateCount: 5,
      },
    });
    const ev = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(ev.fresh).toBe(false);
    expect(ev.reasonCode).toBe("HEARTBEAT_ONLY_NO_PRICE_CHANGE");
  });

  it("rejects instrument mismatch and missing Bid/Ask", () => {
    const now = Date.now();
    const v = sample();
    expect(
      evaluateVerificationQuoteFreshness(v, { nowMs: now, expectedInstrument: "EUR/USD" }).reasonCode,
    ).toBe("INSTRUMENT_MISMATCH");

    const noBid = sample({
      market: { ...sample().market, bid: null },
    });
    expect(evaluateVerificationQuoteFreshness(noBid, { nowMs: now }).reasonCode).toBe("BID_ASK_MISSING");
  });

  it("rejects future source timestamps and unknown price-change age", () => {
    const now = Date.now();
    const future = sample({
      market: { ...sample().market, sourceTimestampMs: now + 60_000 },
    });
    expect(evaluateVerificationQuoteFreshness(future, { nowMs: now }).reasonCode).toBe(
      "SOURCE_TIMESTAMP_FUTURE",
    );

    const unknown = sample({
      market: { ...sample().market, priceChangeAgeMs: null },
    });
    expect(evaluateVerificationQuoteFreshness(unknown, { nowMs: now }).reasonCode).toBe(
      "PRICE_CHANGE_AGE_UNKNOWN",
    );
  });

  it("withEvaluatedMarketReadiness flips PASS Market data when snapshot ages out", () => {
    const verifiedAt = Date.now() - 30_000;
    const v = sample({
      verifiedAtUtc: new Date(verifiedAt).toISOString(),
      market: {
        ...sample().market,
        priceChangeAgeMs: 500,
        receiptAgeMs: 200,
      },
    });
    expect(v.readiness.marketDataHealthVerified).toBe(true);
    const ev = evaluateVerificationQuoteFreshness(v, { nowMs: verifiedAt + 30_000 });
    const adjusted = withEvaluatedMarketReadiness(v, ev);
    expect(adjusted.readiness.marketDataHealthVerified).toBe(false);
    expect(adjusted.readiness.readyForFutureAnalysis).toBe(false);
  });
});

describe("wiring: worker nudge + shared contract", () => {
  it("service nudges monitor after verification and status re-evaluates freshness", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toMatch(/notifyVerificationUpdated/);
    expect(service).toMatch(/withEvaluatedMarketReadiness/);
    expect(service).toMatch(/evaluateVerificationQuoteFreshness/);
    expect(service).toMatch(/nextMs < existingMs/);
  });

  it("worker uses evaluateVerificationMarketQuoteFreshness and exposes diagnostics", () => {
    const worker = read("ai/forex-ai/automated-trading/monitoring/worker.ts");
    expect(worker).toMatch(/evaluateVerificationMarketQuoteFreshness/);
    expect(worker).toMatch(/notifyVerificationUpdated/);
    expect(worker).toMatch(/freshnessReasonCode/);
    expect(worker).toMatch(/pendingVerificationNudge/);
  });

  it("preserves Fix 1 price-consistency gate", () => {
    const engine = read("ai/forex-ai/automated-trading/analysis/engine.ts");
    expect(engine).toMatch(/assertQuoteCandlePriceScale/);
    expect(engine).toMatch(/candlesByTf/);
    const consistency = read("ai/forex-ai/automated-trading/analysis/price-consistency.ts");
    expect(consistency).toMatch(/PRICE_SCALE_MISMATCH/);
  });
});
