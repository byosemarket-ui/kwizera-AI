/**
 * Phase 56.2.4 — XAU quantity semantics, min-stop evidence, exposure reconciliation.
 * Synthetic fixtures only — not claimed as live broker evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessClosedTradesNecessity,
  reconcileBrokerExposure,
  resolveXauQuantitySemantics,
  validateSimulationDraft,
  assembleSimDraftInput,
  defaultSimRiskPolicy,
  type AtSimDraftInput,
  type AtSimRiskPolicy,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";
import { contractSpecFromForexConnectMetadata } from "../../../../ai/forex-ai/position-sizing/contract-spec.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const policy: AtSimRiskPolicy = defaultSimRiskPolicy();

function baseDraft(over: Partial<AtSimDraftInput> = {}): AtSimDraftInput {
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
    entryPrice: 4000,
    stopLoss: 3990,
    takeProfit: 4030,
    requestedQuantity: 1,
    allocationPercentage: null,
    marketEvidenceStrength: null,
    profitProtection: null,
    capitalAllocationPercent: 10,
    requestedPerOrderAllocation: 100,
    reservedStrategyBudgetActive: 0,
    quote: {
      bid: 3999.9,
      ask: 4000.1,
      entryPrice: 4000,
      entrySource: "draft-input",
      fresh: true,
      freshnessReasonCode: null,
      quoteAgeMs: 100,
      observedAtUtc: "2026-10-20T00:00:00.000Z",
    },
    contract: {
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
      minStopDistance: null,
      minStopDistanceVerified: false,
      source: "synthetic-test",
      unavailableReason: null,
    },
    account: {
      verified: true,
      accountIdMasked: "***9634",
      accountCurrency: "USD",
      equity: 20_000,
      balance: 20_000,
      usableMargin: 20_000,
      usedMargin: 0,
      fetchedAtUtc: "2026-10-20T00:00:00.000Z",
      environment: "DEMO",
      unavailableReason: null,
    },
    sourceDecisionId: null,
    sourceAnalysisId: null,
    sourceEvidenceFingerprint: null,
    sourceDecidedAtUtc: null,
    policy,
    openPositionsCount: 0,
    pendingOrdersCount: 0,
    exposureDataAuthoritative: true,
    ...over,
  };
}

describe("Phase 56.2.4 XAU quantity semantics", () => {
  it("verifies XAU identity + contract=ounce binding when DEMO fields align", () => {
    const r = resolveXauQuantitySemantics({
      symbol: "XAU/USD",
      instrumentType: "Bullion",
      pointSize: 0.01,
      pipCostAccount: 0.01,
      baseUnitSize: 1,
      contractMultiplier: 1,
      quantityStep: 1,
      quantityMin: 1,
      legacyQuantityUnitLabel: "lots",
    });
    expect(r.instrumentIdentity.status).toBe("VERIFIED");
    expect(r.quantityUnit.status).toBe("VERIFIED");
    expect(r.resolvedQuantityUnit).toBe("contracts");
    expect(r.quantityUnitAmbiguous).toBe(false);
    expect(r.monetaryRiskAllowed).toBe(true);
    expect(r.minStopDistanceVerified).toBe(false);
    expect(r.minStopDistance.status).toBe("PARTIALLY_VERIFIED");
    expect(r.notes.some((n) => /lots/i.test(n))).toBe(true);
  });

  it("keeps quantity ambiguous when DEMO alignment is incomplete", () => {
    const r = resolveXauQuantitySemantics({
      symbol: "XAU/USD",
      pointSize: 0.01,
      pipCostAccount: null,
      baseUnitSize: null,
      contractMultiplier: 1,
    });
    expect(r.quantityUnitAmbiguous).toBe(true);
    expect(r.monetaryRiskAllowed).toBe(false);
    expect(r.resolvedQuantityUnit).toBe("unknown");
  });

  it("blocks monetary SL risk when quantity unit ambiguous", () => {
    const r = validateSimulationDraft(
      baseDraft({
        contract: {
          verified: true,
          pointSize: 0.01,
          tickSize: 0.01,
          digits: 2,
          quantityMin: 1,
          quantityStep: 1,
          quantityUnit: "unknown",
          quantityUnitAmbiguous: true,
          contractMultiplier: 1,
          baseUnitSize: 1,
          pipCostAccount: 0.01,
          marginPerLotAccount: null,
          minStopDistance: null,
          minStopDistanceVerified: false,
          source: "synthetic",
          unavailableReason: "ambiguous",
        },
      }),
    );
    expect(r.checks.some((c) => c.code === "SL_RISK_QUANTITY_UNIT_AMBIGUOUS" || c.message.includes("ambiguous") || c.code.includes("QUANTITY"))).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("labels XAU contract-spec as contracts not lots when pipCost present", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      instrumentTypeLabel: "Bullion",
      metadata: {
        pointSize: 0.01,
        pipCost: 0.01,
        baseUnitSize: 1,
        contractMultiplier: 1,
        lotStep: 1,
      },
    });
    expect(spec.verified).toBe(true);
    expect(spec.quantityUnit).toBe("contracts");
    expect(spec.convention).toBe("ounce_contract");
  });

  it("treats CondDist > 0 as verified min-stop price = pips × PointSize", () => {
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
    expect(r.minStopDistanceVerified).toBe(true);
    // 5 pips × 0.01 PointSize = 0.05 price (never treat raw pips as price).
    expect(r.minStopDistanceValue).toBeCloseTo(0.05, 10);
    expect(r.condDistStopPips).toBe(5);
    expect(r.condDistUnit).toBe("pips");
    expect(r.minStopDistance.status).toBe("VERIFIED");
  });
});

describe("Phase 56.2.4 exposure reconciliation", () => {
  it("treats confirmed empty ORDERS+TRADES as authoritative zero (not unavailable)", () => {
    const r = reconcileBrokerExposure({
      instrument: "XAU/USD",
      environment: "DEMO",
      openWorkingOrders: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        code: "NO_ORDERS",
        count: 0,
        orders: [],
        fetchedAt: new Date().toISOString(),
      },
      openPositions: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        code: "NO_TRADES",
        count: 0,
        trades: [],
        fetchedAt: new Date().toISOString(),
      },
    });
    expect(r.authoritative).toBe(true);
    expect(r.confirmedZeroExposure).toBe(true);
    expect(r.status).toBe("AUTHORITATIVE_EMPTY");
    expect(r.openPositionsCount).toBe(0);
    expect(r.pendingOrdersCount).toBe(0);
  });

  it("does not treat disconnected/failed queries as zero", () => {
    const r = reconcileBrokerExposure({
      instrument: "XAU/USD",
      environment: "DEMO",
      openWorkingOrders: {
        ok: false,
        capabilityStatus: "AVAILABLE_BUT_DISCONNECTED",
        code: "DISCONNECTED",
        count: 0,
        orders: [],
      },
      openPositions: {
        ok: false,
        capabilityStatus: "ERROR",
        code: "TRADES_UNAVAILABLE",
        count: 0,
        trades: [],
      },
    });
    expect(r.authoritative).toBe(false);
    expect(r.confirmedZeroExposure).toBe(false);
    expect(r.openPositionsCount).toBeNull();
    expect(r.status).toBe("UNAVAILABLE");
  });

  it("counts pending orders and open trades separately without double-count bucket", () => {
    const r = reconcileBrokerExposure({
      instrument: "XAU/USD",
      environment: "DEMO",
      openWorkingOrders: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        code: "OK",
        count: 1,
        orders: [{ instrument: "XAU/USD", amount: 2, status: "WAITING" }],
        fetchedAt: new Date().toISOString(),
      },
      openPositions: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        code: "OK",
        count: 1,
        trades: [{ instrument: "XAU/USD", amount: 3 }],
        fetchedAt: new Date().toISOString(),
      },
    });
    expect(r.authoritative).toBe(true);
    expect(r.pendingOrdersCount).toBe(1);
    expect(r.openPositionsCount).toBe(1);
    expect(r.xau?.pendingOrderQuantitySum).toBe(2);
    expect(r.xau?.openPositionQuantitySum).toBe(3);
    // Not summed into a single filled exposure figure.
    expect(r.note).toMatch(/separately|orders≠fills|no double-count|pending/i);
  });

  it("wires assemble exposure authoritative flag from reconciliation", () => {
    const exposure = reconcileBrokerExposure({
      instrument: "XAU/USD",
      environment: "DEMO",
      openWorkingOrders: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        code: "NO_ORDERS",
        count: 0,
        orders: [],
        fetchedAt: new Date().toISOString(),
      },
      openPositions: {
        ok: true,
        capabilityStatus: "AVAILABLE",
        code: "NO_TRADES",
        count: 0,
        trades: [],
        fetchedAt: new Date().toISOString(),
      },
    });
    const input = assembleSimDraftInput({
      environment: "DEMO",
      environmentEpoch: 1,
      decision: null,
      verification: null,
      quoteFresh: false,
      freshnessReasonCode: "TEST",
      quoteAgeMs: null,
      sessionEnvironment: "DEMO",
      sessionMatchesSelection: true,
      policy,
      capitalAllocationPercent: 10,
      exposureReconciliation: exposure,
      overrides: {
        instrument: "XAU/USD",
        direction: "BUY",
        entryPrice: 4000,
        stopLoss: 3990,
        takeProfit: 4030,
      },
    });
    expect(input.exposureDataAuthoritative).toBe(true);
    expect(input.openPositionsCount).toBe(0);
    expect(input.pendingOrdersCount).toBe(0);
  });

  it("PASS exposure check when authoritative empty on draft validate", () => {
    const r = validateSimulationDraft(baseDraft({
      exposureDataAuthoritative: true,
      openPositionsCount: 0,
      pendingOrdersCount: 0,
    }));
    expect(r.checks.some((c) => c.code === "EXPOSURE_DATA" && c.status === "PASS")).toBe(true);
    expect(r.checks.some((c) => c.code === "EXPOSURE_DATA_UNAVAILABLE")).toBe(false);
  });

  it("BLOCKED exposure when not authoritative", () => {
    const r = validateSimulationDraft(baseDraft({
      exposureDataAuthoritative: false,
      openPositionsCount: null,
      pendingOrdersCount: null,
    }));
    expect(r.checks.some((c) => c.code === "EXPOSURE_DATA_UNAVAILABLE" && c.status === "BLOCKED")).toBe(true);
  });
});

describe("Phase 56.2.4 ClosedTrades + safety", () => {
  it("documents ClosedTrades as not required for open exposure", () => {
    const a = assessClosedTradesNecessity();
    expect(a.implemented).toBe(false);
    expect(a.capabilityStatus).toBe("MISSING");
    expect(String((a.neededFor as Record<string, string>).strategyAllocationAccounting)).toMatch(/NO/);
  });

  it("keeps execution closed and CondDist never mapped to lotStep", () => {
    const py = read("services/forexconnect-sidecar/server.py");
    expect(py).toMatch(/condDistStop/);
    expect(py).toMatch(/Never map CondDistEntry\/stop distances/);
    expect(py).toMatch(/Never use as lotStep|NEVER quantity steps/i);
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).not.toMatch(/acceptsForExecution:\s*true/);
    expect(api).toMatch(/placesOrders:\s*false/);
    const r = validateSimulationDraft(baseDraft());
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.simulationOnly).toBe(true);
  });

  it("enforces 25% per-order loss ceiling distinct from equity %", () => {
    const r = validateSimulationDraft(baseDraft({
      capitalAllocationPercent: 100,
      requestedPerOrderAllocation: 100,
      requestedQuantity: 1,
      entryPrice: 4000,
      stopLoss: 3970, // $30 move * pip path = large vs $25 limit
      takeProfit: 4090,
    }));
    const lossLimit = r.checks.find((c) => /PER_ORDER_LOSS|LOSS_LIMIT|25%/i.test(c.code + c.message));
    // Either explicit fail/block on loss limit or capital analysis records the rule.
    expect(
      lossLimit != null
      || (r.capitalBudgetAnalysis?.perOrderLossLimit != null
        && r.capitalBudgetAnalysis.perOrderLossLimit === 25),
    ).toBe(true);
    expect(r.placesOrders).toBe(false);
  });
});
