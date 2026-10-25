/**
 * Phase 41 — live session ensure vs refCount leak, idle release, frontend resume contracts.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ForexConnectLiveCandleService,
  FOREXCONNECT_LIVE_IDLE_MS,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import type { ForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function mockBridge(): ForexConnectBridge {
  let updateCount = 0;
  return {
    getConfig: () => ({
      environment: "demo",
      environmentLabel: "FXCM DEMO",
      enabled: true,
    }),
    subscribeQuotes: vi.fn(async (symbol: string) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    })),
    unsubscribeQuotes: vi.fn(async () => undefined),
    getHistoricalCandles: vi.fn(async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      displaySymbol: symbol,
      marketType: "FOREX",
      timeframe,
      candles: [
        {
          time: Math.floor(Date.now() / 60_000) * 60,
          open: 1.1,
          high: 1.1,
          low: 1.1,
          close: 1.1,
          volume: 1,
          closed: false,
        },
      ],
    })),
    pollQuotes: vi.fn(async () => []),
    getStreamStatus: vi.fn(async () => {
      updateCount += 1;
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: "CONNECTED",
        streamState: "SUBSCRIBED_WAITING",
        offersListenerActive: true,
        offersPollerActive: true,
        callbackRegistered: true,
        subscriptionCount: 1,
        subscriptions: ["EUR/USD"],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: null,
        updateCount,
        lastEventSource: null,
        diagnostics: null,
        priceBasis: "bid",
        trading: "DISABLED",
      };
    }),
  } as unknown as ForexConnectBridge;
}

describe("Phase 41 ForexConnect live lifecycle", () => {
  const services: ForexConnectLiveCandleService[] = [];
  afterEach(async () => {
    for (const svc of services.splice(0)) {
      await svc.clearAllSessions();
    }
  });

  it("repeated ensure/subscribe does not create extra sessions (HTTP poll safe)", async () => {
    const bridge = mockBridge();
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);
    await svc.ensure("EUR/USD", "1m");
    expect(svc.getSessionCount()).toBe(1);
    await svc.ensure("EUR/USD", "1m");
    await svc.subscribe("EUR/USD", "1m");
    await svc.ensure("EUR/USD", "1m");
    expect(svc.getSessionCount()).toBe(1);
    expect(bridge.subscribeQuotes).toHaveBeenCalledTimes(1);
  });

  it("idle sweep releases abandoned sessions after browser quiet period", async () => {
    const bridge = mockBridge();
    const svc = new ForexConnectLiveCandleService({ bridge });
    services.push(svc);
    await svc.ensure("EUR/USD", "1m");
    expect(svc.getSessionCount()).toBe(1);
    svc.sweepIdleSessionsForTests(Date.now() + FOREXCONNECT_LIVE_IDLE_MS + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.getSessionCount()).toBe(0);
    expect(svc.getIdleSweepCount()).toBeGreaterThanOrEqual(1);
    // Phase 59.0.3: idle sweep releases local sessions but keeps intended + sidecar Offers subscription.
    expect(svc.listIntendedSubscriptions().length).toBe(1);
    expect(bridge.unsubscribeQuotes).not.toHaveBeenCalled();
  });

  it("MarketDataService live path uses ensure and prefers existing FXCM series", () => {
    const svc = read("ai/market-data/providers/market-data-service.ts");
    expect(svc).toContain("forexConnectLive.ensure");
    expect(svc).toContain("Prefer existing live series for poll clients");
    expect(svc).not.toMatch(/forexConnectLive\.subscribe\(request\.symbol/);
  });

  it("frontend arms live poll immediately and resumes on visibility", () => {
    const hook = read("desktop/forex/market-data/use-unified-candles.ts");
    expect(hook).toContain("visibilitychange");
    expect(hook).toContain("softRemount");
    expect(hook).toContain("Arm poller immediately");
    expect(hook).toContain("applySeries");
    expect(hook).not.toMatch(/load\([^\)]*\)\.then\(\(\)\s*=>\s*\{[\s\S]*setInterval/);
  });

  it("historical snapshots do not set live-update counters in live-service", () => {
    const live = read("ai/market-data/forexconnect/live-service.ts");
    expect(live).toContain("FOREXCONNECT_LIVE_IDLE_MS");
    expect(live).toContain("lastClientAtMs");
    expect(live).toContain("never accumulate refCount");
  });
});
