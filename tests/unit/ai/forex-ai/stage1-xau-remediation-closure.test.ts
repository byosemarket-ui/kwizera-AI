/**
 * KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING → XAU/USD
 * Stage 1 closure remediation — spread governance clarity, slippage ingest, post-entry plan.
 * TEST FIXTURES only — never LIVE broker mutations.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decidePerTradeEconomicFeasibility,
  DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/index.js";
import {
  fixtureRollingSpreads,
  fixtureXauUsdContract,
} from "../../../../ai/forex-ai/automated-trading/dynamic-spread/test-fixtures.js";
import {
  ingestSlippageFillEvidence,
  mapBrokerTradeRowToSlippageCandidate,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-slippage-fill-ingest.js";
import {
  resetStage1EvidenceStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-evidence-store.js";
import {
  buildStage1ReadinessReport,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-readiness.js";
import {
  ownerApprovalRequirements,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/observation-evidence.js";
import {
  planPostEntryManagement,
} from "../../../../ai/forex-ai/automated-trading/post-entry/index.js";

const NOW = Date.parse("2026-11-12T00:00:00.000Z");

function xauInput(over: Record<string, unknown> = {}) {
  const spread = typeof over.spreadAbsolute === "number" ? over.spreadAbsolute : 0.30;
  const { spreadAbsolute: _s, ...rest } = over as { spreadAbsolute?: number };
  return {
    instrument: "XAU/USD",
    expectedInstrument: "XAU/USD",
    bid: 4000,
    ask: 4000 + spread,
    quoteAgeMs: 150,
    quoteMaxAgeMs: 5_000,
    quoteTimestampUtc: new Date(NOW).toISOString(),
    quoteId: "q-xau",
    provenance: "LIVE",
    feedConnected: true,
    marketStatus: "OPEN" as const,
    historicalSpreads: fixtureRollingSpreads({
      n: DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
      baseSpread: 0.30,
      instrument: "XAU/USD",
      nowMs: NOW,
    }),
    direction: "BUY" as const,
    entryPrice: 4000,
    stopLoss: 3990,
    takeProfit: 4050,
    quantityLots: 1,
    brokerAmount: 1,
    baseUnitSize: 1,
    contract: fixtureXauUsdContract(),
    orderAllocationAccount: 40,
    allocationId: "alloc-1",
    proposalId: "prop-1",
    accountCurrency: "USD",
    commissionVerified: false,
    slippageEvidenceAvailable: false,
    legacyMaxSpreadAbsolute: null,
    nowMs: NOW,
    ...rest,
  };
}

describe("Stage 1 closure — spread governance (historical 0.30 not a gate)", () => {
  it("ownerApprovalRequirements no longer mandates maxSpreadAbsolute for ACTIVE XAU", () => {
    const r = ownerApprovalRequirements();
    expect(r.fieldsPerInstrument).toEqual(["slippage.maxSlippageAbsolute"]);
    expect(r.optionalEmergencyFields).toContain("spread.maxSpreadAbsolute");
    expect(r.note).toMatch(/DYNAMIC_PER_TRADE/);
  });

  it("high spread can ACCEPT when economics pass; low spread can REJECT when net <3R", () => {
    const high = decidePerTradeEconomicFeasibility(xauInput({
      spreadAbsolute: 0.80,
      takeProfit: 4080,
    }));
    expect(high.decision).toBe("ACCEPT");
    expect(high.fixedCeilingIsPrimaryEligibility).toBe(false);

    const lowBad = decidePerTradeEconomicFeasibility(xauInput({
      spreadAbsolute: 0.20,
      takeProfit: 4015,
    }));
    expect(lowBad.decision).toBe("REJECT");
    expect(lowBad.reasonCodes).toContain("NET_REWARD_BELOW_3R");
  });

  it("Stage1 XAU overall waits for DEMO fills — not WAITING_FOR_OWNER_APPROVAL on missing 0.30", () => {
    const report = buildStage1ReadinessReport({
      nowMs: NOW,
      marketOpen: true,
      store: { getInstrument: () => null },
      acceptedSpreadByInstrument: {
        "XAU/USD": fixtureRollingSpreads({
          n: 25,
          baseSpread: 0.30,
          instrument: "XAU/USD",
          nowMs: NOW,
        }).map((s, i) => ({
          observationId: `obs-${i}`,
          instrument: "XAU/USD" as const,
          bid: 4000,
          ask: 4000 + s.spreadAbsolute,
          spreadAbsolute: s.spreadAbsolute,
          observedAtUtc: s.observedAtUtc,
          provider: "FOREXCONNECT",
          sourceType: "OFFERS",
          marketStatus: "OPEN" as const,
          freshnessStatus: "FRESH" as const,
          provenance: "LIVE" as const,
          units: "absolute_price" as const,
          pricePrecision: 2,
          independent: true as const,
        })),
      },
      slippageFillsByInstrument: { "XAU/USD": [] },
    });
    const xau = report.instruments.find((i) => i.instrument === "XAU/USD")!;
    expect(xau.overall).toBe("WAITING_FOR_CONTROLLED_DEMO_EVIDENCE");
    expect(xau.overall).not.toBe("WAITING_FOR_OWNER_APPROVAL");
    expect(xau.spreadEvidence.note).toMatch(/DYNAMIC_PER_TRADE|not required/i);
  });
});

describe("Stage 1 closure — slippage fill ingest", () => {
  it("accepts genuine BROKER_EXECUTION; rejects synthetic/duplicate/wrong instrument/missing fields", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-slip-"));
    const store = resetStage1EvidenceStoreForTests(path.join(dir, "evidence.json"));

    const ok = ingestSlippageFillEvidence({
      instrument: "XAU/USD",
      direction: "BUY",
      referencePrice: 4000,
      executionPrice: 4000.4,
      fillTimestampUtc: new Date(NOW).toISOString(),
      executionIdentifier: "fill-1",
      brokerResponseId: "br-1",
      provenance: "BROKER_EXECUTION",
    }, store);
    expect(ok.accepted).toBe(true);
    expect(ok.countForInstrument).toBe(1);
    expect(ok.record?.adverseAbsolute).toBeCloseTo(0.4, 6);

    const dup = ingestSlippageFillEvidence({
      instrument: "XAU/USD",
      direction: "BUY",
      referencePrice: 4000,
      executionPrice: 4000.5,
      fillTimestampUtc: new Date(NOW).toISOString(),
      executionIdentifier: "fill-1",
      provenance: "BROKER_EXECUTION",
    }, store);
    expect(dup.accepted).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(store.getSlippageFills("XAU/USD")).toHaveLength(1);

    const synth = ingestSlippageFillEvidence({
      instrument: "XAU/USD",
      direction: "SELL",
      referencePrice: 4000,
      executionPrice: 3999.5,
      fillTimestampUtc: new Date(NOW).toISOString(),
      executionIdentifier: "fill-synth",
      provenance: "SYNTHETIC_TEST_DATA",
    }, store);
    expect(synth.accepted).toBe(false);
    expect(synth.code).toBe("SYNTHETIC_NOT_PRODUCTION_EVIDENCE");
    expect(store.getSlippageFills("XAU/USD")).toHaveLength(1);

    const eur = ingestSlippageFillEvidence({
      instrument: "EUR/USD",
      direction: "BUY",
      referencePrice: 1.1,
      executionPrice: 1.1002,
      fillTimestampUtc: new Date(NOW).toISOString(),
      executionIdentifier: "fill-eur",
      provenance: "BROKER_EXECUTION",
    }, store);
    expect(eur.accepted).toBe(false);
    expect(eur.code).toBe("INSTRUMENT_OUT_OF_SCOPE");

    const mapped = mapBrokerTradeRowToSlippageCandidate({
      instrument: "XAU/USD",
      direction: "BUY",
      // missing reference/execution
      tradeId: "t-1",
    });
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) expect(mapped.missing).toEqual(
      expect.arrayContaining(["referencePrice", "executionPrice", "fillTimestampUtc"]),
    );

    const sell = ingestSlippageFillEvidence({
      instrument: "XAU/USD",
      direction: "SELL",
      referencePrice: 4000,
      executionPrice: 3999.2,
      fillTimestampUtc: new Date(NOW).toISOString(),
      executionIdentifier: "fill-2",
      provenance: "BROKER_EXECUTION",
    }, store);
    expect(sell.accepted).toBe(true);
    expect(sell.record?.adverseAbsolute).toBeCloseTo(0.8, 6);

    // Persistence across store reopen
    const store2 = resetStage1EvidenceStoreForTests(path.join(dir, "evidence.json"));
    expect(store2.getSlippageFills("XAU/USD").length).toBe(2);
  });

  it("wrong environment / account rejected", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-slip-env-"));
    const store = resetStage1EvidenceStoreForTests(path.join(dir, "evidence.json"));
    const r = ingestSlippageFillEvidence({
      instrument: "XAU/USD",
      direction: "BUY",
      referencePrice: 4000,
      executionPrice: 4000.1,
      fillTimestampUtc: new Date(NOW).toISOString(),
      executionIdentifier: "fill-env",
      provenance: "BROKER_EXECUTION",
      expectedEnvironment: "DEMO",
      observedEnvironment: "LIVE",
    }, store);
    expect(r.accepted).toBe(false);
    expect(r.code).toBe("WRONG_ACCOUNT_OR_ENVIRONMENT");
  });
});

describe("Stage 1 closure — post-entry planning (no broker mutation)", () => {
  it("plans trailing without widening; floors partial close; never authorizes mutation", () => {
    const plan = planPostEntryManagement({
      instrument: "XAU/USD",
      positionId: "pos-1",
      direction: "BUY",
      entryPrice: 4000,
      currentPrice: 4010,
      originalStopLoss: 3990,
      takeProfit: 4050,
      openQuantityLots: 2,
      quoteAgeMs: 100,
      quantityStep: 1,
      quantityMin: 1,
      trailingDistancePrice: 5,
      partialCloseFraction: 0.5,
    });
    expect(plan.decision).toBe("PLAN_READY");
    expect(plan.trailing.proposedStopLoss).toBe(4005);
    expect(plan.trailing.widensRisk).toBe(false);
    expect(plan.trailing.brokerMutationAuthorized).toBe(false);
    expect(plan.partialClose.proposedCloseLots).toBe(1);
    expect(plan.partialClose.remainingLots).toBe(1);
    expect(plan.partialClose.brokerMutationAuthorized).toBe(false);
    expect(plan.brokerSlModification.authorized).toBe(false);
    expect(plan.mutatesBroker).toBe(false);

    const widen = planPostEntryManagement({
      instrument: "XAU/USD",
      positionId: "pos-2",
      direction: "BUY",
      entryPrice: 4000,
      currentPrice: 3995,
      originalStopLoss: 3990,
      openQuantityLots: 1,
      quoteAgeMs: 100,
      trailingDistancePrice: 20, // would place SL at 3975 < 3990 → widen
    });
    expect(widen.trailing.proposedStopLoss).toBeNull();
    expect(widen.reasonCodes).toContain("PROTECTIVE_SL_WIDEN_REJECTED");

    const stale = planPostEntryManagement({
      instrument: "XAU/USD",
      positionId: "pos-3",
      direction: "BUY",
      entryPrice: 4000,
      currentPrice: 4010,
      originalStopLoss: 3990,
      openQuantityLots: 1,
      quoteAgeMs: 60_000,
    });
    expect(stale.decision).toBe("REJECTED");
    expect(stale.primaryReasonCode).toBe("QUOTE_STALE");
  });
});
