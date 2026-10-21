/**
 * Phase 56.2.9 — End-to-end simulation acceptance retest (synthetic fixtures).
 * Labels: SYNTHETIC — not production broker evidence.
 * Retests readiness + allocation/3R/25% + multi-instrument independence + execution locks
 * after Phase 56.2.8 market-agnostic data-engine changes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateSimulationDataReadiness,
  validateOrderAllocationAmount,
  sizeOrderQuantityFromAllocation,
  proposeTakeProfit3RPrice,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  AT_INSTRUMENT_ALLOWLIST,
  type AtSimDraftInput,
  type AtSimContractMetaInput,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";
import {
  evaluateInstrumentReadiness,
  summarizeInstrumentReadinessCatalog,
} from "../../../../ai/market-data/instrument-readiness/index.js";
import { resolveForexConnectLiveTimeframe } from "../../../../ai/market-data/forexconnect/timeframes.js";
import type { MarketInstrument } from "../../../../ai/market-data/providers/types.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const readyBase = {
  environment: "DEMO" as const,
  environmentMatches: true,
  quoteFresh: true,
  quoteReasonCode: "LIVE_FRESH",
  feedStatus: "LIVE",
  bid: 4100,
  ask: 4100.3,
  accountVerified: true,
  accountCurrency: "USD",
  equity: 10_000,
  usableMargin: 8_000,
  accountFresh: true,
  quantityUnit: "contracts",
  quantityUnitAmbiguous: false,
  quantityMin: 1,
  quantityStep: 1,
  quantityConstraintsVerified: true,
  minStopDistanceVerified: true,
  minStopNoPositiveMinimum: false,
  condDistUnit: "pips",
  condDistAvailable: true,
  conversionRequired: false,
  conversionReady: true,
  exposureAuthoritative: true,
  exposureStatus: "AUTHORITATIVE_EMPTY",
  confirmedZeroExposure: true,
  masterEnable: false,
  emergencyEntryLock: true,
};

const xauContract: AtSimContractMetaInput = {
  verified: true,
  pointSize: 0.01,
  tickSize: 0.01,
  digits: 2,
  quantityMin: 1,
  quantityStep: 1,
  quantityUnit: "contracts",
  quantityUnitAmbiguous: false,
  contractMultiplier: 1,
  baseUnitSize: 1,
  pipCostAccount: 0.01,
  marginPerLotAccount: 4.79,
  minStopDistance: 0.5,
  minStopDistanceVerified: true,
  source: "synthetic",
  unavailableReason: null,
};

function syntheticInstrument(symbol: string, marketType: MarketInstrument["marketType"] = "FOREX"): MarketInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace("/", ""),
    displaySymbol: symbol,
    marketType,
    baseAsset: symbol.split("/")[0] ?? null,
    quoteAsset: symbol.split("/")[1] ?? null,
    status: "available",
    capabilities: {
      instruments: true,
      liveQuotes: true,
      streamingQuotes: true,
      historicalPrices: true,
      candles: true,
      liveCandles: true,
      trading: false,
    },
    metadata: { synthetic: true },
  };
}

function draftInput(overrides: Partial<AtSimDraftInput> = {}): AtSimDraftInput {
  return {
    environment: "DEMO",
    environmentMeta: {
      requested: "DEMO",
      actualSession: "DEMO",
      matches: true,
      environmentEpoch: 1,
      identityVerified: true,
      liveExecutionAuthorized: false,
    },
    instrument: "XAU/USD",
    direction: "BUY",
    entryPrice: 4100,
    stopLoss: 4080,
    takeProfit: 4160,
    requestedQuantity: 1,
    quote: {
      bid: 4099.9,
      ask: 4100.1,
      entryPrice: 4100,
      entrySource: "synthetic",
      fresh: true,
      freshnessReasonCode: "LIVE_FRESH",
      quoteAgeMs: 50,
      observedAtUtc: new Date().toISOString(),
    },
    contract: xauContract,
    account: {
      verified: true,
      accountIdMasked: "•••",
      accountCurrency: "USD",
      equity: 10_000,
      balance: 10_000,
      usableMargin: 8_000,
      usedMargin: 0,
      fetchedAtUtc: new Date().toISOString(),
      environment: "DEMO",
      unavailableReason: null,
    },
    sourceDecisionId: "d",
    sourceAnalysisId: "a",
    sourceEvidenceFingerprint: "fp",
    sourceDecidedAtUtc: new Date().toISOString(),
    policy: { ...defaultSimRiskPolicy(), riskBudgetMode: "PERCENTAGE", riskPercent: 0.5 },
    openPositionsCount: 0,
    pendingOrdersCount: 0,
    exposureDataAuthoritative: true,
    allocationPercentage: 18,
    marketEvidenceStrength: "SUFFICIENT",
    profitProtection: null,
    capitalAllocationPercent: 50,
    requestedPerOrderAllocation: 200,
    reservedStrategyBudgetActive: 0,
    ...overrides,
  };
}

describe("Phase 56.2.9 — 56.2.8 integration invariants (source)", () => {
  it("TF alias fix and readiness wiring remain present", () => {
    expect(resolveForexConnectLiveTimeframe("m1")).toBe("1m");
    const svc = read("ai/forex-ai/automated-trading/service.ts");
    expect(svc).toMatch(/resolveForexConnectLiveTimeframe/);
    expect(svc).toMatch(/simulationDataReadiness/);
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toMatch(/EXECUTION_FORBIDDEN/);
    const md = read("dev/server/forex-market-data-api.ts");
    expect(md).toMatch(/instrument-readiness/);
  });

  it("execution allowlist still XAU/USD-only (coverage ≠ authorization)", () => {
    // Provider form + canonical form — still a single instrument identity, not multi-market trading.
    expect([...AT_INSTRUMENT_ALLOWLIST]).toEqual(["XAU/USD", "XAUUSD"]);
    expect(AT_INSTRUMENT_ALLOWLIST.every((s) => /XAU/i.test(s))).toBe(true);
  });
});

describe("Phase 56.2.9 — multi-instrument readiness independence (SYNTHETIC)", () => {
  it("LIVE EUR/USD does not mask STALE XAU/USD", () => {
    const eur = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("EUR/USD"),
      providerSymbol: "EUR/USD",
      live: {
        bid: 1.1,
        ask: 1.1002,
        streamState: "LIVE",
        priceChangeAgeMs: 200,
        receiptAgeMs: 100,
        updateCount: 4,
      },
    });
    const xau = evaluateInstrumentReadiness({
      provider: "FOREXCONNECT",
      instrument: syntheticInstrument("XAU/USD", "COMMODITY"),
      providerSymbol: "XAU/USD",
      live: {
        bid: 4100,
        ask: 4100.5,
        streamState: "STALE",
        priceChangeAgeMs: 60_000,
        receiptAgeMs: 60_000,
        updateCount: 2,
      },
    });
    expect(eur.capabilities.liveFeedReady).toBe(true);
    expect(xau.capabilities.liveFeedReady).toBe(false);
    expect(xau.overall).toBe("STALE");
    expect(eur.capabilities.executionAuthorized).toBe(false);
    expect(xau.capabilities.executionAuthorized).toBe(false);

    const catalog = summarizeInstrumentReadinessCatalog({
      provider: "FOREXCONNECT",
      snapshots: [eur, xau],
    });
    expect(catalog.liveFeedReadyCount).toBe(1);
    expect(catalog.blockedOrUnreadyCount).toBe(1);
    expect(catalog.placesOrders).toBe(false);
  });

  it("FEED_NOT_LIVE / missing quote blocks simulation readiness gate", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      quoteFresh: false,
      quoteReasonCode: "FEED_NOT_LIVE",
      feedStatus: "SUBSCRIBED_WAITING",
    });
    expect(r.readyForSimulationDraft).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });
});

describe("Phase 56.2.9 — risk / allocation regression (SYNTHETIC)", () => {
  it("strategy budget = equity × pct/100; max order loss = allocation × 25/100", () => {
    const equity = 10_000;
    const pct = 40;
    const strategyBudget = equity * pct / 100;
    expect(strategyBudget).toBe(4_000);

    const allocation = 200;
    const sized = sizeOrderQuantityFromAllocation({
      verifiedEquity: equity,
      accountCurrency: "USD",
      strategyAllocationPercent: pct,
      remainingStrategyBudget: strategyBudget,
      individualOrderAllocation: allocation,
      entryPrice: 4100,
      stopLoss: 4080,
      contract: xauContract,
      freeMargin: 8_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 4.79,
      sdkMinQuantity: 1,
    });
    expect(sized.ok).toBe(true);
    if (!sized.ok) return;
    expect(sized.maxPermittedOrderLoss).toBe(allocation * 0.25);
    expect(sized.estimatedStopLossRisk).toBeLessThanOrEqual(sized.maxPermittedOrderLoss + 1e-8);
  });

  it("3R TP derived correctly for BUY and SELL", () => {
    const buy = proposeTakeProfit3RPrice({
      direction: "BUY",
      entryPrice: 4100,
      stopLoss: 4080,
      digits: 2,
    });
    expect(buy.ok).toBe(true);
    if (buy.ok) expect(buy.takeProfit).toBe(4160);

    const sell = proposeTakeProfit3RPrice({
      direction: "SELL",
      entryPrice: 4100,
      stopLoss: 4120,
      digits: 2,
    });
    expect(sell.ok).toBe(true);
    if (sell.ok) expect(sell.takeProfit).toBe(4040);
  });

  it("invalid allocation and stale quote keep draft non-executable", () => {
    expect(validateOrderAllocationAmount(0).ok).toBe(false);
    expect(validateOrderAllocationAmount(-1).ok).toBe(false);

    const stale = validateSimulationDraft(draftInput({
      quote: {
        bid: 4100,
        ask: 4100.2,
        entryPrice: 4100,
        entrySource: "synthetic",
        fresh: false,
        freshnessReasonCode: "FEED_NOT_LIVE",
        quoteAgeMs: 60_000,
        observedAtUtc: new Date().toISOString(),
      },
    }));
    expect(stale.placesOrders).toBe(false);
    expect(stale.acceptsForExecution).toBe(false);
    expect(stale.simulationOnly).toBe(true);
  });

  it("non-authoritative exposure is never treated as zero for readiness", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      exposureAuthoritative: false,
      exposureStatus: "QUERY_FAILED",
      confirmedZeroExposure: false,
    });
    const ex = r.gates.find((g) => g.id === "exposure");
    expect(ex?.authoritative).toBe(false);
    expect(ex?.reason).toMatch(/not zero/i);
    expect(r.readyForSimulationDraft).toBe(false);
  });

  it("missing conversion / quantity / min-stop / margin block dependent gates", () => {
    expect(
      evaluateSimulationDataReadiness({
        ...readyBase,
        accountCurrency: "EUR",
        conversionRequired: true,
        conversionReady: false,
      }).gates.find((g) => g.id === "currency_conversion")?.status,
    ).toBe("BLOCKED");

    expect(
      evaluateSimulationDataReadiness({
        ...readyBase,
        quantityConstraintsVerified: false,
        quantityUnitAmbiguous: true,
      }).gates.find((g) => g.id === "quantity_constraints")?.status,
    ).toBe("UNVERIFIED");

    expect(
      evaluateSimulationDataReadiness({
        ...readyBase,
        minStopDistanceVerified: false,
      }).gates.find((g) => g.id === "min_stop")?.status,
    ).toMatch(/UNVERIFIED|BLOCKED|UNAVAILABLE/);

    expect(
      evaluateSimulationDataReadiness({
        ...readyBase,
        equity: null,
        usableMargin: null,
      }).readyForSimulationDraft,
    ).toBe(false);
  });
});

describe("Phase 56.2.9 — execution safety (SYNTHETIC + source)", () => {
  it("readiness and draft validation never open execution locks", () => {
    const r = evaluateSimulationDataReadiness(readyBase);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.gates.find((g) => g.id === "execution_locks")?.status).toBe("READY");

    const unlocked = evaluateSimulationDataReadiness({
      ...readyBase,
      masterEnable: true,
      emergencyEntryLock: false,
    });
    expect(unlocked.gates.find((g) => g.id === "execution_locks")?.status).toBe("BLOCKED");
    expect(unlocked.placesOrders).toBe(false);

    const draft = validateSimulationDraft(draftInput());
    expect(draft.placesOrders).toBe(false);
    expect(draft.acceptsForExecution).toBe(false);
  });

  it("UI still shows Order Allocation and Data Readiness without implying execution", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toMatch(/Order Allocation \(USD\)/);
    expect(page).toMatch(/Data Readiness/);
    expect(page).toMatch(/placesOrders/);
    expect(page).toMatch(/monitorTf \|\| "1m"/);
  });
});
