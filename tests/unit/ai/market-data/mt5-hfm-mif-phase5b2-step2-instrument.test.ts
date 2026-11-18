/**
 * Phase 5B.2 Step 2 — instrument metadata & price precision tests.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifInstrumentQuality,
  buildMifInstrumentStub,
  mifInstrumentFromHfmCatalog,
  MIF_QI_MISSING_DIGITS,
  MIF_QI_MISSING_TICK_SIZE,
  MIF_QI_PRICE_DIGITS_MISMATCH,
  MIF_QI_PRICE_TICK_MISMATCH,
  MIF_QI_PRICE_PRECISION_UNAVAILABLE,
  MIF_QI_INVALID_METADATA,
  MIF_QI_CATALOG_PROVENANCE_UNKNOWN,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import { precisionOk as sharedPrecisionOk, tickAligned as sharedTickAligned } from "../../../../ai/market-data/mt5-hfm/quote-validation";
import type { HfmCatalogInstrument } from "../../../../ai/market-data/mt5-hfm/catalog-types";

function catalogRow(over: Partial<HfmCatalogInstrument> = {}): HfmCatalogInstrument {
  return {
    symbol: "EURUSD",
    description: "Euro vs US Dollar",
    digits: 5,
    point: 0.00001,
    tickSize: 0.00001,
    tickValue: 1,
    contractSize: 100000,
    currencyBase: "EUR",
    currencyProfit: "USD",
    currencyMargin: "USD",
    tradeMode: 4,
    categoryRaw: "Forex",
    classification: { category: "forex", confidence: "high" },
    catalogVersion: "test-catalog-v1",
    ...over,
  } as HfmCatalogInstrument;
}

describe("Phase 5B.2 Step2 — instrument metadata", () => {
  it("complete valid metadata from catalog", () => {
    const inst = mifInstrumentFromHfmCatalog(catalogRow());
    const r = assessMifInstrumentQuality({
      instrument: inst,
      providerSymbol: "EURUSD",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.metadataComplete).toBe(true);
    expect(r.digits).toBe(5);
    expect(r.doesNotApproveAiReasoning).toBe(true);
  });

  it("missing digits/point/tickSize and unknown catalog provenance", () => {
    const stub = buildMifInstrumentStub({ providerSymbol: "XAUUSD" });
    const r = assessMifInstrumentQuality({
      instrument: stub,
      providerSymbol: "XAUUSD",
    });
    expect(r.metadataComplete).toBe(false);
    expect(r.findings.some((f) => f.code === MIF_QI_MISSING_DIGITS)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_MISSING_TICK_SIZE)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_CATALOG_PROVENANCE_UNKNOWN)).toBe(true);
  });

  it("invalid zero/negative metadata blocked", () => {
    const inst = mifInstrumentFromHfmCatalog(catalogRow({ tickSize: 0, point: -1 }));
    // mifInstrumentFromHfmCatalog may null invalid? It only checks isFinite — 0 and -1 pass through.
    const r = assessMifInstrumentQuality({
      instrument: { ...inst, tickSize: 0, point: -1 },
      providerSymbol: "EURUSD",
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.findings.some((f) => f.code === MIF_QI_INVALID_METADATA)).toBe(true);
  });
});

describe("Phase 5B.2 Step2 — price precision", () => {
  it("uses same precisionOk/tickAligned helpers as Phase 3.1", () => {
    expect(sharedPrecisionOk(1.12345, 5)).toBe(true);
    expect(sharedPrecisionOk(1.123456, 5)).toBe(false);
    expect(sharedTickAligned(1.12345, 0.00001)).toBe(true);
    expect(sharedTickAligned(1.123455, 0.00001)).toBe(false);
  });

  it("accepts on-tick price; rejects off-tick / digits mismatch without rounding", () => {
    const inst = mifInstrumentFromHfmCatalog(catalogRow());
    const ok = assessMifInstrumentQuality({
      instrument: inst,
      providerSymbol: "EURUSD",
      prices: [{ label: "bid", value: 1.12345 }],
      requirePositivePrices: true,
    });
    expect(ok.precisionVerified).toBe(true);

    const digits = assessMifInstrumentQuality({
      instrument: inst,
      providerSymbol: "EURUSD",
      prices: [{ label: "bid", value: 1.123456 }],
    });
    expect(digits.findings.some((f) => f.code === MIF_QI_PRICE_DIGITS_MISMATCH)).toBe(true);
    expect(digits.precisionVerified).toBe(false);

    const tick = assessMifInstrumentQuality({
      instrument: mifInstrumentFromHfmCatalog(catalogRow({ digits: 5, tickSize: 0.0001 })),
      providerSymbol: "EURUSD",
      prices: [{ label: "ask", value: 1.12345 }],
    });
    expect(tick.findings.some((f) => f.code === MIF_QI_PRICE_TICK_MISMATCH)).toBe(true);
  });

  it("unavailable precision when digits+tick missing; no universal FX assumption", () => {
    const stub = buildMifInstrumentStub({ providerSymbol: "CUSTOM" });
    const r = assessMifInstrumentQuality({
      instrument: stub,
      providerSymbol: "CUSTOM",
      prices: [{ label: "px", value: 42 }],
      requirePositivePrices: false,
    });
    expect(r.findings.some((f) => f.code === MIF_QI_PRICE_PRECISION_UNAVAILABLE)).toBe(true);
    expect(r.precisionVerified).toBe(false);
  });

  it("deterministic identity changes with metadata/prices; not wall-clock", () => {
    const inst = mifInstrumentFromHfmCatalog(catalogRow());
    const a = assessMifInstrumentQuality({
      instrument: inst,
      providerSymbol: "EURUSD",
      prices: [{ label: "bid", value: 1.12345 }],
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifInstrumentQuality({
      instrument: inst,
      providerSymbol: "EURUSD",
      prices: [{ label: "bid", value: 1.12345 }],
      assessmentTimestamp: "2025-06-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    const c = assessMifInstrumentQuality({
      instrument: { ...inst, digits: 3 },
      providerSymbol: "EURUSD",
      prices: [{ label: "bid", value: 1.12345 }],
    });
    expect(c.inputIdentity).not.toBe(a.inputIdentity);
  });
});
