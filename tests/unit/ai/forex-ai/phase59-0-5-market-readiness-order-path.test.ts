/**
 * Phase 59.0.5 — Market readiness + order-path audit contracts (read-only).
 * Mocks ≠ live FXCM evidence. Does not enable mutation or place orders.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  evaluateExecutionQuoteEvidence,
  evaluateQuoteSubscriptionReadiness,
} from "../../../../ai/forex-ai/automated-trading/quote-subscription-readiness.ts";
import { evaluateDemoLifecyclePreflight } from "../../../../ai/forex-ai/automated-trading/demo-execution/preflight.ts";
import { prepareDemoExecutionPlan } from "../../../../ai/forex-ai/automated-trading/order-execution/prepare-plan.ts";
import { getDisabledBrokerMutationAdapter } from "../../../../ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const FIXED_NOW = Date.parse("2026-10-26T18:55:00.000Z");

describe("Phase 59.0.5 market-data readiness distinctions", () => {
  it("CONNECTED + snapshot alone is never execution-ready without fresh bid/ask", () => {
    const sessionOnly = evaluateQuoteSubscriptionReadiness({
      sessionStatus: "CONNECTED",
      configuredInstrumentCount: 1,
      intendedCount: 1,
      subscriptionCount: 1,
      offersListenerActive: true,
      streamState: "MARKET_INACTIVE",
      lastQuoteAt: null,
      lastQuoteAgeMs: null,
      bid: null,
      ask: null,
      subscriptionError: null,
      nowMs: FIXED_NOW,
    });
    expect(sessionOnly.readyForExecutionQuote).toBe(false);
    expect(sessionOnly.placesOrders).toBe(false);
    expect(sessionOnly.acceptsForExecution).toBe(false);
    expect(["QUOTE_NOT_RECEIVED", "SUBSCRIPTION_ACTIVE_WAITING_FOR_QUOTE", "QUOTE_INVALID"]).toContain(
      sessionOnly.code,
    );

    const fresh = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 4013.47,
      ask: 4013.77,
      lastQuoteAt: "2026-10-26T18:54:59.700Z",
      nowMs: FIXED_NOW,
      freshnessThresholdMs: 15_000,
    });
    expect(fresh.readyForExecutionQuote).toBe(true);
    expect(fresh.code).toBe("QUOTE_READY");
  });

  it("same-price heartbeat age must not be confused with last genuine change without bid/ask evidence", () => {
    const staleChange = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "XAU/USD",
      bid: 4013.47,
      ask: 4013.77,
      lastQuoteAt: "2026-10-26T18:00:00.000Z",
      lastQuoteAgeMs: 60_000,
      nowMs: FIXED_NOW,
      freshnessThresholdMs: 15_000,
    });
    expect(staleChange.readyForExecutionQuote).toBe(false);
    expect(staleChange.code).toBe("QUOTE_STALE");
  });

  it("invalid crossed quote and instrument mismatch fail closed", () => {
    const crossed = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      bid: 4014,
      ask: 4013,
      lastQuoteAt: "2026-10-26T18:54:59.700Z",
      nowMs: FIXED_NOW,
    });
    expect(crossed.readyForExecutionQuote).toBe(false);
    expect(crossed.code).toBe("QUOTE_INVALID");

    const mismatch = evaluateExecutionQuoteEvidence({
      requestedInstrument: "XAU/USD",
      quoteInstrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1001,
      lastQuoteAt: "2026-10-26T18:54:59.700Z",
      nowMs: FIXED_NOW,
    });
    expect(mismatch.readyForExecutionQuote).toBe(false);
    expect(mismatch.code).toBe("QUOTE_INVALID");
  });
});

describe("Phase 59.0.5 order-path safety and construction (non-mutating)", () => {
  it("DisabledBrokerMutationAdapter remains the ordinary AT mutation path", () => {
    const adapter = getDisabledBrokerMutationAdapter();
    expect(adapter.placesOrders).toBe(false);
    expect(adapter.acceptsForExecution).toBe(false);
    const result = adapter.submit({});
    expect(result).toMatchObject({
      ok: false,
      code: "EXECUTION_FORBIDDEN",
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    });
  });

  it("prepareDemoExecutionPlan never sets maySubmitDemoMutation or placesOrders", () => {
    const plan = prepareDemoExecutionPlan({
      decision: null,
      draft: null,
      grantId: "test-grant",
      grantActive: false,
      grantMaxLots: 1,
      grantInstrumentAllowlist: ["XAU/USD"],
      environment: "DEMO",
    });
    expect(plan.maySubmitDemoMutation).toBe(false);
    expect(plan.placesOrders).toBe(false);
    expect(plan.acceptsForExecution).toBe(false);
    expect(plan.mutatesBroker).toBe(false);
    expect(plan.demoRequest).toBeNull();
  });

  it("demo preflight keeps globals false even when quote evidence would pass", () => {
    const result = evaluateDemoLifecyclePreflight({
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 5,
      environment: "demo",
      sessionConnected: true,
      quotePresent: true,
      quoteBid: 4013.47,
      quoteAsk: 4013.77,
      quoteInstrument: "XAU/USD",
      quoteTimestamp: "2026-10-26T18:54:59.700Z",
      nowMs: FIXED_NOW,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: false,
    });
    expect(result.placesOrdersGlobal).toBe(false);
    expect(result.acceptsForExecutionGlobal).toBe(false);
    expect(result.maySubmitDemoMutation).toBe(false);
    expect(result.blockers).toContain("NO_ACTIVE_DEMO_GRANT");
  });
});

describe("Phase 59.0.5 Trade Monitor / broker table contracts", () => {
  it("sidecar keeps OrderID and TradeID as distinct fields", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain('"orderId"');
    expect(sidecar).toContain('"tradeId"');
    expect(sidecar).toContain("open_order_id");
    expect(sidecar).toMatch(/def _normalize_order_row/);
    expect(sidecar).toMatch(/def _normalize_trade_row/);
    expect(sidecar).toContain("forexconnect-orders");
    expect(sidecar).toContain("forexconnect-trades");
  });

  it("Trade Monitor UI renders working orders separately from open trades", () => {
    const tm = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(tm).toContain("openWorkingOrders");
    expect(tm).toContain("Active working orders");
    expect(tm).toContain("row.orderId");
    expect(tm).toContain("row.tradeId");
    expect(tm).toContain('data-places-orders="false"');
    expect(tm).toContain('data-accepts-for-execution="false"');
  });

  it("DEMO mutation open path documents OrderID vs fill via trade row (code contract only)", () => {
    const mut = read("services/forexconnect-sidecar/mutation_demo.py");
    expect(mut).toContain("TRUE_MARKET_OPEN");
    expect(mut).toContain("brokerOrderId");
    expect(mut).toContain("fillConfirmed");
    expect(mut).toContain("ACCEPTED_PENDING_OR_TIMEOUT");
    expect(mut).toContain("gate_demo_mutation");
    expect(mut).toContain("LIVE_MUTATION_FORBIDDEN");
  });

  it("heartbeat vs change diagnostics remain distinct in sidecar stream payload", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("lastPollHeartbeatAt");
    expect(sidecar).toContain("lastPollChangeAt");
    expect(sidecar).toContain("lastQuoteAt");
    expect(sidecar).toContain("offersSnapshotPresent");
    expect(sidecar).toContain("MARKET_INACTIVE");
    expect(sidecar).toContain("callbackAccepted");
    expect(sidecar).toContain("callbackFiltered");
  });
});

describe("Phase 59.0.5 source inventory — no accidental mutation enablement", () => {
  it("AT service still wires DisabledBrokerMutationAdapter", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
    expect(service).toMatch(/acceptsForExecution:\s*false/);
  });

  it("phase stamp docs exist for 59.0 / 59.0.3 and this audit test exists for 59.0.5", () => {
    expect(read("docs/forex/PHASE_59_0_ORDER_EXECUTION_ENGINE_AUDIT_IMPLEMENTATION_AND_VERIFICATION.md").length).toBeGreaterThan(100);
    expect(read("docs/forex/PHASE_59_0_3_QUOTE_SUBSCRIPTION_AND_READINESS_REPAIR.md").length).toBeGreaterThan(100);
    expect(
      readFileSync(
        path.join(root, "tests/unit/ai/forex-ai/phase59-0-5-market-readiness-order-path.test.ts"),
        "utf8",
      ),
    ).toContain("Phase 59.0.5");
  });
});
