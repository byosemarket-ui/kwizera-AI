/**
 * Stage 1 Part 3 — spread evidence integrity, owner propose≠approve,
 * XAU 0.30 stability analysis, missing fills/MMR, controlled DEMO plan (no orders).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// os/path used for temp-store leak regression
import { afterEach, describe, expect, it } from "vitest";
import {
  AtRiskPolicyStore,
  buildStage1Part3SlippageDemoPlan,
  buildStage1ReadinessReport,
  compareLiveSpreadToPendingOrActiveLimit,
  computeExecutionSlippage,
  draftSpreadRecommendation,
  documentedPrecision,
  resetAtRiskPolicyStoreForTests,
  resetStage1EvidenceStoreForTests,
  resolveSpreadLimit,
  summarizeSlippageEvidence,
  validateSlippageFillEvidence,
  SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION,
  type LiveSpreadObservationRecord,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/index.js";

const tmpDirs: string[] = [];
afterEach(() => {
  resetAtRiskPolicyStoreForTests();
  resetStage1EvidenceStoreForTests();
  for (const d of tmpDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s1-p3-"));
  tmpDirs.push(dir);
  return resetAtRiskPolicyStoreForTests(path.join(dir, "risk-policy.json"));
}

function liveObs(
  instrument: "EUR/USD" | "GBP/USD" | "USD/JPY" | "XAU/USD",
  bid: number,
  ask: number,
  i: number,
): LiveSpreadObservationRecord {
  const t0 = Date.parse("2026-11-09T13:29:10.000Z");
  return {
    observationId: `${instrument}-${i}`,
    instrument,
    bid,
    ask,
    spreadAbsolute: ask - bid,
    observedAtUtc: new Date(t0 + i * 6_000).toISOString(),
    provenance: "LIVE",
    provider: "FOREXCONNECT",
    sourceType: "Offers",
    marketStatus: "OPEN",
    freshnessStatus: "FRESH",
    units: "absolute_price",
    pricePrecision: documentedPrecision(instrument),
    independent: true,
  };
}

describe("Stage 1 Part 3 — XAU/USD stable 0.30 spread", () => {
  it("treats moving bid/ask with constant 0.30 spread as independent LIVE evidence", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      liveObs("XAU/USD", 4125.0 + i * 0.05, 4125.3 + i * 0.05, i),
    );
    const pairs = new Set(rows.map((r) => `${r.bid}|${r.ask}`));
    expect(pairs.size).toBe(20);
    const draft = draftSpreadRecommendation({ instrument: "XAU/USD", acceptedLive: rows });
    expect(draft.sufficient).toBe(true);
    expect(draft.recommendedMaxSpreadAbsolute).toBe(0.3);
    expect(documentedPrecision("XAU/USD")).toBe(2);
    // All spreads equal 0.30 within float — genuine broker tick size / quoted spread, not stuck quote.
    expect(draft.minSpread).toBeCloseTo(0.3, 10);
    expect(draft.maxSpread).toBeCloseTo(0.3, 10);
    expect(Math.abs((draft.maxSpread ?? 0) - (draft.minSpread ?? 1))).toBeLessThan(1e-9);
  });
});

describe("Stage 1 Part 3 — spread stats + proposal integrity", () => {
  it("recomputes min/mean/max/p95 and rounds EUR draft to documented precision", () => {
    const rows = Array.from({ length: 20 }, (_, i) => {
      const spread = i % 3 === 0 ? 0.00012 : i % 3 === 1 ? 0.00013 : 0.00014;
      const bid = 1.12 + i * 0.00001;
      return liveObs("EUR/USD", bid, bid + spread, i);
    });
    const draft = draftSpreadRecommendation({ instrument: "EUR/USD", acceptedLive: rows });
    expect(draft.validObservationCount).toBe(20);
    expect(draft.minSpread).toBeCloseTo(0.00012, 10);
    expect(draft.maxSpread).toBeCloseTo(0.00014, 10);
    expect(draft.p95Spread).toBeCloseTo(0.00014, 10);
    expect(draft.recommendedMaxSpreadAbsolute).toBe(0.00014);
    expect(draft.autoApproved).toBe(false);
    expect(draft.mayActivateWithoutOwner).toBe(false);
  });

  it("propose leaves spread inactive until owner approve+confirm", () => {
    const store = tempStore();
    const proposed = store.proposeSpread({
      instrument: "EUR/USD",
      maxSpreadAbsolute: 0.00014,
      actor: "admin-test",
      note: "Part3 evidence draft max",
    });
    expect(proposed.ok).toBe(true);
    const resolved = resolveSpreadLimit({ instrument: "EUR/USD", store });
    expect(resolved.status).not.toBe("VERIFIED");
    expect(resolved.status).toBe("NOT_CONFIGURED");
    const inst = store.getInstrument("EUR/USD")!;
    expect(inst.spread.approvalState).toBe("PENDING_APPROVAL");
    expect(inst.spread.proposed?.value).toBe(0.00014);
    expect(inst.spread.maxSpreadAbsolute).toBeNull();
  });

  it("owner approve without confirm is rejected", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "GBP/USD", maxSpreadAbsolute: 0.00013, actor: "admin" });
    const denied = store.approveSpread({
      instrument: "GBP/USD",
      confirm: false,
      actor: "owner",
    });
    expect(denied.ok).toBe(false);
    expect(String(denied.status)).toMatch(/CONFIRM/i);
  });
});

describe("Stage 1 Part 3 — slippage fills + missing evidence", () => {
  it("computes slippage from reference vs fill only", () => {
    const buy = computeExecutionSlippage({
      direction: "BUY",
      referencePrice: 1.1,
      executionPrice: 1.1002,
    });
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    expect(buy.adverseAbsolute).toBeCloseTo(0.0002, 10);
    expect(buy.absoluteSlippage).toBeCloseTo(0.0002, 10);
  });

  it("missing fills → controlled DEMO blocker; synthetic rejected", () => {
    const empty = summarizeSlippageEvidence({ instrument: "EUR/USD", productionFills: [] });
    expect(empty.status).toBe(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
    const syn = validateSlippageFillEvidence({
      instrument: "EUR/USD",
      direction: "BUY",
      referencePrice: 1.1,
      executionPrice: 1.1001,
      fillTimestampUtc: new Date().toISOString(),
      executionIdentifier: "x",
      provenance: "SYNTHETIC_TEST_DATA",
    });
    expect(syn.ok).toBe(false);
    expect(syn.blockers).toContain("SYNTHETIC_NOT_PRODUCTION_EVIDENCE");
  });
});

describe("Stage 1 Part 3 — controlled DEMO plan + readiness", () => {
  it("plan excludes GBP/JPY MMR blockers and never authorizes orders", () => {
    const plan = buildStage1Part3SlippageDemoPlan({ usableMarginUsd: 19997.4 });
    expect(plan.placesOrders).toBe(false);
    expect(plan.mayCallCreateOrderRequest).toBe(false);
    expect(plan.realDemoFillAuthorizedByThisPlan).toBe(false);
    expect(plan.eligibleInstruments.map((i) => i.instrument)).toEqual(["EUR/USD", "XAU/USD"]);
    expect(plan.excludedInstruments.every((e) => e.blocker === "MMR_PER_LOT_UNVERIFIED")).toBe(true);
    expect(plan.fillCampaign.minimumFillsPerInstrument).toBe(20);
    expect(plan.fillCampaign.limitGtcMayNeverFill).toBe(true);
    expect(plan.fillCampaign.requiresSeparateOwnerAuthorizedCycles).toBe(true);
    for (const row of plan.eligibleInstruments) {
      expect(row.estimatedModeledLossUsd).toBeLessThanOrEqual(row.allowedRiskAmountUsd + 1e-9);
      expect(row.proposedBrokerAmount).toBe(row.baseUnitSize * row.proposedLots);
    }
  });

  it("advises when LIVE GBP spread exceeds pending 0.00013 without changing policy", () => {
    const check = compareLiveSpreadToPendingOrActiveLimit({
      instrument: "GBP/USD",
      liveSpreadAbsolute: 0.00015,
      pendingProposedValue: 0.00013,
      activeApprovedValue: null,
    });
    expect(check.exceedsComparedLimit).toBe(true);
    expect(check.relation).toBe("LIVE_EXCEEDS_PENDING_OR_ACTIVE_LIMIT");
    expect(check.mayChangePolicyValue).toBe(false);
    expect(check.comparedAgainstValue).toBe(0.00013);
  });

  it("resetAtRiskPolicyStoreForTests defaults to OS temp, not repo cwd", () => {
    const store = resetAtRiskPolicyStoreForTests();
    expect(store.persistencePath.includes(os.tmpdir())).toBe(true);
    expect(path.normalize(store.persistencePath).startsWith(path.normalize(process.cwd() + path.sep))).toBe(false);
  });

  it("readiness stays NOT_RESOLVED without approved spread+slippage", () => {
    const accepted: Record<string, LiveSpreadObservationRecord[]> = {
      "EUR/USD": Array.from({ length: 20 }, (_, i) => liveObs("EUR/USD", 1.1, 1.10014, i)),
      "GBP/USD": Array.from({ length: 20 }, (_, i) => liveObs("GBP/USD", 1.3, 1.30013, i)),
      "USD/JPY": Array.from({ length: 20 }, (_, i) => liveObs("USD/JPY", 150, 150.013, i)),
      "XAU/USD": Array.from({ length: 20 }, (_, i) => liveObs("XAU/USD", 2600 + i, 2600.3 + i, i)),
    };
    const report = buildStage1ReadinessReport({
      marketOpen: true,
      acceptedSpreadByInstrument: accepted as never,
      slippageFillsByInstrument: {
        "EUR/USD": [],
        "GBP/USD": [],
        "USD/JPY": [],
        "XAU/USD": [],
      },
    });
    expect(report.stageComplete).toBe(false);
    expect(report.completionCode).toBe("NOT_RESOLVED");
    expect(report.tradingSafety.placesOrders).toBe(false);
    expect(report.instruments.every((i) => i.overall !== "RESOLVED")).toBe(true);
  });
});
