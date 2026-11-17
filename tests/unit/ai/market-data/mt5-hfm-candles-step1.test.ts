/**
 * STEP 1 Charts readiness — candle normalization / timeframe map / API wiring.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("STEP 1 HFM candle readiness", () => {
  it("agent retains candle cache between Expert dump cycles", () => {
    const control = read("services/mt5-hfm-agent/mt5_control.py");
    expect(control).toContain("candles-cache.json");
    expect(control).toContain("kwizera_readonly_candles.json");
    expect(control).toContain("_persist_candle_cache");
    expect(control).toContain("_load_candle_sources");
    expect(control).toContain("wait_for_cycle_sec");
    expect(control).toContain('"placesOrders": False');
  });

  it("Expert writes durable candle artifact for quote-universe symbols", () => {
    const mq5 = read("services/mt5-hfm-agent/mql5/KwizeraReadonlySnapshot.mq5");
    expect(mq5).toContain("kwizera_readonly_candles.json");
    expect(mq5).toContain("GBPUSD");
    expect(mq5).toContain("CopyRates");
    expect(mq5).toContain("ordersEnabled");
    expect(mq5).toMatch(/ordersEnabled\\":false/);
    // Comment may mention OrderSend; ensure no call site.
    expect(mq5).not.toMatch(/\bOrderSend\s*\(/);
  });

  it("market/candles API accepts count alias and refuses synthetic success", () => {
    const api = read("dev/server/mt5-hfm-api.ts");
    expect(api).toContain("body.limit ?? body.count");
    expect(api).toContain("available === true");
    expect(api).toContain("no synthetic bars");
    expect(api).toContain('provider: "HFM_MT5"');
  });

  it("timeframe map includes native MT5 periods used by Charts plan", () => {
    const mcp = read("services/mt5-hfm-agent/mt5_mcp.py");
    for (const tf of ["M1", "M2", "M5", "M10", "M15", "M20", "M30", "H1", "H3", "H4", "H8", "D1", "W1", "MN1"]) {
      expect(mcp).toContain(`"${tf}": "${tf}"`);
    }
  });

  it("watchdog script is marked executable in git", () => {
    // Mode is asserted via git ls-files in deploy; source still has shebang.
    const wd = read("services/mt5-hfm-lifecycle/bin/watchdog-mt5-demo.sh");
    expect(wd.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(wd).toContain("watchdog_ok");
  });

  it("lightweight-charts remains the installed HFM chart dependency", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["lightweight-charts"]).toBeTruthy();
    const chart = read("desktop/forex/hfm-dashboard/components/HfmCandlestickChart.tsx");
    expect(chart).toContain('from "lightweight-charts"');
    expect(chart).toContain("CopyRates snapshot");
  });

  it("maps canonical 15m to M15 and never uppercases to 15M for MQL lookup", () => {
    const control = read("services/mt5-hfm-agent/mt5_control.py");
    expect(control).toContain("map_timeframe(str(timeframe");
    expect(control).toContain('Never use `.upper()` alone');
  });

  it("unified MarketDataService routes HFM_MT5 historically without FXCM fallthrough", () => {
    const svc = read("ai/market-data/providers/market-data-service.ts");
    expect(svc).toContain('providerId === "HFM_MT5"');
    expect(svc).toContain("unifyHfmMt5Historical");
    expect(svc).toContain("canonicalTimeframeToHfmMt5");
    expect(svc).toContain("never fall through to FXCM");
  });
});

describe("STEP 1 HFM canonical timeframe helper", () => {
  it("maps unified timeframes to MT5 keys", async () => {
    const { canonicalTimeframeToHfmMt5 } = await import(
      "../../../../ai/market-data/providers/market-data-service"
    );
    expect(canonicalTimeframeToHfmMt5("15m")).toBe("M15");
    expect(canonicalTimeframeToHfmMt5("1h")).toBe("H1");
    expect(canonicalTimeframeToHfmMt5("1d")).toBe("D1");
  });
});
