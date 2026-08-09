import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiAutomationEngine } from "../../../../ai/automation-engine/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      try {
        await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* ignore */
      }
    }),
  );
});

describe("AiAutomationEngine (Platform Step 5)", () => {
  it("runs schedules, backs up, cleans safely, recovers failures, keeps logs", async () => {
    const root = path.join(os.tmpdir(), `kwizera-auto-${Date.now()}`);
    roots.push(root);
    await fs.mkdir(root, { recursive: true });
    const engine = new AiAutomationEngine();
    engine.initialize(root);

    const hourly = engine.runSchedule("hourly");
    expect(hourly.tasks.length).toBeGreaterThanOrEqual(2);
    expect(hourly.userProjectsDeleted).toBe(false);
    expect(hourly.userAssetsDeleted).toBe(false);

    const backup = engine.executeTask("incremental-backup", "manual");
    expect(backup.status).toBe("completed");
    expect(engine.getRestorePoints().some((p) => p.verified)).toBe(true);

    const cache = path.join(root, "automation-engine", "cache", "stale-cache.bin");
    await fs.writeFile(cache, "unused", "utf8");
    const cleanup = engine.executeTask("cache-cleanup", "manual");
    expect(cleanup.status).toBe("completed");
    expect(cleanup.backupVerifiedBeforeCleanup).toBe(true);
    expect(cleanup.userAssetsDeleted).toBe(false);

    const failFlag = path.join(root, "automation-engine", "backups", ".force-fail");
    await fs.writeFile(failFlag, "1", "utf8");
    expect(engine.executeTask("incremental-backup", "manual").status).toBe("failed");
    await fs.unlink(failFlag);
    expect(engine.executeTask("incremental-backup", "manual").status).toBe("completed");

    expect(engine.getLogs().length).toBeGreaterThan(0);
    expect(engine.getAiMeAwareness().workspaceManagerDeferred).toBe(false);
    expect(engine.runQualityAssurance().criticalIssues).toHaveLength(0);
  });
});
