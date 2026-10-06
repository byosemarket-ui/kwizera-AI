import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createBinanceMarketDataHandler } from "../../../../dev/server/binance-market-data-api.ts";

async function withServer(fetchImpl: typeof fetch) {
  const handler = createBinanceMarketDataHandler({
    env: { KWIZERA_ENV: "production", KWIZERA_BINANCE_ENABLED: "1" },
    fetchImpl,
  });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    void handler.handle(req, res, url, (response, status, data) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    }).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end("no");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { server, port: address.port };
}

describe("Binance market-data HTTP foundation", () => {
  it("returns a normalized status snapshot without secrets", async () => {
    const { server, port } = await withServer(async (input) => {
      const url = String(input);
      if (url.includes("/api/v3/ping")) return new Response("{}", { status: 200 });
      if (url.includes("/api/v3/time")) return new Response(JSON.stringify({ serverTime: 42 }), { status: 200 });
      return new Response("missing", { status: 404 });
    });
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/forex/binance/status`);
      const body = await response.json() as {
        ok: boolean;
        snapshot: { state: string; liveMarketData: boolean; restBaseHost?: string };
        public: { restBaseHost: string; tradingEnabled: boolean };
      };
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.snapshot.state).toBe("CONNECTED");
      expect(body.snapshot.liveMarketData).toBe(false);
      expect(body.public.tradingEnabled).toBe(false);
      expect(body.public.restBaseHost).toBe("api.binance.com");
      expect(JSON.stringify(body)).not.toMatch(/apiKey|secret|BINANCE_API/i);
    } finally {
      server.close();
    }
  });

  it("rejects unknown Binance routes and non-GET methods", async () => {
    const { server, port } = await withServer(async () => new Response("{}", { status: 200 }));
    try {
      const missing = await fetch(`http://127.0.0.1:${port}/api/forex/binance/orders`);
      expect(missing.status).toBe(404);
      const posted = await fetch(`http://127.0.0.1:${port}/api/forex/binance/status`, { method: "POST" });
      expect(posted.status).toBe(405);
    } finally {
      server.close();
    }
  });
});
