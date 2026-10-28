/**
 * Phase 59.0.13 — Automatic DEMO grant lifecycle (no broker orders).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoExecutionGrantStore,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";
import {
  AutoDemoGrantLifecycleWorker,
  resolveAutoDemoGrantConfig,
  resetAutoDemoGrantLifecycleWorkerForTests,
  type AutoDemoGrantGateResult,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/auto-grant-lifecycle.ts";

const root = process.cwd();

function gatesOk(overrides: Partial<AutoDemoGrantGateResult> = {}): AutoDemoGrantGateResult {
  return {
    ok: true,
    blockers: [],
    connected: true,
    environment: "demo",
    demoSession: true,
    nodeMutationEnvEnabled: true,
    sidecarMutationEnvEnabled: true,
    nodeMutationSecretConfigured: true,
    sidecarMutationSecretConfigured: true,
    mutationSecretsConsistent: true,
    instrumentEligible: true,
    ...overrides,
  };
}

describe("Phase 59.0.13 auto DEMO grant config", () => {
  it("defaults to off and never placesOrdersGlobal", () => {
    const cfg = resolveAutoDemoGrantConfig({});
    expect(cfg.mode).toBe("off");
    expect(cfg.placesOrdersGlobal).toBe(false);
    expect(cfg.liveLocked).toBe(true);
    expect(cfg.instruments).toContain("XAU/USD");
  });

  it("parses dry_run and enabled modes", () => {
    expect(resolveAutoDemoGrantConfig({
      KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE: "dry_run",
    }).mode).toBe("dry_run");
    expect(resolveAutoDemoGrantConfig({
      KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE: "enabled",
    }).mode).toBe("enabled");
  });

  it("clamps ttl and maxLots to approved bounds", () => {
    const cfg = resolveAutoDemoGrantConfig({
      KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE: "dry_run",
      KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_TTL_MS: "999999999",
      KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MAX_LOTS: "99",
    });
    expect(cfg.ttlMs).toBeLessThanOrEqual(60 * 60_000);
    expect(cfg.maxLots).toBeLessThanOrEqual(10);
  });
});

describe("Phase 59.0.13 auto DEMO grant worker", () => {
  let dir: string;
  let store: DemoExecutionGrantStore;
  let prevMode: string | undefined;
  let prevStorage: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-auto-grant-"));
    prevMode = process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE;
    prevStorage = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = dir;
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "off";
    resetDemoExecutionGrantStoreForTests();
    resetAutoDemoGrantLifecycleWorkerForTests();
    store = new DemoExecutionGrantStore(join(dir, "forex", "demo-execution-grants.json"));
  });

  afterEach(() => {
    if (prevMode == null) delete process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE;
    else process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = prevMode;
    if (prevStorage == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    resetAutoDemoGrantLifecycleWorkerForTests();
    resetDemoExecutionGrantStoreForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("disabled mode performs no grant mutation", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "off";
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("DISABLED");
    expect(r.mutatesGrants).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(store.listActive()).toHaveLength(0);
  });

  it("valid covering grant remains usable and is not duplicated", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_RENEW_BEFORE_MS = "60000";
    const g = store.create({
      ttlMs: 600_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("COVERED");
    expect(r.coveringGrantId).toBe(g.grantId);
    expect(store.listActive()).toHaveLength(1);
    expect(store.requireActive(g.grantId, "XAU/USD", 1).ok).toBe(true);
  });

  it("expired grant is rejected by requireActive; enabled mode creates replacement when gates pass", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_INSTRUMENTS = "XAU/USD";
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MAX_LOTS = "1";
    const expired = store.create({
      ttlMs: 60_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    // Force expiry in memory + disk
    (expired as { expiresAtUtc: string }).expiresAtUtc = new Date(Date.now() - 5_000).toISOString();
    store.reload();
    // rewrite expired via create of empty then overwrite file is awkward — mutate via requireActive after save
    const path = store.filePath;
    const raw = JSON.parse(readFileSync(path, "utf8")) as { grants: Array<{ grantId: string; expiresAtUtc: string }> };
    const row = raw.grants.find((x) => x.grantId === expired.grantId);
    if (row) row.expiresAtUtc = new Date(Date.now() - 5_000).toISOString();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, JSON.stringify(raw, null, 2), "utf8");
    store.reload();
    expect(store.requireActive(expired.grantId, "XAU/USD", 1).ok).toBe(false);

    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("CREATED");
    expect(r.mutatesGrants).toBe(true);
    expect(r.mutatesBroker).toBe(false);
    expect(r.grantId).toBeTruthy();
    expect(store.requireActive(String(r.grantId), "XAU/USD", 1).ok).toBe(true);
  });

  it("missing grant can be created when enabled and gates pass", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("CREATED");
    expect(store.listActive()).toHaveLength(1);
    expect(store.listActive()[0].instrumentAllowlist).toContain("XAU/USD");
  });

  it("dry_run reports WOULD_CREATE without writing grants", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "dry_run";
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("WOULD_CREATE");
    expect(r.dryRun).toBe(true);
    expect(r.mutatesGrants).toBe(false);
    expect(store.listActive()).toHaveLength(0);
  });

  it("revoked grant is not treated as covering", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    const g = store.create({
      ttlMs: 600_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    store.revoke(g.grantId);
    expect(store.requireActive(g.grantId, "XAU/USD", 1).ok).toBe(false);
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("CREATED");
    expect(r.grantId).not.toBe(g.grantId);
  });

  it("instrument outside allowlist is rejected by store requireActive", () => {
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    expect(store.requireActive(g.grantId, "EUR/USD", 1).ok).toBe(false);
    expect(store.requireActive(g.grantId, "XAU/USD", 1).ok).toBe(true);
  });

  it("lots exceeding maxLots are rejected", () => {
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    expect(store.requireActive(g.grantId, "XAU/USD", 2).ok).toBe(false);
  });

  it("inconsistent mutation secret blocks auto grant creation", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk({
        ok: false,
        blockers: ["MUTATION_SECRET_MISMATCH"],
        mutationSecretsConsistent: false,
      }),
    });
    const r = await worker.tick();
    expect(r.action).toBe("GATES_BLOCKED");
    expect(r.blockers).toContain("MUTATION_SECRET_MISMATCH");
    expect(store.listActive()).toHaveLength(0);
  });

  it("disconnected session or LIVE environment blocks automatic grant creation", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk({
        ok: false,
        blockers: ["SESSION_NOT_CONNECTED", "ENVIRONMENT_NOT_DEMO"],
        connected: false,
        demoSession: false,
        environment: "live",
      }),
    });
    const r = await worker.tick();
    expect(r.action).toBe("GATES_BLOCKED");
    expect(r.blockers).toEqual(expect.arrayContaining([
      "SESSION_NOT_CONNECTED",
      "ENVIRONMENT_NOT_DEMO",
    ]));
    expect(store.listActive()).toHaveLength(0);
  });

  it("concurrent overlapping ticks do not create duplicate grants", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    let gateCalls = 0;
    const worker = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => {
        gateCalls += 1;
        await new Promise((r) => setTimeout(r, 40));
        return gatesOk();
      },
    });
    const [a, b] = await Promise.all([worker.tick(), worker.tick()]);
    const actions = [a.action, b.action].sort();
    expect(actions).toContain("CREATED");
    expect(actions).toContain("SKIPPED_IN_FLIGHT");
    expect(store.listActive()).toHaveLength(1);
    expect(gateCalls).toBe(1);
  });

  it("restarts recover lifecycle state from disk without inventing grants when mode=off", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "dry_run";
    const statePath = join(dir, "forex", "auto-state.json");
    const worker1 = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath,
      evaluateGates: async () => gatesOk(),
    });
    await worker1.tick();
    expect(existsSync(statePath)).toBe(true);
    const worker2 = new AutoDemoGrantLifecycleWorker({
      store,
      allowTimer: false,
      statePath,
      evaluateGates: async () => gatesOk(),
    });
    expect(worker2.getStatus().lastTick?.action).toBe("WOULD_CREATE");
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "off";
    const off = await worker2.tick();
    expect(off.action).toBe("DISABLED");
    expect(store.listActive()).toHaveLength(0);
  });

  it("storage create failure fails closed", async () => {
    process.env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE = "enabled";
    const badStore = {
      reload: () => undefined,
      findCoveringActive: () => null,
      create: () => {
        throw new Error("disk full");
      },
      listActive: () => [],
      filePath: join(dir, "x.json"),
    } as unknown as DemoExecutionGrantStore;
    const worker = new AutoDemoGrantLifecycleWorker({
      store: badStore,
      allowTimer: false,
      statePath: join(dir, "forex", "auto-state.json"),
      evaluateGates: async () => gatesOk(),
    });
    const r = await worker.tick();
    expect(r.action).toBe("STORAGE_FAILED");
    expect(r.ok).toBe(false);
    expect(r.mutatesBroker).toBe(false);
  });

  it("grant renewal never triggers order submission (source invariants)", () => {
    const src = readFileSync(
      join(root, "ai/forex-ai/automated-trading/demo-execution/auto-grant-lifecycle.ts"),
      "utf8",
    );
    expect(src).toContain("mutatesBroker: false");
    expect(src).toContain('mode === "off"');
    expect(src).not.toContain("openTrueMarket");
    expect(src).not.toContain("closeTrade");
    expect(src).not.toContain("demoMutationOpenMarket");
    const api = readFileSync(join(root, "dev/server/forex-automated-trading-api.ts"), "utf8");
    expect(api).toContain("/demo-lifecycle/auto-grant/status");
    expect(api).toContain("mutatesBroker: false");
  });
});
