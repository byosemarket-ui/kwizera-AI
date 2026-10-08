/**
 * Phase 29 — FXCM real-time streaming price engine tests.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createFxcmRealtimeStreamService,
} from "../../../../ai/market-data/fxcm/stream-service.ts";
import {
  assertSafeStreamPayload,
  isOutOfOrderQuote,
  normalizeFxcmPriceUpdate,
  normalizeFxcmSourceTimestampMs,
  validateFxcmRates,
} from "../../../../ai/market-data/fxcm/stream-normalize.ts";
import {
  parseEngineIoPollingBody,
  type FakeFxcmTransportController,
} from "../../../../ai/market-data/fxcm/stream-transport.ts";
import { createFxcmMarketDataProvider } from "../../../../ai/market-data/fxcm/provider.ts";
import { FXCM_PHASE29_CAPABILITIES } from "../../../../ai/market-data/fxcm/config.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const TOKEN = "abcdef0123456789abcdef0123456789token";

const SAMPLE_INSTRUMENTS = [
  { symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 },
  { symbol: "GBP/USD", visible: true, order: 2, instrumentType: 1 },
];

function mockFetch() {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/socket.io/")) {
      return new Response('97:0{"sid":"StreamSid","upgrades":[],"pingInterval":25000}', { status: 200 });
    }
    if (url.includes("/trading/get_instruments")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        data: { instrument: SAMPLE_INSTRUMENTS },
      }), { status: 200 });
    }
    if (url.includes("/subscribe")) {
      expect(init?.method).toBe("POST");
      const body = String(init?.body ?? "");
      expect(body).toContain("pairs=");
      return new Response(JSON.stringify({
        response: { executed: true, error: "" },
        pairs: JSON.stringify({
          Updated: Math.floor(Date.now() / 1000),
          Rates: [1.08501, 1.08521, 1.09, 1.08],
          Symbol: body.includes("GBP") ? "GBP/USD" : "EUR/USD",
        }),
      }), { status: 200 });
    }
    if (url.includes("/unsubscribe")) {
      return new Response(JSON.stringify({
        response: { executed: true, error: "" },
        pairs: "EUR/USD",
      }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("Forex Phase 29 — FXCM real-time stream", () => {
  const services: Array<{ shutdown: () => void }> = [];
  afterEach(() => {
    for (const s of services) s.shutdown();
    services.length = 0;
  });

  it("1 provider registers streaming capabilities", () => {
    expect(FXCM_PHASE29_CAPABILITIES.liveQuotes).toBe(true);
    expect(FXCM_PHASE29_CAPABILITIES.streamingQuotes).toBe(true);
    expect(FXCM_PHASE29_CAPABILITIES.historicalPrices).toBe(true);
    expect(FXCM_PHASE29_CAPABILITIES.trading).toBe(false);
    const provider = createFxcmMarketDataProvider({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    expect(provider.getCapabilities().streamingQuotes).toBe(true);
    expect(provider.getCapabilities().trading).toBe(false);
  });

  it("2/3/4/5 subscribe valid, reject invalid, prevent duplicates", async () => {
    const fake: FakeFxcmTransportController = {};
    const svc = createFxcmRealtimeStreamService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
        KWIZERA_FXCM_QUOTE_STALE_MS: "30000",
      },
      fetchImpl: mockFetch(),
      fakeTransport: fake,
      autoReconnect: false,
    });
    services.push(svc);

    const sub = await svc.subscribe("EUR/USD");
    expect(sub.providerSymbol).toBe("EUR/USD");
    expect(sub.canonicalSymbol).toBe("EURUSD");
    expect(sub.state).toBe("SUBSCRIBED");

    const again = await svc.subscribe("EURUSD");
    expect(again.providerSymbol).toBe("EUR/USD");
    expect(svc.listSubscriptions()).toHaveLength(1);

    await expect(svc.subscribe("NOT/A/PAIR")).rejects.toMatchObject({
      code: "FXCM_INSTRUMENT_NOT_FOUND",
    });
  });

  it("6 unsubscribe cleans subscription", async () => {
    const fake: FakeFxcmTransportController = {};
    const svc = createFxcmRealtimeStreamService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
      fakeTransport: fake,
      autoReconnect: false,
    });
    services.push(svc);
    await svc.subscribe("EUR/USD");
    await svc.unsubscribe("EUR/USD");
    expect(svc.listSubscriptions()).toHaveLength(0);
  });

  it("7/8/9/10 normalize quote + validate bid/ask + reject invalid", () => {
    const ok = normalizeFxcmPriceUpdate(
      { Updated: 1_700_000_000, Rates: [1.1, 1.2, 1.3, 1.0], Symbol: "EUR/USD" },
      {
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        marketType: "FOREX",
        receivedAtMs: 1_700_000_100_000,
        connectionState: "LIVE",
      },
    );
    expect(ok.valid).toBe(true);
    expect(ok.bid).toBe(1.1);
    expect(ok.ask).toBe(1.2);
    expect(ok.mid).toBeCloseTo(1.15);
    expect(ok.sourceTimestamp).toBeTruthy();
    expect(ok.receivedAt).toBeTruthy();
    expect(ok.provider).toBe("FXCM");

    const bad = validateFxcmRates([1.2, 1.1]);
    expect(bad.valid).toBe(false);
    expect(bad.reason).toMatch(/bid > ask/);

    const nan = normalizeFxcmPriceUpdate(
      { Updated: 1_700_000_000, Rates: [Number.NaN, 1.2], Symbol: "EUR/USD" },
      {
        providerSymbol: "EUR/USD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EUR/USD",
        marketType: "FOREX",
        receivedAtMs: Date.now(),
        connectionState: "LIVE",
      },
    );
    expect(nan.valid).toBe(false);
  });

  it("11/12/13 stale + out-of-order + timestamp normalization", async () => {
    expect(normalizeFxcmSourceTimestampMs(1_700_000_000)).toBe(1_700_000_000_000);
    expect(normalizeFxcmSourceTimestampMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(isOutOfOrderQuote(1000, 2000)).toBe(true);
    expect(isOutOfOrderQuote(3000, 2000)).toBe(false);

    let now = Date.now();
    const fake: FakeFxcmTransportController = {};
    const svc = createFxcmRealtimeStreamService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
        KWIZERA_FXCM_QUOTE_STALE_MS: "5000",
      },
      fetchImpl: mockFetch(),
      fakeTransport: fake,
      autoReconnect: false,
      nowMs: () => now,
    });
    services.push(svc);
    await svc.subscribe("EUR/USD");
    // Advance clock and inject a newer source event than the subscribe snapshot.
    now += 1_000;
    const sourceSec = Math.floor(now / 1000) + 60;
    svc.injectRawEvent("EUR/USD", {
      Updated: sourceSec,
      Rates: [1.1, 1.11, 1.12, 1.09],
      Symbol: "EUR/USD",
    });
    expect(svc.getStreamState()).toBe("LIVE");

    svc.injectRawEvent("EUR/USD", {
      Updated: sourceSec - 10,
      Rates: [9.9, 9.91, 9.92, 9.8],
      Symbol: "EUR/USD",
    });
    const quote = svc.getQuote("EUR/USD");
    expect(quote?.bid).toBe(1.1);

    now += 6_000;
    expect(svc.evaluateFreshness()).toBe("STALE");
  });

  it("14/15/16 connection state + reconnect restore subscriptions", async () => {
    const fake: FakeFxcmTransportController = {};
    const svc = createFxcmRealtimeStreamService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
      fakeTransport: fake,
      autoReconnect: false,
    });
    services.push(svc);
    expect(["DISABLED", "NOT_CONFIGURED", "DISCONNECTED"]).toContain(svc.getStreamState());
    await svc.subscribe("EUR/USD");
    expect(["CONNECTED", "LIVE"]).toContain(svc.getStreamState());
    fake.setConnected?.(false);
    await svc.ensureConnected();
    expect(svc.listSubscriptions().some((s) => s.providerSymbol === "EUR/USD")).toBe(true);
  });

  it("17/18/19/20 cleanup + multi-symbol + provider identity", async () => {
    const fake: FakeFxcmTransportController = {};
    const svc = createFxcmRealtimeStreamService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch(),
      fakeTransport: fake,
      autoReconnect: false,
    });
    services.push(svc);
    await svc.subscribe("EUR/USD");
    await svc.subscribe("GBP/USD");
    expect(svc.listSubscriptions()).toHaveLength(2);
    const status = svc.toSafeApiPayload();
    expect(status.provider).toBe("FXCM");
    expect(status.trading).toBe("DISABLED");
    expect(status.mode).toBe("REALTIME_QUOTE");
    assertSafeStreamPayload(status, TOKEN);
    svc.shutdown();
    expect(svc.listSubscriptions()).toHaveLength(0);
  });

  it("21/22/23 no fake prices / no secrets in payload", () => {
    const streamSrc = read("ai/market-data/fxcm/stream-service.ts");
    const normSrc = read("ai/market-data/fxcm/stream-normalize.ts");
    expect(streamSrc).not.toMatch(/Math\.random/);
    expect(normSrc).not.toMatch(/Math\.random/);
    expect(streamSrc).not.toMatch(/fakeQuote|mockQuote|simulatedQuote|fakeTick|simulatedPrice/);
    expect(() => assertSafeStreamPayload({ token: TOKEN }, TOKEN)).toThrow();
  });

  it("24 Engine.IO event parse", () => {
    const packets = parseEngineIoPollingBody(
      '42["EUR/USD","{\\"Updated\\":1700000000,\\"Rates\\":[1.1,1.2,1.3,1.0],\\"Symbol\\":\\"EUR/USD\\"}"]',
    );
    expect(packets.some((p) => p.type === "event" && p.eventName === "EUR/USD")).toBe(true);
  });

  it("25 Phase 28 historical regression still present", () => {
    const hist = read("ai/market-data/fxcm/historical-service.ts");
    expect(hist).toContain("getHistoricalCandles");
    expect(hist).not.toMatch(/Math\.random/);
    const provider = createFxcmMarketDataProvider({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    expect(provider.getCapabilities().historicalPrices).toBe(true);
    expect(provider.getHistoricalService()).toBeTruthy();
  });

  it("26 admin/API surface exists", () => {
    const api = read("dev/server/forex-providers-api.ts");
    expect(api).toContain("/api/forex/providers/fxcm/stream/status");
    expect(api).toContain("/api/forex/providers/fxcm/quotes");
    expect(api).toContain("/api/forex/providers/fxcm/stream/subscribe");
    const page = read("desktop/forex-admin/ForexAdminStreamPage.tsx");
    expect(page).toContain("REALTIME_QUOTE");
    expect(page).not.toMatch(/Math\.random/);
    const routes = read("desktop/forex-admin/forex-admin-routes.ts");
    expect(routes).toContain("/admin/forex/stream");
  });

  it("27 disabled / not configured states", () => {
    const disabled = createFxcmRealtimeStreamService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
      autoReconnect: false,
    });
    services.push(disabled);
    expect(disabled.getStreamState()).toBe("DISABLED");

    const missing = createFxcmRealtimeStreamService({
      env: { KWIZERA_FXCM_ENABLED: "1" },
      autoReconnect: false,
    });
    services.push(missing);
    expect(missing.getStreamState()).toBe("NOT_CONFIGURED");
  });
});
