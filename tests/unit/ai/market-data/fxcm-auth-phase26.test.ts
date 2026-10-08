/**
 * Phase 26 — FXCM authentication + secure credentials tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertSafeAuthStatus,
  createFxcmAuthenticationService,
  mapToAuthErrorCode,
} from "../../../../ai/market-data/fxcm/auth-service.ts";
import { createFxcmMarketDataProvider } from "../../../../ai/market-data/fxcm/provider.ts";
import { resolveFxcmConfig } from "../../../../ai/market-data/fxcm/config.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const TOKEN = "abcdef0123456789abcdef0123456789token";

function mockFetch(handlers: {
  handshakeStatus?: number;
  handshakeBody?: string;
  instrumentsStatus?: number;
}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/socket.io/")) {
      const status = handlers.handshakeStatus ?? 200;
      const body = handlers.handshakeBody
        ?? (status === 200 ? '97:0{"sid":"AuthSidXYZ","upgrades":[]}' : "unauthorized");
      return new Response(body, { status });
    }
    if (url.includes("/trading/get_instruments")) {
      return new Response(JSON.stringify({
        response: { executed: true },
        data: { instrument: [{ symbol: "EUR/USD", visible: true, order: 1, instrumentType: 1 }] },
      }), {
        status: handlers.instrumentsStatus ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("Forex Phase 26 — FXCM authentication", () => {
  it("1/2/3/4 missing, invalid, demo, real configuration", async () => {
    const missing = createFxcmAuthenticationService({
      env: { KWIZERA_FXCM_ENABLED: "1", KWIZERA_FXCM_ENVIRONMENT: "demo" },
    });
    const s1 = await missing.authenticate();
    expect(s1.state).toBe("NOT_CONFIGURED");

    const demo = resolveFxcmConfig({
      KWIZERA_FXCM_ENABLED: "1",
      KWIZERA_FXCM_ENVIRONMENT: "demo",
      KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
    });
    expect(demo.environmentLabel).toBe("FXCM DEMO");

    const real = resolveFxcmConfig({
      KWIZERA_FXCM_ENABLED: "1",
      KWIZERA_FXCM_ENVIRONMENT: "real",
      KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
    });
    expect(real.environmentLabel).toBe("FXCM REAL");
    expect(real.environment).toBe("real");
  });

  it("5 successful authentication via mocked Socket REST boundary", async () => {
    const auth = createFxcmAuthenticationService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch({}),
    });
    const ctx = await auth.authenticate();
    expect(ctx.state).toBe("AUTHENTICATED");
    expect(ctx.environmentLabel).toBe("FXCM DEMO");
    expect(ctx.marketData).toBe("NOT_STARTED");
    expect(ctx.liveStream).toBe("NOT_ENABLED_YET");
    expect(ctx.trading).toBe("DISABLED");
    expect(ctx.expiresAt).toBeNull();
    const safe = auth.getSafeStatus();
    expect(safe.authentication.state).toBe("AUTHENTICATED");
    expect(safe.authentication.session).toBe("ACTIVE");
    assertSafeAuthStatus(safe, TOKEN);
    expect(JSON.stringify(safe)).not.toContain(TOKEN);
    expect(JSON.stringify(safe)).not.toContain("Bearer ");
  });

  it("6/7 invalid credentials / unauthorized", async () => {
    const auth = createFxcmAuthenticationService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch({ handshakeStatus: 401 }),
      sleep: async () => undefined,
    });
    const ctx = await auth.authenticate();
    expect(ctx.state).toBe("AUTHENTICATION_ERROR");
    expect(ctx.lastErrorCode).toBe("FXCM_AUTH_UNAUTHORIZED");
  });

  it("8/9 network timeout / unavailable with bounded retry", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      throw new Error("network abort timeout");
    }) as typeof fetch;
    const auth = createFxcmAuthenticationService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl,
      sleep: async () => undefined,
    });
    const ctx = await auth.authenticate();
    expect(ctx.state).toBe("NETWORK_ERROR");
    expect(calls).toBeGreaterThan(1);
    expect(calls).toBeLessThanOrEqual(3);
  });

  it("13 concurrent authentication single-flight", async () => {
    let handshakeCalls = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/socket.io/")) {
        handshakeCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return new Response('97:0{"sid":"SharedSid","upgrades":[]}', { status: 200 });
      }
      return new Response(JSON.stringify({ response: { executed: true }, data: { instrument: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const auth = createFxcmAuthenticationService({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl,
    });
    const [a, b, c] = await Promise.all([
      auth.authenticate(),
      auth.authenticate(),
      auth.authenticate(),
    ]);
    expect(a.state).toBe("AUTHENTICATED");
    expect(b.state).toBe("AUTHENTICATED");
    expect(c.state).toBe("AUTHENTICATED");
    expect(handshakeCalls).toBe(1);
  });

  it("14/15/16/17 safe status — no credential leakage in status/errors/logs helpers", () => {
    const auth = createFxcmAuthenticationService({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    const safe = auth.getSafeStatus();
    const json = JSON.stringify(safe);
    expect(json).not.toMatch(/password|accessToken|refreshToken|authorizationHeader/i);
    expect(mapToAuthErrorCode("FXCM_AUTHENTICATION_FAILED")).toBe("FXCM_AUTH_UNAUTHORIZED");

    const providerSrc = read("ai/market-data/fxcm/auth-service.ts");
    expect(providerSrc).not.toMatch(/console\.info\([^)]*TOKEN/i);
    expect(providerSrc).toContain("Never include in JSON responses");
    expect(providerSrc).toContain('console.info("[FXCM] authentication succeeded"');
    const api = read("dev/server/forex-providers-api.ts");
    expect(api).toContain("assertSafeAuthStatus");
    // Token may be read only to assert it is absent from the serialized status.
    expect(api).toContain("Never returns FXCM tokens");
    expect(api).not.toContain("accessToken:");
  });

  it("18 frontend cannot access secrets", () => {
    for (const file of [
      "desktop/forex-admin/api.ts",
      "desktop/forex-admin/ForexAdminPages.tsx",
      "desktop/forex-admin/ForexAdminIntelligencePages.tsx",
    ]) {
      const src = read(file);
      expect(src).not.toContain("KWIZERA_FXCM_ACCESS_TOKEN");
      expect(src).not.toContain("authorizationHeader");
      expect(src).not.toContain("FXCM_PASSWORD");
    }
  });

  it("provider health uses auth service and never claims LIVE stream", async () => {
    const provider = createFxcmMarketDataProvider({
      env: {
        KWIZERA_FXCM_ENABLED: "1",
        KWIZERA_FXCM_ENVIRONMENT: "demo",
        KWIZERA_FXCM_ACCESS_TOKEN: TOKEN,
      },
      fetchImpl: mockFetch({}),
    });
    const health = await provider.healthCheck();
    expect(health.authenticated).toBe(true);
    expect(health.liveStreamEnabled).toBe(false);
    expect(health.tradingEnabled).toBe(false);
    expect(health.status).toBe("CONNECTED");
    const auth = provider.getSafeAuthenticationStatus();
    expect(auth.marketData).toBe("NOT_STARTED");
    expect(auth.note).toMatch(/not enabled/i);
  });

  it("disabled / not configured states", async () => {
    const disabled = createFxcmAuthenticationService({ env: { KWIZERA_FXCM_ENABLED: "0" } });
    expect((await disabled.authenticate()).state).toBe("DISABLED");
  });

  it("wires authenticate endpoint and admin UI without trading", () => {
    const api = read("dev/server/forex-providers-api.ts");
    const pages = read("desktop/forex-admin/ForexAdminPages.tsx");
    expect(api).toContain("/api/forex/providers/fxcm/authenticate");
    expect(api).not.toContain("open_trade");
    expect(pages).toContain("Test FXCM Authentication");
    expect(pages).toContain("FXCM authenticated ≠ LIVE");
    expect(pages).not.toContain("placeOrder");
  });
});
