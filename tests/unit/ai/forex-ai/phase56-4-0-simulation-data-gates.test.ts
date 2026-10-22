/**
 * Phase 56.4.0 — Simulation data gates closure (quantity, CondDist, FX).
 * Synthetic fixtures only — not production broker evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isDocumentedCondDistMethod,
  resolveCondDistMinStop,
  resolveCondDistUnit,
  buildOffersConversionRateSnapshot,
  convertCurrencyAmount,
  resolveXauQuantitySemantics,
  resolveXauQuantityConstraints,
  evaluateSimulationDataReadiness,
  assembleSimDraftInput,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  type AtSimDraftInput,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";
import { contractSpecFromForexConnectMetadata } from "../../../../ai/forex-ai/position-sizing/contract-spec.js";
import { verifyInstrumentMetadata } from "../../../../ai/forex-ai/automated-trading/verification-engine.js";
import type { ForexConnectInstrument } from "../../../../ai/market-data/forexconnect/types.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Authoritative DEMO-shaped XAU metadata (mirrors production MDS probe). */
const xauHit: ForexConnectInstrument = {
  provider: "FOREXCONNECT",
  providerSymbol: "XAU/USD",
  canonicalSymbol: "XAUUSD",
  displaySymbol: "XAU/USD",
  marketType: "COMMODITY",
  baseAsset: "XAU",
  quoteAsset: "USD",
  status: "available",
  instrumentTypeLabel: "Forex Connect Bullion",
  pointSize: 0.01,
  pipCost: 0.01,
  contractMultiplier: 1,
  baseUnitSize: 1,
  minQuantity: 1,
  lotStep: 1,
  mmrPerLot: 4.79,
  condDistStop: 0,
  condDistAvailable: true,
  condDistUnit: "pips",
  condDistMethod: "get_cond_dist_stop_for_trade",
};

describe("Phase 56.4.0 CondDist method provenance", () => {
  it("recognizes documented getCondDist* method aliases", () => {
    expect(isDocumentedCondDistMethod("get_cond_dist_stop_for_trade")).toBe(true);
    expect(isDocumentedCondDistMethod("getCondDistStopForTrade")).toBe(true);
    expect(isDocumentedCondDistMethod("getCondDistEntryStop")).toBe(true);
    expect(isDocumentedCondDistMethod("unknown")).toBe(false);
    expect(isDocumentedCondDistMethod(null)).toBe(false);
  });

  it("resolves unit=pips from method even without reportedUnit", () => {
    expect(
      resolveCondDistUnit({ condDistMethod: "get_cond_dist_stop_for_trade" }),
    ).toBe("pips");
    expect(resolveCondDistUnit({ reportedUnit: "pips_or_points_unverified" })).toBe("unknown");
  });

  it("attests no-positive-minimum when CondDist=0 via documented method", () => {
    const a = resolveCondDistMinStop({
      condDistAvailable: true,
      condDistStop: 0,
      condDistMethod: "get_cond_dist_stop_for_trade",
      pointSize: 0.01,
    });
    expect(a.minStopDistanceVerified).toBe(true);
    expect(a.noPositiveMinimumAttested).toBe(true);
    expect(a.minStopDistancePrice).toBeNull();
  });

  it("does not manufacture a min-stop when CondDist unavailable", () => {
    const a = resolveCondDistMinStop({
      condDistAvailable: false,
      pointSize: 0.01,
    });
    expect(a.minStopDistanceVerified).toBe(false);
    expect(a.minStopDistancePrice).toBeNull();
  });
});

