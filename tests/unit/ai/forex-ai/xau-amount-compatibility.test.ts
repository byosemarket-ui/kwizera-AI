/**
 * XAU/USD owner-lot vs FXCM AMOUNT compatibility classification.
 */
import { describe, expect, it } from "vitest";
import { classifyXauAmountCompatibility } from "../../../../ai/forex-ai/automated-trading/order-execution/xau-amount-compatibility.ts";

describe("XAU AMOUNT compatibility classification", () => {
  it("classifies live XAU DEMO metadata + owner 0.01 as BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT", () => {
    const r = classifyXauAmountCompatibility({
      baseUnitSize: 1,
      minQuantity: 1,
      ownerMaxLots: 0.01,
    });
    expect(r.classification).toBe("BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT");
    expect(r.minLotsFromBroker).toBe(1);
    expect(r.amount).toBeNull();
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
  });

  it("classifies missing metadata as INSUFFICIENT_BROKER_EVIDENCE", () => {
    const r = classifyXauAmountCompatibility({
      baseUnitSize: null,
      minQuantity: 1,
      ownerMaxLots: 0.01,
    });
    expect(r.classification).toBe("INSUFFICIENT_BROKER_EVIDENCE");
  });

  it("accepts 1 lot when baseUnitSize=1 and minQuantity=1", () => {
    const r = classifyXauAmountCompatibility({
      baseUnitSize: 1,
      minQuantity: 1,
      ownerMaxLots: 1,
      lots: 1,
    });
    expect(r.classification).toBe("COMPATIBLE");
    expect(r.amount).toBe(1);
  });

  it("accepts 0.01 lots when baseUnitSize=100 yields integer AMOUNT 1", () => {
    const r = classifyXauAmountCompatibility({
      baseUnitSize: 100,
      minQuantity: 1,
      ownerMaxLots: 0.01,
      lots: 0.01,
    });
    expect(r.classification).toBe("COMPATIBLE");
    expect(r.amount).toBe(1);
  });
});
