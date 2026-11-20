/**
 * Phase 5F STEP 2 — ForexAdmin Historical Analogue UI contracts and helpers.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOREX_ADMIN_NAV,
  parseForexAdminRouteFromLocation,
} from "../../../desktop/forex-admin/forex-admin-routes";
import {
  ANALOGUE_DOCUMENTED_LIMITATIONS,
  ANALOGUE_MODE_OPTIONS,
  ANALOGUE_SIMILARITY_LABEL,
  partitionDatasets,
  similarityNeverProbabilityCopy,
  summarizeCoverage,
  validateAnalogueReferenceInput,
} from "../../../desktop/forex-admin/analogue-ui-helpers";

const root = path.resolve(process.cwd());
function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Phase 5F STEP 2 ForexAdmin Historical Analogue UI", () => {
  it("registers navigation and route for Historical Analogue Research", () => {
    expect(
      FOREX_ADMIN_NAV.some(
        (i) =>
          i.id === "mt5-hfm-analogue" &&
          i.path === "/admin/forex/mt5-hfm/analogue" &&
          i.label === "Historical Analogue Research",
      ),
    ).toBe(true);
    const loc = parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm/analogue");
    expect(loc.view).toBe("mt5-hfm-analogue");
    expect(loc.canonicalPath).toBe("/admin/forex/mt5-hfm/analogue");
  });

  it("wires page router and API client to real analogue endpoints", () => {
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    const api = read("desktop/forex-admin/api.ts");
    const page = read("desktop/forex-admin/ForexAdminMt5HfmAnaloguePage.tsx");
    expect(pages).toContain("ForexAdminMt5HfmAnaloguePage");
    expect(pages).toContain('"mt5-hfm-analogue"');
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/research/analogues/search");
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/research/analogues/reference");
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/research/coverage");
    expect(api).toContain("mt5HfmMifAnalogueSearch");
    expect(api).toContain("mt5HfmMifAnalogueSearchesList");
    expect(api).toContain("similarityIsNotProbability");
    expect(page).toContain("ANALOGUE_SIMILARITY_LABEL");
    expect(page).toContain("NOT probability");
    expect(page).not.toContain("win probability");
    expect(ANALOGUE_SIMILARITY_LABEL).toContain("NOT probability");
    expect(page).toContain("data-forex-admin-historical-analogue");
    expect(page).toContain("data-analogue-search-submit");
    expect(page).toContain("placesOrders=false");
  });

  it("never presents similarity as probability in helper copy", () => {
    expect(similarityNeverProbabilityCopy(91.2)).toContain("NOT probability");
    expect(similarityNeverProbabilityCopy(91.2)).toContain("91.20");
    expect(ANALOGUE_SIMILARITY_LABEL.toLowerCase()).not.toContain("win probability");
  });

  it("validates reference inputs and blocks unsupported modes", () => {
    expect(
      validateAnalogueReferenceInput({
        datasetId: "",
        tipOpenTimeSec: 1,
        lookbackBars: 16,
        warmupBars: 24,
        eligibilityMode: "PRICE_ACTION",
      }).ok,
    ).toBe(false);
    expect(
      validateAnalogueReferenceInput({
        datasetId: "ds:EURUSD:H1:abc",
        tipOpenTimeSec: "bad",
        lookbackBars: 16,
        warmupBars: 24,
        eligibilityMode: "PRICE_ACTION",
      }).ok,
    ).toBe(false);
    expect(
      validateAnalogueReferenceInput({
        datasetId: "ds:EURUSD:H1:abc",
        tipOpenTimeSec: 1700000000,
        lookbackBars: 16,
        warmupBars: 24,
        eligibilityMode: "STRUCTURE_REGIME",
      }).ok,
    ).toBe(false);
    expect(
      validateAnalogueReferenceInput({
        datasetId: "ds:EURUSD:H1:abc",
        tipOpenTimeSec: 1700000000,
        lookbackBars: 16,
        warmupBars: 24,
        eligibilityMode: "PRICE_ACTION",
      }),
    ).toEqual({ ok: true });
  });

  it("only marks PRICE_ACTION as supported for v1 search matching", () => {
    const supported = ANALOGUE_MODE_OPTIONS.filter((m) => m.supportedForSearch);
    expect(supported.map((m) => m.value)).toEqual(["PRICE_ACTION"]);
  });

  it("partitions COMPLETE eligible vs excluded datasets", () => {
    const { complete, incomplete } = partitionDatasets([
      {
        datasetId: "a",
        status: "COMPLETE",
        suitableForCandleResearch: true,
      },
      {
        datasetId: "b",
        status: "INCOMPLETE",
        suitableForCandleResearch: false,
      },
      {
        datasetId: "c",
        status: "COMPLETE",
        suitableForCandleResearch: false,
      },
    ]);
    expect(complete.map((d) => d.datasetId)).toEqual(["a"]);
    expect(incomplete.map((d) => d.datasetId).sort()).toEqual(["b", "c"]);
  });

  it("summarizes live coverage without inventing fields", () => {
    expect(summarizeCoverage(null)).toEqual({
      cells: 0,
      archived: 0,
      complete: 0,
      eligible: 0,
      registry: 0,
    });
    expect(
      summarizeCoverage({
        cells: 63,
        archivedCells: 57,
        completeCells: 54,
        researchEligibleCells: 54,
        registryDatasets: 68,
      }),
    ).toEqual({
      cells: 63,
      archived: 57,
      complete: 54,
      eligible: 54,
      registry: 68,
    });
  });

  it("exposes documented limitations panel content", () => {
    const page = read("desktop/forex-admin/ForexAdminMt5HfmAnaloguePage.tsx");
    expect(ANALOGUE_DOCUMENTED_LIMITATIONS.length).toBeGreaterThanOrEqual(8);
    expect(page).toContain("ANALOGUE_DOCUMENTED_LIMITATIONS");
    expect(page).toContain("data-analogue-limitations");
    expect(ANALOGUE_DOCUMENTED_LIMITATIONS.some((l) => l.includes("No COMPLETE M1"))).toBe(true);
  });

  it("blocks duplicate search submit via busy state and has no execution controls", () => {
    const page = read("desktop/forex-admin/ForexAdminMt5HfmAnaloguePage.tsx");
    expect(page).toContain('if (busy === "search") return');
    expect(page).toContain("disabled={busy != null}");
    expect(page).not.toContain("placesOrders=true");
    expect(page).not.toContain("Submit order");
    expect(page).not.toContain("Enable execution");
    expect(page).not.toContain("EXPORT_ENABLED=1");
  });

  it("keeps phase19 HFM routes intact alongside analogue", () => {
    expect(parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm/mif").view).toBe("mt5-hfm-mif");
    expect(parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm").view).toBe("mt5-hfm");
  });
});
