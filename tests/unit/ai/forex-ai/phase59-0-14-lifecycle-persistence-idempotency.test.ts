/**
 * Phase 59.0.14 — DEMO lifecycle persistence + idempotency fail-closed (no broker mutation).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoLifecycleOrchestrator,
  resetDemoLifecycleOrchestratorForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/orchestrator.ts";
import {
  DemoExecutionGrantStore,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";
import { writeJsonAtomicSync } from "../../../../storage/safe-json.ts";

describe("Phase 59.0.14 lifecycle persistence + idempotency", () => {
  let dir: string;
  let prevStorage: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-lc-persist-"));
    prevStorage = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = dir;
    resetDemoLifecycleOrchestratorForTests();
    resetDemoExecutionGrantStoreForTests();
  });

  afterEach(() => {
    if (prevStorage == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    resetDemoLifecycleOrchestratorForTests();
    resetDemoExecutionGrantStoreForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("writeJsonAtomicSync creates the target file", () => {
    const p = join(dir, "forex", "atomic.json");
    writeJsonAtomicSync(p, { ok: true, n: 1 });
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, "utf8")).ok).toBe(true);
  });

  it("corrupt lifecycle store fails closed and refuses openMarket", async () => {
    const path = join(dir, "forex", "demo-lifecycle-records.json");
    mkdirSync(join(dir, "forex"), { recursive: true });
    writeFileSync(path, "{not-json", "utf8");
    const orch = new DemoLifecycleOrchestrator();
    const status = orch.getStatus();
    expect(status.persistenceDegraded).toBe(true);
    const result = await orch.openMarket({
      grantId: "g1",
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      requireProtective: false,
      idempotencyKey: "k-corrupt",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PERSISTENCE_DEGRADED");
    expect(result.record.mutatesBroker).toBe(false);
  });

  it("uncertain prior state returns IDEMPOTENT_RECONCILIATION_REQUIRED without resubmit", async () => {
    const path = join(dir, "forex", "demo-lifecycle-records.json");
    mkdirSync(join(dir, "forex"), { recursive: true });
    writeJsonAtomicSync(path, {
      schemaVersion: "demo-lifecycle-v4",
      records: [{
        lifecycleId: "lc-1",
        state: "SUBMISSION_UNKNOWN",
        grantId: "g1",
        intentId: "i1",
        idempotencyKey: "same-key",
        instrument: "XAU/USD",
        direction: "BUY",
        lots: 1,
        stopLoss: null,
        takeProfit: null,
        brokerOrderId: "o-maybe",
        tradeId: null,
        closeOrderId: null,
        fillConfirmed: false,
        closeConfirmed: false,
        cancelConfirmed: false,
        brokerProtected: false,
        remainingAmount: null,
        protectionStatus: "NOT_REQUESTED",
        lastError: "timeout",
        lastCode: "TIMEOUT",
        mutatesBroker: true,
        placesOrdersGlobal: false,
        acceptsForExecutionGlobal: false,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
        evidence: {},
      }],
    });
    const orch = new DemoLifecycleOrchestrator();
    const result = await orch.openMarket({
      grantId: "g1",
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      requireProtective: false,
      idempotencyKey: "same-key",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("IDEMPOTENT_RECONCILIATION_REQUIRED");
    expect(result.record.state).toBe("SUBMISSION_UNKNOWN");
  });

  it("requireActive without instrument still authorizes active grant for close/cancel paths", () => {
    const store = new DemoExecutionGrantStore(join(dir, "forex", "grants.json"));
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    expect(store.requireActive(g.grantId).ok).toBe(true);
    expect(store.requireActive(g.grantId, "EUR/USD", 1).ok).toBe(false);
    expect(store.requireActive(g.grantId, "XAU/USD", 1).ok).toBe(true);
  });

  it("corrupt grant store fails closed for create and requireActive", () => {
    const path = join(dir, "forex", "demo-execution-grants.json");
    mkdirSync(join(dir, "forex"), { recursive: true });
    writeFileSync(path, "{broken", "utf8");
    const store = new DemoExecutionGrantStore(path);
    expect(store.isPersistenceDegraded).toBe(true);
    expect(store.requireActive("any", "XAU/USD", 1)).toMatchObject({
      ok: false,
      code: "GRANT_STORE_PERSISTENCE_DEGRADED",
    });
    expect(() => store.create({
      ttlMs: 60_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    })).toThrow(/corrupt|degraded|recovered/i);
  });

  it("atomic save survives orchestrator upsert round-trip", async () => {
    const orch = new DemoLifecycleOrchestrator();
    const g = orch.createGrant({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    const result = await orch.openMarket({
      grantId: g.grantId,
      instrument: "XAU/USD",
      direction: "BUY",
      lots: 1,
      requireProtective: true,
      // missing levels → validation fail before broker
      idempotencyKey: "persist-roundtrip",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROTECTION_LEVELS_REQUIRED");
    const path = join(dir, "forex", "demo-lifecycle-records.json");
    expect(existsSync(path)).toBe(true);
    const raw = JSON.parse(readFileSync(path, "utf8")) as { schemaVersion: string; records: unknown[] };
    expect(raw.schemaVersion).toBe("demo-lifecycle-v4");
    expect(raw.records.length).toBeGreaterThanOrEqual(1);
  });
});
