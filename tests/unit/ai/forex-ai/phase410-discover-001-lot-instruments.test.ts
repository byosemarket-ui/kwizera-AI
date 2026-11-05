import { describe, expect, it } from "vitest";
import {
  classify001LotScore,
  discover001LotCompatibleInstruments,
  scoreInstrumentFor001Lots,
  OWNER_MAX_LOTS_001,
} from "../../../../ai/forex-ai/automated-trading/order-execution/discover-001-lot-instruments.js";
import { evaluateDemoOpenMarketRisk, DEMO_OPEN_RISK_DEFAULTS } from "../../../../ai/forex-ai/automated-trading/demo-execution/open-market-risk.js";

/**
 * MOCK FIXTURES ONLY — not live broker verification.
 * Labels: mock_fixture. Live discovery is scripts/phase410-vps-ro-instrument-discovery.mjs.
 */

describe("Phase 4.10 discover 0.01-lot instruments (mock fixtures)", () => {
  it("PASS path: integer-compatible AMOUNT + min + live MMR (mock)", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "EUR/USD",
      instrumentType: "1",
      tradingStatus: "O",
      baseUnitSize: 100,
      minQuantity: 1,
      lotStep: 1,
      mmrPerLot: 50,
      pointSize: 0.0001,
      pipCost: 0.1,
      evidenceSource: "mock_fixture",
    });
    expect(OWNER_MAX_LOTS_001).toBe(0.01);
    expect(s.contract.amountConversion.ok).toBe(true);
    expect(s.contract.amountConversion.amount).toBe(1);
    expect(s.compatible001Lot).toBe(true);
    expect(s.blockers).not.toContain("AMOUNT_NOT_INTEGER");
  });

  it("BLOCKED: fractional AMOUNT when baseUnitSize=1 (XAU-like mock)", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "XAU/USD",
      baseUnitSize: 1,
      minQuantity: 1,
      mmrPerLot: 4.79,
      evidenceSource: "mock_fixture",
    });
    expect(s.compatible001Lot).toBe(false);
    expect(s.blockers).toContain("AMOUNT_NOT_INTEGER");
    expect(s.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
  });

  it("BLOCKED: quantity below broker minimum", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/MIN",
      baseUnitSize: 100,
      minQuantity: 2,
      mmrPerLot: 10,
      evidenceSource: "mock_fixture",
    });
    // amount=1 < minQuantity=2
    expect(s.contract.amountConversion.code).toBe("AMOUNT_BELOW_MIN_QUANTITY");
    expect(s.compatible001Lot).toBe(false);
  });

  it("BLOCKED: amount not aligned to amount step", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/STEP",
      baseUnitSize: 100,
      minQuantity: 1,
      amountStep: 3,
      mmrPerLot: 10,
      evidenceSource: "mock_fixture",
    });
    // amount=1 is not a multiple of step 3
    expect(s.amountStepOk).toBe(false);
    expect(s.blockers).toContain("AMOUNT_NOT_ALIGNED_TO_STEP");
    expect(s.compatible001Lot).toBe(false);
  });

  it("BLOCKED: missing baseUnitSize", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/NOBUS",
      baseUnitSize: null,
      minQuantity: 1,
      mmrPerLot: 10,
      evidenceSource: "mock_fixture",
    });
    expect(s.blockers).toContain("BASE_UNIT_SIZE_UNKNOWN");
    expect(s.compatible001Lot).toBe(false);
  });

  it("BLOCKED: missing minimum quantity", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/NOMIN",
      baseUnitSize: 100,
      minQuantity: null,
      mmrPerLot: 10,
      evidenceSource: "mock_fixture",
    });
    expect(s.blockers).toContain("MIN_QUANTITY_UNVERIFIED");
    expect(s.compatible001Lot).toBe(false);
  });

  it("BLOCKED: missing MMR", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/NOMMR",
      baseUnitSize: 100,
      minQuantity: 1,
      mmrPerLot: null,
      evidenceSource: "mock_fixture",
    });
    expect(s.blockers).toContain("MMR_PER_LOT_UNVERIFIED");
    expect(s.compatible001Lot).toBe(false);
  });

  it("BLOCKED: documentation evidence never counts as PASS", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "DOC/EURUSD",
      baseUnitSize: 100,
      minQuantity: 1,
      mmrPerLot: 50,
      evidenceSource: "documentation",
    });
    expect(s.blockers).toContain("EVIDENCE_NOT_LIVE");
    expect(s.compatible001Lot).toBe(false);
  });

  it("catalog scan returns none when only XAU-like rows (mock)", () => {
    const r = discover001LotCompatibleInstruments([
      {
        providerSymbol: "XAU/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: 4.79,
        evidenceSource: "mock_fixture",
      },
      {
        providerSymbol: "XAG/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: null,
        evidenceSource: "mock_fixture",
      },
    ]);
    expect(r.compatible).toHaveLength(0);
    expect(r.summary).toMatch(/NONE_COMPATIBLE/);
  });

  it("catalog finds compatible row without reusing XAU specs for EUR (mock only — live EUR minQuantity=1000)", () => {
    // MOCK: live DEMO EUR/USD has minQuantity=baseUnitSize=1000 (min lots=1), so 0.01 fails.
    // This fixture intentionally uses minQuantity=1 to unit-test per-row scoring isolation.
    const r = discover001LotCompatibleInstruments([
      {
        providerSymbol: "XAU/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: 4.79,
        evidenceSource: "mock_fixture",
      },
      {
        providerSymbol: "EUR/USD",
        baseUnitSize: 1000,
        minQuantity: 1,
        mmrPerLot: 20,
        evidenceSource: "mock_fixture",
      },
    ]);
    expect(r.compatible).toHaveLength(1);
    expect(r.compatible[0]?.providerSymbol).toBe("EUR/USD");
    expect(r.compatible[0]?.contract.amountConversion.amount).toBe(10);
    expect(r.compatible[0]?.liveFields.baseUnitSize).toBe(1000);
    expect(r.compatible[0]?.liveFields.mmrPerLot).toBe(20);
  });

  it("live-shaped EUR/USD (bus=1000,minQuantity=1000) rejects 0.01 lots (mock of live shape)", () => {
    const s = scoreInstrumentFor001Lots({
      providerSymbol: "EUR/USD",
      baseUnitSize: 1000,
      minQuantity: 1000,
      mmrPerLot: 1.3,
      evidenceSource: "mock_fixture",
    });
    expect(s.contract.amountConversion.code).toBe("AMOUNT_BELOW_MIN_QUANTITY");
    expect(s.compatible001Lot).toBe(false);
  });

  it("risk preflight uses instrument-specific specs — EUR-like size cannot inherit XAU bus=1 (mock)", () => {
    const now = Date.now();
    // Intentionally wrong: claim EUR/USD but supply XAU bus=1 → 0.01 fails AMOUNT
    const wrong = evaluateDemoOpenMarketRisk({
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 0.01,
      stopLoss: 1.08,
      takeProfit: 1.12,
      entryPrice: 1.1,
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
        providerSymbol: "EUR/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        pointSize: 0.0001,
        pipCostAccount: 0.1,
        mmrPerLot: 50,
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
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, maxSlLossAccount: 50 },
    });
    expect(wrong.ok).toBe(false);
    expect(wrong.blockers).toContain("AMOUNT_NOT_INTEGER");
  });

  it("classifies catalog rows into transparent 0.01-lot buckets (mock)", () => {
    expect(classify001LotScore(scoreInstrumentFor001Lots({
      providerSymbol: "EUR/USD",
      baseUnitSize: 100,
      minQuantity: 1,
      mmrPerLot: 50,
      evidenceSource: "mock_fixture",
    }, OWNER_MAX_LOTS_001), "1")).toBe("VERIFIED_COMPATIBLE_AT_0_01");

    expect(classify001LotScore(scoreInstrumentFor001Lots({
      providerSymbol: "XAU/USD",
      baseUnitSize: 1,
      minQuantity: 1,
      mmrPerLot: 4.79,
      evidenceSource: "mock_fixture",
    }, OWNER_MAX_LOTS_001), "4001")).toBe("VERIFIED_INCOMPATIBLE_QUANTITY");

    expect(classify001LotScore(scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/NOMMR",
      baseUnitSize: 100,
      minQuantity: 1,
      mmrPerLot: null,
      evidenceSource: "mock_fixture",
    }, OWNER_MAX_LOTS_001), "9")).toBe("MMR_MISSING");

    expect(classify001LotScore(scoreInstrumentFor001Lots({
      providerSymbol: "MOCK/NOSPEC",
      baseUnitSize: null,
      minQuantity: null,
      mmrPerLot: 10,
      evidenceSource: "mock_fixture",
    }, OWNER_MAX_LOTS_001), "9")).toBe("QUANTITY_METADATA_MISSING");

    const r = discover001LotCompatibleInstruments([
      {
        providerSymbol: "EUR/USD",
        baseUnitSize: 100,
        minQuantity: 1,
        mmrPerLot: 50,
        evidenceSource: "mock_fixture",
      },
      {
        providerSymbol: "XAU/USD",
        baseUnitSize: 1,
        minQuantity: 1,
        mmrPerLot: 4.79,
        evidenceSource: "mock_fixture",
      },
      {
        providerSymbol: "MOCK/NOMMR",
        baseUnitSize: 100,
        minQuantity: 1,
        mmrPerLot: null,
        evidenceSource: "mock_fixture",
      },
    ]);
    expect(r.classificationCounts.VERIFIED_COMPATIBLE_AT_0_01).toBe(1);
    expect(r.classificationCounts.VERIFIED_INCOMPATIBLE_QUANTITY).toBe(1);
    expect(r.classificationCounts.MMR_MISSING).toBe(1);
  });

  it("compatible quantity still fails when usable margin insufficient (mock)", () => {
    const now = Date.now();
    const risk = evaluateDemoOpenMarketRisk({
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 0.01,
      stopLoss: 1.08,
      takeProfit: 1.12,
      entryPrice: 1.1,
      requireProtective: true,
      grantMaxLots: 0.01,
      accountFetchOk: true,
      accountCount: 1,
      account: {
        accountId: "demo-masked",
        environment: "demo",
        accountCurrency: "USD",
        equity: 10_000,
        usableMargin: 0.05,
        balance: 10_000,
        fetchedAtUtc: new Date(now).toISOString(),
      },
      instrumentSpecs: {
        providerSymbol: "EUR/USD",
        baseUnitSize: 100,
        minQuantity: 1,
        pointSize: 0.0001,
        pipCostAccount: 0.1,
        mmrPerLot: 100,
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
      limits: { ...DEMO_OPEN_RISK_DEFAULTS, minUsableMargin: 50, maxSlLossAccount: 50 },
    });
    expect(risk.ok).toBe(false);
    // estimated margin = 100 * 0.01 = 1; usable 0.05 fails floor and/or reserve
    expect(
      risk.blockers.some((b) =>
        b === "USABLE_MARGIN_BELOW_MINIMUM"
        || b === "INSUFFICIENT_USABLE_MARGIN"
        || b === "MARGIN_RESERVE_INSUFFICIENT"
      ),
    ).toBe(true);
  });
});
