/**
 * Phase 52 — FXCM account & market verification engine (read-only).
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  assembleVerificationResult,
  buildMarketFromQuote,
  computeReadinessGates,
  mapIdentityFromSnapshot,
  parseOptionalFinite,
  validateBidAsk,
  verifyInstrumentMetadata,
  AUTOMATED_EXECUTION_BANNER,
  emptyAccountMetadata,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import type { ForexAccountSnapshot } from "../../../../ai/forex-ai/position-sizing/account-snapshot.ts";
import type { ForexConnectAccountsResult, ForexConnectInstrument } from "../../../../ai/market-data/forexconnect/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function baseSnapshot(over: Partial<ForexAccountSnapshot> = {}): ForexAccountSnapshot {
  return {
    ok: true,
    code: "OK",
    environment: "demo",
    environmentLabel: "DEMO",
    accountId: "ACCT-12345678",
    accountIdMasked: "••••5678",
    accountNameMasked: null,
    accountCurrency: "USD",
    balance: 1000,
    equity: 1000,
    usedMargin: 0,
    usableMargin: 1000,
    source: "forexconnect-accounts",
    fetchedAt: new Date().toISOString(),
    isFresh: true,
    maxAgeMs: 60_000,
    ageMs: 100,
    fields: {
      accountCurrency: true,
      balance: true,
      equity: true,
      usedMargin: true,
      usableMargin: true,
    },
    missingFields: [],
    accounts: [],
    connectionStatus: "CONNECTED",
    message: "ok",
    note: "test",
    ...over,
  };
}

function accountsOk(accountId = "ACCT-12345678"): ForexConnectAccountsResult {
  return {
    ok: true,
    code: "OK",
    count: 1,
    accounts: [
      {
        accountId,
        accountIdMasked: "••••5678",
        environment: "demo",
        accountCurrency: "USD",
        balance: 1000,
        equity: 1000,
        usedMargin: 0,
        usableMargin: 1000,
        missingFields: [],
      },
    ],
    fetchedAt: new Date().toISOString(),
    status: {
      ok: true,
      provider: "FOREXCONNECT",
      apiPath: "/status",
      status: "CONNECTED",
      enabled: true,
      configured: true,
      environment: "demo",
      environmentLabel: "DEMO",
      usernameConfigured: true,
      passwordConfigured: true,
      trading: "DISABLED",
    },
    trading: "DISABLED",
  };
}

const eurUsd: ForexConnectInstrument = {
  provider: "FOREXCONNECT",
  providerSymbol: "EUR/USD",
  canonicalSymbol: "EURUSD",
  displaySymbol: "EUR/USD",
  marketType: "forex",
  baseAsset: "EUR",
  quoteAsset: "USD",
  status: "tradable",
  pointSize: 0.0001,
  pipCost: 10,
  baseUnitSize: 1000,
  lotStep: 0.01,
  instrumentTypeLabel: "Forex",
};

describe("Phase 52 verification pure helpers", () => {
  it("accepts legitimate zero balance and rejects non-finite", () => {
    expect(parseOptionalFinite(0)).toEqual({ present: true, value: 0, invalid: false });
    expect(parseOptionalFinite(null).present).toBe(false);
    expect(parseOptionalFinite(Number.NaN).invalid).toBe(true);
  });

  it("validates Bid/Ask ordering and positivity", () => {
    expect(validateBidAsk(1.1, 1.2).ok).toBe(true);
    expect(validateBidAsk(1.2, 1.1).ok).toBe(false);
    expect(validateBidAsk(-1, 1).ok).toBe(false);
  });

  it("detects DEMO/LIVE environment mismatch", () => {
    const r = mapIdentityFromSnapshot({
      credentialsConfigured: true,
      connectionStatus: "CONNECTED",
      selected: "LIVE",
      sessionEnv: "DEMO",
      snapshot: baseSnapshot(),
    });
    expect(r.identityStatus).toBe("ENVIRONMENT_MISMATCH");
    expect(r.environmentMatches).toBe(false);
  });

  it("rejects account id mismatch against expected binding", () => {
    const r = mapIdentityFromSnapshot({
      credentialsConfigured: true,
      connectionStatus: "CONNECTED",
      selected: "DEMO",
      sessionEnv: "DEMO",
      snapshot: baseSnapshot({ accountId: "OTHER" }),
      expectedAccountId: "ACCT-12345678",
    });
    expect(r.identityStatus).toBe("ACCOUNT_IDENTITY_UNVERIFIED");
  });

  it("marks missing account identity", () => {
    const r = mapIdentityFromSnapshot({
      credentialsConfigured: true,
      connectionStatus: "CONNECTED",
      selected: "DEMO",
      sessionEnv: "DEMO",
      snapshot: baseSnapshot({ accountId: null, accountIdMasked: null }),
    });
    expect(r.identityStatus).toBe("ACCOUNT_IDENTITY_UNVERIFIED");
  });

  it("marks stale account metadata", () => {
    const r = mapIdentityFromSnapshot({
      credentialsConfigured: true,
      connectionStatus: "CONNECTED",
      selected: "DEMO",
      sessionEnv: "DEMO",
      snapshot: baseSnapshot({ isFresh: false, code: "STALE" }),
    });
    expect(r.identityStatus).toBe("ACCOUNT_DATA_STALE");
  });

  it("flags incomplete contract metadata and unsupported instruments", () => {
    const missing = verifyInstrumentMetadata("EUR/USD", [
      { ...eurUsd, pointSize: null, pipCost: null, baseUnitSize: null },
    ]);
    expect(missing.instrument.recognized).toBe(true);
    expect(missing.instrument.level).toBe("METADATA_PARTIAL");
    expect(missing.blockers.some((b) => b.code === "CONTRACT_METADATA_MISSING")).toBe(true);

    const unsupported = verifyInstrumentMetadata("NOPE", [eurUsd]);
    expect(unsupported.instrument.level).toBe("NOT_SUPPORTED");
  });

  it("verifies complete FX contract as eligible for future risk", () => {
    const r = verifyInstrumentMetadata("EUR/USD", [eurUsd]);
    expect(r.instrument.level).toBe("ELIGIBLE_FOR_FUTURE_RISK");
    expect(r.instrument.contractVerified).toBe(true);
  });

  it("does not label unchanged receipt heartbeats as LIVE", () => {
    const liveish = buildMarketFromQuote({
      bid: 1.1,
      ask: 1.1002,
      streamState: "LIVE",
      priceChangeAgeMs: 60_000,
      receiptAgeMs: 500,
      updateCount: 5,
    });
    expect(liveish.market.feedStatus).not.toBe("LIVE");
    expect(liveish.market.feedStatus).toBe("NO_RECENT_MARKET_UPDATES");
  });

  it("accepts genuine recent price changes as LIVE", () => {
    const r = buildMarketFromQuote({
      bid: 1.1,
      ask: 1.1002,
      streamState: "LIVE",
      priceChangeAgeMs: 400,
      receiptAgeMs: 400,
      updateCount: 3,
    });
    expect(r.market.feedStatus).toBe("LIVE");
    expect(r.market.spread).toBeCloseTo(0.0002);
  });

  it("keeps market session UNKNOWN when inactive evidence is absent", () => {
    const r = buildMarketFromQuote({
      bid: null,
      ask: null,
      streamState: "SUBSCRIBED_WAITING",
      updateCount: 0,
    });
    expect(r.market.marketSession).toBe("UNKNOWN");
  });

  it("assembles readiness gates and never marks readyForTrading", () => {
    const verification = assembleVerificationResult({
      selected: "DEMO",
      environmentEpoch: 3,
      credentialsConfigured: true,
      connectionStatus: "CONNECTED",
      sessionEnv: "DEMO",
      accountsResult: accountsOk(),
      instrumentSymbol: "EUR/USD",
      instruments: [eurUsd],
      marketInput: {
        bid: 1.1,
        ask: 1.1001,
        streamState: "LIVE",
        priceChangeAgeMs: 200,
        receiptAgeMs: 200,
        updateCount: 2,
      },
    });
    expect(verification.identityStatus).toBe("ACCOUNT_VERIFIED");
    expect(verification.readiness.readyForTrading).toBe(false);
    expect(verification.readiness.executionImplemented).toBe(false);
    expect(verification.readiness.riskEngineVerified).toBe(false);
    expect(verification.placesOrders).toBe(false);
    expect(verification.environmentEpoch).toBe(3);

    const gates = computeReadinessGates({
      identityStatus: "ACCOUNT_VERIFIED",
      account: { ...emptyAccountMetadata(), fields: {
        accountCurrency: true, balance: true, equity: true, usedMargin: true, usableMargin: true,
      }, accountCurrency: "USD", balance: 1, equity: 1, isFresh: true },
      instrument: verification.instrument,
      market: verification.market,
    });
    expect(gates.readyForFutureAnalysis).toBe(true);
    expect(gates.readyForTrading).toBe(false);
  });

  it("rejects LIVE verification when DEMO session is connected", () => {
    const verification = assembleVerificationResult({
      selected: "LIVE",
      environmentEpoch: 1,
      credentialsConfigured: true,
      connectionStatus: "CONNECTED",
      sessionEnv: "DEMO",
      accountsResult: accountsOk(),
      instrumentSymbol: null,
      instruments: [],
      marketInput: null,
    });
    expect(verification.identityStatus).toBe("ENVIRONMENT_MISMATCH");
    expect(verification.readiness.readyForFutureAnalysis).toBe(false);
  });
});

describe("Phase 52 static contracts", () => {
  it("registers verification APIs and keeps execution forbidden", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/verify");
    expect(api).toContain("/api/forex/automated-trading/verification");
    expect(api).toContain("/api/forex/automated-trading/instrument");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    expect(read("ai/forex-ai/automated-trading/service.ts")).not.toMatch(
      /placeOrder|submitOrder|createOrder|closePosition/,
    );
    expect(AUTOMATED_EXECUTION_BANNER).toContain("PHASE 52");
    expect(read("desktop/forex/ForexAutomatedTradingPage.tsx")).toContain("data-fx-at-verification");
    expect(read("desktop/forex/ForexAutomatedTradingPage.tsx")).toContain("data-fx-at-readiness");
    expect(read("desktop/forex/ForexShell.tsx")).toContain("ForexAutomatedTradingPage");
    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/ai-analysis");
    expect(read("desktop/forex/forex-routes.ts")).toContain("/forex/charts");
  });
});
