/**
 * Stage 1 — Net 3R / Dynamic Spread / order-proposal consistency regression.
 * TEST FIXTURES ONLY — never submits broker orders.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateDynamicSpread,
  DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION,
  DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/index.js";
import {
  fixtureEurUsdContract,
  fixtureRollingSpreads,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/test-fixtures.js";
import { buildOrderProposal } from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import {
  accountCostToPriceDistance,
  proposeTakeProfitNetAware3R,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/net-3r-take-profit.js";
import { proposeTakeProfit3RPrice } from "../../../../ai/forex-ai/automated-trading/simulation-risk/propose-levels.js";
import { sizeOrderQuantityFromAllocation } from "../../../../ai/forex-ai/automated-trading/simulation-risk/size-order-quantity.js";
import {
  amountConstraintsToLots,
  lotsToFxcmAmount,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/fxcm-amount-lots.js";
import {
  runPreExecutionValidation,
  type AtPreExecutionValidationInput,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.js";
import { evaluateProtectiveGeometry } from "../../../../ai/forex-ai/automated-trading/broker-intent/protective-geometry.js";

const NOW = Date.parse("2026-11-10T14:00:00.000Z");
/** Exact 5-decimal tick prices — avoid binary float off-tick INVALID_PRICE_PRECISION. */
const ENTRY = 110_000 / 100_000; // 1.10000
const STOP = 109_900 / 100_000; // 1.09900 — 10 pips / 0.001
/** LIVE-shaped EUR/USD — AMOUNT min/step = baseUnitSize (1000), not invented 1. */
const CONTRACT = {
  ...fixtureEurUsdContract(),
  quantityMin: 1000,
  quantityStep: 1000,
  baseUnitSize: 1000,
};

