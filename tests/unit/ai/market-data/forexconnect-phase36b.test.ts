/**
 * Phase 36B — Admin auth UX, vault-locked saves, Demo login mapping (mocked).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  createForexConnectProfilesManager,
  resetForexConnectProfilesManagerForTests,
} from "../../../../ai/market-data/forexconnect/profiles.ts";
import { createForexConnectSessionService } from "../../../../ai/market-data/forexconnect/session.ts";
import {
  createForexConnectBridge,
} from "../../../../ai/market-data/forexconnect/client.ts";
import {
  createForexConnectLiveCandleService,
  resetForexConnectLiveCandleServiceForTests,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import { assertAdminAccess, resolveAdminAuthMode } from "../../../../ai/admin-control-plane/admin-auth-boundary.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 36B Admin authorization boundary", () => {
  const prevMode = process.env.KWIZERA_ADMIN_AUTH_MODE;
  const prevToken = process.env.KWIZERA_ADMIN_API_TOKEN;
  const prevEnv = process.env.KWIZERA_ENV;
  const prevNode = process.env.NODE_ENV;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.KWIZERA_ADMIN_AUTH_MODE;
    else process.env.KWIZERA_ADMIN_AUTH_MODE = prevMode;
    if (prevToken === undefined) delete process.env.KWIZERA_ADMIN_API_TOKEN;
    else process.env.KWIZERA_ADMIN_API_TOKEN = prevToken;
    if (prevEnv === undefined) delete process.env.KWIZERA_ENV;
    else process.env.KWIZERA_ENV = prevEnv;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });

  it("rejects missing token in require-admin-token mode without revealing secrets", () => {
    process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-token";
    process.env.KWIZERA_ADMIN_API_TOKEN = "expected-admin-token-value";
    expect(resolveAdminAuthMode()).toBe("require-admin-token");
    const denied = assertAdminAccess({
      roles: [],
      path: "/api/forex/providers/forexconnect/profiles/credentials",
      adminApi: true,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/Admin API token required/i);
    expect(denied.mayRevealSecrets).toBe(false);

    const allowed = assertAdminAccess({
      roles: [],
      path: "/api/forex/providers/forexconnect/profiles/credentials",
      adminApi: true,
      adminToken: "expected-admin-token-value",
    });
    expect(allowed.allowed).toBe(true);
  });
});

describe("Phase 36B persistent vault saves (mocked)", () => {
  let tmp: string;
  const prevPassphrase = process.env.KWIZERA_SECRETS_PASSPHRASE;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fc-p36b-"));
    resetForexConnectProfilesManagerForTests();
    resetForexConnectLiveCandleServiceForTests();
  });

  afterEach(async () => {
    if (prevPassphrase === undefined) delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    else process.env.KWIZERA_SECRETS_PASSPHRASE = prevPassphrase;
    resetForexConnectProfilesManagerForTests();
    resetForexConnectLiveCandleServiceForTests();
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  });

  it("rejects save when vault is locked (no silent memory-only persistence)", async () => {
    delete process.env.KWIZERA_SECRETS_PASSPHRASE;
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    expect(mgr.storageMode()).toBe("memory-only");
    await expect(
      mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" }),
    ).rejects.toThrow(/Encrypted vault is locked/i);
    expect(mgr.publicProfile("demo").configured).toBe(false);
  });

  it("persists demo credentials across manager re-init when vault unlocked", async () => {
    process.env.KWIZERA_SECRETS_PASSPHRASE = "phase36b-test-passphrase";
    const mgr1 = createForexConnectProfilesManager();
    await mgr1.initialize(tmp);
    await mgr1.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });
    expect(mgr1.publicState().storageMode).toBe("encrypted-vault");

    resetForexConnectProfilesManagerForTests();
    const mgr2 = createForexConnectProfilesManager();
    await mgr2.initialize(tmp);
    const creds = mgr2.getCredentials("demo");
    expect(creds?.username).toBe("demo-user");
    expect(creds?.password).toBe("demo-secret-aaaa");
    expect(creds?.sdkEnvironment).toBe("demo");
    expect(JSON.stringify(mgr2.publicState())).not.toContain("demo-secret-aaaa");
  });

  it("maps Demo activate to SDK connection Demo (mocked sidecar)", async () => {
    process.env.KWIZERA_SECRETS_PASSPHRASE = "phase36b-test-passphrase";
    const mgr = createForexConnectProfilesManager();
    await mgr.initialize(tmp);
    await mgr.saveCredentials("demo", { username: "demo-user", password: "demo-secret-aaaa" });

    let seen: Record<string, unknown> | null = null;
    const bridge = createForexConnectBridge({
      env: { KWIZERA_FOREXCONNECT_ENABLED: "1" },
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(_input);
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
        if (url.endsWith("/connect")) {
          seen = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          return new Response(JSON.stringify({
            ok: true,
            status: "CONNECTED",
            enabled: true,
            configured: true,
            environment: "demo",
            environmentLabel: "FXCM DEMO",
            connectionLabel: "Demo",
            usernameConfigured: true,
            passwordConfigured: true,
            instrumentCount: 4,
            trading: "DISABLED",
            connectedAt: "2026-10-10T15:00:00Z",
          }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }) as typeof fetch,
    });
    const live = createForexConnectLiveCandleService({ bridge });
    const session = createForexConnectSessionService({ profiles: mgr, bridge, live });
    const result = await session.testConnection("demo", { confirmSwitch: true });
    expect(result.ok).toBe(true);
    expect(seen?.username).toBe("demo-user");
    expect(seen?.password).toBe("demo-secret-aaaa");
    expect(seen?.environment).toBe("demo");
    expect(JSON.stringify(result)).not.toContain("demo-secret-aaaa");
  });
});

describe("Phase 36B UI/API wiring", () => {
  it("exposes Admin API Access unlock and auth-check route", () => {
    const page = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    const api = read("dev/server/forexconnect-api.ts");
    const client = read("desktop/forex-admin/api.ts");
    expect(page).toContain("Admin API Access");
    expect(page).toContain("Authorize session");
    expect(page).toContain("Password: {profile.passwordConfigured ? \"saved\"");
    expect(api).toContain("profiles/auth-check");
    expect(api).toContain("profiles/credentials/clear");
    expect(api).toContain("assertAdminAccess");
    expect(client).toContain("FOREX_ADMIN_TOKEN_STORAGE_KEY");
    expect(client).toContain("kwizera.admin.apiToken");
  });

  it("sidecar login uses Demo/Real connection labels", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    expect(sidecar).toContain('fx.login(str(username), str(password), str(url), str(connection)');
    expect(sidecar).toContain('"Demo"');
    expect(sidecar).toContain('"Real"');
  });
});
