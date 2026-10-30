import { describe, expect, it } from "vitest";
import {
  DEMO_OPEN_RISK_DEFAULTS,
  estimateStopLossLossAccount,
  evaluateDemoOpenMarketRisk,
  loadDemoOpenMarketRiskLimits,
  loadDemoOpenMarketRiskLimitsDetailed,
  sumOpenExposureLotsFromTradesPayload,
  type DemoOpenMarketRiskInput,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/open-market-risk.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function verifiedSpecs(over: Record<string, unknown> = {}) {
  return {
    providerSymbol: "XAU/USD",
    baseUnitSize: 1,
    pointSize: 0.01,
    pipCostAccount: 0.01,
    mmrPerLot: 100,
    condDistStopRaw: 0,
    condDistReportedUnit: "pips",
    condDistMethod: "getCondDistStopForTrade",
    condDistAvailable: true,
    ...over,
  };
}

function baseInput(over: Partial<DemoOpenMarketRiskInput> = {}): DemoOpenMarketRiskInput {
  const nowMs = Date.now();
  return {
    instrument: "XAU/USD",
    direction: "BUY",
    lots: 1,
    stopLoss: 4000,
    takeProfit: 4100,
    entryPrice: 4020,
    requireProtective: true,
    grantMaxLots: 1,
    requestedAccountId: null,
    account: {
      accountId: "demo-1",
      accountIdMasked: "***o-1",
      environment: "demo",
      accountCurrency: "USD",
      equity: 10_000,
      usableMargin: 8_000,
      balance: 10_000,
      missingFields: [],
      fetchedAtUtc: new Date(nowMs).toISOString(),
      equityIncludesFloatingPl: true,
    },
    accountFetchOk: true,
    accountCount: 1,
    instrumentSpecs: verifiedSpecs(),
    openExposureLots: 0,
    openPositionCount: 0,
    tradesFetchOk: true,
    hasUnresolvedUnprotectedFill: false,
    quoteTimestamp: nowMs,
    quoteMaxAgeMs: 15_000,
    limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50 },
    nowMs,
    ...over,
  };
}