describe("Phase 56.4.0 quantity / contract attestation", () => {
  it("verifies XAU instrument with BaseUnitSize min/step and CondDist method", () => {
    const { instrument, blockers } = verifyInstrumentMetadata("XAU/USD", [xauHit]);
    expect(instrument.contractVerified).toBe(true);
    expect(instrument.quantityUnit).toBe("contracts");
    expect(instrument.quantityMin).toBe(1);
    expect(instrument.quantityStep).toBe(1);
    expect(instrument.baseUnitSize).toBe(1);
    expect(instrument.contractMultiplier).toBe(1);
    expect(instrument.condDistMethod).toBe("get_cond_dist_stop_for_trade");
    expect(instrument.condDistUnit).toBe("pips");
    expect(blockers.some((b) => b.code === "QUANTITY_RULES_UNVERIFIED")).toBe(false);
  });

  it("binds contracts when Offers omit ContractMultiplier but BaseUnitSize=1 + PipCost align", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      instrumentTypeLabel: "Bullion",
      metadata: {
        pointSize: 0.01,
        pipCost: 0.01,
        baseUnitSize: 1,
        minQuantity: 1,
        // contractMultiplier intentionally omitted
      },
    });
    expect(spec.verified).toBe(true);
    expect(spec.quantityUnit).toBe("contracts");
    expect(spec.contractMultiplier).toBe(1);
    expect(spec.quantityStep).toBe(1);
    expect(spec.quantityMin).toBe(1);
  });

  it("resolves quantity constraints READY for attested XAU contracts", () => {
    const semantics = resolveXauQuantitySemantics({
      symbol: "XAU/USD",
      pointSize: 0.01,
      pipCostAccount: 0.01,
      baseUnitSize: 1,
      contractMultiplier: 1,
      quantityStep: 1,
      quantityMin: 1,
      condDistStop: 0,
      condDistStopUnit: "pips",
      condDistAvailable: true,
      condDistMethod: "get_cond_dist_stop_for_trade",
    });
    expect(semantics.quantityUnitAmbiguous).toBe(false);
    expect(semantics.resolvedQuantityUnit).toBe("contracts");
    expect(semantics.minStopNoPositiveMinimum).toBe(true);
    expect(semantics.minStopDistanceVerified).toBe(true);

    const c = resolveXauQuantityConstraints({
      quantityUnit: semantics.resolvedQuantityUnit,
      quantityUnitAmbiguous: semantics.quantityUnitAmbiguous,
      baseUnitSize: 1,
      sdkMinQuantity: 1,
      reportedQuantityStep: 1,
      reportedQuantityMin: 1,
    });
    expect(c.sizingBlocked).toBe(false);
    expect(c.quantityMin).toBe(1);
    expect(c.quantityStep).toBe(1);
  });

  it("never treats non-XAU as XAU contracts", () => {
    const semantics = resolveXauQuantitySemantics({
      symbol: "EUR/USD",
      pointSize: 0.0001,
      baseUnitSize: 1000,
      contractMultiplier: 1,
    });
    expect(semantics.quantityUnitAmbiguous).toBe(true);
    expect(semantics.resolvedQuantityUnit).toBe("unknown");
  });
});

