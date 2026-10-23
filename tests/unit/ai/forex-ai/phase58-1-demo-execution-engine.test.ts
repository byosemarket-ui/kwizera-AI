/**
 * Phase 58.1 — DEMO execution engine unit tests (no live broker mutation).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoExecutionGrantStore,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 58.1 DEMO grant store", () => {
  let dir: string;
  let store: DemoExecutionGrantStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-demo-grant-"));
    store = new DemoExecutionGrantStore(join(dir, "grants.json"));
  });

  afterEach(() => {
    resetDemoExecutionGrantStoreForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates time-bounded DEMO grants and rejects expired/revoked", () => {
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["EUR/USD"],
    });
    expect(g.environment).toBe("DEMO");
    expect(store.requireActive(g.grantId, "EUR/USD", 1).ok).toBe(true);
    expect(store.requireActive(g.grantId, "XAU/USD", 1).ok).toBe(false);
    expect(store.requireActive(g.grantId, "EUR/USD", 5).ok).toBe(false);
    store.revoke(g.grantId);
    expect(store.requireActive(g.grantId, "EUR/USD", 1).ok).toBe(false);
  });

  it("never authorizes LIVE environment on grant records", () => {
    const g = store.create({ ttlMs: 60_000 });
    expect(g.environment).toBe("DEMO");
    expect((g as { environment: string }).environment).not.toBe("LIVE");
  });
});

describe("Phase 58.1 wiring and safety", () => {
  it("sidecar mutation module defaults to disabled and forbids LIVE", () => {
    const mod = read("services/forexconnect-sidecar/mutation_demo.py");
    expect(mod).toContain("TRUE_MARKET_OPEN");
    expect(mod).toContain("TRUE_MARKET_CLOSE");
    expect(mod).toContain("LIVE_MUTATION_FORBIDDEN");
    expect(mod).toContain("KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION");
    expect(mod).toContain("create_order_request");
    expect(mod).toContain("send_request");
  });

  it("sidecar exposes sdk-capabilities and gated demo-mutation routes", () => {
    const server = read("services/forexconnect-sidecar/server.py");
    expect(server).toContain("/sdk-capabilities");
    expect(server).toContain("/demo-mutation/open-market");
    expect(server).toContain("/demo-mutation/close-trade");
    expect(server).toContain("LIVE always forbidden");
  });

  it("AT API exposes demo-lifecycle routes without enabling global placesOrders", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/demo-lifecycle/status");
    expect(api).toContain("/demo-lifecycle/open-market");
    expect(api).toContain("/demo-lifecycle/close-trade");
    expect(api).toContain("placesOrders: false");
    expect(api).toContain("liveUnauthorized: true");
  });

  it("automation store still coerces placesOrders false", () => {
    const store = read("ai/forex-ai/automated-trading/automation-control/store.ts");
    expect(store).toMatch(/placesOrders\s*=\s*false/);
    expect(store).not.toMatch(/placesOrders\s*=\s*true/);
  });

  it("orchestrator refuses requireProtective until broker attach is verified", () => {
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).toContain("PROTECTION_REQUIRED_BUT_UNVERIFIED");
    expect(orch).toContain("requireProtective");
  });

  it("DisabledBrokerMutationAdapter remains for normal AT path", () => {
    const stub = read("ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts");
    expect(stub).toContain("DisabledBrokerMutationAdapter");
    expect(stub).toContain("EXECUTION_FORBIDDEN");
  });
});
