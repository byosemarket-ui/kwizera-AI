/**
 * Stage 3 — Margin verification & position feasibility.
 * Fixtures labelled documentation/mock — not LIVE broker RO unless stated.
 */
import { describe, expect, it } from "vitest";
import {
  DOCUMENTED_DEMO_INSTRUMENT_CONTRACTS,
  buildStage3FeasibilityReport,
  evaluateInstrumentPositionFeasibility,
} from "../../../../ai/forex-ai/automated-trading/order-execution/stage3-position-feasibility.js";
import { OWNER_MAX_QUANTITY } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import { SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION } from "../../../../ai/forex-ai/automated-trading/risk-policy/slippage-evidence.js";

describe("Stage 3 — documented DEMO contracts (not LIVE)", () => {
  it("blocks owner 0.01 on typical FX pairs (min lots = 1) without raising max", () => {
    const eur = evaluateInstrumentPositionFeasibility(
      DOCUMENTED_DEMO_INSTRUMENT_CONTRACTS.find((r) => r.instrument === "EUR/USD")!,
      {
        spreadPolicyStatus: "NOT_CONFIGURED",
        slippagePolicyStatus: "NOT_CONFIGURED",
        marketClosed: true,
        dataMode: "MARKET_CLOSED",
      },
    );
    expect(eur.ownerMaxLots).toBe(OWNER_MAX_QUANTITY);
    expect(eur.riskPolicyPreserved.mayRaiseOwnerMaxLots).toBe(false);
    expect(eur.amountConversion.ok).toBe(false);
    // 1000×0.01=10 is integer AMOUNT but below minQuantity=1000 → BELOW_MIN + owner max below broker min lots.
    expect(eur.amountConversion.code).toBe("AMOUNT_BELOW_MIN_QUANTITY");
    expect(eur.quantityContract.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
    expect(eur.executionReady).toBe(false);
    expect(eur.placesOrders).toBe(false);
    expect(eur.evidenceClass).toBe("DOCUMENTATION");
  });

  it("documents XAU/USD 0.01 incompatibility (AMOUNT_NOT_INTEGER + below min)", () => {
    const xau = evaluateInstrumentPositionFeasibility(
      DOCUMENTED_DEMO_INSTRUMENT_CONTRACTS.find((r) => r.instrument === "XAU/USD")!,
      { marketClosed: true, dataMode: "MARKET_CLOSED" },
    );
    expect(xau.metadata.baseUnitSize).toBe(1);
    expect(xau.metadata.minQuantity).toBe(1);
    expect(xau.amountConversion.code).toBe("AMOUNT_NOT_INTEGER");
    expect(xau.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
    expect(xau.verdict).toBe("UNVERIFIED"); // documentation ≠ live authoritative
    expect(xau.metadata.unitInterpretation).toContain("not assumed ounces");
  });

  it("propagates Stage 1/2 blockers and never marks executionReady", () => {
    const report = buildStage3FeasibilityReport({
      rows: DOCUMENTED_DEMO_INSTRUMENT_CONTRACTS,
      marketClosed: true,
    });
    expect(report.stage3Status).toBe("NOT_RESOLVED");
    expect(report.stage3EngineeringComplete).toBe(true);
    expect(report.stage3LiveVerified).toBe(false);
    expect(report.mayRaiseOwnerMaxLots).toBe(false);
    expect(report.instruments).toHaveLength(4);
    for (const row of report.instruments) {
      expect(row.executionReady).toBe(false);
      expect(row.stage1Blockers).toContain("WAITING_FOR_OWNER_APPROVAL");
      expect(row.stage1Blockers).toContain(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
      expect(row.stage1Blockers).toContain("WAITING_FOR_LIVE_MARKET");
      expect(row.riskPolicyPreserved.perOrderRiskTargetPercent).toBe(25);
      expect(row.riskPolicyPreserved.perOrderRiskMaximumPercent).toBe(25);
      expect(row.riskPolicyPreserved.minTakeProfitR).toBe(3);
    }
  });
});

describe("Stage 3 — LIVE-labelled path still fail-closed without Stage 1", () => {
  it("live-authoritative EUR still BLOCKED when policies missing / cannot raise size for min", () => {
    const r = evaluateInstrumentPositionFeasibility({
      instrument: "EUR/USD",
      baseUnitSize: 1000,
      minQuantity: 1000,
      quantityIncrement: 1000,
      mmrPerLot: 33.3,
      usableMargin: 5000,
      accountFresh: true,
      sourceAuthoritative: true,
      evidenceSource: "live_broker",
      observedAtUtc: new Date().toISOString(),
    }, {
      spreadPolicyStatus: "NOT_CONFIGURED",
      slippagePolicyStatus: "NOT_CONFIGURED",
      dataMode: "LIVE",
      marketClosed: false,
    });
    expect(r.evidenceClass).toBe("LIVE_BROKER_RO");
    expect(r.verdict).toBe("BLOCKED");
    expect(r.executionReady).toBe(false);
    expect(r.blockers).toContain("AMOUNT_BELOW_MIN_QUANTITY");
    expect(r.blockers).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
    expect(r.blockers).toContain("WAITING_FOR_OWNER_APPROVAL");
  });

  it("missing MMR → UNAVAILABLE margin attestation (no invented value)", () => {
    const r = evaluateInstrumentPositionFeasibility({
      instrument: "GBP/USD",
      baseUnitSize: 1000,
      minQuantity: 1000,
      quantityIncrement: 1000,
      mmrPerLot: null,
      usableMargin: 5000,
      accountFresh: true,
      sourceAuthoritative: true,
      evidenceSource: "live_broker",
      observedAtUtc: new Date().toISOString(),
    });
    expect(r.marginAttestation.status).toBe("UNAVAILABLE");
    expect(r.marginEvidenceClass).toBe("MISSING");
    expect(r.blockers).toContain("MMR_PER_LOT_UNVERIFIED");
  });

  it("stale account flagged", () => {
    const r = evaluateInstrumentPositionFeasibility({
      instrument: "USD/JPY",
      baseUnitSize: 1000,
      minQuantity: 1000,
      quantityIncrement: 1000,
      mmrPerLot: 40,
      usableMargin: 100,
      accountFresh: false,
      sourceAuthoritative: true,
      evidenceSource: "live_broker",
      observedAtUtc: new Date().toISOString(),
    });
    expect(r.blockers).toContain("STALE_ACCOUNT_DATA");
    expect(r.marginEvidenceClass).toBe("STALE_ACCOUNT");
  });
});

describe("Stage 3 — catalog mapper (fixture-labelled)", () => {
  it("maps four tracked symbols and keeps missing rows unverified", async () => {
    const { buildStage3FeasibilityFromInstrumentCatalog } = await import(
      "../../../../ai/forex-ai/automated-trading/order-execution/stage3-live-ro.js"
    );
    const report = buildStage3FeasibilityFromInstrumentCatalog({
      instruments: [
        { providerSymbol: "EUR/USD", baseUnitSize: 1000, minQuantity: 1000, lotStep: 1000, mmrPerLot: null },
        { providerSymbol: "XAU/USD", baseUnitSize: 1, minQuantity: 1, lotStep: 1, mmrPerLot: 4.42 },
      ],
      evidenceSource: "mock_fixture",
      sourceAuthoritative: false,
      marketClosed: true,
      usableMargin: 1000,
      accountFresh: true,
    });
    expect(report.instruments).toHaveLength(4);
    const eur = report.instruments.find((i) => i.instrument === "EUR/USD")!;
    const gbp = report.instruments.find((i) => i.instrument === "GBP/USD")!;
    const xau = report.instruments.find((i) => i.instrument === "XAU/USD")!;
    expect(eur.metadata.baseUnitSize).toBe(1000);
    expect(gbp.metadata.baseUnitSize).toBeNull();
    expect(xau.amountConversion.code).toBe("AMOUNT_NOT_INTEGER");
    expect(report.stage3Status).toBe("NOT_RESOLVED");
    expect(report.instruments.every((i) => i.executionReady === false)).toBe(true);
  });
});
