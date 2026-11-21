import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { getMifOdWorkerStatus } from "../../../ai/market-data/mt5-hfm/mif/index.js";
import { OPENAI_AI_MAX_CONCURRENT } from "../../../ai/forex-ai/snapshot-openai/concurrency.js";
import { getBackgroundRefreshEnabled } from "../../../ai/market-data/mt5-hfm/fundamentals/index.js";
import {
  emptyCalendarView,
  parseHfmEconomicCalendarResponse,
} from "../../../desktop/forex/hfm-dashboard/charts/analysis/parse-hfm-fundamentals";

describe("Phase 7 — Charts calendar UI markers", () => {
  it("panel and calendar components expose gated states and no order controls", async () => {
    const panel = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/HfmAnalysisPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("HfmEconomicCalendarPanel");
    expect(panel).toContain("fetchHfmFundamentalsStatus");
    expect(panel).not.toMatch(/Place Order|Execute Trade|Submit Order/i);

    const cal = await fs.readFile(
      path.join(
        process.cwd(),
        "desktop/forex/hfm-dashboard/charts/analysis/HfmEconomicCalendarPanel.tsx",
      ),
      "utf8",
    );
    expect(cal).toContain("data-phase7-calendar");
    expect(cal).toContain("licensing-blocked");
    expect(cal).toContain("data-calendar-attribution");
    expect(cal).toContain("Informational only");

    const css = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/hfm-analysis-panel.css"),
      "utf8",
    );
    expect(css).toContain("hap-calendar");
  });

  it("parser keeps empty values as empty (not zero) and reads availability", () => {
    const view = parseHfmEconomicCalendarResponse({
      ok: true,
      availability: "OK",
      events: [
        {
          eventId: "smt:x",
          title: "CPI",
          currency: "USD",
          impact: "high",
          scheduledAtUtc: "2026-12-10T13:30:00Z",
          forecast: "",
          previous: "0.4%",
          actual: "",
          status: "scheduled",
          confidence: "sources_agree",
        },
      ],
      attribution: {
        text: "Economic calendar by ShowMyTrades",
        url: "https://showmytrades.com/tools/economic-calendar",
      },
    });
    expect(view.events[0].forecast).toBe("");
    expect(view.events[0].actual).toBe("");
    expect(view.attribution?.text).toContain("ShowMyTrades");
    expect(emptyCalendarView({ availability: "LICENSING_BLOCKED" }).availability).toBe(
      "LICENSING_BLOCKED",
    );
  });

  it("keeps OD off, OpenAI concurrency 1, background refresh off", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
    expect(OPENAI_AI_MAX_CONCURRENT).toBe(1);
    expect(getBackgroundRefreshEnabled()).toBe(false);
  });
});
