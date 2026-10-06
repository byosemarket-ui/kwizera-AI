import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createBinanceMarketDataHandler } from "../../../../dev/server/binance-market-data-api.ts";

function fakeReq(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

async function invoke(
  method: string,
  pathname: string,
  fetchImpl: typeof fetch,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const handler = createBinanceMarketDataHandler({
    env: { KWIZERA_ENV: "production", KWIZERA_BINANCE_ENABLED: "1" },
    fetchImpl,
  });
  let status = 0;
  let body: Record<string, unknown> = {};
  const sent = await handler.handle(
    fakeReq(method),
    {} as ServerResponse,
    new URL(pathname, "http://studio.local"),
    (_res, nextStatus, data) => {
      status = nextStatus;
      body = data as Record<string, unknown>;
    },
  );
  expect(sent).toBe(true);
  return { status, body };
}

describe("Binance market-data HTTP foundation", () => {
  it("returns a normalized status snapshot without secrets or live claims", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/v3/ping")) return new Response("{}", { status: 200 });
      if (url.includes("/api/v3/time")) return new Response(JSON.stringify({ serverTime: 42 }), { status: 200 });
      return new Response("missing", { status: 404 });
    }) as typeof fetch;

    const { status, body } = await invoke("GET", "/api/forex/binance/status", fetchImpl);
    const snapshot = body.snapshot as { state: string; liveMarketData: boolean };
    const published = body.public as { restBaseHost: string; tradingEnabled: boolean };
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(snapshot.state).toBe("CONNECTED");
    expect(snapshot.liveMarketData).toBe(false);
    expect(published.tradingEnabled).toBe(false);
    expect(published.restBaseHost).toBe("api.binance.com");
    expect(JSON.stringify(body)).not.toMatch(/apiKey|apiSecret|BINANCE_API_KEY|BINANCE_API_SECRET/i);
  });

  it("rejects unknown Binance routes and non-GET methods", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 200 })) as typeof fetch;
    const missing = await invoke("GET", "/api/forex/binance/orders", fetchImpl);
    expect(missing.status).toBe(404);
    const posted = await invoke("POST", "/api/forex/binance/status", fetchImpl);
    expect(posted.status).toBe(405);
  });

  it("returns normalized Spot markets without prices or secrets", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toContain("/api/v3/exchangeInfo");
      return new Response(JSON.stringify({
        symbols: [
          { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING", permissions: ["SPOT"], isSpotTradingAllowed: true },
        ],
      }), { status: 200 });
    }) as typeof fetch;
    const { status, body } = await invoke("GET", "/api/forex/binance/markets", fetchImpl);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.liveMarketData).toBe(false);
    expect(body.marketType).toBe("spot");
    const markets = body.markets as Array<{ symbol: string; lastPrice?: unknown }>;
    expect(markets[0]?.symbol).toBe("BTCUSDT");
    expect(markets[0]?.lastPrice).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/apiKey|apiSecret|BINANCE_API_KEY|BINANCE_API_SECRET/i);
  });

  it("returns historical klines without claiming a live stream", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(url).toContain("/api/v3/klines?symbol=ETHUSDT&interval=15m");
      return new Response(JSON.stringify([
        [1_700_000_000_000, "3000", "3010", "2990", "3005", "12", 1_700_000_899_999],
      ]), { status: 200 });
    }) as typeof fetch;
    const { status, body } = await invoke("GET", "/api/forex/binance/klines?symbol=ETHUSDT&interval=15m&limit=300", fetchImpl);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.liveMarketData).toBe(false);
    expect(body.symbol).toBe("ETHUSDT");
    expect(body.timeframe).toBe("15m");
    const candles = body.candles as Array<{ close: number }>;
    expect(candles[0]?.close).toBe(3005);
  });

  it("rejects unsupported kline intervals instead of inventing data", async () => {
    const fetchImpl = (async () => new Response("[]", { status: 200 })) as typeof fetch;
    const { status, body } = await invoke("GET", "/api/forex/binance/klines?symbol=BTCUSDT&interval=3m", fetchImpl);
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
