/**
 * Phase 36F — ForexConnect catalog completeness + InstrumentType classification.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildForexConnectCatalog,
  classifyForexConnectInstrument,
  dedupeForexConnectInstruments,
  filterClassifiedInstruments,
  FOREXCONNECT_EXPLORER_CATEGORIES,
  FXCM_INSTRUMENT_TYPE_LABELS,
} from "../../../../ai/market-data/forexconnect/instrument-classify.ts";
import type { ForexConnectInstrument } from "../../../../ai/market-data/forexconnect/types.ts";
import { parseSelectedMarket } from "../../../../desktop/forex/market-data/selected-market.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function inst(symbol: string, extras: Partial<ForexConnectInstrument> = {}): ForexConnectInstrument {
  return {
    provider: "FOREXCONNECT",
    providerSymbol: symbol,
    canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
    displaySymbol: symbol,
    marketType: "FOREX",
    baseAsset: null,
    quoteAsset: null,
    status: "available",
    offerId: "1",
    ...extras,
  };
}

describe("Phase 36F FXCM InstrumentType classification", () => {
  it("maps numeric Offers InstrumentType codes before symbol heuristics", () => {
    expect(FXCM_INSTRUMENT_TYPE_LABELS["1"]).toBe("Forex");
    expect(FXCM_INSTRUMENT_TYPE_LABELS["5"]).toBe("Bullion");
    expect(FXCM_INSTRUMENT_TYPE_LABELS["9"]).toBe("Crypto");

    expect(classifyForexConnectInstrument(inst("RKG/CNH", { instrumentType: "5" })).categoryId)
      .toBe("metals");
    expect(classifyForexConnectInstrument(inst("CryptoMajor", { instrumentType: "9" })).categoryId)
      .toBe("cryptocurrency");
    expect(classifyForexConnectInstrument(inst("USEquities", { instrumentType: "2" })).categoryId)
      .toBe("indices");
    expect(classifyForexConnectInstrument(inst("CORNF", { instrumentType: "3" })).categoryId)
      .toBe("agriculture");
    expect(classifyForexConnectInstrument(inst("USOilSpot", { instrumentType: "3" })).categoryId)
      .toBe("energy");
    expect(classifyForexConnectInstrument(inst("Copper", { instrumentType: "3" })).categoryId)
      .toBe("metals");
    expect(classifyForexConnectInstrument(inst("AAPL.us", { instrumentType: "8" })).categoryId)
      .toBe("shares_us");
    expect(classifyForexConnectInstrument(inst("FAANG", { instrumentType: "8" })).categoryId)
      .toBe("stock_baskets");
  });

  it("exposes Agricultural category and search aliases for Trading Station names", () => {
    expect(FOREXCONNECT_EXPLORER_CATEGORIES.some((c) => c.id === "agriculture")).toBe(true);
    const { instruments } = buildForexConnectCatalog([
      inst("XAU/USD", { instrumentType: "5" }),
      inst("XAG/USD", { instrumentType: "5" }),
      inst("WHEATF", { instrumentType: "3" }),
      inst("EUR/USD", { instrumentType: "1" }),
    ]);
    expect(filterClassifiedInstruments(instruments, { query: "gold" }).map((i) => i.providerSymbol))
      .toEqual(["XAU/USD"]);
    expect(filterClassifiedInstruments(instruments, { query: "silver" }).map((i) => i.providerSymbol))
      .toEqual(["XAG/USD"]);
    expect(filterClassifiedInstruments(instruments, { categoryId: "agriculture" })).toHaveLength(1);
    expect(instruments.find((i) => i.providerSymbol === "XAU/USD")?.searchAliases).toContain("GOLD");
  });

  it("dedupes by exact providerSymbol and preserves share dots", () => {
    const deduped = dedupeForexConnectInstruments([
      inst("AAPL.us"),
      inst("AAPL.us"),
      inst("MAG7.24h"),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]!.providerSymbol).toBe("AAPL.us");
    expect(classifyForexConnectInstrument(inst("MAG7.24h")).canonicalSymbol).toBe("MAG7.24H");
  });

  it("marks session-closed Offers without claiming LIVE", () => {
    const closed = classifyForexConnectInstrument(inst("CORNF", {
      instrumentType: "3",
      tradingStatus: "C",
    }));
    expect(closed.dataAvailability).toBe("SESSION_CLOSED");
    expect(closed.categoryId).toBe("agriculture");
    const open = classifyForexConnectInstrument(inst("EUR/USD", {
      instrumentType: "1",
      tradingStatus: "O",
    }));
    expect(open.dataAvailability).toBe("AVAILABLE_IN_CATALOG");
  });

  it("preserves ForexConnect URL selection identity", () => {
    expect(parseSelectedMarket("USOilSpot", "FOREXCONNECT")).toEqual({
      venue: "forexconnect",
      symbol: "USOilSpot",
      displaySymbol: "USOilSpot",
      provider: "FOREXCONNECT",
    });
    expect(parseSelectedMarket("AlumSpot", "FOREXCONNECT")?.symbol).toBe("AlumSpot");
  });

  it("does not introduce Socket REST fallback or fabricated catalog rows", () => {
    const classify = read("ai/market-data/forexconnect/instrument-classify.ts");
    expect(classify).toContain("Never invent instruments");
    expect(classify).not.toContain("socketapi");
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain("data-fc-availability");
    expect(explorer).toContain("instrumentTypeLabel");
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("instrumentTypeLabel");
    expect(sidecar).toContain('"9": "Crypto"');
  });
});
