/**
 * Integration fix — Phase 52 verification shape vs monitor/decision gates.
 */
import { describe, expect, it } from "vitest";
import {
  isVerificationAccountIdentityOk,
  isVerificationMarketQuoteFresh,
  verificationLastQuoteChangeAtUtc,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import type { AutomatedTradingVerificationResult } from "../../../../ai/forex-ai/automated-trading/verification-types.ts";

function sample(over: Partial<AutomatedTradingVerificationResult> = {}): AutomatedTradingVerificationResult {
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
      fetchedAtUtc: new Date().toISOString(),
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
      bid: 4172.72,
      ask: 4173.02,
      spread: 0.3,
      feedStatus: "LIVE",
      sourceTimestampMs: Date.now() - 500,
      receivedAtMs: Date.now(),
      priceChangeAgeMs: 1000,
      receiptAgeMs: 200,
      updateCount: 5,
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
    verifiedAtUtc: new Date().toISOString(),
    placesOrders: false,
    ...over,
  };
}

describe("Phase 52 verification gates for monitor/decision", () => {
  it("accepts ACCOUNT_VERIFIED + LIVE Bid/Ask (real Phase 52 shape)", () => {
    const v = sample();
    expect(isVerificationAccountIdentityOk(v)).toBe(true);
    expect(isVerificationMarketQuoteFresh(v)).toBe(true);
    expect(verificationLastQuoteChangeAtUtc(v)).toMatch(/T/);
  });

  it("rejects invented quoteFresh-only aliases (must use feedStatus+Bid/Ask)", () => {
    const stale = sample({
      market: {
        ...sample().market,
        feedStatus: "STALE",
        bid: 1,
        ask: 1.1,
      },
    });
    expect(isVerificationMarketQuoteFresh(stale)).toBe(false);

    const noBid = sample({
      market: {
        ...sample().market,
        bid: null,
        ask: 4173,
        feedStatus: "LIVE",
      },
    });
    expect(isVerificationMarketQuoteFresh(noBid)).toBe(false);
  });

  it("rejects unverified identity", () => {
    expect(
      isVerificationAccountIdentityOk(
        sample({ identityStatus: "ACCOUNT_IDENTITY_UNVERIFIED", account: { ...sample().account, isFresh: false } }),
      ),
    ).toBe(false);
  });

  it("does not treat heartbeat receipt/source as a last quote price change", () => {
    const heartbeatOnly = sample({
      market: {
        ...sample().market,
        feedStatus: "SUBSCRIBING",
        priceChangeAgeMs: null,
        receiptAgeMs: 200,
        updateCount: 0,
        sourceTimestampMs: Date.now() - 100,
        receivedAtMs: Date.now(),
      },
      readiness: {
        ...sample().readiness,
        marketDataHealthVerified: false,
        readyForFutureAnalysis: false,
      },
    });
    expect(verificationLastQuoteChangeAtUtc(heartbeatOnly)).toBeNull();
    expect(isVerificationMarketQuoteFresh(heartbeatOnly)).toBe(false);
  });
});
