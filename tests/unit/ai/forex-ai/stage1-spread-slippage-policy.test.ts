/**
 * Stage 1 — Spread/slippage policy evidence & fail-closed readiness.
 * Labels: SYNTHETIC_TEST_DATA where fixtures are used — not production LIVE evidence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeSpreadAbsolute,
  evaluateSpreadObservationQuality,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/observation-evidence.js";
import {
  ingestSpreadObservation,
  stage1SpreadCollectionGate,
  summarizeInstrumentSpreadEvidence,
  type LiveSpreadObservationRecord,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/spread-observation-collector.js";
import { draftSpreadRecommendation } from "../../../../ai/forex-ai/automated-trading/risk-policy/spread-recommendation.js";
import {
  SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION,
  computeExecutionSlippage,
  getSlippageEvidenceCollectionWorkflow,
  summarizeSlippageEvidence,
  validateSlippageFillEvidence,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/slippage-evidence.js";
import {
  buildStage1ReadinessReport,
  rejectStaleXau030AsPolicyEvidence,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-readiness.js";
import {
  AtRiskPolicyStore,
  resetAtRiskPolicyStoreForTests,
  resolveSpreadLimit,
  resolveSlippageLimit,
  documentedPrecision,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/index.js";
const tmpDirs: string[] = [];
afterEach(() => {
  resetAtRiskPolicyStoreForTests();
  for (const d of tmpDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s1-rp-"));
  tmpDirs.push(dir);
  return resetAtRiskPolicyStoreForTests(path.join(dir, "risk-policy.json"));
}

describe("Stage 1 — spread calculation & precision", () => {
  it("computes ask−bid absolute_price spread and documented precision", () => {
    expect(computeSpreadAbsolute(1.1000, 1.1002)).toBeCloseTo(0.0002, 10);
    expect(computeSpreadAbsolute(1.1, 1.05)).toBeNull();
    expect(documentedPrecision("EUR/USD")).toBe(5);
    expect(documentedPrecision("USD/JPY")).toBe(3);
    expect(documentedPrecision("XAU/USD")).toBe(2);
  });

  it("rejects CACHED/STALE/SYNTHETIC as LIVE recommendation evidence", () => {
    const now = new Date().toISOString();
    for (const provenance of ["CACHED", "STALE", "HISTORICAL", "SYNTHETIC_TEST_DATA"] as const) {
      const q = evaluateSpreadObservationQuality({
        observation: {
          instrument: "XAU/USD",
          bid: 2650,
          ask: 2650.3,
          spreadAbsolute: 0.3,
          observedAtUtc: now,
          provenance,
          source: "fixture",
        },
        marketOpen: true,
      });
      expect(q.usableForRecommendation).toBe(false);
    }
    const staleXau = rejectStaleXau030AsPolicyEvidence();
    expect(staleXau.accepted).toBe(false);
    expect(staleXau.mayUseAsThreshold).toBe(false);
  });
});

describe("Stage 1 — independent LIVE observation collector", () => {
  it("returns WAITING_FOR_LIVE_MARKET when market closed (no fabrication)", () => {
    const r = ingestSpreadObservation({
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      observedAtUtc: new Date().toISOString(),
      provider: "FXCM",
      sourceType: "Offers",
      marketStatus: "CLOSED",
      freshnessStatus: "FRESH",
      provenance: "LIVE",
    });
    expect(r.status).toBe("WAITING_FOR_LIVE_MARKET");
    expect(r.record).toBeNull();
    expect(r.mutatesBroker).toBe(false);
  });

  it("rejects repeated snapshots and requires time gap for independence", () => {
    const t0 = Date.parse("2026-11-10T12:00:00.000Z");
    const first = ingestSpreadObservation({
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      observedAtUtc: new Date(t0).toISOString(),
      provider: "FXCM",
      sourceType: "Offers",
      marketStatus: "OPEN",
      freshnessStatus: "FRESH",
      provenance: "LIVE",
      observationId: "obs-1",
      nowMs: t0 + 1000,
    });
    expect(first.status).toBe("ACCEPTED_LIVE");
    const prior = [first.record!];

    const dupId = ingestSpreadObservation({
      instrument: "EUR/USD",
      bid: 1.1001,
      ask: 1.1003,
      observedAtUtc: new Date(t0 + 10_000).toISOString(),
      provider: "FXCM",
      sourceType: "Offers",
      marketStatus: "OPEN",
      freshnessStatus: "FRESH",
      provenance: "LIVE",
      observationId: "obs-1",
      priorAccepted: prior,
      nowMs: t0 + 10_000,
    });
    expect(dupId.status).toBe("DUPLICATE_NOT_INDEPENDENT");

    const tooSoon = ingestSpreadObservation({
      instrument: "EUR/USD",
      bid: 1.1001,
      ask: 1.1003,
      observedAtUtc: new Date(t0 + 1000).toISOString(),
      provider: "FXCM",
      sourceType: "Offers",
      marketStatus: "OPEN",
      freshnessStatus: "FRESH",
      provenance: "LIVE",
      observationId: "obs-2",
      priorAccepted: prior,
      nowMs: t0 + 2000,
    });
    expect(tooSoon.code).toBe("INSUFFICIENT_TIME_GAP");
  });

  it("weekend gate reports WAITING_FOR_LIVE_MARKET", () => {
    // Sunday 12:00 UTC — before typical reopen
    const sun = Date.parse("2026-11-08T12:00:00.000Z");
    const g = stage1SpreadCollectionGate(sun);
    expect(g.code).toBe("WAITING_FOR_LIVE_MARKET");
    expect(g.collectionStatus).toBe("WAITING_FOR_LIVE_MARKET");
  });
});

describe("Stage 1 — recommendation stats (never auto-approve)", () => {
  it("refuses recommendation without 20 samples; drafts from max when sufficient", () => {
    const base = Date.parse("2026-11-10T12:00:00.000Z");
    const few: LiveSpreadObservationRecord[] = Array.from({ length: 5 }, (_, i) => ({
      observationId: `e-${i}`,
      instrument: "EUR/USD" as const,
      bid: 1.1,
      ask: 1.1 + 0.0001 * (i + 1),
      spreadAbsolute: 0.0001 * (i + 1),
      observedAtUtc: new Date(base + i * 10_000).toISOString(),
      provider: "FXCM",
      sourceType: "Offers",
      marketStatus: "OPEN" as const,
      freshnessStatus: "FRESH" as const,
      provenance: "LIVE" as const,
      units: "absolute_price" as const,
      pricePrecision: 5,
      independent: true as const,
    }));
    const d1 = draftSpreadRecommendation({ instrument: "EUR/USD", acceptedLive: few });
    expect(d1.sufficient).toBe(false);
    expect(d1.recommendedMaxSpreadAbsolute).toBeNull();
    expect(d1.autoApproved).toBe(false);

    const many: LiveSpreadObservationRecord[] = Array.from({ length: 20 }, (_, i) => ({
      ...few[0]!,
      observationId: `m-${i}`,
      ask: 1.1 + 0.0001 * ((i % 5) + 1),
      spreadAbsolute: 0.0001 * ((i % 5) + 1),
      observedAtUtc: new Date(base + i * 10_000).toISOString(),
    }));
    const d2 = draftSpreadRecommendation({ instrument: "EUR/USD", acceptedLive: many });
    expect(d2.sufficient).toBe(true);
    expect(d2.recommendedMaxSpreadAbsolute).toBeCloseTo(0.0005, 10);
    expect(d2.mayActivateWithoutOwner).toBe(false);
    expect(d2.p95Spread).not.toBeNull();

    const syn = draftSpreadRecommendation({
      instrument: "EUR/USD",
      acceptedLive: many,
      syntheticTestData: true,
    });
    expect(syn.evidenceQuality).toBe("SYNTHETIC_TEST_ONLY");
    expect(syn.recommendedMaxSpreadAbsolute).toBeNull();
  });
});

describe("Stage 1 — slippage evidence (no order submission)", () => {
  it("computes BUY/SELL adverse absolute slippage", () => {
    const buy = computeExecutionSlippage({ direction: "BUY", referencePrice: 1.1, executionPrice: 1.1003 });
    expect(buy.ok).toBe(true);
    if (buy.ok) {
      expect(buy.adverseAbsolute).toBeCloseTo(0.0003, 10);
      expect(buy.absoluteSlippage).toBeCloseTo(0.0003, 10);
    }
    const sell = computeExecutionSlippage({ direction: "SELL", referencePrice: 1.1, executionPrice: 1.0997 });
    expect(sell.ok).toBe(true);
    if (sell.ok) expect(sell.adverseAbsolute).toBeCloseTo(0.0003, 10);
  });

  it("reports SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION without fills", () => {
    const s = summarizeSlippageEvidence({ instrument: "EUR/USD", productionFills: [] });
    expect(s.status).toBe(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
    expect(s.maySubmitOrderToCollect).toBe(false);
    expect(s.recommendedMaxSlippageAbsolute).toBeNull();
    const wf = getSlippageEvidenceCollectionWorkflow();
    expect(wf.maySubmitOrderInStage1).toBe(false);

    const missing = validateSlippageFillEvidence({
      instrument: "EUR/USD",
      direction: "BUY",
      referencePrice: null,
      executionPrice: 1.1,
      fillTimestampUtc: new Date().toISOString(),
      executionIdentifier: "x",
      provenance: "BROKER_EXECUTION",
    });
    expect(missing.ok).toBe(false);
    expect(missing.blockers).toContain("MISSING_REFERENCE_PRICE");
  });
});

describe("Stage 1 — fail-closed + instrument isolation + owner confirm", () => {
  it("missing policies fail closed per instrument; EUR approval does not satisfy GBP", () => {
    const store = tempStore();
    for (const inst of ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"] as const) {
      expect(resolveSpreadLimit({ instrument: inst, store }).status).toBe("NOT_CONFIGURED");
      expect(resolveSlippageLimit({ instrument: inst, store }).status).toBe("NOT_CONFIGURED");
    }
    const proposed = store.proposeSpread({
      instrument: "EUR/USD",
      maxSpreadAbsolute: 0.0003,
      actor: "admin",
      expectedVersion: store.get().version,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const noConfirm = store.approveSpread({
      instrument: "EUR/USD",
      actor: "owner",
      confirm: false,
      expectedVersion: proposed.document.version,
    });
    expect(noConfirm.ok).toBe(false);
    if (!noConfirm.ok) expect(noConfirm.status).toBe("CONFIRMATION_REQUIRED");

    const approved = store.approveSpread({
      instrument: "EUR/USD",
      actor: "owner",
      confirm: true,
      expectedVersion: proposed.document.version,
    });
    expect(approved.ok).toBe(true);
    expect(resolveSpreadLimit({ instrument: "EUR/USD", store }).status).toBe("VERIFIED");
    expect(resolveSpreadLimit({ instrument: "GBP/USD", store }).status).toBe("NOT_CONFIGURED");
    expect(resolveSlippageLimit({ instrument: "GBP/USD", store }).status).toBe("NOT_CONFIGURED");
    expect(resolveSpreadLimit({ instrument: "XAU/USD", store }).status).toBe("NOT_CONFIGURED");
  });

  it("Stage 1 readiness is NOT_RESOLVED while market closed / no policies", () => {
    const store = tempStore();
    const sun = Date.parse("2026-11-08T12:00:00.000Z");
    const report = buildStage1ReadinessReport({
      nowMs: sun,
      marketOpen: false,
      store,
    });
    expect(report.stageComplete).toBe(false);
    expect(report.completionCode).toBe("NOT_RESOLVED");
    expect(report.marketGate.code).toBe("WAITING_FOR_LIVE_MARKET");
    expect(report.tradingSafety.mayInventThresholds).toBe(false);
    for (const row of report.instruments) {
      expect(row.overall).toBe("WAITING_FOR_LIVE_MARKET");
      expect(row.spreadPolicyStatus).toBe("NOT_CONFIGURED");
      expect(row.slippagePolicyStatus).toBe("NOT_CONFIGURED");
      expect(row.slippageEvidence.status).toBe(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
      expect(row.staleXau030Rejected).toBe(true);
    }
  });
});
