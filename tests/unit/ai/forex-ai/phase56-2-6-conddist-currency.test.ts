/**
 * Phase 56.2.6 — CondDist pips semantics, min-stop attestation, currency conversion.
 * Synthetic fixtures — not live broker evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  condDistPipsToPriceDistance,
  resolveCondDistMinStop,
  resolveCondDistUnit,
  convertCurrencyAmount,
  isConversionSnapshotFresh,
  ensureAmountInAccountCurrency,
  resolveXauQuantitySemantics,
  sizeOrderQuantityFromAllocation,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  type AtSimContractMetaInput,
  type AtSimDraftInput,
  type ConversionRateSnapshot,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

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
  minStopDistance: 0.05,
  minStopDistanceVerified: true,
  minStopNoPositiveMinimum: false,
  condDistStopPips: 5,
  condDistUnit: "pips",
  source: "synthetic",
  unavailableReason: null,
};

describe("Phase 56.2.6 CondDist unit gates", () => {
  it("documents CondDist as pips only when provenance says so", () => {
    expect(resolveCondDistUnit({ reportedUnit: "pips" })).toBe("pips");
    expect(resolveCondDistUnit({ fromDocumentedSdkMethod: true })).toBe("pips");
    expect(resolveCondDistUnit({ reportedUnit: "pips_or_points_unverified" })).toBe("unknown");
    expect(resolveCondDistUnit({})).toBe("unknown");
  });

  it("converts pips × PointSize to price and refuses missing PointSize", () => {
    const ok = condDistPipsToPriceDistance(5, 0.01);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.priceDistance).toBeCloseTo(0.05, 10);
    const bad = condDistPipsToPriceDistance(5, null);
    expect(bad.ok).toBe(false);
  });

  it("attests no-positive-minimum when CondDist=0 pips", () => {
    const a = resolveCondDistMinStop({
      condDistAvailable: true,
      condDistStop: 0,
      reportedUnit: "pips",
      fromDocumentedSdkMethod: true,
      pointSize: 0.01,
    });
    expect(a.minStopDistanceVerified).toBe(true);
    expect(a.noPositiveMinimumAttested).toBe(true);
    expect(a.minStopDistancePrice).toBeNull();
    expect(a.publicEnhancedExecutionClaim).toBe("CONSISTENT_WITH_ZERO_CONDDIST");
  });

  it("does not apply public Enhanced Execution claim without CondDist", () => {
    const a = resolveCondDistMinStop({
      condDistAvailable: false,
      pointSize: 0.01,
    });
    expect(a.minStopDistanceVerified).toBe(false);
    expect(a.publicEnhancedExecutionClaim).toBe("NOT_APPLIED_AS_ACCOUNT_PROOF");
  });

  it("blocks when CondDist present but unit unknown", () => {
    const a = resolveCondDistMinStop({
      condDistAvailable: true,
      condDistStop: 5,
      reportedUnit: "unknown",
      pointSize: 0.01,
    });
    expect(a.minStopDistanceVerified).toBe(false);
    expect(a.minStopDistancePrice).toBeNull();
  });

  it("semantics resolve price min-stop, not raw pips", () => {
    const r = resolveXauQuantitySemantics({
      symbol: "XAU/USD",
      pointSize: 0.01,
      pipCostAccount: 0.01,
      baseUnitSize: 1,
      contractMultiplier: 1,
      condDistAvailable: true,
      condDistStop: 5,
      condDistStopUnit: "pips",
    });
    expect(r.minStopDistanceValue).toBeCloseTo(0.05, 10);
    expect(r.condDistStopPips).toBe(5);
  });
});

describe("Phase 56.2.6 currency conversion", () => {
  const now = Date.parse("2026-10-21T10:00:00.000Z");
  const freshEurUsd: ConversionRateSnapshot = {
    fromCurrency: "EUR",
    toCurrency: "USD",
    rate: 1.1,
    direction: "MULTIPLY",
    source: "TEST_OFFERS_MID",
    observedAtUtc: "2026-10-21T09:59:30.000Z",
    maxAgeMs: 120_000,
  };

  it("identity conversion for matching currencies", () => {
    const r = convertCurrencyAmount({
      amount: 100,
      fromCurrency: "USD",
      toCurrency: "usd",
      nowMs: now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.identity).toBe(true);
    expect(r.amount).toBe(100);
  });

  it("multiplies with verified direction and rejects inverse invention", () => {
    const r = convertCurrencyAmount({
      amount: 100,
      fromCurrency: "EUR",
      toCurrency: "USD",
      rateSnapshot: freshEurUsd,
      nowMs: now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.amount).toBeCloseTo(110, 10);

    const mismatched = convertCurrencyAmount({
      amount: 100,
      fromCurrency: "USD",
      toCurrency: "EUR",
      rateSnapshot: freshEurUsd,
      nowMs: now,
    });
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok) expect(mismatched.code).toBe("FX_RATE_PAIR_MISMATCH");
  });

  it("supports DIVIDE only when snapshot direction is DIVIDE", () => {
    const snap: ConversionRateSnapshot = {
      ...freshEurUsd,
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: 1.1,
      direction: "DIVIDE",
    };
    const r = convertCurrencyAmount({
      amount: 110,
      fromCurrency: "USD",
      toCurrency: "EUR",
      rateSnapshot: snap,
      nowMs: now,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toBeCloseTo(100, 10);
  });

  it("blocks stale and missing rates", () => {
    const staleCheck = isConversionSnapshotFresh(freshEurUsd, Date.parse("2026-10-21T10:05:00.000Z"));
    expect(staleCheck.fresh).toBe(false);
    if (!staleCheck.fresh) expect(staleCheck.code).toBe("FX_RATE_STALE");

    const missing = ensureAmountInAccountCurrency({
      amount: 100,
      amountCurrency: "EUR",
      accountCurrency: "USD",
      rateSnapshot: null,
      nowMs: now,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("FX_RATE_UNAVAILABLE");
  });

  it("rejects non-finite amounts and invalid rate", () => {
    expect(convertCurrencyAmount({
      amount: Number.NaN,
      fromCurrency: "USD",
      toCurrency: "USD",
    }).ok).toBe(false);
    expect(isConversionSnapshotFresh({ ...freshEurUsd, rate: -1 }).fresh).toBe(false);
  });

  it("sizing uses identity for USD and blocks EUR without rate", () => {
    const base = {
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 200,
      allocationCurrency: "USD",
      entryPrice: 4100,
      stopLoss: 4080,
      contract: xauContract,
      freeMargin: 8_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 4.79,
      sdkMinQuantity: 1,
      nowMs: now,
    };
    const usd = sizeOrderQuantityFromAllocation(base);
    expect(usd.ok).toBe(true);

    const eur = sizeOrderQuantityFromAllocation({
      ...base,
      accountCurrency: "EUR",
      conversionRateSnapshot: null,
    });
    expect(eur.ok).toBe(false);
    if (!eur.ok) expect(eur.code).toBe("FX_RATE_UNAVAILABLE");
  });
});

describe("Phase 56.2.6 engine min-stop + safety", () => {
  function draft(over: Partial<AtSimDraftInput> = {}): AtSimDraftInput {
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
        entrySource: "test",
        fresh: true,
        freshnessReasonCode: "FRESH",
        quoteAgeMs: 50,
        observedAtUtc: new Date().toISOString(),
      },
      contract: xauContract,
      account: {
        verified: true,
        accountIdMasked: "12••••34",
        accountCurrency: "USD",
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        usedMargin: 0,
        fetchedAtUtc: new Date().toISOString(),
        environment: "DEMO",
        unavailableReason: null,
      },
      sourceDecisionId: "d1",
      sourceAnalysisId: "a1",
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
      ...over,
    };
  }

  it("passes min-stop when distance ≥ CondDist price and when CondDist=0 attested", () => {
    const ok = validateSimulationDraft(draft());
    expect(ok.checks.some((c) => c.code === "MIN_STOP_DISTANCE" && c.status === "PASS")).toBe(true);
    expect(ok.acceptsForExecution).toBe(false);
    expect(ok.placesOrders).toBe(false);

    const none = validateSimulationDraft(draft({
      contract: {
        ...xauContract,
        minStopDistance: null,
        minStopDistanceVerified: true,
        minStopNoPositiveMinimum: true,
        condDistStopPips: 0,
      },
    }));
    expect(none.checks.some((c) =>
      c.code === "MIN_STOP_DISTANCE" && c.status === "PASS" && /CondDistStop=0/i.test(c.message)
    )).toBe(true);
  });

  it("fails when stop closer than verified CondDist price distance", () => {
    const r = validateSimulationDraft(draft({
      stopLoss: 4099.96, // dist 0.04 < 0.05 price min
      takeProfit: 4100.12, // still above entry for BUY geometry
    }));
    expect(r.checks.some((c) => c.code === "MIN_STOP_DISTANCE" && c.status === "FAIL")).toBe(true);
  });

  it("blocks stale quotes and keeps execution closed", () => {
    const r = validateSimulationDraft(draft({
      quote: {
        bid: 4099.9,
        ask: 4100.1,
        entryPrice: 4100,
        entrySource: "test",
        fresh: false,
        freshnessReasonCode: "FEED_NOT_LIVE",
        quoteAgeMs: 999_999,
        observedAtUtc: new Date().toISOString(),
      },
    }));
    expect(r.checks.some((c) => c.code === "QUOTE_STALE")).toBe(true);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.placesOrders).toBe(false);
  });

  it("UI and sidecar preserve CondDist≠lotStep and Order Allocation-only", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toMatch(/Order Allocation \(USD\)/);
    expect(page).toMatch(/Min-Stop \/ CondDist/);
    expect(page).toMatch(/Currency Conversion/);
    expect(page).toMatch(/Quote Freshness|Quote \/ Exposure/);
    const py = read("services/forexconnect-sidecar/server.py");
    expect(py).toMatch(/getCondDistStopForTrade|get_cond_dist_stop_for_trade/);
    expect(py).toMatch(/Never map CondDistEntry\/stop distances/);
    expect(py).toMatch(/condDistUnit.*=.*"pips"/);
  });
});
