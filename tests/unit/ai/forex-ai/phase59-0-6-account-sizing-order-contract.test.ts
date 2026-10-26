/**
 * Phase 59.0.6 — DEMO account/sizing/request contract + order status mapping (offline).
 * Mocks ≠ live FXCM. Never invokes send_request or mutation adapters.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { lotsToBrokerAmount } from "../../../../ai/forex-ai/automated-trading/order-execution/lots-to-broker-amount.ts";
import { buildDemoOpenRequestContract } from "../../../../ai/forex-ai/automated-trading/order-execution/build-demo-open-request-contract.ts";
import {
  mergeBrokerOrderStatusUpdate,
  normalizeBrokerOrderStatus,
} from "../../../../ai/forex-ai/automated-trading/order-execution/normalize-broker-order-status.ts";
import { mapProposedQuantityToLots } from "../../../../ai/forex-ai/automated-trading/order-execution/map-lots.ts";
import { getDisabledBrokerMutationAdapter } from "../../../../ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts";
import { parseBrokerRoTables } from "../../../../desktop/forex/trade-monitor/parse-broker-tables.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 59.0.6 lots → broker amount", () => {
  it("converts with explicit baseUnitSize without double conversion", () => {
    const lots = mapProposedQuantityToLots({ proposedQuantity: 2.9, grantMaxLots: 5 });
    expect(lots.ok).toBe(true);
    expect(lots.lots).toBe(2);
    const amount = lotsToBrokerAmount({ lots: lots.lots!, baseUnitSize: 1, minQuantity: 1 });
    expect(amount).toMatchObject({ ok: true, amount: 2, baseUnitSize: 1, usedBrokerBaseUnitSize: true });
    // baseUnitSize=100 would be amount=200 — proves single multiply only.
    expect(lotsToBrokerAmount({ lots: 2, baseUnitSize: 100 }).amount).toBe(200);
  });

  it("rejects unknown/invalid/zero/out-of-range sizing without inventing defaults", () => {
    expect(lotsToBrokerAmount({ lots: 1, baseUnitSize: null }).code).toBe("BASE_UNIT_SIZE_UNKNOWN");
    expect(lotsToBrokerAmount({ lots: 1, baseUnitSize: 0 }).code).toBe("BASE_UNIT_SIZE_INVALID");
    expect(lotsToBrokerAmount({ lots: 0, baseUnitSize: 1 }).code).toBe("LOTS_INVALID");
    expect(lotsToBrokerAmount({ lots: -1, baseUnitSize: 1 }).code).toBe("LOTS_INVALID");
    expect(lotsToBrokerAmount({ lots: 51, baseUnitSize: 1 }).code).toBe("LOTS_OUT_OF_RANGE");
    expect(lotsToBrokerAmount({ lots: 1, baseUnitSize: 1, minQuantity: 2 }).code).toBe(
      "AMOUNT_BELOW_MIN_QUANTITY",
    );
    expect(mapProposedQuantityToLots({ proposedQuantity: 0.4, grantMaxLots: 5 }).ok).toBe(false);
  });
});

describe("Phase 59.0.6 offline request contract", () => {
  it("builds TRUE_MARKET_OPEN contract and never calls send/create hooks", () => {
    const sendRequest = vi.fn(() => {
      throw new Error("send must not run");
    });
    const createOrderRequest = vi.fn(() => {
      throw new Error("create must not run");
    });
    const result = buildDemoOpenRequestContract({
      accountPresent: true,
      accountIdMasked: "***9634",
      instrument: "XAU/USD",
      offerId: "4001",
      direction: "BUY",
      lots: 1,
      baseUnitSize: 1,
      minQuantity: 1,
      sendRequest,
      createOrderRequest,
    });
    expect(result.ok).toBe(true);
    expect(result.sendInvoked).toBe(false);
    expect(result.createInvoked).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.placesOrders).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(sendRequest).not.toHaveBeenCalled();
    expect(createOrderRequest).not.toHaveBeenCalled();
    expect(result.contract).toMatchObject({
      orderType: "TRUE_MARKET_OPEN",
      amount: 1,
      brokerAccepted: false,
      fillConfirmed: false,
      timeInForce: "IOC",
      timeInForceSource: "DOCUMENTED_OM_DEFAULT_IOC",
    });
  });

  it("accepts documented OM TIF values and rejects unknown/GTD", () => {
    const gtc = buildDemoOpenRequestContract({
      accountPresent: true,
      accountIdMasked: "***9634",
      instrument: "XAU/USD",
      offerId: "4001",
      direction: "BUY",
      lots: 1,
      baseUnitSize: 1,
      timeInForce: "GTC",
    });
    expect(gtc.ok).toBe(true);
    expect(gtc.contract?.timeInForce).toBe("GTC");
    expect(gtc.contract?.timeInForceSource).toBe("EXPLICIT");

    const bad = buildDemoOpenRequestContract({
      accountPresent: true,
      accountIdMasked: "***9634",
      instrument: "XAU/USD",
      offerId: "4001",
      direction: "BUY",
      lots: 1,
      baseUnitSize: 1,
      timeInForce: "FOOBAR",
    });
    expect(bad.ok).toBe(false);
    expect(bad.blockers).toContain("TIME_IN_FORCE_UNSUPPORTED");

    const gtd = buildDemoOpenRequestContract({
      accountPresent: true,
      accountIdMasked: "***9634",
      instrument: "XAU/USD",
      offerId: "4001",
      direction: "BUY",
      lots: 1,
      baseUnitSize: 1,
      timeInForce: "GTD",
    });
    expect(gtd.ok).toBe(false);
    expect(gtd.blockers).toContain("TIME_IN_FORCE_GTD_UNSUPPORTED");
  });

  it("rejects missing account or unknown baseUnitSize", () => {
    const missingAccount = buildDemoOpenRequestContract({
      accountPresent: false,
      accountIdMasked: null,
      instrument: "XAU/USD",
      offerId: "4001",
      direction: "BUY",
      lots: 1,
      baseUnitSize: 1,
    });
    expect(missingAccount.ok).toBe(false);
    expect(missingAccount.blockers).toContain("ACCOUNT_ROW_MISSING");

    const unknownBase = buildDemoOpenRequestContract({
      accountPresent: true,
      accountIdMasked: "***9634",
      instrument: "XAU/USD",
      offerId: "4001",
      direction: "SELL",
      lots: 1,
      baseUnitSize: null,
    });
    expect(unknownBase.ok).toBe(false);
    expect(unknownBase.blockers).toContain("BASE_UNIT_SIZE_UNKNOWN");
  });
});

describe("Phase 59.0.6 broker order status mapping", () => {
  it("maps known statuses and preserves unknown/missing", () => {
    expect(normalizeBrokerOrderStatus("Waiting").normalized).toBe("PENDING");
    expect(normalizeBrokerOrderStatus("Executing").normalized).toBe("PENDING");
    expect(normalizeBrokerOrderStatus("Open").normalized).toBe("ACCEPTED");
    expect(normalizeBrokerOrderStatus("Rejected").normalized).toBe("REJECTED");
    expect(normalizeBrokerOrderStatus("Partial").normalized).toBe("PARTIALLY_FILLED");
    expect(normalizeBrokerOrderStatus("Filled").normalized).toBe("FILLED");
    expect(normalizeBrokerOrderStatus("Canceled").normalized).toBe("CANCELLED");
    expect(normalizeBrokerOrderStatus("Expired").normalized).toBe("EXPIRED");
    expect(normalizeBrokerOrderStatus(null).normalized).toBe("UNKNOWN");
    expect(normalizeBrokerOrderStatus(null).unavailable).toBe(true);
    expect(normalizeBrokerOrderStatus("WeirdBrokerCode99").unmapped).toBe(true);
  });

  it("handles duplicate and out-of-order updates without regressing terminals", () => {
    expect(mergeBrokerOrderStatusUpdate({ previous: "PENDING", incoming: "PENDING" })).toMatchObject({
      applied: false,
      reason: "duplicate",
    });
    expect(mergeBrokerOrderStatusUpdate({ previous: "FILLED", incoming: "PENDING" })).toMatchObject({
      status: "FILLED",
      applied: false,
    });
    expect(mergeBrokerOrderStatusUpdate({ previous: "CANCELLED", incoming: "ACCEPTED" })).toMatchObject({
      status: "CANCELLED",
      applied: false,
    });
    expect(mergeBrokerOrderStatusUpdate({ previous: "PENDING", incoming: "FILLED" })).toMatchObject({
      status: "FILLED",
      applied: true,
    });
  });

  it("parseBrokerRoTables attaches normalizedStatus without inventing OrderID/TradeID", () => {
    const parsed = parseBrokerRoTables({
      ok: true,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      accounts: { ok: true, accounts: [{ accountIdMasked: "***9634", accountCurrency: "USD" }] },
      openPositions: { ok: true, count: 0, trades: [] },
      openWorkingOrders: {
        ok: true,
        count: 2,
        orders: [
          {
            orderId: "ord-1",
            instrument: "XAU/USD",
            side: "B",
            amount: 1,
            rate: null,
            status: "Waiting",
            timeInForce: "IOC",
          },
          { orderId: "ord-2", instrument: "XAU/USD", side: "S", amount: 1, rate: null, status: null },
        ],
      },
      closedTrades: { ok: true, capabilityStatus: "OK", count: 0, closedTrades: [] },
    });
    expect(parsed?.openWorkingOrders.orders[0]?.normalizedStatus).toBe("PENDING");
    expect(parsed?.openWorkingOrders.orders[0]?.timeInForce).toBe("IOC");
    expect(parsed?.openWorkingOrders.orders[1]?.normalizedStatus).toBe("UNKNOWN");
    expect(parsed?.openWorkingOrders.orders[1]?.timeInForce).toBeNull();
    expect(parsed?.openWorkingOrders.orders[0]?.orderId).toBe("ord-1");
    expect(parsed?.openPositions.trades).toEqual([]);
  });
});

describe("Phase 59.0.6 safety invariants", () => {
  it("DisabledBrokerMutationAdapter remains ordinary AT path", () => {
    const denied = getDisabledBrokerMutationAdapter().submit({});
    expect(denied).toMatchObject({
      ok: false,
      code: "EXECUTION_FORBIDDEN",
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    });
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
  });

  it("mutation_demo still gates DEMO and forbids LIVE", () => {
    const mut = read("services/forexconnect-sidecar/mutation_demo.py");
    expect(mut).toContain("gate_demo_mutation");
    expect(mut).toContain("LIVE_MUTATION_FORBIDDEN");
    expect(mut).toContain("TRUE_MARKET_OPEN");
    expect(mut).toContain("base_unit_size");
  });
});
