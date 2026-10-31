import { describe, expect, it } from "vitest";
import { evaluateBrokerQuantityContract } from "../../../../ai/forex-ai/automated-trading/order-execution/broker-quantity-contract.js";
import { evaluateDemoActivationReadiness } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-readiness.js";
import { evaluateDemoOpenMarketRisk } from "../../../../ai/forex-ai/automated-trading/demo-execution/open-market-risk.js";
import { PROPOSED_BOUNDED_DEMO_ACTIVATION } from "../../../../ai/forex-ai/automated-trading/demo-execution/demo-activation-config.js";

/**
 * Fixture values labeled from docs/forex/PHASE_59_0_6 live DEMO probe
 * (baseUnitSize=1, minQuantity=1, mmrPerLot=4.79). Not invented for this test.
 */
const LIVE_DOCUMENTED_XAU = {
  baseUnitSize: 1,
  minQuantity: 1,
  mmrPerLot: 4.79,
  pointSize: 0.01,
  pipCostAccount: 0.01,
} as const;

describe("Phase 4.9 broker quantity + margin contract", () => {
  it("documents conversion: 1.0 lot → AMOUNT 1 when baseUnitSize=1", () => {
    const r = evaluateBrokerQuantityContract({
      requestedLots: 1,
      ...LIVE_DOCUMENTED_XAU,
      maxLotsPerOrder: 1,
    });
    expect(r.formula).toBe("amount = baseUnitSize * lots");
    expect(r.amountConversion.ok).toBe(true);
    expect(r.amountConversion.amount).toBe(1);
    expect(r.minLotsFromBroker).toBe(1);
    expect(r.mmrAuthoritative).toBe(true);
    expect(r.estimatedMarginAccount).toBeCloseTo(4.79, 6);
    expect(r.requestedLotsSupported).toBe(true);
  });

  it("rejects owner 0.01 lots when baseUnitSize=1 (non-integer AMOUNT) without upsizing", () => {
    const r = evaluateBrokerQuantityContract({
      requestedLots: 0.01,
      ...LIVE_DOCUMENTED_XAU,
      maxLotsPerOrder: 0.01,
    });
    expect(r.amountConversion.ok).toBe(false);
    expect(r.amountConversion.code).toBe("AMOUNT_NOT_INTEGER");
    expect(r.amountConversion.amount).toBeNull();
    expect(r.minLotsFromBroker).toBe(1);
    expect(r.ownerMaxBelowBrokerMin).toBe(true);
    expect(r.requestedLotsSupported).toBe(false);
    expect(r.blockers).toContain("AMOUNT_NOT_INTEGER");
    expect(r.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
  });

  it("rejects amounts below minQuantity", () => {
    const r = evaluateBrokerQuantityContract({
      requestedLots: 1,
      baseUnitSize: 1,
      minQuantity: 2,
      mmrPerLot: 4.79,
      maxLotsPerOrder: 1,
    });
    expect(r.amountConversion.code).toBe("AMOUNT_BELOW_MIN_QUANTITY");
    expect(r.requestedLotsSupported).toBe(false);
  });

  it("fail-closes when mmrPerLot missing (does not invent)", () => {
    const r = evaluateBrokerQuantityContract({
      requestedLots: 1,
      baseUnitSize: 1,
      minQuantity: 1,
      mmrPerLot: null,
      maxLotsPerOrder: 1,
    });
    expect(r.mmrAuthoritative).toBe(false);
    expect(r.estimatedMarginAccount).toBeNull();
    expect(r.blockers).toContain("MMR_PER_LOT_UNVERIFIED");
  });

  it("activation readiness blocks owner 0.01 when live-documented XAU min is 1 lot", () => {
    const ready = evaluateDemoActivationReadiness({
      forexConnectStatus: "CONNECTED",
      forexConnectEnvironment: "demo",
      activeEnvironment: "demo",
      trading: "DISABLED",
      liveProfileConfigured: false,
      sidecarReachable: true,
      allowDemoMutationEnabled: false,
      placesOrders: false,
      acceptsForExecution: false,
      emergencyEntryLock: true,
      masterEnable: false,
      dayRiskTelemetryReady: true,
      autoEntryLoopArmed: false,
      proposed: PROPOSED_BOUNDED_DEMO_ACTIVATION,
      brokerContract: {
        providerSymbol: "XAU/USD",
        ...LIVE_DOCUMENTED_XAU,
      },
    });
    expect(ready.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
    expect(ready.blockers).toContain("AMOUNT_CONVERSION");
    expect(ready.brokerQuantityContract?.requestedLotsSupported).toBe(false);
    expect(ready.readyForOwnerActivationApproval).toBe(false);
  });

  it("open-market risk includes OWNER_MAX_LOTS_BELOW_BROKER_MIN for 0.01 vs minLots=1", () => {
    const now = Date.now();
    const risk = evaluateDemoOpenMarketRisk({
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 0.01,
      stopLoss: 2600,
      takeProfit: 2700,
      entryPrice: 2650,
      requireProtective: true,
      grantMaxLots: 0.01,
      accountFetchOk: true,
      accountCount: 1,
      account: {
        accountId: "demo-masked",
        environment: "demo",
        accountCurrency: "USD",
        equity: 10_000,
        usableMargin: 9_000,
        balance: 10_000,
        fetchedAtUtc: new Date(now).toISOString(),
      },
      instrumentSpecs: {
        providerSymbol: "XAU/USD",
        baseUnitSize: LIVE_DOCUMENTED_XAU.baseUnitSize,
        minQuantity: LIVE_DOCUMENTED_XAU.minQuantity,
        pointSize: LIVE_DOCUMENTED_XAU.pointSize,
        pipCostAccount: LIVE_DOCUMENTED_XAU.pipCostAccount,
        mmrPerLot: LIVE_DOCUMENTED_XAU.mmrPerLot,
        condDistStopRaw: 5,
        condDistReportedUnit: "pips",
        condDistMethod: "getCondDistStopForTrade",
        condDistAvailable: true,
      },
      openExposureLots: 0,
      openPositionCount: 0,
      tradesFetchOk: true,
      hasUnresolvedUnprotectedFill: false,
      quoteTimestamp: now,
      nowMs: now,
    });
    expect(risk.ok).toBe(false);
    expect(risk.blockers).toContain("AMOUNT_NOT_INTEGER");
    expect(risk.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
  });
});
