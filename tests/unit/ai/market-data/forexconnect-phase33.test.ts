/**
 * Phase 33 — ForexConnect bridge tests (mocked sidecar; not proof of live FXCM).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveForexConnectConfig } from "../../../../ai/market-data/forexconnect/config.ts";
import {
  assertNoSecretsInForexConnectPayload,
  createForexConnectBridge,
} from "../../../../ai/market-data/forexconnect/client.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 33 ForexConnect bridge", () => {
  it("parses disabled / not configured / demo vs real", () => {
    expect(resolveForexConnectConfig({}).enabled).toBe(false);
    const demo = resolveForexConnectConfig({
      KWIZERA_FOREXCONNECT_ENABLED: "1",
      KWIZERA_FOREXCONNECT_ENVIRONMENT: "demo",
      KWIZERA_FOREXCONNECT_USERNAME: "user1",
      KWIZERA_FOREXCONNECT_PASSWORD: "secret-password",
    });
    expect(demo.enabled).toBe(true);
    expect(demo.environment).toBe("demo");
    expect(demo.usernameConfigured).toBe(true);
    expect(demo.passwordConfigured).toBe(true);
    expect(demo.sidecarHost).toBe("127.0.0.1");

    const real = resolveForexConnectConfig({
      KWIZERA_FOREXCONNECT_ENABLED: "1",
      KWIZERA_FOREXCONNECT_ENVIRONMENT: "live",
      KWIZERA_FOREXCONNECT_USERNAME: "user1",
      KWIZERA_FOREXCONNECT_PASSWORD: "secret-password",
      KWIZERA_FOREXCONNECT_SIDECAR_HOST: "0.0.0.0",
    });
    expect(real.environment).toBe("real");
    // Force localhost — never allow public bind via config.
    expect(real.sidecarHost).toBe("127.0.0.1");
  });

  it("returns DISABLED when not enabled", async () => {
    const bridge = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "0" },
      fetchImpl: (async () => {
        throw new Error("should not call sidecar when disabled");
      }) as typeof fetch,
    });
    const status = await bridge.getStatus();
    expect(status.status).toBe("DISABLED");
    expect(status.trading).toBe("DISABLED");
  });

  it("returns NOT_CONFIGURED when enabled without credentials", async () => {
    const bridge = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "1" },
      fetchImpl: (async () => {
        throw new Error("sidecar down");
      }) as typeof fetch,
    });
    const status = await bridge.getStatus();
    expect(status.status).toBe("NOT_CONFIGURED");
    expect(status.errorCode).toBe("FOREXCONNECT_NOT_CONFIGURED");
  });

  it("surfaces SERVICE_UNAVAILABLE when sidecar is down", async () => {
    const bridge = createForexConnectBridge({
      env: {
        KWIZERA_FOREXCONNECT_ENABLED: "1",
        KWIZERA_FOREXCONNECT_USERNAME: "demo",
        KWIZERA_FOREXCONNECT_PASSWORD: "demo-pass-1234",
      },
      fetchImpl: (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as typeof fetch,
    });
    const status = await bridge.getStatus();
    expect(status.status).toBe("SERVICE_UNAVAILABLE");
    expect(status.sidecarReachable).toBe(false);
  });

  it("connect success via mocked sidecar", async () => {
    const bridge = createForexConnectBridge({
      env: {
        KWIZERA_FOREXCONNECT_ENABLED: "1",
        KWIZERA_FOREXCONNECT_USERNAME: "demo",
        KWIZERA_FOREXCONNECT_PASSWORD: "demo-pass-1234",
      },
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/connect") && init?.method === "POST") {
          return new Response(JSON.stringify({
            ok: true,
            status: "CONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            usernameConfigured: true,
            passwordConfigured: true,
            instrumentCount: 2,
            trading: "DISABLED",
            connectedAt: "2026-10-09T12:00:00Z",
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });
    const status = await bridge.connect();
    expect(status.status).toBe("CONNECTED");
    expect(status.instrumentCount).toBe(2);
  });

  it("authentication failure remains explicit", async () => {
    const bridge = createForexConnectBridge({
      env: {
        KWIZERA_FOREXCONNECT_ENABLED: "1",
        KWIZERA_FOREXCONNECT_USERNAME: "demo",
        KWIZERA_FOREXCONNECT_PASSWORD: "demo-pass-1234",
      },
      fetchImpl: (async () => new Response(JSON.stringify({
        ok: false,
        status: "AUTHENTICATION_FAILED",
        enabled: true,
        configured: true,
        environment: "demo",
        environmentLabel: "FXCM DEMO",
        usernameConfigured: true,
        passwordConfigured: true,
        errorCode: "FOREXCONNECT_AUTHENTICATION_FAILED",
        errorMessage: "Login failed",
        trading: "DISABLED",
      }), { status: 503 })) as typeof fetch,
    });
    const status = await bridge.connect();
    expect(status.status).toBe("AUTHENTICATION_FAILED");
    expect(status.ok).toBe(false);
  });

  it("instruments require CONNECTED and normalize provider identity", async () => {
    let connected = false;
    const bridge = createForexConnectBridge({
      env: {
        KWIZERA_FOREXCONNECT_ENABLED: "1",
        KWIZERA_FOREXCONNECT_USERNAME: "demo",
        KWIZERA_FOREXCONNECT_PASSWORD: "demo-pass-1234",
      },
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({
            ok: true,
            status: connected ? "CONNECTED" : "DISCONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            usernameConfigured: true,
            passwordConfigured: true,
            trading: "DISABLED",
          }), { status: 200 });
        }
        if (url.endsWith("/instruments")) {
          return new Response(JSON.stringify({
            ok: true,
            count: 1,
            instruments: [{
              provider: "FOREXCONNECT",
              providerSymbol: "EUR/USD",
              canonicalSymbol: "EURUSD",
              displaySymbol: "EUR/USD",
              marketType: "FOREX",
              baseAsset: "EUR",
              quoteAsset: "USD",
              status: "available",
            }],
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });

    const before = await bridge.listInstruments();
    expect(before.ok).toBe(false);

    connected = true;
    const after = await bridge.listInstruments();
    expect(after.ok).toBe(true);
    expect(after.instruments[0]?.provider).toBe("FOREXCONNECT");
    expect(after.instruments[0]?.canonicalSymbol).toBe("EURUSD");
  });

  it("refuses payloads that embed the password", () => {
    expect(() => assertNoSecretsInForexConnectPayload(
      { note: "x", secret: "super-secret-password" },
      { KWIZERA_FOREXCONNECT_PASSWORD: "super-secret-password" },
    )).toThrow(/password/i);
  });

  it("empty instrument list stays empty (no fabrication)", async () => {
    const bridge = createForexConnectBridge({
      env: {
        KWIZERA_FOREXCONNECT_ENABLED: "1",
        KWIZERA_FOREXCONNECT_USERNAME: "demo",
        KWIZERA_FOREXCONNECT_PASSWORD: "demo-pass-1234",
      },
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({
            ok: true,
            status: "CONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            usernameConfigured: true,
            passwordConfigured: true,
            trading: "DISABLED",
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true, count: 0, instruments: [] }), { status: 200 });
      }) as typeof fetch,
    });
    const res = await bridge.listInstruments();
    expect(res.ok).toBe(true);
    expect(res.instruments).toEqual([]);
  });

  it("Admin UI and sidecar files exist with required routes", () => {
    const page = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    const api = read("dev/server/forexconnect-api.ts");
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(page).toContain("Connect ForexConnect");
    expect(page).toContain("Discover instruments");
    expect(api).toContain("/api/forex/providers/forexconnect/status");
    expect(api).toContain("/api/forex/providers/forexconnect/connect");
    expect(api).toContain("/api/forex/providers/forexconnect/instruments");
    expect(sidecar).toContain("127.0.0.1");
    expect(sidecar).toContain("ForexConnect");
    expect(sidecar).not.toContain("place_order");
    // Phase 34 extends the same sidecar with get_history — still no trading.
    expect(sidecar).toContain("get_history");
  });
});