describe("Phase 59.0.15 DEMO open-market risk", () => {
  it("passes when equity, margin, specs, exposure, and geometry are verified", () => {
    const r = evaluateDemoOpenMarketRisk(baseInput());
    expect(r.ok).toBe(true);
    expect(r.maySubmitDemoMutation).toBe(true);
    expect(r.placesOrdersGlobal).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.details.estimatedSlLossAccount).toBeCloseTo(20, 5); // |4020-4000|/0.01 * 0.01 * 1
    expect(r.details.estimatedMarginAccount).toBe(100);
    expect(r.details.exposureScope).toBe("instrument");
    expect(r.details.condDistUnit).toBe("pips");
  });

  it("fails closed on missing or stale equity / usable margin", () => {
    const missing = evaluateDemoOpenMarketRisk(baseInput({
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: null,
        usableMargin: null,
        balance: 1,
        missingFields: ["equity", "usableMargin"],
        fetchedAtUtc: new Date().toISOString(),
      },
    }));
    expect(missing.ok).toBe(false);
    expect(missing.blockers).toEqual(expect.arrayContaining([
      "EQUITY_MISSING",
      "USABLE_MARGIN_MISSING",
    ]));

    const stale = evaluateDemoOpenMarketRisk(baseInput({
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: 10_000,
        usableMargin: 8_000,
        balance: 10_000,
        missingFields: [],
        fetchedAtUtc: new Date(Date.now() - 60_000).toISOString(),
      },
      nowMs: Date.now(),
    }));
    expect(stale.blockers).toContain("ACCOUNT_STATE_STALE");

    const noFetchAt = evaluateDemoOpenMarketRisk(baseInput({
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: 10_000,
        usableMargin: 8_000,
        balance: 10_000,
        missingFields: [],
        fetchedAtUtc: null,
      },
    }));
    expect(noFetchAt.blockers).toContain("ACCOUNT_FETCHED_AT_MISSING");
  });

  it("rejects insufficient free margin and reserve violations", () => {
    const r = evaluateDemoOpenMarketRisk(baseInput({
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: 10_000,
        usableMargin: 80,
        balance: 10_000,
        missingFields: [],
        fetchedAtUtc: new Date().toISOString(),
      },
      instrumentSpecs: verifiedSpecs({ mmrPerLot: 100 }),
    }));
    expect(r.ok).toBe(false);
    expect(r.blockers).toEqual(expect.arrayContaining([
      "INSUFFICIENT_USABLE_MARGIN",
    ]));
  });

  it("rejects max-loss and exposure limit violations", () => {
    const loss = evaluateDemoOpenMarketRisk(baseInput({
      stopLoss: 3900, // 120 points * 0.01 pipCost * 1 lot = 120
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50, maxSlLossFractionOfEquity: 0.5 },
    }));
    expect(loss.blockers).toContain("MAX_SL_LOSS_ACCOUNT_EXCEEDED");

    const frac = evaluateDemoOpenMarketRisk(baseInput({
      account: {
        accountId: "demo-1",
        environment: "demo",
        accountCurrency: "USD",
        equity: 1_000,
        usableMargin: 900,
        balance: 1_000,
        missingFields: [],
        fetchedAtUtc: new Date().toISOString(),
      },
      stopLoss: 3900, // loss 120 > 2% of 1000
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: null, maxSlLossFractionOfEquity: 0.02 },
    }));
    expect(frac.blockers).toContain("MAX_SL_LOSS_FRACTION_EXCEEDED");

    const exposure = evaluateDemoOpenMarketRisk(baseInput({
      openExposureLots: 2,
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxTotalExposureLots: 2, maxSlLossAccount: 50 },
    }));
    expect(exposure.blockers).toContain("MAX_EXPOSURE_LOTS_EXCEEDED");
  });

  it("fails closed when contract specs or conversion inputs are missing", () => {
    const r = evaluateDemoOpenMarketRisk(baseInput({
      instrumentSpecs: {
        providerSymbol: "XAU/USD",
        baseUnitSize: null,
        pointSize: null,
        pipCostAccount: null,
        mmrPerLot: null,
        condDistStopRaw: null,
        condDistReportedUnit: null,
        condDistMethod: null,
        condDistAvailable: false,
      },
    }));
    expect(r.ok).toBe(false);
    expect(r.blockers).toEqual(expect.arrayContaining([
      "BASE_UNIT_SIZE_UNKNOWN",
      "POINT_SIZE_UNVERIFIED",
      "PIP_COST_UNVERIFIED",
      "MMR_PER_LOT_UNVERIFIED",
      "CONDDIST_STOP_UNAVAILABLE",
    ]));
  });

  it("rejects unknown CondDist units and below-minimum stop distance", () => {
    const unknown = evaluateDemoOpenMarketRisk(baseInput({
      instrumentSpecs: verifiedSpecs({
        condDistStopRaw: 5,
        condDistReportedUnit: "points_or_pips_unverified",
        condDistMethod: "mysteryGetter",
        condDistAvailable: true,
      }),
    }));
    expect(unknown.ok).toBe(false);
    expect(unknown.blockers).toContain("CONDDIST_UNIT_UNVERIFIED");
    expect(unknown.details.condDistUnit).toBe("unknown");

    // 5 pips × 0.01 pointSize = 0.05; stop distance 0.02 → below CondDist
    const tooClose = evaluateDemoOpenMarketRisk(baseInput({
      entryPrice: 4020,
      stopLoss: 4019.98,
      takeProfit: 4100,
      instrumentSpecs: verifiedSpecs({ condDistStopRaw: 5 }),
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50 },
    }));
    expect(tooClose.blockers).toContain("STOP_DISTANCE_BELOW_COND_DIST");
  });

  it("fails closed on missing, future, or stale quote timestamps at evaluation time", () => {
    const missing = evaluateDemoOpenMarketRisk(baseInput({ quoteTimestamp: null }));
    expect(missing.blockers).toContain("QUOTE_TIMESTAMP_MISSING");

    const stale = evaluateDemoOpenMarketRisk(baseInput({
      quoteTimestamp: Date.now() - 60_000,
      quoteMaxAgeMs: 15_000,
      nowMs: Date.now(),
    }));
    expect(stale.blockers).toContain("QUOTE_STALE");

    const future = evaluateDemoOpenMarketRisk(baseInput({
      quoteTimestamp: Date.now() + 60_000,
      nowMs: Date.now(),
    }));
    expect(future.blockers).toContain("QUOTE_TIMESTAMP_FUTURE");
  });

  it("rejects invalid BUY/SELL stop-loss and take-profit geometry", () => {
    const buy = evaluateDemoOpenMarketRisk(baseInput({
      direction: "BUY",
      entryPrice: 4020,
      stopLoss: 4030,
      takeProfit: 4010,
    }));
    expect(buy.blockers).toEqual(expect.arrayContaining([
      "STOP_LOSS_GEOMETRY_INVALID",
      "TAKE_PROFIT_GEOMETRY_INVALID",
    ]));

    const sell = evaluateDemoOpenMarketRisk(baseInput({
      direction: "SELL",
      entryPrice: 4020,
      stopLoss: 4010,
      takeProfit: 4030,
    }));
    expect(sell.blockers).toEqual(expect.arrayContaining([
      "STOP_LOSS_GEOMETRY_INVALID",
      "TAKE_PROFIT_GEOMETRY_INVALID",
    ]));
  });

  it("blocks entries on unresolved unprotected fills and missing protective requirement", () => {
    const unprotected = evaluateDemoOpenMarketRisk(baseInput({
      hasUnresolvedUnprotectedFill: true,
    }));
    expect(unprotected.blockers).toContain("UNPROTECTED_FILL_BLOCKS_ENTRIES");

    const noProtective = evaluateDemoOpenMarketRisk(baseInput({
      requireProtective: false,
    }));
    expect(noProtective.blockers).toContain("PROTECTIVE_REQUIRED_FOR_DEMO_RISK");
  });

  it("fails closed when account or trades RO state cannot be verified", () => {
    const noAcct = evaluateDemoOpenMarketRisk(baseInput({
      accountFetchOk: false,
      account: null,
    }));
    expect(noAcct.blockers).toContain("ACCOUNT_STATE_UNAVAILABLE");

    const noTrades = evaluateDemoOpenMarketRisk(baseInput({
      tradesFetchOk: false,
      openExposureLots: null,
    }));
    expect(noTrades.blockers).toContain("OPEN_EXPOSURE_UNAVAILABLE");

    const multi = evaluateDemoOpenMarketRisk(baseInput({
      accountCount: 2,
      requestedAccountId: null,
    }));
    expect(multi.blockers).toContain("ACCOUNT_ID_REQUIRED_MULTIPLE");
  });

  it("estimates SL loss and sums exposure lots without inventing specs", () => {
    expect(estimateStopLossLossAccount({
      entryPrice: 4020,
      stopLoss: 4000,
      lots: 1,
      pointSize: 0.01,
      pipCostAccount: 0.01,
    })).toBeCloseTo(20, 8);

    expect(estimateStopLossLossAccount({
      entryPrice: 4020,
      stopLoss: 4000,
      lots: 1,
      pointSize: 0.01,
      pipCostAccount: null as unknown as number,
    })).toBeNull();

    expect(sumOpenExposureLotsFromTradesPayload(
      { ok: true, trades: [{ instrument: "XAU/USD", amount: 2 }] },
      { instrument: "XAU/USD", baseUnitSize: 1, scope: "instrument" },
    )).toBe(2);

    expect(sumOpenExposureLotsFromTradesPayload(
      { ok: true, trades: [{ instrument: "XAU/USD", amount: 2 }] },
      { instrument: "XAU/USD", baseUnitSize: null, scope: "instrument" },
    )).toBeNull();

    // Non-divisible amount → reject unknown trade shape
    expect(sumOpenExposureLotsFromTradesPayload(
      { ok: true, trades: [{ instrument: "XAU/USD", amount: 1.5 }] },
      { instrument: "XAU/USD", baseUnitSize: 1, scope: "instrument" },
    )).toBeNull();
  });

  it("loads env limits without unsafe zero defaults for fractions", () => {
    const limits = loadDemoOpenMarketRiskLimits({
      KWIZERA_DEMO_OPEN_MAX_LOTS: "3",
      KWIZERA_DEMO_OPEN_MAX_EXPOSURE_LOTS: "4",
      KWIZERA_DEMO_OPEN_MIN_USABLE_MARGIN: "25",
      KWIZERA_DEMO_OPEN_MARGIN_RESERVE_FRACTION: "0.2",
      KWIZERA_DEMO_OPEN_MAX_SL_LOSS: "75",
      KWIZERA_DEMO_OPEN_MAX_SL_LOSS_FRACTION: "0.05",
      KWIZERA_DEMO_OPEN_ACCOUNT_MAX_AGE_MS: "20000",
    } as NodeJS.ProcessEnv);
    expect(limits.maxLotsPerOrder).toBe(3);
    expect(limits.maxTotalExposureLots).toBe(4);
    expect(limits.minUsableMargin).toBe(25);
    expect(limits.marginReserveFractionOfEquity).toBe(0.2);
    expect(limits.maxSlLossAccount).toBe(75);
    expect(limits.maxSlLossFractionOfEquity).toBe(0.05);
    expect(limits.accountMaxAgeMs).toBe(20_000);
  });

  it("fails closed when risk-limit env values are malformed, negative, NaN, or infinite", () => {
    const detailed = loadDemoOpenMarketRiskLimitsDetailed({
      KWIZERA_DEMO_OPEN_MAX_LOTS: "NaN",
      KWIZERA_DEMO_OPEN_MIN_USABLE_MARGIN: "-1",
      KWIZERA_DEMO_OPEN_MARGIN_RESERVE_FRACTION: "Infinity",
      KWIZERA_DEMO_OPEN_MAX_SL_LOSS_FRACTION: "2",
    } as NodeJS.ProcessEnv);
    expect(detailed.configInvalid).toBe(true);
    expect(detailed.invalidKeys.length).toBeGreaterThan(0);

    const r = evaluateDemoOpenMarketRisk(baseInput({
      limits: detailed.limits,
      limitsConfigInvalid: detailed.configInvalid,
      limitsInvalidKeys: detailed.invalidKeys,
    }));
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("RISK_LIMITS_ENV_INVALID");
  });

  it("orchestrator wires open-market risk before broker mutation with quote + CondDist fields", () => {
    const orch = readFileSync(
      join(process.cwd(), "ai/forex-ai/automated-trading/demo-execution/orchestrator.ts"),
      "utf8",
    );
    expect(orch).toContain("evaluateDemoOpenMarketRisk");
    expect(orch).toContain("DEMO open-market risk blocked");
    expect(orch).toContain("loadDemoOpenMarketRiskLimitsDetailed");
    expect(orch).toContain("quoteTimestamp");
    expect(orch).toContain("condDistStopRaw");
    expect(orch).toContain("limitsConfigInvalid");
    expect(orch).toMatch(/listAccounts\(\)/);
    expect(orch).toMatch(/listTrades\(\)/);
    const riskIdx = orch.indexOf("evaluateDemoOpenMarketRisk");
    const submitIdx = orch.indexOf("openTrueMarket");
    expect(riskIdx).toBeGreaterThan(0);
    expect(submitIdx).toBeGreaterThan(riskIdx);
  });
});
