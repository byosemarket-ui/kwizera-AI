/**
 * XAU/USD dynamic-sizing vs FXCM AMOUNT compatibility classification (no fixed owner lot cap).
 */
import { describe, expect, it } from "vitest";
import { classifyXauAmountCompatibility } from "../../../../ai/forex-ai/automated-trading/order-execution/xau-amount-compatibility.ts";
import { OWNER_MAX_LOTS_EXECUTION } from "../../../../ai/forex-ai/automated-trading/broker-execution/types.ts";
import {
  defaultPrecheckRiskLimits,
  OWNER_MAX_LOTS_PRECHECK,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/precheck-types.ts";
import { OWNER_MAX_LOTS } from "../../../../ai/forex-ai/automated-trading/broker-compatibility/types.ts";

describe("No fixed owner lot cap in the active XAU/USD path", () => {
  it("execution, precheck and handoff caps are null; precheck lot limits default to none", () => {
    expect(OWNER_MAX_LOTS_EXECUTION).toBeNull();
    expect(OWNER_MAX_LOTS_PRECHECK).toBeNull();
    expect(OWNER_MAX_LOTS).toBeNull();
    const limits = defaultPrecheckRiskLimits();
    expect(limits.maxLotsPerOrder).toBeNull();
    expect(limits.maxTotalExposureLots).toBeNull();
    expect(limits.maxOpenPositions).toBe(1);
  });
});

const LIVE = { baseUnitSize: 1, minQuantity: 1, quantityStep: 1 };

describe("XAU AMOUNT compatibility classification (dynamic sizing)", () => {
  it("without a sized proposal reports the broker minimum, not an owner cap", () => {
    const r = classifyXauAmountCompatibility({ ...LIVE });
    expect(r.classification).toBe("AWAITING_SIZED_PROPOSAL");
    expect(r.minLotsFromBroker).toBe(1);
    expect(r.message).not.toMatch(/owner/i);
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
  });

  it("classifies missing metadata as INSUFFICIENT_BROKER_EVIDENCE", () => {
    const r = classifyXauAmountCompatibility({ baseUnitSize: null, minQuantity: 1, lots: 1 });
    expect(r.classification).toBe("INSUFFICIENT_BROKER_EVIDENCE");
    expect(r.code).toBe("BROKER_METADATA_UNAVAILABLE");
  });

  it.each([1, 2, 3, 5, 12])("accepts risk-sized %s lots (no legacy 0.01 cap)", (lots) => {
    const r = classifyXauAmountCompatibility({ ...LIVE, lots });
    expect(r.classification).toBe("COMPATIBLE");
    expect(r.amount).toBe(lots);
  });

  it("risk-sized quantity below the broker minimum is BROKER_MINIMUM_EXCEEDS_RISK_BUDGET", () => {
    const r = classifyXauAmountCompatibility({ baseUnitSize: 1, minQuantity: 2, quantityStep: 1, lots: 1 });
    expect(r.classification).toBe("BROKER_MINIMUM_EXCEEDS_RISK_BUDGET");
  });

  it("non-integer AMOUNT is a conversion defect, never rounded", () => {
    const r = classifyXauAmountCompatibility({ ...LIVE, lots: 0.5 });
    expect(r.classification).toBe("BROKER_MAPPING_DEFECT");
    expect(r.code).toBe("BROKER_QUANTITY_CONVERSION_UNVERIFIED");
  });

  it("AMOUNT off the broker step is BROKER_QUANTITY_STEP_INVALID", () => {
    const r = classifyXauAmountCompatibility({ baseUnitSize: 1, minQuantity: 2, quantityStep: 2, lots: 3 });
    expect(r.classification).toBe("BROKER_QUANTITY_STEP_INVALID");
  });

  it("baseUnitSize=100 maps 0.01 lots to AMOUNT 1", () => {
    const r = classifyXauAmountCompatibility({ baseUnitSize: 100, minQuantity: 1, lots: 0.01 });
    expect(r.classification).toBe("COMPATIBLE");
    expect(r.amount).toBe(1);
  });
});
