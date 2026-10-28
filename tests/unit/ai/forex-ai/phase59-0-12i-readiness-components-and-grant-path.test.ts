/**
 * Phase 59.0.12I — consolidated readiness components, secret consistency, grant storage path.
 * No broker mutation; no secret values.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoExecutionGrantStore,
  legacyDemoExecutionGrantsPath,
  resetDemoExecutionGrantStoreForTests,
  resolveDemoExecutionGrantsPath,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";
import {
  buildDemoReadinessComponents,
  classifyDemoReadinessBlocker,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/readiness-blockers.ts";
import { nodeMutationSecretFingerprint } from "../../../../ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.ts";
import { createHash } from "node:crypto";

const root = process.cwd();

describe("Phase 59.0.12I readiness components", () => {
  it("classifies MUTATION_SECRET_MISMATCH as OWNER_CONFIG", () => {
    expect(classifyDemoReadinessBlocker("MUTATION_SECRET_MISMATCH")).toBe("OWNER_CONFIG");
    expect(classifyDemoReadinessBlocker("SDK_CANCEL_SURFACE_UNVERIFIED")).toBe("SDK");
    expect(classifyDemoReadinessBlocker("SDK_CLOSE_SURFACE_UNVERIFIED")).toBe("SDK");
  });

  it("does not treat connection/quotes alone as orderSubmission ready", () => {
    const r = buildDemoReadinessComponents({
      blockers: ["NODE_MUTATION_ENV_DISABLED", "NO_ACTIVE_DEMO_GRANT"],
      connected: true,
      demoSession: true,
      nodeMutationEnvEnabled: false,
      sidecarMutationEnvEnabled: false,
      nodeMutationSecretConfigured: false,
      sidecarMutationSecretConfigured: false,
      mutationSecretsConsistent: null,
      grantCoverageOk: false,
      quoteReady: true,
      sdkMutationOk: true,
      sdkProtectiveOk: true,
      sdkCancelOk: true,
      sdkCloseOk: true,
    });
    expect(r.components.find((c) => c.id === "connection")?.ok).toBe(true);
    expect(r.components.find((c) => c.id === "marketData")?.ok).toBe(true);
    expect(r.components.find((c) => c.id === "orderSubmission")?.ok).toBe(false);
    expect(r.mayAttemptDemoMutation).toBe(false);
    expect(r.components.find((c) => c.id === "orderSubmission")?.remediation).toBeTruthy();
  });

  it("scores cancel/close separately from submission quote gate", () => {
    const r = buildDemoReadinessComponents({
      blockers: ["QUOTE_STALE"],
      connected: true,
      demoSession: true,
      nodeMutationEnvEnabled: true,
      sidecarMutationEnvEnabled: true,
      nodeMutationSecretConfigured: true,
      sidecarMutationSecretConfigured: true,
      mutationSecretsConsistent: true,
      grantCoverageOk: true,
      quoteReady: false,
      sdkMutationOk: true,
      sdkProtectiveOk: true,
      sdkCancelOk: true,
      sdkCloseOk: true,
    });
    expect(r.mayAttemptDemoMutation).toBe(false);
    expect(r.mayAttemptDemoCancel).toBe(true);
    expect(r.mayAttemptDemoClose).toBe(true);
  });

  it("fails closed on proven secret mismatch", () => {
    const r = buildDemoReadinessComponents({
      blockers: ["MUTATION_SECRET_MISMATCH"],
      connected: true,
      demoSession: true,
      nodeMutationEnvEnabled: true,
      sidecarMutationEnvEnabled: true,
      nodeMutationSecretConfigured: true,
      sidecarMutationSecretConfigured: true,
      mutationSecretsConsistent: false,
      grantCoverageOk: true,
      quoteReady: true,
      sdkMutationOk: true,
      sdkProtectiveOk: true,
      sdkCancelOk: true,
      sdkCloseOk: true,
    });
    expect(r.components.find((c) => c.id === "secret")?.ok).toBe(false);
    expect(r.mayAttemptDemoMutation).toBe(false);
  });
});

describe("Phase 59.0.12I grant path + secret fingerprint", () => {
  let dir: string;
  const prevStorage = process.env.KWIZERA_STORAGE_ROOT;
  const prevSecret = process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-12i-"));
    process.env.KWIZERA_STORAGE_ROOT = dir;
    resetDemoExecutionGrantStoreForTests();
  });

  afterEach(() => {
    if (prevStorage == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    if (prevSecret == null) delete process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET;
    else process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET = prevSecret;
    resetDemoExecutionGrantStoreForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists grants under storage root forex/ path", () => {
    const path = resolveDemoExecutionGrantsPath(dir);
    expect(path.replace(/\\/g, "/")).toContain("forex/demo-execution-grants.json");
    const store = new DemoExecutionGrantStore(path);
    store.create({ ttlMs: 120_000, maxLots: 1, instrumentAllowlist: ["XAU/USD"] });
    expect(existsSync(path)).toBe(true);
    expect(store.listActive()).toHaveLength(1);
  });

  it("migrates legacy cwd grants into storage root when primary missing", () => {
    const appRoot = join(dir, "cwd-app");
    const legacyDir = join(appRoot, "data", "forex");
    mkdirSync(legacyDir, { recursive: true });
    const grantId = "legacy-grant-1";
    writeFileSync(
      join(legacyDir, "demo-execution-grants.json"),
      JSON.stringify({
        schemaVersion: "demo-execution-grants-v1",
        grants: [{
          grantId,
          createdAtUtc: new Date().toISOString(),
          expiresAtUtc: new Date(Date.now() + 600_000).toISOString(),
          revokedAtUtc: null,
          accountIdMasked: null,
          instrumentAllowlist: ["XAU/USD"],
          maxLots: 1,
          createdBy: "admin",
          purpose: "PHASE_58_3_DEMO_LIFECYCLE",
          environment: "DEMO",
        }],
      }),
      "utf8",
    );

    const originalCwd = process.cwd;
    process.cwd = () => appRoot;
    try {
      expect(legacyDemoExecutionGrantsPath()).toBe(join(appRoot, "data", "forex", "demo-execution-grants.json"));
      const store = new DemoExecutionGrantStore();
      const primary = resolveDemoExecutionGrantsPath();
      expect(existsSync(primary)).toBe(true);
      expect(store.get(grantId)?.instrumentAllowlist).toEqual(["XAU/USD"]);
      expect(store.requireActive(grantId, "XAU/USD", 1).ok).toBe(true);
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("nodeMutationSecretFingerprint never returns the secret and matches sha256", () => {
    process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET = "unit-test-secret-value-12i";
    const fp = nodeMutationSecretFingerprint();
    expect(fp).toBe(
      createHash("sha256").update("unit-test-secret-value-12i", "utf8").digest("hex"),
    );
    expect(fp).not.toContain("unit-test-secret");
  });

  it("orchestrator readiness strips fingerprint and exposes components wiring", () => {
    const orch = readFileSync(
      join(root, "ai/forex-ai/automated-trading/demo-execution/orchestrator.ts"),
      "utf8",
    );
    expect(orch).toContain("buildDemoReadinessComponents");
    expect(orch).toContain("mutationSecretsConsistent");
    expect(orch).toContain("delete capsSafe.mutationSecretFingerprint");
    expect(orch).toContain("grantStorePath");
    expect(orch).toContain('phase: "59.0.12I"');
    expect(orch).toContain("optsInstrument");
    expect(orch).toContain("SDK_CANCEL_SURFACE_UNVERIFIED");
    expect(orch).toContain("// Cancel is DELETE_ORDER");
  });
});
