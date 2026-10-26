/**
 * Phase 60.0.14 — centralized Forex Admin Access regressions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 60.0.14 shared Forex Admin token service", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const local: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
      key: (i) => [...store.keys()][i] ?? null,
    };
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", {
      get length() { return 0; },
      clear: () => undefined,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      key: () => null,
    } satisfies Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("saves, retrieves, masks, updates, and clears without exposing full secret in snapshot", async () => {
    const mod = await import("../../../desktop/forex/admin-access/forex-admin-token.ts");
    const saved = mod.saveForexAdminToken("super-secret-admin-token-value");
    expect(saved.ok).toBe(true);
    expect(saved.snapshot.configured).toBe(true);
    expect(saved.snapshot.masked).toBeTruthy();
    expect(saved.snapshot.masked).not.toContain("super-secret-admin-token-value");
    expect(mod.getForexAdminToken()).toBe("super-secret-admin-token-value");

    const listeners: number[] = [];
    const unsub = mod.subscribeForexAdminToken((snap) => {
      listeners.push(snap.generation);
    });
    mod.saveForexAdminToken("another-secret-token-zzzz");
    expect(mod.getForexAdminToken()).toBe("another-secret-token-zzzz");
    expect(listeners.length).toBeGreaterThan(0);

    const cleared = mod.clearForexAdminToken();
    expect(cleared.ok).toBe(true);
    expect(mod.getForexAdminToken()).toBe("");
    expect(cleared.snapshot.configured).toBe(false);
    unsub();
  });

  it("migrates legacy sessionStorage into localStorage", async () => {
    const session = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      get length() { return session.size; },
      clear: () => session.clear(),
      getItem: (k: string) => (session.has(k) ? session.get(k)! : null),
      setItem: (k: string, v: string) => { session.set(k, String(v)); },
      removeItem: (k: string) => { session.delete(k); },
      key: (i: number) => [...session.keys()][i] ?? null,
    } satisfies Storage);
    session.set("kwizera.admin.apiToken", "legacy-session-token-abc");

    const mod = await import("../../../desktop/forex/admin-access/forex-admin-token.ts");
    expect(mod.getForexAdminToken()).toBe("legacy-session-token-abc");
    expect(store.get("kwizera.admin.apiToken")).toBe("legacy-session-token-abc");
    expect(session.has("kwizera.admin.apiToken")).toBe(false);
  });

  it("only attaches credentials to approved Forex/Admin API paths", async () => {
    const mod = await import("../../../desktop/forex/admin-access/forex-admin-token.ts");
    mod.saveForexAdminToken("path-guard-token-value");
    const ok = mod.buildForexAdminHeaders("/api/forex/automated-trading/status");
    expect(ok["x-kwizera-admin-token"]).toBe("path-guard-token-value");
    expect(ok.Authorization).toBe("Bearer path-guard-token-value");

    const blocked = mod.buildForexAdminHeaders("https://api.binance.com/api/v3/ticker");
    expect(blocked["x-kwizera-admin-token"]).toBeUndefined();
    expect(blocked.Authorization).toBeUndefined();

    const blockedRelative = mod.buildForexAdminHeaders("/api/public/health");
    expect(blockedRelative["x-kwizera-admin-token"]).toBeUndefined();
  });

  it("redacts token from user-facing strings", async () => {
    const mod = await import("../../../desktop/forex/admin-access/forex-admin-token.ts");
    mod.saveForexAdminToken("leak-me-token-xyz");
    expect(mod.redactForexAdminToken("failed leak-me-token-xyz oops")).toBe("failed [REDACTED] oops");
  });
});

describe("Phase 60.0.14 module migration contracts", () => {
  it("central Admin Access card remains shared; modules drop duplicate token forms", () => {
    const dash = read("desktop/forex/ForexDashboard.tsx");
    expect(dash).not.toContain("ForexAdminAccessCard");
    expect(dash).toContain("fx-admin-access-dash-link");
    expect(dash).toContain("admin-access");

    const page = read("desktop/forex/ForexAdminAccessPage.tsx");
    expect(page).toContain("ForexAdminAccessCard");
    expect(page).toContain('data-forex-page="admin-access"');

    const card = read("desktop/forex/admin-access/ForexAdminAccessCard.tsx");
    expect(card).toContain("Forex Admin Token");
    expect(card).toContain("data-fx-admin-masked");
    expect(card).toContain("/forex/admin-access");
    expect(card).not.toMatch(/console\.(log|debug|info|warn|error)\([^\n]*token/i);

    const tm = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(tm).toContain("ForexAdminAccessLink");
    expect(tm).toContain("buildForexAdminHeaders");
    expect(tm).not.toContain("fx-tm-admin-token");
    expect(tm).not.toMatch(/sessionStorage\.setItem\(\s*FOREX_ADMIN_TOKEN/);

    const at = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(at).toContain("ForexAdminAccessLink");
    expect(at).toContain("buildForexAdminHeaders");
    expect(at).not.toContain("fx-at-admin-token");

    const mon = read("desktop/forex/ForexMonitorPage.tsx");
    expect(mon).toContain("ForexAdminAccessLink");
    expect(mon).toContain("buildForexAdminHeaders");
    expect(mon).not.toContain("fx-monitor-token");

    const adminApi = read("desktop/forex-admin/api.ts");
    expect(adminApi).toContain("buildForexAdminHeaders");
    expect(adminApi).toContain("../forex/admin-access/forex-admin-token");
  });

  it("preserves trading safety invariants and placesOrders false markers", () => {
    const tm = read("desktop/forex/ForexTradeMonitorPage.tsx");
    expect(tm).toContain('data-places-orders="false"');
    expect(tm).toContain('data-accepts-for-execution="false"');
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
  });
});
