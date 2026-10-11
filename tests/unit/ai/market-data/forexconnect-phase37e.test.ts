/**
 * Phase 37E — ForexConnect live-state propagation + Charts/TA series consistency.
 * Real Offers tick delivery is verified online; mocks cover classification only.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveFcWaitingStreamState } from "../../../../ai/market-data/forexconnect/stream-state.ts";
import { UNIFIED_CONNECTION_STATES } from "../../../../ai/market-data/providers/contracts.ts";
import { calculateRSI, calculateSMA, lastValue } from "../../../../desktop/forex/chart/indicators.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 37E live data & TA integration", () => {
  it("preserves sidecar MARKET_INACTIVE / SUBSCRIBED_WAITING while updateCount is zero", () => {
    expect(resolveFcWaitingStreamState("MARKET_INACTIVE", 0)).toBe("MARKET_INACTIVE");
    expect(resolveFcWaitingStreamState("SUBSCRIBED_WAITING", 0)).toBe("SUBSCRIBED_WAITING");
    expect(resolveFcWaitingStreamState("LIVE", 0)).toBe("SUBSCRIBED_WAITING");
    expect(resolveFcWaitingStreamState("STALE", 0)).toBe("STALE");
  });

  it("exposes MARKET_INACTIVE and SUBSCRIBED_WAITING on unified connection contracts", () => {
    expect(UNIFIED_CONNECTION_STATES).toContain("MARKET_INACTIVE");
    expect(UNIFIED_CONNECTION_STATES).toContain("SUBSCRIBED_WAITING");
    const unify = read("ai/market-data/providers/market-data-service.ts");
    expect(unify).toContain('result.streamState === "MARKET_INACTIVE" ? "MARKET_INACTIVE"');
    expect(unify).toContain('result.streamState === "SUBSCRIBED_WAITING" ? "SUBSCRIBED_WAITING"');
    expect(unify).toContain("streamDiagnostics");
  });

  it("live service syncs sidecar streamState and does not invent ticks", () => {
    const live = read("ai/market-data/forexconnect/live-service.ts");
    expect(live).toContain("resolveFcWaitingStreamState");
    expect(live).toContain("lastStreamStatus");
    expect(live).toContain("sidecarUpdateCount");
    expect(live).not.toContain("Math.random()");
    // Comments may say "must not fabricate"; reject executable invent helpers only.
    expect(live).not.toMatch(/\binvent(?:Ticks|Prices|Candles)\b/);
    expect(live).not.toMatch(/\bfake(?:Tick|Quote|Candle)\s*\(/);
  });

  it("client maps inactive Offers wait to ready historical state, not LIVE", () => {
    const client = read("desktop/forex/market-data/studio-unified-candles-client.ts");
    expect(client).toContain('conn === "MARKET_INACTIVE"');
    expect(client).toContain('conn === "SUBSCRIBED_WAITING"');
    expect(client).toContain("mapStreamDiagnostics");
    expect(client).toContain('connectionState.toUpperCase() === "LIVE"');
  });

  it("Charts/TA workspace exposes stream diagnostics and shared series key", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toMatch(/data-phase="37[ef]"/);
    expect(workspace).toContain("data-fx-stream-diagnostics");
    expect(workspace).toContain("data-ta-series-key");
    expect(workspace).toContain("data-candle-source=\"unified-market-data\"");
    expect(workspace).toContain("MARKET_INACTIVE · no Offers bid/ask changes");
    expect(workspace).toContain("Boolean(seriesReady && providerReady)");
  });

  it("indicators warm up without inventing values on short series", () => {
    const short = [
      { time: 1, close: 1.1 },
      { time: 2, close: 1.2 },
      { time: 3, close: 1.15 },
    ];
    expect(calculateSMA(short, 20)).toEqual([]);
    expect(calculateRSI(short, 14)).toEqual([]);
    expect(lastValue(calculateSMA(short, 20))).toBeNull();
  });

  it("preserves Phase 37A–D chart chrome and explorer contracts", () => {
    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain("fx-trading-chrome");
    expect(workspace).toContain("LIVE · ForexConnect Offers");
    expect(workspace).toContain("Authenticated · waiting for fresh quotes");
    const explorer = read("desktop/forex/ForexConnectMarketExplorer.tsx");
    expect(explorer).toContain('data-phase="37c"');
  });
});
