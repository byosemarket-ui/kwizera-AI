/**
 * Phase 58.0 — DEMO order open/close lifecycle readiness gates.
 * Asserts architectural blockers remain; does NOT invoke broker mutation.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBrokerCapabilityMatrix,
  getDisabledBrokerMutationAdapter,
  evaluateBrokerIntentPreflight,
} from "../../../../ai/forex-ai/automated-trading/broker-intent/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 58.0 DEMO lifecycle readiness — architectural blockers", () => {
  it("mutation capability matrix remains DISABLED (no submit/close)", () => {
    const m = buildBrokerCapabilityMatrix();
    expect(m.placesOrders).toBe(false);
    expect(m.mutatesBroker).toBe(false);
    expect(m.tradingEnabled).toBe(false);
    expect(m.capabilities.ORDER_SUBMISSION_DISABLED).toBe(true);
    expect(m.capabilities.POSITION_CLOSURE_DISABLED).toBe(true);
    expect(m.capabilities.PROTECTIVE_ORDER_MUTATION_DISABLED).toBe(true);
  });

  it("DisabledBrokerMutationAdapter rejects submit and close without contacting broker", () => {
    const adapter = getDisabledBrokerMutationAdapter();
    expect(adapter.placesOrders).toBe(false);
    expect(adapter.acceptsForExecution).toBe(false);
    const submit = adapter.submit({ environment: "DEMO" });
    expect(submit.ok).toBe(false);
    expect(submit.code).toBe("EXECUTION_FORBIDDEN");
    expect(submit.mutatesBroker).toBe(false);
    const close = adapter.closePosition("pos_test");
    expect(close.ok).toBe(false);
    expect(close.code).toBe("EXECUTION_FORBIDDEN");
  });

  it("preflight never sets maySubmitToBroker even with DEMO-verified inputs", () => {
    const result = evaluateBrokerIntentPreflight({
      idempotencyKey: "phase58_readiness_key",
      environment: "DEMO",
      environmentVerified: true,
      accountIdMasked: "***TEST",
      accountStateVerified: true,
      instrument: "XAU/USD",
      direction: "BUY",
      quantity: 1,
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
      sourceDraftId: "draft_phase58",
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
      ownerExecutionAuthorized: true,
      requireProtective: true,
      requireThreeR: true,
    });
    expect(result.maySubmitToBroker).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.intent.rejections.some((r) => r.code === "EXECUTION_FORBIDDEN")).toBe(true);
    expect(result.intent.executionDisabled).toBe(true);
    expect(result.intent.brokerOrderId).toBeNull();
  });

  it("API hard-gates order/submit/execute paths; FC client has no mutation methods", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toMatch(/order\|position\\\/close\|submit\|execute/i);
    expect(api).toContain("EXECUTION_FORBIDDEN");

    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain('sidecarFetch(cfg, "/orders", { method: "GET" }');
    // Generic broker mutation helpers remain absent; Phase 58.x DEMO-gated
    // demoMutation* methods are intentionally present and secret-gated.
    expect(client).not.toMatch(/\bcreateOrder\b|\bsubmitOrder\b|\bRequestTrading\b/);
    expect(client).toContain("demoMutationOpenMarket");

    const stub = read("ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts");
    expect(stub).toContain("DisabledBrokerMutationAdapter");
    expect(stub).toContain("No broker request was sent");
  });

  it("automation store coerces placesOrders and acceptsForExecution to false", () => {
    const store = read("ai/forex-ai/automated-trading/automation-control/store.ts");
    expect(store).toMatch(/placesOrders\s*=\s*false/);
    expect(store).toMatch(/acceptsForExecution\s*=\s*false/);
    expect(store).not.toMatch(/placesOrders\s*=\s*true/);
    expect(store).not.toMatch(/acceptsForExecution\s*=\s*true/);
  });

  it("no Phase 58 DEMO-only owner authorization module exists yet", () => {
    // Architectural gap: time-bound DEMO grant must be designed before mutation wiring.
    const engine = read("ai/forex-ai/automated-trading/broker-intent/engine.ts");
    expect(engine).toMatch(/ownerExecutionAuthorized:\s*false|ownerExecutionAuthorized\s*=\s*false/);
  });
});
