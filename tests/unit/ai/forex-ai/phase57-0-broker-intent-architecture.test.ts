/**
 * Phase 57.0 — Broker-intent architecture, disabled mutation, preflight, recon, safety.
 * No broker mutation is invoked. Mocks/fixtures only.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBrokerCapabilityMatrix,
  getDisabledBrokerMutationAdapter,
  evaluateProtectiveGeometry,
  evaluateUnprotectedFillPolicy,
  evaluateBrokerIntentPreflight,
  reconcileBrokerIntentWithRoObservation,
  interpretOrderAcknowledgment,
  dedupeObservedIds,
  AtBrokerIntentStore,
  AtBrokerIntentEngine,
  resetAtBrokerIntentStoreForTests,
  resetAtBrokerIntentEngineForTests,
  type BrokerIntentPreflightInput,
} from "../../../../ai/forex-ai/automated-trading/broker-intent/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function baseInput(over: Partial<BrokerIntentPreflightInput> = {}): BrokerIntentPreflightInput {
  return {
    idempotencyKey: `key_${Math.random().toString(36).slice(2, 10)}`,
    environment: "DEMO",
    environmentVerified: true,
    accountIdMasked: "***9634",
    accountStateVerified: true,
    instrument: "XAU/USD",
    direction: "BUY",
    quantity: 2,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractSizeVerified: true,
    pointSize: 0.01,
    entryPrice: 4000,
    stopLoss: 3990,
    takeProfit: 4030,
    quoteFresh: true,
    quotePresent: true,
    strategyAllocationPercent: 10,
    perOrderAllocation: 100,
    estimatedSlLossAccount: 20,
    sourceDraftId: "draft_x",
    sourceDecisionId: null,
    masterEnable: false,
    emergencyEntryLock: true,
    placesOrders: false,
    acceptsForExecution: false,
    forexConnectTradingEnabled: false,
    automaticEntryEnabled: false,
    automaticReentryEnabled: false,
    duplicateIdempotencyKey: false,
    exposureReconciliationRequired: false,
    protectionCapabilityVerified: true,
    ownerExecutionAuthorized: false,
    requireProtective: true,
    requireThreeR: true,
    ...over,
  };
}

describe("Phase 57.0 capability matrix and disabled mutation", () => {
  it("stamps RO capabilities and all mutation DISABLED", () => {
    const m = buildBrokerCapabilityMatrix();
    expect(m.tradingEnabled).toBe(false);
    expect(m.placesOrders).toBe(false);
    expect(m.mutatesBroker).toBe(false);
    expect(m.capabilities.READ_ONLY_ORDERS).toBe(true);
    expect(m.capabilities.ORDER_SUBMISSION_DISABLED).toBe(true);
    expect(m.capabilities.POSITION_CLOSURE_DISABLED).toBe(true);
    expect(m.capabilities.PROTECTIVE_ORDER_MUTATION_DISABLED).toBe(true);
  });

  it("disabled adapter rejects every mutation op with EXECUTION_FORBIDDEN", () => {
    const a = getDisabledBrokerMutationAdapter();
    for (const r of [
      a.submit({}),
      a.modify("x", {}),
      a.cancel("x"),
      a.closePosition("x"),
      a.attachProtective({}),
      a.amendProtective({}),
      a.cancelProtective({}),
    ]) {
      expect(r.ok).toBe(false);
      expect(r.code).toBe("EXECUTION_FORBIDDEN");
      expect(r.placesOrders).toBe(false);
      expect(r.mutatesBroker).toBe(false);
      expect(r.tradingEnabled).toBe(false);
    }
  });
});

describe("Phase 57.0 protective geometry", () => {
  it("rejects invalid BUY SL/TP geometry and missing protective levels", () => {
    const missing = evaluateProtectiveGeometry({
      direction: "BUY",
      entryPrice: 4000,
      stopLoss: null,
      takeProfit: null,
      requireProtective: true,
      requireThreeR: true,
    });
    expect(missing.ok).toBe(false);
    expect(missing.brokerProtected).toBe(false);
    expect(missing.protectiveStatus).toBe("LOCAL_CALCULATED_ONLY");
    expect(missing.rejections.some((r) => r.code === "STOP_LOSS_REQUIRED")).toBe(true);

    const bad = evaluateProtectiveGeometry({
      direction: "BUY",
      entryPrice: 4000,
      stopLoss: 4010,
      takeProfit: 3990,
      requireProtective: true,
      requireThreeR: true,
    });
    expect(bad.ok).toBe(false);
    expect(bad.rejections.some((r) => r.code === "STOP_LOSS_GEOMETRY_INVALID")).toBe(true);
  });

  it("accepts ~3R geometry locally without claiming broker protection", () => {
    const ok = evaluateProtectiveGeometry({
      direction: "BUY",
      entryPrice: 4000,
      stopLoss: 3990,
      takeProfit: 4030,
      requireProtective: true,
      requireThreeR: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.rewardRisk).toBeCloseTo(3, 5);
    expect(ok.brokerProtected).toBe(false);
  });

  it("unprotected-fill policy never authorizes autonomous close", () => {
    const p = evaluateUnprotectedFillPolicy();
    expect(p.autonomousCloseAuthorized).toBe(false);
    expect(p.blockAdditionalEntries).toBe(true);
    expect(p.mutatesBroker).toBe(false);
  });
});

describe("Phase 57.0 preflight", () => {
  it("structurally valid DEMO intent is still EXECUTION_DISABLED and maySubmit=false", () => {
    const r = evaluateBrokerIntentPreflight(baseInput());
    expect(r.maySubmitToBroker).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.intent.brokerOrderId).toBeNull();
    expect(r.intent.authorizationGranted).toBe(false);
    expect(r.intent.state).toBe("EXECUTION_DISABLED");
    expect(r.intent.rejections.some((x) => x.code === "EXECUTION_FORBIDDEN")).toBe(true);
    expect(r.intent.rejections.some((x) => x.code === "AUTHORIZATION_REQUIRED")).toBe(true);
    expect(r.preflightPassed).toBe(true);
  });

  it("LIVE environment is blocked", () => {
    const r = evaluateBrokerIntentPreflight(baseInput({ environment: "LIVE" }));
    expect(r.intent.state).toBe("BLOCKED");
    expect(r.intent.rejections.some((x) => x.code === "LIVE_EXECUTION_UNAUTHORIZED")).toBe(true);
  });

  it("DEMO-looking profile without verified environment is blocked", () => {
    const r = evaluateBrokerIntentPreflight(baseInput({ environmentVerified: false }));
    expect(r.intent.state).toBe("BLOCKED");
    expect(r.intent.rejections.some((x) => x.code === "DEMO_ENVIRONMENT_UNVERIFIED")).toBe(true);
  });

  it("non-allowlisted instrument is blocked", () => {
    const r = evaluateBrokerIntentPreflight(baseInput({ instrument: "EUR/USD" }));
    expect(r.intent.rejections.some((x) => x.code === "INSTRUMENT_NOT_ALLOWED")).toBe(true);
  });

  it("stale quote and client placesOrders=true cannot override guards", () => {
    const r = evaluateBrokerIntentPreflight(
      baseInput({ quoteFresh: false, placesOrders: true, acceptsForExecution: true }),
    );
    expect(r.maySubmitToBroker).toBe(false);
    expect(r.intent.rejections.some((x) => x.code === "QUOTE_STALE")).toBe(true);
    expect(r.intent.rejections.some((x) => x.code === "EXECUTION_FORBIDDEN")).toBe(true);
  });

  it("risk limit uses 25% of order allocation", () => {
    const r = evaluateBrokerIntentPreflight(
      baseInput({ perOrderAllocation: 100, estimatedSlLossAccount: 40 }),
    );
    expect(r.intent.rejections.some((x) => x.code === "RISK_LIMIT_EXCEEDED")).toBe(true);
  });
});

describe("Phase 57.0 reconciliation", () => {
  it("local intent is not a fill; ack is not a fill; ids dedupe", () => {
    const r = evaluateBrokerIntentPreflight(baseInput());
    const recon = reconcileBrokerIntentWithRoObservation({
      intent: r.intent,
      observation: {
        observedAtUtc: new Date().toISOString(),
        openOrdersCount: 0,
        openPositionsCount: 0,
        ordersCapability: "AVAILABLE",
        tradesCapability: "AVAILABLE",
        observedOrderIds: [],
        observedPositionIds: [],
        placesOrders: false,
        mutatesBroker: false,
      },
    });
    expect(recon.inferredFill).toBe(false);
    expect(recon.inferredProtection).toBe(false);
    expect(recon.outcome).toBe("INTENT_ONLY_NO_BROKER_EVIDENCE");

    const ack = interpretOrderAcknowledgment({ brokerOrderId: "o1", status: "ACK" });
    expect(ack.isFill).toBe(false);
    expect(ack.outcome).toBe("BROKER_ACK_NOT_FILL");

    expect(dedupeObservedIds(["a", "a", "", null, "b"])).toEqual(["a", "b"]);
  });

  it("unrelated broker exposure does not attribute a fill to unsent intent", () => {
    const r = evaluateBrokerIntentPreflight(baseInput());
    const recon = reconcileBrokerIntentWithRoObservation({
      intent: r.intent,
      observation: {
        observedAtUtc: new Date().toISOString(),
        openOrdersCount: 1,
        openPositionsCount: 0,
        ordersCapability: "AVAILABLE",
        tradesCapability: "AVAILABLE",
        observedOrderIds: ["obs_1"],
        observedPositionIds: [],
        placesOrders: false,
        mutatesBroker: false,
      },
    });
    expect(recon.inferredFill).toBe(false);
    expect(recon.outcome).toBe("UNKNOWN_BROKER_OUTCOME");
  });
});

describe("Phase 57.0 durable intent store idempotency", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtBrokerIntentStoreForTests();
    resetAtBrokerIntentEngineForTests();
    tmp = mkdtempSync(join(tmpdir(), "kw-bi-57-0-"));
  });

  afterEach(() => {
    resetAtBrokerIntentStoreForTests();
    resetAtBrokerIntentEngineForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("duplicate idempotency key does not create a second intent", async () => {
    const engine = new AtBrokerIntentEngine({
      store: new AtBrokerIntentStore(tmp),
    });
    const key = "idem_stable_1";
    const a = await engine.validateAndPersist(baseInput({ idempotencyKey: key }));
    const b = await engine.validateAndPersist(baseInput({ idempotencyKey: key }));
    expect(a.duplicated).toBe(false);
    expect(b.duplicated).toBe(true);
    expect(b.intent.intentId).toBe(a.intent.intentId);
    expect(a.maySubmitToBroker).toBe(false);
    expect(engine.getPublicStatus().intentCount).toBe(1);
    expect(engine.getPublicStatus().executionDisabled).toBe(true);
  });
});

describe("Phase 57.0 wiring and path safety", () => {
  it("API paths avoid order/submit/execute substrings and retain EXECUTION_FORBIDDEN", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/broker-intent/status");
    expect(api).toContain("/broker-intent/validate");
    expect(api).toContain("/broker-intent/reconcile");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");
    expect(api).toMatch(/order\|position\\\/close\|submit\|execute/i);
    // Intent routes themselves must not include forbidden path tokens.
    expect(api).not.toContain("/broker-intent/order");
    expect(api).not.toContain("/broker-intent/submit");
    expect(api).not.toContain("/broker-intent/execute");
  });

  it("UI distinguishes broker-intent architecture without claiming filled/protected", () => {
    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(ui).toContain("data-fx-at-broker-intent");
    expect(ui).toContain("Phase 57.0");
    expect(ui).toContain("No one-click execution");
    expect(ui).not.toMatch(/Order placed|Trading active/);
  });

  it("FC bridge still has no mutation methods", () => {
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("listOrders");
    expect(client).toContain("listTrades");
    expect(client).not.toMatch(/createOrder|submitOrder|closeTrade|RequestTrading/);
    expect(client).toContain('trading: "DISABLED"');
  });
});
