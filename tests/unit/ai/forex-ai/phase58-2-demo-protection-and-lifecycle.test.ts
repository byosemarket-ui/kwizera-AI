/**
 * Phase 58.2 — DEMO protection + lifecycle unit tests (no live broker mutation).
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoExecutionGrantStore,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";
import {
  DemoLifecycleOrchestrator,
  resetDemoLifecycleOrchestratorForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/orchestrator.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 58.2 wiring — protective surface", () => {
  it("sidecar mutation module documents RATE_STOP/RATE_LIMIT and post-fill STOP/LIMIT", () => {
    const mod = read("services/forexconnect-sidecar/mutation_demo.py");
    expect(mod).toContain("RATE_STOP");
    expect(mod).toContain("RATE_LIMIT");
    expect(mod).toContain("attach_protective_orders");
    expect(mod).toContain("reconcile_trade_protection");
    expect(mod).toContain("Orders.STOP");
    expect(mod).toContain("Orders.LIMIT");
    expect(mod).toContain("LIVE_MUTATION_FORBIDDEN");
    expect(mod).toContain("TRUE_MARKET_OPEN");
    expect(mod).toContain("TRUE_MARKET_CLOSE");
  });

  it("sidecar exposes attach-protective and reconcile-protection routes", () => {
    const server = read("services/forexconnect-sidecar/server.py");
    expect(server).toContain("/demo-mutation/attach-protective");
    expect(server).toContain("/demo-mutation/reconcile-protection");
    expect(server).toContain("/demo-mutation/open-market");
    expect(server).toContain("rateStop");
  });

  it("Node bridge forwards protective rates and attach routes", () => {
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("demoMutationAttachProtective");
    expect(client).toContain("demoMutationReconcileProtection");
    expect(client).toContain("rateStop");
    expect(client).toContain("rateLimit");
  });

  it("API accepts stopLoss/takeProfit for DEMO open without enabling placesOrders", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("stopLoss");
    expect(api).toContain("takeProfit");
    expect(api).toContain("closeIfUnprotected");
    expect(api).toContain("placesOrders: false");
    expect(api).toContain("liveUnauthorized: true");
  });

  it("orchestrator no longer hard-refuses requireProtective as unverified", () => {
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).not.toContain("PROTECTION_REQUIRED_BUT_UNVERIFIED");
    expect(orch).toContain("PROTECTION_LEVELS_REQUIRED");
    expect(orch).toContain("CLOSED_AFTER_PROTECTION_FAILURE");
    expect(orch).toContain("attachProtective");
    expect(orch).toContain("evaluateUnprotectedFillPolicy");
    expect(orch).toContain("autonomousCloseAuthorized");
  });

  it("DisabledBrokerMutationAdapter remains for normal AT path", () => {
    const stub = read("ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts");
    expect(stub).toContain("DisabledBrokerMutationAdapter");
    expect(stub).toContain("EXECUTION_FORBIDDEN");
  });

  it("automation store still coerces placesOrders false", () => {
    const store = read("ai/forex-ai/automated-trading/automation-control/store.ts");
    expect(store).toMatch(/placesOrders\s*=\s*false/);
    expect(store).not.toMatch(/placesOrders\s*=\s*true/);
  });
});

describe("Phase 58.2 grant store", () => {
  let dir: string;
  let store: DemoExecutionGrantStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-demo-grant-582-"));
    store = new DemoExecutionGrantStore(join(dir, "grants.json"));
  });

  afterEach(() => {
    resetDemoExecutionGrantStoreForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates DEMO grants with Phase 58.3 purpose (supersedes 58.2 label)", () => {
    const g = store.create({ ttlMs: 120_000, maxLots: 1, instrumentAllowlist: ["EUR/USD"] });
    expect(g.environment).toBe("DEMO");
    expect(g.purpose).toBe("PHASE_58_3_DEMO_LIFECYCLE");
    expect(store.requireActive(g.grantId, "EUR/USD", 1).ok).toBe(true);
  });
});

describe("Phase 58.2 orchestrator protective validation", () => {
  let dir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;
  let prevStorage: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-demo-life-582-"));
    prevStorage = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = dir;
    mkdirSync(join(dir, "forex"), { recursive: true });
    mkdirSync(join(dir, "data", "forex"), { recursive: true });
    writeFileSync(join(dir, "data", "forex", "demo-execution-grants.json"), JSON.stringify({ grants: [] }));
    writeFileSync(join(dir, "data", "forex", "demo-lifecycle-records.json"), JSON.stringify({ records: [] }));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    resetDemoExecutionGrantStoreForTests();
    resetDemoLifecycleOrchestratorForTests();
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
    if (prevStorage == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    resetDemoExecutionGrantStoreForTests();
    resetDemoLifecycleOrchestratorForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects requireProtective without stopLoss/takeProfit before broker call", async () => {
    const orch = new DemoLifecycleOrchestrator();
    const grant = orch.createGrant({ ttlMs: 120_000, maxLots: 1, instrumentAllowlist: ["EUR/USD"] });
    const result = await orch.openMarket({
      grantId: grant.grantId,
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      requireProtective: true,
      idempotencyKey: "test-no-levels",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROTECTION_LEVELS_REQUIRED");
    expect(result.record.state).toBe("VALIDATION_FAILED");
    expect(result.record.mutatesBroker).toBe(false);
  });

  it("rejects invalid BUY geometry when entryHint provided", async () => {
    const orch = new DemoLifecycleOrchestrator();
    const grant = orch.createGrant({ ttlMs: 120_000, maxLots: 1, instrumentAllowlist: ["EUR/USD"] });
    const result = await orch.openMarket({
      grantId: grant.grantId,
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      requireProtective: true,
      stopLoss: 1.20,
      takeProfit: 1.10,
      entryHint: 1.15,
      idempotencyKey: "test-bad-geometry",
    });
    expect(result.ok).toBe(false);
    expect(result.record.state).toBe("VALIDATION_FAILED");
    expect(result.record.mutatesBroker).toBe(false);
  });
});