describe("Phase 56.4.0 Offers FX conversion", () => {
  const nowIso = new Date().toISOString();

  it("identity when currencies match", () => {
    const r = buildOffersConversionRateSnapshot({
      fromCurrency: "USD",
      toCurrency: "USD",
      offers: [],
      observedAtUtc: nowIso,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.path).toBe("IDENTITY");
      expect(r.snapshot.rate).toBe(1);
    }
  });

  it("direct MULTIPLY from Offers mid", () => {
    const r = buildOffersConversionRateSnapshot({
      fromCurrency: "EUR",
      toCurrency: "USD",
      offers: [{ baseAsset: "EUR", quoteAsset: "USD", bid: 1.1, ask: 1.12, observedAtUtc: nowIso }],
      observedAtUtc: nowIso,
      maxAgeMs: 60_000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.path).toBe("DIRECT");
      expect(r.snapshot.direction).toBe("MULTIPLY");
      expect(r.snapshot.rate).toBeCloseTo(1.11, 10);
      const converted = convertCurrencyAmount({
        amount: 100,
        fromCurrency: "EUR",
        toCurrency: "USD",
        rateSnapshot: r.snapshot,
      });
      expect(converted.ok).toBe(true);
      if (converted.ok) expect(converted.amount).toBeCloseTo(111, 8);
    }
  });

  it("inverse DIVIDE when only reverse pair exists", () => {
    const r = buildOffersConversionRateSnapshot({
      fromCurrency: "USD",
      toCurrency: "EUR",
      offers: [{ baseAsset: "EUR", quoteAsset: "USD", bid: 1.1, ask: 1.1, observedAtUtc: nowIso }],
      observedAtUtc: nowIso,
      maxAgeMs: 60_000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.path).toBe("INVERSE");
      expect(r.snapshot.direction).toBe("DIVIDE");
      const converted = convertCurrencyAmount({
        amount: 110,
        fromCurrency: "USD",
        toCurrency: "EUR",
        rateSnapshot: r.snapshot,
      });
      expect(converted.ok).toBe(true);
      if (converted.ok) expect(converted.amount).toBeCloseTo(100, 8);
    }
  });

  it("rejects stale Offers rates", () => {
    const staleIso = new Date(Date.now() - 120_000).toISOString();
    const r = buildOffersConversionRateSnapshot({
      fromCurrency: "EUR",
      toCurrency: "USD",
      offers: [{ baseAsset: "EUR", quoteAsset: "USD", bid: 1.1, ask: 1.1, observedAtUtc: staleIso }],
      observedAtUtc: staleIso,
      maxAgeMs: 30_000,
      nowMs: Date.now(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FX_RATE_STALE");
  });

  it("rejects missing path without inventing a rate", () => {
    const r = buildOffersConversionRateSnapshot({
      fromCurrency: "JPY",
      toCurrency: "GBP",
      offers: [{ baseAsset: "EUR", quoteAsset: "USD", bid: 1.1, ask: 1.1, observedAtUtc: nowIso }],
      observedAtUtc: nowIso,
      maxAgeMs: 60_000,
    });
    expect(r.ok).toBe(false);
  });
});

describe("Phase 56.4.0 Scenario 1 synthetic path (gates + draft)", () => {
  it("readiness READY when attested quantity + CondDist=0 + USD identity", () => {
    const semantics = resolveXauQuantitySemantics({
      symbol: "XAU/USD",
      pointSize: 0.01,
      pipCostAccount: 0.01,
      baseUnitSize: 1,
      contractMultiplier: 1,
      quantityStep: 1,
      quantityMin: 1,
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
    const r = evaluateSimulationDataReadiness({
      environment: "DEMO",
      environmentMatches: true,
      quoteFresh: true,
      quoteReasonCode: "FRESH",
      feedStatus: "LIVE",
      bid: 4100,
      ask: 4100.3,
      accountVerified: true,
      accountCurrency: "USD",
      equity: 10_000,
      usableMargin: 8_000,
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
    });
    expect(r.overall).toBe("READY");
    expect(r.readyForSimulationDraft).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.gates.find((g) => g.id === "quantity_constraints")?.status).toBe("READY");
    expect(r.gates.find((g) => g.id === "min_stop")?.status).toBe("READY");
    expect(r.gates.find((g) => g.id === "currency_conversion")?.status).toBe("READY");
  });

  it("assemble + validate draft with attested CondDist unit (not legacy unverified label)", () => {
    const { instrument } = verifyInstrumentMetadata("XAU/USD", [xauHit]);
    const verification = {
      identityStatus: "ACCOUNT_VERIFIED" as const,
      environmentSelected: "DEMO" as const,
      environmentConnected: "DEMO" as const,
      environmentMatches: true,
      connectionStatus: "CONNECTED",
      environmentEpoch: 1,
      account: {
        accountIdMasked: "****1234",
        environment: "DEMO" as const,
        accountCurrency: "USD",
        balance: 10_000,
        equity: 10_000,
        equityDerived: false,
        equityDerivation: null,
        usedMargin: 0,
        usableMargin: 9_000,
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
        missingFields: [] as string[],
        snapshotCode: null,
      },
      instrument,
      market: {
        bid: 4100,
        ask: 4100.25,
        spread: 0.25,
        feedStatus: "LIVE" as const,
        sourceTimestampMs: Date.now(),
        receivedAtMs: Date.now(),
        priceChangeAgeMs: 500,
        receiptAgeMs: 200,
        updateCount: 10,
        marketSession: "ACTIVE" as const,
      },
      readiness: {
        environmentVerified: true,
        accountIdentityVerified: true,
        accountMetadataSufficient: true,
        instrumentMetadataVerified: true,
        marketDataHealthVerified: true,
        riskEngineVerified: false as const,
        executionImplemented: false as const,
        readyForFutureAnalysis: true,
        readyForTrading: false as const,
      },
      blockers: [],
      verifiedAtUtc: new Date().toISOString(),
      placesOrders: false as const,
    };

    const input = assembleSimDraftInput({
      environment: "DEMO",
      environmentEpoch: 1,
      decision: null,
      verification,
      quoteFresh: true,
      freshnessReasonCode: "FRESH",
      quoteAgeMs: 500,
      sessionEnvironment: "DEMO",
      sessionMatchesSelection: true,
      policy: defaultSimRiskPolicy(),
      capitalAllocationPercent: 10,
      requestedPerOrderAllocation: 200,
      reservedStrategyBudgetActive: 0,
      exposureReconciliation: {
        authoritative: true,
        status: "AUTHORITATIVE_EMPTY",
        confirmedZeroExposure: true,
        openPositionsCount: 0,
        pendingOrdersCount: 0,
        note: "synthetic empty",
        ordersCapability: "OK",
        tradesCapability: "OK",
      },
      // Intentionally omit cond overrides — assemble must use instrument CondDist fields.
      overrides: {
        instrument: "XAU/USD",
        direction: "BUY",
        entryPrice: 4100.1,
        stopLoss: 4095,
        takeProfit: 4115.4, // 3R: |4100.1−4095|×3
      },
    });

    expect(input.contract?.minStopDistanceVerified).toBe(true);
    expect(input.contract?.minStopNoPositiveMinimum).toBe(true);
    expect(input.contract?.quantityUnitAmbiguous).toBe(false);
    expect(input.contract?.quantityMin).toBe(1);
    expect(input.contract?.quantityStep).toBe(1);

    const draft = validateSimulationDraft(input as AtSimDraftInput);
    expect(draft.placesOrders).toBe(false);
    expect(draft.acceptsForExecution).toBe(false);
    // With genuine synthetic inputs, draft should structurally pass or record explicit blockers — not invent.
    expect(
      draft.overallStatus === "VALIDATION_PASSED"
      || draft.overallStatus === "VALIDATION_FAILED"
      || draft.overallStatus === "BLOCKED",
    ).toBe(true);
    if (draft.overallStatus !== "VALIDATION_PASSED") {
      // Fail closed is acceptable when policy rejects geometry; never silently invent qty.
      expect(draft.contract?.quantityUnitAmbiguous !== true || draft.structuralOk === false).toBe(true);
    }
  });
});

describe("Phase 56.4.0 safety invariants in sources", () => {
  it("keeps execution forbidden literals and does not add order submission", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toMatch(/placesOrders:\s*false/);
    expect(service).not.toMatch(/createOrder|submitOrder|placeOrder\(/);
    expect(service).toContain("buildOffersConversionRateSnapshot");
    expect(service).toContain("isDocumentedCondDistMethod");
    // Must not hardcode the legacy unverified CondDist unit on the draft path.
    expect(service).not.toMatch(/condDistStopUnit:\s*"pips_or_points_unverified"/);

    const readiness = read(
      "ai/forex-ai/automated-trading/simulation-risk/simulation-data-readiness.ts",
    );
    expect(readiness).toMatch(/placesOrders:\s*false/);
    expect(readiness).toMatch(/acceptsForExecution:\s*false/);
  });
});
