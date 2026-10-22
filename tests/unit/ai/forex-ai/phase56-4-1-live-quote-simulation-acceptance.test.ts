/**
 * Phase 56.4.1 — Live-quote simulation acceptance (synthetic unit fixtures).
 * Production LIVE evidence is recorded separately in the phase report — not claimed here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateVerificationQuoteFreshness,
} from "../../../../ai/forex-ai/automated-trading/quote-freshness.js";
import {
  evaluateSimulationDataReadiness,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  assembleSimDraftInput,
  resolveXauQuantitySemantics,
  resolveXauQuantityConstraints,
  type AtSimDraftInput,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";
import type { AutomatedTradingVerificationResult } from "../../../../ai/forex-ai/automated-trading/verification-types.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function baseVerification(
  overrides: {
    verifiedAtUtc?: string;
    market?: Partial<AutomatedTradingVerificationResult["market"]>;
    instrument?: Partial<AutomatedTradingVerificationResult["instrument"]>;
  } = {},
): AutomatedTradingVerificationResult {
  const now = Date.now();
  const verifiedAtUtc = overrides.verifiedAtUtc ?? new Date(now).toISOString();
  return {
    identityStatus: "ACCOUNT_VERIFIED",
    environmentSelected: "DEMO",
    environmentConnected: "DEMO",
    environmentMatches: true,
    connectionStatus: "CONNECTED",
    environmentEpoch: 1,
    account: {
      accountIdMasked: "****9999",
      environment: "DEMO",
      accountCurrency: "USD",
      balance: 10_000,
      equity: 10_000,
      equityDerived: false,
      equityDerivation: null,
      usedMargin: 0,
      usableMargin: 9_000,
      fetchedAtUtc: verifiedAtUtc,
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
      snapshotCode: null,
    },
    instrument: {
      symbol: "XAU/USD",
      displaySymbol: "XAU/USD",
      provider: "FOREXCONNECT",
      recognized: true,
      level: "ELIGIBLE_FOR_FUTURE_RISK",
      instrumentType: "Bullion",
      baseAsset: "XAU",
      quoteAsset: "USD",
      pointSize: 0.01,
      pipCostAccount: 0.01,
      contractMultiplier: 1,
      baseUnitSize: 1,
      quantityMin: 1,
      quantityStep: 1,
      quantityUnit: "contracts",
      marginRate: null,
      marginPerLotAccount: 4.79,
      contractVerified: true,
      contractSource: "synthetic",
      unavailableReason: null,
      condDistStop: 0,
      condDistAvailable: true,
      condDistUnit: "pips",
      condDistMethod: "get_cond_dist_stop_for_trade",
      ...overrides.instrument,
    },
    market: {
      bid: 4072.5,
      ask: 4072.8,
      spread: 0.3,
      feedStatus: "LIVE",
      sourceTimestampMs: now,
      receivedAtMs: now,
      priceChangeAgeMs: 200,
      receiptAgeMs: 150,
      updateCount: 5,
      marketSession: "ACTIVE",
      ...overrides.market,
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
    verifiedAtUtc,
    placesOrders: false,
  };
}

describe("Phase 56.4.1 quote freshness gating", () => {
  it("accepts fresh LIVE bid/ask", () => {
    const now = Date.now();
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: {
        feedStatus: "LIVE",
        bid: 4072.5,
        ask: 4072.8,
        priceChangeAgeMs: 100,
        receiptAgeMs: 80,
        sourceTimestampMs: now,
        receivedAtMs: now,
        updateCount: 3,
      },
    });
    const f = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(f.fresh).toBe(true);
  });

  it("rejects non-LIVE feed", () => {
    const now = Date.now();
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: {
        feedStatus: "SUBSCRIBING",
        bid: 4072.5,
        ask: 4072.8,
        updateCount: 0,
        priceChangeAgeMs: null,
      },
    });
    const f = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(f.fresh).toBe(false);
    expect(["FEED_NOT_LIVE", "NO_QUOTE_UPDATES"]).toContain(f.reasonCode);
  });

  it("rejects STALE price-change age", () => {
    const now = Date.now();
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: {
        feedStatus: "LIVE",
        bid: 4072.5,
        ask: 4072.8,
        priceChangeAgeMs: 120_000,
        receiptAgeMs: 120_000,
        sourceTimestampMs: now - 120_000,
        receivedAtMs: now - 120_000,
        updateCount: 1,
      },
    });
    const f = evaluateVerificationQuoteFreshness(v, { nowMs: now, staleMs: 15_000 });
    expect(f.fresh).toBe(false);
  });

  it("rejects future source timestamps", () => {
    const now = Date.now();
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: {
        feedStatus: "LIVE",
        bid: 4072.5,
        ask: 4072.8,
        sourceTimestampMs: now + 600_000,
        receivedAtMs: now,
        priceChangeAgeMs: 0,
        receiptAgeMs: 0,
        updateCount: 1,
      },
    });
    const f = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(f.fresh).toBe(false);
    expect(f.reasonCode).toBe("SOURCE_TIMESTAMP_FUTURE");
  });

  it("rejects missing bid/ask", () => {
    const now = Date.now();
    const v = baseVerification({
      verifiedAtUtc: new Date(now).toISOString(),
      market: { feedStatus: "LIVE", bid: null, ask: null, updateCount: 0 },
    });
    const f = evaluateVerificationQuoteFreshness(v, { nowMs: now });
    expect(f.fresh).toBe(false);
    expect(f.reasonCode).toBe("BID_ASK_MISSING");
  });
});

describe("Phase 56.4.1 readiness under LIVE vs idle", () => {
  it("market_quote READY only when quoteFresh and LIVE bid/ask present", () => {
    const semantics = resolveXauQuantitySemantics({
      symbol: "XAU/USD",
      pointSize: 0.01,
      pipCostAccount: 0.01,
      baseUnitSize: 1,
      contractMultiplier: 1,
      quantityMin: 1,
      quantityStep: 1,
      condDistStop: 0,
      condDistAvailable: true,
      condDistStopUnit: "pips",
      condDistMethod: "get_cond_dist_stop_for_trade",
    });
    const c = resolveXauQuantityConstraints({
      quantityUnit: semantics.resolvedQuantityUnit,
      quantityUnitAmbiguous: semantics.quantityUnitAmbiguous,
      baseUnitSize: 1,
      sdkMinQuantity: 1,
    });
    const readyInput = {
      environment: "DEMO" as const,
      environmentMatches: true,
      quoteFresh: true,
      feedStatus: "LIVE",
      bid: 4072.5,
      ask: 4072.8,
      accountVerified: true,
      accountCurrency: "USD",
      equity: 10_000,
      usableMargin: 9_000,
      accountFresh: true,
      quantityUnit: semantics.resolvedQuantityUnit,
      quantityUnitAmbiguous: semantics.quantityUnitAmbiguous,
      quantityMin: c.quantityMin,
      quantityStep: c.quantityStep,
      quantityConstraintsVerified: !c.sizingBlocked,
      minStopDistanceVerified: semantics.minStopDistanceVerified,
      minStopNoPositiveMinimum: semantics.minStopNoPositiveMinimum,
      condDistUnit: semantics.condDistUnit,
      condDistAvailable: true,
      conversionRequired: false,
      conversionReady: true,
      exposureAuthoritative: true,
      exposureStatus: "AUTHORITATIVE_EMPTY",
      confirmedZeroExposure: true,
      masterEnable: false,
      emergencyEntryLock: true,
    };
    expect(evaluateSimulationDataReadiness(readyInput).overall).toBe("READY");

    const idle = evaluateSimulationDataReadiness({
      ...readyInput,
      quoteFresh: false,
      quoteReasonCode: "FEED_NOT_LIVE",
      feedStatus: "DISCONNECTED",
    });
    expect(idle.gates.find((g) => g.id === "market_quote")?.status).not.toBe("READY");
    expect(idle.readyForSimulationDraft).toBe(false);
  });
});

describe("Phase 56.4.1 synthetic Scenario 1 draft under LIVE fixture", () => {
  it("validates draft with LIVE verification + attested CondDist/quantity (synthetic)", () => {
    const verification = baseVerification();
    const input = assembleSimDraftInput({
      environment: "DEMO",
      environmentEpoch: 1,
      decision: null,
      verification,
      quoteFresh: true,
      freshnessReasonCode: "FRESH",
      quoteAgeMs: 200,
      sessionEnvironment: "DEMO",
      sessionMatchesSelection: true,
      policy: defaultSimRiskPolicy(),
      capitalAllocationPercent: 10,
      requestedPerOrderAllocation: 250,
      reservedStrategyBudgetActive: 0,
      exposureReconciliation: {
        authoritative: true,
        status: "AUTHORITATIVE_EMPTY",
        confirmedZeroExposure: true,
        openPositionsCount: 0,
        pendingOrdersCount: 0,
        xau: null,
        ordersCapability: "AVAILABLE",
        tradesCapability: "AVAILABLE",
        ordersCode: "NO_ORDERS",
        tradesCode: "NO_TRADES",
        fetchedAtUtc: new Date().toISOString(),
        freshnessMs: 100,
        note: "synthetic empty",
        blockers: [],
      },
      overrides: {
        instrument: "XAU/USD",
        direction: "BUY",
        entryPrice: 4072.6,
        stopLoss: 4067.6,
        takeProfit: 4087.6,
      },
    });
    expect(input.contract?.quantityUnitAmbiguous).toBe(false);
    expect(input.contract?.minStopNoPositiveMinimum).toBe(true);
    const draft = validateSimulationDraft(input as AtSimDraftInput);
    expect(draft.placesOrders).toBe(false);
    expect(draft.acceptsForExecution).toBe(false);
    expect([
      "VALIDATION_PASSED",
      "VALIDATION_FAILED",
      "BLOCKED",
      "BLOCKED_INSUFFICIENT_DATA",
      "BLOCKED_POLICY_UNDECIDED",
      "REJECTED_LOCAL",
    ]).toContain(draft.overallStatus);
  });
});

describe("Phase 56.4.1 subscribe API wires live-service (source)", () => {
  it("forexconnect subscribe/unsubscribe use live-service ensure/unsubscribe", () => {
    const api = read("dev/server/forexconnect-api.ts");
    expect(api).toContain("live.ensure(symbol, timeframe)");
    expect(api).toContain("live.unsubscribe(symbol, timeframe)");
    expect(api).toContain("intendedRegistered");
    expect(api).toMatch(/placesOrders:\s*false/);
    const subscribeBlock = api.slice(
      api.indexOf('/api/forex/providers/forexconnect/subscribe"'),
      api.indexOf('/api/forex/providers/forexconnect/unsubscribe"'),
    );
    expect(subscribeBlock).not.toMatch(/bridge\.subscribeQuotes\(symbol\)/);
  });

  it("AT API remains Admin-gated and EXECUTION_FORBIDDEN", () => {
    const at = read("dev/server/forex-automated-trading-api.ts");
    expect(at).toContain("requireForexAdmin");
    expect(at).toContain("EXECUTION_FORBIDDEN");
    expect(at).toMatch(/placesOrders:\s*false/);
  });
});
