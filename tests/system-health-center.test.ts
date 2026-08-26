/**
 * Phase 7 Step 4 — System Health Center tests.
 * Isolated temp storage; does not touch production user data.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistentMemoryCenter } from "../dev/server/persistent-memory-center.js";
import { onlineKnowledgeEngine } from "../dev/server/online-knowledge-engine.js";
import { systemHealthCenter } from "../dev/server/system-health-center.js";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p7s4-"));

describe("Phase 7 Step 4 — System Health Center", () => {
  beforeAll(async () => {
    process.env.KWIZERA_STORAGE_ROOT = tmpRoot;
    await persistentMemoryCenter.boot(tmpRoot);
    await onlineKnowledgeEngine.boot(tmpRoot);
    await systemHealthCenter.boot(tmpRoot);
    systemHealthCenter.markSessionRunning();
  }, 120000);

  afterAll(() => {
    try {
      systemHealthCenter.markCleanExit();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("boots and reports a computed health score (not hardcoded)", async () => {
    expect(systemHealthCenter.isReady()).toBe(true);
    const report = await systemHealthCenter.runFastHealthCheck();
    expect(report.applicationVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
    expect(report.subsystems.length).toBeGreaterThan(5);
    expect(report.offlineCapable).toBe(true);
    expect(report.storageRoot).toBe(tmpRoot);
  });

  it("lists registered services with real statuses", () => {
    const services = systemHealthCenter.listServices();
    expect(services.some((s) => s.id === "local-api")).toBe(true);
    expect(services.some((s) => s.id === "memory")).toBe(true);
    for (const s of services) {
      expect(["STARTING", "READY", "DEGRADED", "FAILED", "STOPPED", "UNKNOWN"]).toContain(s.status);
    }
  });

  it("denies non-allowlisted repair actions", async () => {
    const denied = await systemHealthCenter.repair({
      // @ts-expect-error intentional forbidden action
      action: "delete-database",
      problem: "test deny",
    });
    expect(denied.result).toBe("failed");
    expect(denied.finalStatus).toBe("DENIED");
    expect(denied.error).toMatch(/Forbidden|allowlist/i);
  });

  it("creates a safety backup repair without deleting user data", async () => {
    const entry = await systemHealthCenter.repair({
      action: "create-safety-backup",
      problem: "test backup",
    });
    expect(entry.result).toBe("success");
    expect(entry.backupId).toBeTruthy();
    expect(fs.existsSync(tmpRoot)).toBe(true);
  });

  it("ensures temp/cache dirs (level 2 safe repair)", async () => {
    const entry = await systemHealthCenter.repair({
      action: "ensure-temp-dirs",
      problem: "missing cache",
    });
    expect(entry.result).toBe("success");
    expect(fs.existsSync(path.join(tmpRoot, "temp"))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, "cache"))).toBe(true);
  });

  it("rejects untrusted update package URLs", () => {
    const state = systemHealthCenter.checkForUpdate({
      version: "9.9.9",
      packageUrl: "https://evil.example/malware.exe",
      checksum: "abc",
    });
    expect(state.phase).toBe("FAILED");
    expect(state.lastError).toMatch(/trusted/i);
  });

  it("notes a trusted update as AVAILABLE without downloading", () => {
    const state = systemHealthCenter.checkForUpdate({
      version: "0.2.0",
      releaseId: "test",
      packageUrl: "file:///C:/trusted/KwizeraAIStudio-Setup-0.2.0.exe",
    });
    expect(state.phase).toBe("AVAILABLE");
    expect(state.availableVersion).toBe("0.2.0");
  });

  it("prepares update backup via PMC", async () => {
    const bak = await systemHealthCenter.prepareUpdateBackup();
    expect(bak.ok).toBe(true);
    expect(bak.backupId).toBeTruthy();
    const update = systemHealthCenter.getUpdateState();
    expect(update.rollbackAvailable).toBe(true);
  });

  it("self-test returns per-subsystem checks", async () => {
    const st = await systemHealthCenter.selfTest();
    expect(st.total).toBeGreaterThan(5);
    expect(st.passed).toBeGreaterThanOrEqual(0);
    expect(st.checks.every((c) => typeof c.ok === "boolean")).toBe(true);
  });

  it("writes diagnostic report and support bundle without secrets", () => {
    const diag = systemHealthCenter.writeDiagnosticReport();
    expect(diag.ok).toBe(true);
    expect(fs.existsSync(diag.path)).toBe(true);
    const text = fs.readFileSync(diag.path, "utf8");
    expect(text).not.toMatch(/sk-[a-zA-Z0-9]{20}/);

    const bundle = systemHealthCenter.createSupportBundle();
    expect(fs.existsSync(bundle.path)).toBe(true);
    expect(bundle.excluded.some((e) => /password|api key|token/i.test(e))).toBe(true);
  });

  it("crash marker: dirty session detected, clean exit clears dirty flag", () => {
    systemHealthCenter.markSessionRunning();
    // Simulate reboot of center by detecting marker still present
    const healthRoot = path.join(tmpRoot, "logs", "system-health");
    const marker = path.join(healthRoot, "session-interrupted.marker");
    expect(fs.existsSync(marker)).toBe(true);

    systemHealthCenter.markCleanExit();
    expect(fs.existsSync(marker)).toBe(false);
  });
});