function handoff(): AtOrderPreparationHandoff {
  return {
    acceptedResultId: "res-net3r-1",
    analysisId: "an-net3r-1",
    instrument: "EUR/USD",
    canonicalDirection: "BUY",
    directionalConfidencePct: 60,
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    observationId: "obs-net3r-1",
    imageId: "img-net3r-1",
    imageHash: "hash-net3r-1",
    analyzedAtUtc: new Date(NOW).toISOString(),
    resultExpiresAtUtc: new Date(NOW + 3600_000).toISOString(),
    validationStatus: "VALID",
    intakeLifecycle: "ACCEPTED",
    evidenceReferences: {
      reconciliationStatus: "ALIGNED",
      canonicalOutcome: "BUY_CANDIDATE",
      primaryTimeframe: "H1",
      mtfAlignment: "ALIGNED",
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: "TEST_FIXTURE_NET_3R",
  };
}

function baseProposalInput(over: Record<string, unknown> = {}) {
  return {
    handoff: handoff(),
    entryPrice: ENTRY,
    stopLoss: STOP,
    verifiedEquity: 10_000,
    accountCurrency: "USD",
    equityFresh: true,
    usableMargin: 8_000,
    usedMargin: 100,
    marginFresh: true,
    strategyAllocationPercent: 10,
    // $40 allocation → $10 allowed risk → ~1.0 lot at $10/lot SL risk (clean cost math).
    individualOrderAllocation: 40,
    allocationCurrency: "USD",
    existingCommittedExposure: 0,
    contract: CONTRACT,
    contractFresh: true,
    sdkMinQuantity: 1000,
    marginPerUnitAccount: 33,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: true,
    emergencyEntryLock: false,
    nowMs: NOW,
    ...over,
  };
}

describe("Stage 1 — Net 3R take-profit consistency", () => {
  it("1. exact 3R gross with zero verified trading costs", () => {
    const gross = proposeTakeProfit3RPrice({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      digits: 5,
    });
    expect(gross.ok).toBe(true);
    if (!gross.ok) return;
    const net = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: 0,
      costsVerified: true,
      digits: 5,
      tickSize: 0.00001,
    });
    expect(net.ok).toBe(true);
    if (!net.ok) return;
    expect(net.takeProfit).toBeCloseTo(gross.takeProfit, 8);
    expect(net.grossRewardRiskRatio).toBeCloseTo(3, 8);
    expect(net.netRewardRiskRatio).toBeCloseTo(3, 8);
    expect(net.verifiedTradingCostsAccount).toBe(0);
  });

  it("2. exact 3R gross with positive spread cost → TP extends for net ≥3R", () => {
    const spreadCost = 1.2; // matches fixture 0.00012 × POINT_COST
    const net = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: spreadCost,
      costsVerified: true,
      digits: 5,
      tickSize: 0.00001,
    });
    expect(net.ok).toBe(true);
    if (!net.ok) return;
    expect(net.grossRewardRiskRatio).toBeGreaterThan(3);
    expect(net.netRewardRiskRatio!).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(net.takeProfit).toBeGreaterThan(ENTRY + 3 * (ENTRY - STOP) - 1e-12);
    expect(net.stopLossUnchanged).toBe(true);
    expect(net.quantityUnchanged).toBe(true);
  });

  it("3. gross above 3R but net below 3R is REJECTED when TP not extended", () => {
    // Fixed TP at exact 3R with positive friction → dynamic spread REJECT
    const r = evaluateDynamicSpread({
      instrument: "EUR/USD",
      bid: 1.10000,
      ask: 1.10012,
      quoteAgeMs: 200,
      provenance: "LIVE",
      feedConnected: true,
      marketStatus: "OPEN",
      historicalSpreads: fixtureRollingSpreads({
        n: DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
        baseSpread: 0.00012,
        instrument: "EUR/USD",
        nowMs: NOW,
      }),
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      takeProfit: ENTRY + 3 * (ENTRY - STOP),
      quantityLots: 1,
      brokerAmount: 1000,
      baseUnitSize: 1000,
      contract: CONTRACT,
      orderAllocationAccount: 400,
      accountCurrency: "USD",
      nowMs: NOW,
    });
    expect(r.decision).toBe("REJECT");
    expect(r.primaryReasonCode).toBe("NET_REWARD_BELOW_3R");
    expect(r.reasonCodes).toContain("NET_REWARD_BELOW_POLICY");
  });

  it("4. technically valid TP that satisfies net 3R is accepted by proposal engine", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
      technicalRewardDistanceMax: 0.01, // plenty of room
    }));
    expect(proposal.blockers.map((b) => `${b.code}:${b.message}`)).toEqual([]);
    expect(proposal.lifecycle).toBe("PROPOSAL_READY");
    expect(proposal.pricePlan.takeProfit).not.toBeNull();
    expect(proposal.pricePlan.netRewardRiskRatio!).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(proposal.pricePlan.stopLoss).toBeCloseTo(STOP, 8);
  });

  it("5. technical target that cannot support net 3R → REJECT", () => {
    const net = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
      technicalRewardDistanceMax: 0.00300, // exact 3R only — too tight for costs
      digits: 5,
    });
    expect(net.ok).toBe(false);
    if (net.ok) return;
    expect(net.code).toBe("TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R");
  });

  it("6. TP beyond valid resistance for BUY → REJECT (no invented structure)", () => {
    const resistanceDistance = 0.0025; // < required cost-adjusted distance
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 5,
      costsVerified: true,
      technicalRewardDistanceMax: resistanceDistance,
    }));
    expect(proposal.lifecycle).toBe("BLOCKED");
    expect(
      proposal.blockers.some((b) =>
        b.code === "TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R"
        || b.code === "TP_OUTSIDE_VALID_MARKET_STRUCTURE"
      ),
    ).toBe(true);
    expect(proposal.pricePlan.takeProfit).toBeNull();
  });

  it("7. TP beyond valid support for SELL → REJECT", () => {
    const sellHandoff = { ...handoff(), canonicalDirection: "SELL" as const };
    const entry = 1.10000;
    const stop = 1.10100;
    const net = proposeTakeProfitNetAware3R({
      direction: "SELL",
      entryPrice: entry,
      stopLoss: stop,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: 2,
      costsVerified: true,
      technicalRewardDistanceMax: 0.0025,
      digits: 5,
    });
    expect(net.ok).toBe(false);
    if (net.ok) return;
    expect(net.code).toBe("TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R");
    expect(sellHandoff.canonicalDirection).toBe("SELL");
  });

  it("8. invalid TP direction rejected", () => {
    const geom = evaluateProtectiveGeometry({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      takeProfit: ENTRY - 0.001, // wrong side
      requireProtective: true,
      requireThreeR: true,
    });
    expect(geom.ok).toBe(false);
    expect(geom.rejections.some((r) => r.code === "TAKE_PROFIT_GEOMETRY_INVALID")).toBe(true);
  });

  it("9. spread cost deducted exactly once (convention)", () => {
    expect(DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION).toContain("SPREAD_IS_ENTRY_FRICTION_SUBTRACTED_FROM_TP_REWARD_ONLY");
    const r = evaluateDynamicSpread({
      instrument: "EUR/USD",
      bid: 1.10000,
      ask: 1.10012,
      quoteAgeMs: 200,
      provenance: "LIVE",
      feedConnected: true,
      marketStatus: "OPEN",
      historicalSpreads: fixtureRollingSpreads({
        n: 20,
        baseSpread: 0.00012,
        instrument: "EUR/USD",
        nowMs: NOW,
      }),
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      takeProfit: ENTRY + 0.005,
      quantityLots: 1,
      brokerAmount: 1000,
      baseUnitSize: 1000,
      contract: CONTRACT,
      orderAllocationAccount: 400,
      accountCurrency: "USD",
      nowMs: NOW,
    });
    expect(r.stopLossImpact.spreadIncludedInStopLossRisk).toBe(false);
    expect(r.netReward.costsSubtractedFromReward).toBe(true);
    // SL risk $10; spread $1.2 — not added into SL
    expect(r.stopLossImpact.modeledStopLossRiskAccount).toBeCloseTo(10, 5);
    expect(r.costBreakdown.spreadCostAccount).toBeCloseTo(1.2, 5);
    expect(r.netReward.netTakeProfitRewardAccount).toBeCloseTo(
      (r.netReward.grossTakeProfitRewardAccount ?? 0) - 1.2,
      5,
    );
  });

  it("10. commission included only when verified", () => {
    const withComm = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: 1.2 + 0.5,
      costsVerified: true,
      digits: 5,
    });
    const spreadOnly = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
      digits: 5,
    });
    expect(withComm.ok && spreadOnly.ok).toBe(true);
    if (!withComm.ok || !spreadOnly.ok) return;
    expect(withComm.takeProfit!).toBeGreaterThan(spreadOnly.takeProfit!);
  });

  it("11. slippage included only when evidence-backed (unverified non-zero → REJECT)", () => {
    const net = proposeTakeProfitNetAware3R({
      direction: "BUY",
      entryPrice: ENTRY,
      stopLoss: STOP,
      quantityLots: 1,
      contract: CONTRACT,
      verifiedTradingCostsAccount: 2.0,
      costsVerified: false,
      digits: 5,
    });
    expect(net.ok).toBe(false);
    if (net.ok) return;
    expect(net.code).toBe("TRADING_COST_UNVERIFIED");
  });

  it("12. missing cost inputs → gross 3R floor (zero costs)", () => {
    const proposal = buildOrderProposal(baseProposalInput());
    expect(proposal.blockers.map((b) => b.code)).toEqual([]);
    expect(proposal.lifecycle).toBe("PROPOSAL_READY");
    expect(proposal.pricePlan.plannedRewardRiskRatio).toBeCloseTo(3, 8);
    expect(proposal.pricePlan.verifiedTradingCostsAccount).toBe(0);
  });

  it("13. missing account-currency conversion path fails closed in cost→distance", () => {
    const bad = accountCostToPriceDistance({
      costAccount: 1.2,
      quantityLots: 1,
      contract: {
        ...CONTRACT,
        verified: false,
      },
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.code).toBe("INSTRUMENT_METADATA_UNVERIFIED");
  });

  it("14. per-order allocation independence preserved", () => {
    const a = buildOrderProposal(baseProposalInput({
      individualOrderAllocation: 400,
      proposalId: "alloc-indep-A",
    }));
    const b = buildOrderProposal(baseProposalInput({
      individualOrderAllocation: 40,
      proposalId: "alloc-indep-B",
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(a.capital.individualOrderAllocation).toBe(400);
    expect(b.capital.individualOrderAllocation).toBe(40);
    expect(a.capital.allowedRiskAmount).toBeCloseTo(100, 6);
    expect(b.capital.allowedRiskAmount).toBeCloseTo(10, 6);
  });

  it("15. 25% target and hard maximum preserved", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(proposal.capital.riskTargetPercent).toBe(25);
    expect(proposal.capital.riskMaximumPercent).toBe(25);
    expect(proposal.capital.allowedRiskAmount).toBeCloseTo(10, 6);
  });

  it("16. Stop Loss unchanged during TP calculation", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(proposal.pricePlan.stopLoss).toBeCloseTo(STOP, 8);
    expect(proposal.blockers.some((b) => b.code === "STOP_LOSS_CHANGED_DURING_TP")).toBe(false);
  });

  it("17. Quantity unchanged during TP calculation", () => {
    const without = buildOrderProposal(baseProposalInput());
    const withCosts = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(without.quantity.normalizedQuantity).toBe(withCosts.quantity.normalizedQuantity);
    expect(withCosts.blockers.some((b) => b.code === "QUANTITY_CHANGED_DURING_TP")).toBe(false);
  });

  it("18. existing dynamic position sizing regression", () => {
    const sized = sizeOrderQuantityFromAllocation({
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 10,
      remainingStrategyBudget: 1000,
      individualOrderAllocation: 40,
      entryPrice: ENTRY,
      stopLoss: STOP,
      contract: CONTRACT,
      freeMargin: 8000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 33,
      sdkMinQuantity: 1000,
      allocationCurrency: "USD",
    });
    if (!sized.ok) {
      expect.fail(`sizing failed: ${"code" in sized ? sized.code : "?"} — ${sized.message}`);
    }
    expect(sized.quantity).toBeGreaterThan(0);
    // With costs, proposal must not increase quantity to compensate
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(proposal.blockers.map((b) => `${b.code}:${b.message}`)).toEqual([]);
    expect(proposal.quantity.normalizedQuantity).toBeLessThanOrEqual(sized.quantity + 1e-12);
  });

  it("19. FXCM AMOUNT/lots conversion regression", () => {
    const amt = lotsToFxcmAmount({ lots: 1, baseUnitSize: 1000 });
    expect(amt.ok).toBe(true);
    if (!amt.ok) return;
    expect(amt.amount).toBe(1000);
    const lots = amountConstraintsToLots({
      amountMin: 1000,
      amountStep: 1000,
      amountMax: 1000,
      baseUnitSize: 1000,
    });
    expect(lots.ok).toBe(true);
    if (!lots.ok) return;
    expect(lots.lots.lotsMin).toBeCloseTo(1, 8);
  });

  it("20. Dynamic Spread Engine ACCEPT after net-aware proposal TP", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(proposal.lifecycle).toBe("PROPOSAL_READY");
    const r = evaluateDynamicSpread({
      instrument: "EUR/USD",
      bid: 1.10000,
      ask: 1.10012,
      quoteAgeMs: 200,
      provenance: "LIVE",
      feedConnected: true,
      marketStatus: "OPEN",
      historicalSpreads: fixtureRollingSpreads({
        n: 20,
        baseSpread: 0.00012,
        instrument: "EUR/USD",
        nowMs: NOW,
      }),
      direction: "BUY",
      entryPrice: proposal.pricePlan.entryPrice,
      stopLoss: proposal.pricePlan.stopLoss,
      takeProfit: proposal.pricePlan.takeProfit,
      quantityLots: proposal.quantity.normalizedQuantity,
      brokerAmount: proposal.quantity.brokerAmount,
      baseUnitSize: 1000,
      contract: CONTRACT,
      orderAllocationAccount: proposal.capital.individualOrderAllocation,
      accountCurrency: "USD",
      nowMs: NOW,
    });
    expect(r.decision).toBe("ACCEPT");
    expect(r.netReward.meetsMinimum).toBe(true);
    expect(r.authorizesBrokerSubmission).toBe(false);
  });

  it("21. broker precheck consumes the corrected proposal", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    const input: AtPreExecutionValidationInput = {
      handoff: null,
      proposal,
      environment: "DEMO",
      controls: {
        emergencyEntryLock: true,
        masterEnable: false,
        automaticEntry: false,
        positionManagement: false,
      },
      foundation: {
        executionMasterEnabled: false,
        armedForSubmission: false,
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
        lifecycle: "AUTHORIZATION_REQUIRED",
      },
      account: {
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        usedMargin: 100,
        currency: "USD",
        accountIdMasked: "DEMO***",
        fetchedAtMs: NOW - 500,
        isFresh: true,
      },
      market: {
        bid: 1.0999,
        ask: 1.10012,
        spread: 0.00022,
        quoteAgeMs: 200,
        tradingEligible: true,
        marketClosed: false,
        instrument: "EUR/USD",
      },
      exposure: {
        openExposureLots: 0,
        openPositionCount: 0,
        exposureAuthoritative: true,
        duplicateTradeSuspected: false,
        dayRealizedPnlAccount: 0,
        dayStartEquity: 10_000,
      },
      instrumentContract: {
        baseUnitSize: 1000,
        minQuantity: 1,
        quantityStep: 1000,
        mmrPerLot: 33,
        contractVerified: true,
      },
      riskLimits: {
        maxSpreadAbsolute: null,
        maxSlippageAbsolute: 0.01,
      },
      dynamicSpread: {
        historicalSpreads: fixtureRollingSpreads({
          n: 20,
          baseSpread: 0.00012,
          instrument: "EUR/USD",
          nowMs: NOW,
        }),
        provenance: "LIVE",
        feedConnected: true,
        contract: CONTRACT,
        orderAllocationAccount: proposal.capital.individualOrderAllocation,
        accountCurrency: "USD",
        commissionVerified: false,
        slippageEvidenceAvailable: false,
      },
      nowMs: NOW,
    };
    const r = runPreExecutionValidation(input);
    expect(r.dynamicSpread).toBeTruthy();
    expect(r.executionAuthorized).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    // Protective geometry must accept ≥3R cost-adjusted TP
    const geom = evaluateProtectiveGeometry({
      direction: "BUY",
      entryPrice: proposal.pricePlan.entryPrice,
      stopLoss: proposal.pricePlan.stopLoss,
      takeProfit: proposal.pricePlan.takeProfit,
      requireProtective: true,
      requireThreeR: true,
    });
    expect(geom.ok).toBe(true);
    expect((geom.rewardRisk ?? 0)).toBeGreaterThanOrEqual(3 - 0.05);
  });

  it("gross vs net labels are distinct on proposal", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      verifiedTradingCostsAccount: 1.2,
      costsVerified: true,
    }));
    expect(proposal.pricePlan.grossRewardRiskRatio).not.toBeNull();
    expect(proposal.pricePlan.netRewardRiskRatio).not.toBeNull();
    expect(proposal.pricePlan.grossRewardRiskRatio!).toBeGreaterThan(
      proposal.pricePlan.netRewardRiskRatio!,
    );
    expect(proposal.pricePlan.takeProfitLabel).toBe("NET_3R_AFTER_VERIFIED_COSTS");
  });

  it("22. liveSpreadAbsolute computes friction once after sizing (no double count)", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      liveSpreadAbsolute: 0.00012,
    }));
    expect(proposal.blockers.map((b) => `${b.code}:${b.message}`)).toEqual([]);
    expect(proposal.lifecycle).toBe("PROPOSAL_READY");
    expect(proposal.pricePlan.verifiedTradingCostsAccount).toBeCloseTo(1.2, 5);
    expect(proposal.pricePlan.netRewardRiskRatio!).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(proposal.pricePlan.grossRewardRiskRatio!).toBeGreaterThan(
      proposal.pricePlan.netRewardRiskRatio!,
    );
    expect(proposal.notes.some((n) => n.includes("NET_3R_SPREAD_FRICTION"))).toBe(true);
  });

  it("23. structure ceiling rejects BUY TP beyond farthest resistance", () => {
    const proposal = buildOrderProposal(baseProposalInput({
      liveSpreadAbsolute: 0.00012,
      technicalRewardDistanceMax: 0.0025,
    }));
    expect(proposal.lifecycle).toBe("BLOCKED");
    expect(
      proposal.blockers.some((b) => b.code === "TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R"),
    ).toBe(true);
  });
});
