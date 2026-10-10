/**
 * Phase 36 — DEMO/LIVE ForexConnect credential profiles (mocked; not live SDK proof).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  createForexConnectProfilesManager,
  resetForexConnectProfilesManagerForTests,
  uiEnvToSdk,
} from "../../../../ai/market-data/forexconnect/profiles.ts";
import {
  assertNoSecretsInForexConnectPayload,
  createForexConnectBridge,
} from "../../../../ai/market-data/forexconnect/client.ts";
import { createForexConnectSessionService } from "../../../../ai/market-data/forexconnect/session.ts";
import {
  createForexConnectLiveCandleService,
  resetForexConnectLiveCandleServiceForTests,
} from "../../../../ai/market-data/forexconnect/live-service.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 36 profile isolation (mocked)", () => {
  let tmp: string;
  const prevPassphrase = process.env.KWIZERA_SECRETS_PASSPHRASE;
  const prevUser = process.env.KWIZERA_FOREXCONNECT_USERNAME;
  const prevPass = process.env.KWIZERA_FOREXCONNECT_PASSWORD;
  const prevEnv = process.env.KWIZERA_FOREXCONNECT_ENVIRONMENT;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fc-p36-"));
    process.env.KWIZERA_SECRETS_PASSPHRASE = "phase36-test-passphrase-not-production";
    delete process.env.KWIZERA_FOREXCONNECT_USERNAME;
    delete process.env.KWIZERA_FOREXCONNECT_PASSWORD;
    delete process.env.KWIZERA_FOREXCONNECT_ENVIRONMENT;
    resetForexConnectProfilesManagerForTests();
    resetForexConnectLiveCandleServiceForTests();
  });

  afterEach(async () => {
    if (prevPassphrase === undefined) delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    else process.env.KWIZERA_SECRETS_PASSPHRASE = prevPassphrase;
    if (prevUser === undefined) delete process.env.KWIZERA_FOREXCONNECT_USERNAME;
    else process.env.KWIZERA_FOREXCONNECT_USERNAME = prevUser;
    if (prevPass === undefined) delete process.env.KWIZERA_FOREXCONNECT_PASSWORD;
    else process.env.KWIZERA_FOREXCONNECT_PASSWORD = prevPass;
    if (prevEnv === undefined) delete process.env.KWIZERA_FOREXCONNECT_ENVIRONMENT;
    else process.env.KWIZERA_FOREXCONNECT_ENVIRONMENT = prevEnv;
    resetForexConnectProfilesManagerForTests();
    resetForexConnectLiveCandleServiceForTests();
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  });

  it("keeps DEMO and LIVE credentials isolated", async () => {
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    await mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });
    await mgr.saveCredentials("live", { username: "live-user", password: "live-secret-bbbb" });

    const demo = mgr.getCredentials("demo");
    const live = mgr.getCredentials("live");
    expect(demo?.username).toBe("demo-user");
    expect(demo?.password).toBe("demo-secret-aaaa");
    expect(demo?.sdkEnvironment).toBe("demo");
    expect(live?.username).toBe("live-user");
    expect(live?.password).toBe("live-secret-bbbb");
    expect(live?.sdkEnvironment).toBe("real");
    expect(uiEnvToSdk("live")).toBe("real");

    const publicState = mgr.publicState();
    const text = JSON.stringify(publicState);
    expect(text).not.toContain("demo-secret-aaaa");
    expect(text).not.toContain("live-secret-bbbb");
    expect(publicState.profiles.demo.configured).toBe(true);
    expect(publicState.profiles.live.configured).toBe(true);
    expect(publicState.profiles.demo.passwordConfigured).toBe(true);
    expect(publicState.storageMode).toBe("encrypted-vault");

    const metaRaw = await fs.readFile(path.join(tmp, "forexconnect", "profiles.json"), "utf8");
    expect(metaRaw).not.toContain("demo-secret");
    expect(metaRaw).not.toContain("live-secret");
    expect(metaRaw).toContain("demo-user");
  });

  it("does not fall back across environments from env vars", async () => {
    process.env.KWIZERA_FOREXCONNECT_USERNAME = "env-demo";
    process.env.KWIZERA_FOREXCONNECT_PASSWORD = "env-demo-password";
    process.env.KWIZERA_FOREXCONNECT_ENVIRONMENT = "demo";
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    expect(mgr.getCredentials("demo")?.username).toBe("env-demo");
    expect(mgr.getCredentials("live")).toBeNull();
  });

  it("redacts password fields from API payload guard", () => {
    expect(() => assertNoSecretsInForexConnectPayload({
      ok: true,
      password: "super-secret-value",
    })).toThrow(/password/i);
    expect(() => assertNoSecretsInForexConnectPayload(
      { ok: true, note: "x" },
      {},
      ["extra-secret-zzzz"],
    )).not.toThrow();
    expect(() => assertNoSecretsInForexConnectPayload(
      { ok: true, leak: "extra-secret-zzzz" },
      {},
      ["extra-secret-zzzz"],
    )).toThrow();
  });

  it("connects DEMO with DEMO credentials only (mocked sidecar)", async () => {
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    await mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });
    await mgr.saveCredentials("live", { username: "live-user", password: "live-secret-bbbb" });

    let seenBody: Record<string, unknown> | null = null;
    const bridge = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "1" },
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(_input);
        if (url.endsWith("/connect") && init?.method === "POST") {
          seenBody = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
          return new Response(JSON.stringify({
            ok: true,
            status: "CONNECTED",
            enabled: true,
            configured: true,
            environment: seenBody.environment,
            environmentLabel: seenBody.environment === "real" ? "FXCM REAL" : "FXCM DEMO",
            usernameConfigured: true,
            passwordConfigured: true,
            instrumentCount: 3,
            trading: "DISABLED",
            connectedAt: "2026-10-10T12:00:00Z",
          }), { status: 200 });
        }
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({
            ok: true,
            status: "DISCONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            trading: "DISABLED",
          }), { status: 200 });
        }
        if (url.endsWith("/disconnect")) {
          return new Response(JSON.stringify({
            ok: true,
            status: "DISCONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            trading: "DISABLED",
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });

    const live = createForexConnectLiveCandleService({ bridge });
    const session = createForexConnectSessionService({ profiles: mgr, bridge, live });
    const result = await session.activate("demo", { confirmSwitch: true });
    expect(result.ok).toBe(true);
    expect(seenBody?.username).toBe("demo-user");
    expect(seenBody?.password).toBe("demo-secret-aaaa");
    expect(seenBody?.environment).toBe("demo");
    expect(mgr.getActiveEnvironment()).toBe("demo");
    expect(JSON.stringify(result)).not.toContain("demo-secret-aaaa");
  });

  it("requires confirmation and cleans up when switching DEMO → LIVE (mocked)", async () => {
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    await mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });
    await mgr.saveCredentials("live", { username: "live-user", password: "live-secret-bbbb" });

    let connectedEnv: string | null = null;
    let connectBodies: Array<Record<string, unknown>> = [];
    const bridge = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "1" },
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(_input);
        if (url.endsWith("/status")) {
          return new Response(JSON.stringify({
            ok: true,
            status: connectedEnv ? "CONNECTED" : "DISCONNECTED",
            enabled: true,
            configured: true,
            environment: connectedEnv ?? "demo",
            environmentLabel: connectedEnv === "real" ? "FXCM REAL" : "FXCM DEMO",
            trading: "DISABLED",
            instrumentCount: connectedEnv ? 2 : 0,
          }), { status: 200 });
        }
        if (url.endsWith("/connect") && init?.method === "POST") {
          const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
          connectBodies.push(body);
          connectedEnv = String(body.environment ?? "demo");
          return new Response(JSON.stringify({
            ok: true,
            status: "CONNECTED",
            enabled: true,
            configured: true,
            environment: connectedEnv,
            environmentLabel: connectedEnv === "real" ? "FXCM REAL" : "FXCM DEMO",
            usernameConfigured: true,
            passwordConfigured: true,
            instrumentCount: 2,
            trading: "DISABLED",
            connectedAt: "2026-10-10T12:00:00Z",
          }), { status: 200 });
        }
        if (url.endsWith("/disconnect")) {
          connectedEnv = null;
          return new Response(JSON.stringify({
            ok: true,
            status: "DISCONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            trading: "DISABLED",
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });

    const live = createForexConnectLiveCandleService({ bridge });
    const session = createForexConnectSessionService({ profiles: mgr, bridge, live });
    expect((await session.activate("demo", { confirmSwitch: true })).ok).toBe(true);

    const blocked = await session.activate("live", { confirmSwitch: false });
    expect(blocked.ok).toBe(false);
    expect(blocked.requiresConfirmation).toBe(true);
    expect(blocked.confirmationMessage).toMatch(/DEMO to LIVE/);
    expect(mgr.getActiveEnvironment()).toBe("demo");

    const switched = await session.activate("live", { confirmSwitch: true });
    expect(switched.ok).toBe(true);
    expect(mgr.getActiveEnvironment()).toBe("live");
    const last = connectBodies[connectBodies.length - 1]!;
    expect(last.username).toBe("live-user");
    expect(last.password).toBe("live-secret-bbbb");
    expect(last.environment).toBe("real");
  });

  it("does not mark new environment active when authentication fails (mocked)", async () => {
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    await mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });

    const bridge = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "1" },
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(_input);
        if (url.endsWith("/connect")) {
          return new Response(JSON.stringify({
            ok: false,
            status: "AUTHENTICATION_FAILED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            errorCode: "FOREXCONNECT_AUTHENTICATION_FAILED",
            errorMessage: "Login failed",
            trading: "DISABLED",
          }), { status: 503 });
        }
        if (url.endsWith("/status") || url.endsWith("/disconnect")) {
          return new Response(JSON.stringify({
            ok: true,
            status: "DISCONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            trading: "DISABLED",
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });

    const live = createForexConnectLiveCandleService({ bridge });
    const session = createForexConnectSessionService({ profiles: mgr, bridge, live });
    const result = await session.activate("demo", { confirmSwitch: true });
    expect(result.ok).toBe(false);
    expect(result.status.status).toBe("AUTHENTICATION_FAILED");
    expect(mgr.getActiveEnvironment()).toBeNull();
  });

  it("blocks instrument discovery across environments", async () => {
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    await mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });
    mgr.setActiveSession("demo", "CONNECTED");

    const bridge = createForexConnectBridge({
      env: {
        KWIZERA_FOREXCONNECT_ENABLED: "1",
        KWIZERA_FOREXCONNECT_USERNAME: "demo-user",
        KWIZERA_FOREXCONNECT_PASSWORD: "demo-secret-aaaa",
      },
      fetchImpl: (async () => new Response(JSON.stringify({
        ok: true,
        status: "CONNECTED",
        enabled: true,
        configured: true,
        environment: "demo",
        environmentLabel: "FXCM DEMO",
        trading: "DISABLED",
        instrumentCount: 1,
      }), { status: 200 })) as typeof fetch,
    });
    const live = createForexConnectLiveCandleService({ bridge });
    const session = createForexConnectSessionService({ profiles: mgr, bridge, live });
    const cross = await session.discoverInstruments("live");
    expect(cross.ok).toBe(false);
    expect(cross.error?.code).toBe("ENVIRONMENT_MISMATCH");
  });

  it("Admin UI and API expose DEMO/LIVE account management without password echo", () => {
    const page = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    expect(page).toContain("ForexConnect Accounts");
    expect(page).toContain("Save Credentials");
    expect(page).toContain("Test Connection");
    expect(page).toContain("Discover Instruments");
    expect(page).toContain("Activate / Connect");
    expect(page).toContain('type={showPassword ? "text" : "password"}');

    const api = read("dev/server/forexconnect-api.ts");
    expect(api).toContain("profiles/credentials");
    expect(api).toContain("assertAdminAccess");
    expect(api).toContain("requireAdmin");

    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain("overrides");
    expect(sidecar).toContain("_session_auth");
  });

  it("Binance provider identity remains distinct in Admin dashboard", () => {
    const admin = read("desktop/forex-admin/ForexAdminPages.tsx");
    expect(admin).toContain("BINANCE");
    expect(admin).toContain("Manage ForexConnect Accounts");
    expect(admin).toContain('data-forex-admin-forexconnect-summary');
    expect(admin).not.toMatch(/KWIZERA_FOREXCONNECT_PASSWORD\s*=/);
  });
});
