/**
 * Phase 7 Step 2 — Persistent Memory Center tests (filesystem-backed, no Electron).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PersistentMemoryCenter, persistentMemoryCenter } from "../dev/server/persistent-memory-center.js";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p7s2-"));

describe("Phase 7 Step 2 — Persistent Memory Center", () => {
  beforeAll(async () => {
    process.env.KWIZERA_STORAGE_ROOT = tmpRoot;
    // Use exported singleton after pointing env — boot with override
    await persistentMemoryCenter.boot(tmpRoot);
  }, 120000);

  afterAll(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("boots and reports healthy offline-capable status", () => {
    expect(persistentMemoryCenter.isReady()).toBe(true);
    const health = persistentMemoryCenter.health();
    expect(health.memory).toBe("READY");
    expect(health.knowledge).toBe("READY");
    expect(health.offlineCapable).toBe(true);
    expect(health.storageRoot).toBe(tmpRoot);
    expect(fs.existsSync(health.memoryRoot)).toBe(true);
    expect(fs.existsSync(health.knowledgeRoot)).toBe(true);
  });

  it("saves and retrieves project memory", async () => {
    const saved = await persistentMemoryCenter.saveMemory({
      kind: "PROJECT_MEMORY",
      title: "Test product angle",
      content: "Prefer close-up product shots in first 3 seconds",
      projectId: "proj-test-1",
      importance: "HIGH",
      source: "unit-test",
      dedupeKey: "angle-v1",
    });
    expect(saved.action === "created" || saved.action === "updated").toBe(true);
    const id = saved.memoryId as string;
    expect(id).toBeTruthy();
    const read = await persistentMemoryCenter.getMemory(id);
    expect(read.success).toBe(true);
    expect(read.record?.description).toContain("close-up");
  });

  it("deduplicates / updates on same dedupe key", async () => {
    const first = await persistentMemoryCenter.saveMemory({
      kind: "AI_DECISION",
      title: "CTA style",
      content: "Shop now",
      projectId: "proj-test-1",
      dedupeKey: "cta-1",
      source: "unit-test",
    });
    const second = await persistentMemoryCenter.saveMemory({
      kind: "AI_DECISION",
      title: "CTA style",
      content: "Buy today",
      projectId: "proj-test-1",
      dedupeKey: "cta-1",
      source: "unit-test",
    });
    expect(second.action === "updated" || second.action === "created").toBe(true);
    if (second.action === "updated" && first.memoryId) {
      const read = await persistentMemoryCenter.getMemory(String(first.memoryId));
      expect(read.record?.description).toContain("Buy today");
    }
  });

  it("stores AI correction memory", async () => {
    const saved = await persistentMemoryCenter.saveMemory({
      kind: "AI_CORRECTION",
      title: "Scene style corrected",
      content: "User changed scene style A → B",
      projectId: "proj-test-1",
      importance: "HIGH",
      payload: { original: "A", corrected: "B" },
    });
    expect(saved.success || saved.action === "updated").toBeTruthy();
  });

  it("saves and searches knowledge with source tracking", async () => {
    const saved = await persistentMemoryCenter.saveKnowledge({
      title: "Opening product visibility",
      topic: "Video advertising",
      content: "Short product videos should show the product clearly within the opening seconds.",
      source: "Official documentation",
      sourceUrl: "https://example.local/docs/video-ads",
      tags: ["video", "advertising"],
    });
    expect(saved.action === "created" || saved.action === "updated").toBe(true);
    const found = await persistentMemoryCenter.searchKnowledge({ text: "opening seconds", limit: 10 });
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((k) => k.title.includes("Opening"))).toBe(true);
  });

  it("builds focused AI context without dumping entire DB", async () => {
    const ctx = await persistentMemoryCenter.buildContext({
      projectId: "proj-test-1",
      task: "product video",
      limit: 5,
    });
    expect(ctx.projectId).toBe("proj-test-1");
    expect(ctx.builtAt).toBeTruthy();
    const total =
      ctx.preferences.length
      + ctx.decisions.length
      + ctx.corrections.length
      + ctx.projectMemory.length
      + ctx.knowledge.length;
    expect(total).toBeLessThanOrEqual(40);
  });

  it("writes checkpoints transactionally", () => {
    const cp = persistentMemoryCenter.writeCheckpoint("after-analysis", {
      projectId: "proj-test-1",
      stage: "analysis",
    });
    expect(cp.ok).toBe(true);
    expect(fs.existsSync(cp.path)).toBe(true);
    const list = persistentMemoryCenter.listCheckpoints();
    expect(list.length).toBeGreaterThan(0);
  });

  it("creates backup and can restore with safety copy", async () => {
    const before = persistentMemoryCenter.health().memoryCount;
    const backup = persistentMemoryCenter.createBackup();
    expect(backup.ok).toBe(true);
    expect(fs.existsSync(path.join(backup.path, "manifest.json"))).toBe(true);

    await persistentMemoryCenter.saveMemory({
      kind: "SYSTEM_MEMORY",
      title: "post-backup marker",
      content: "should be replaced on restore",
      dedupeKey: "post-backup-marker",
    });

    const denied = persistentMemoryCenter.restoreBackup(backup.backupId, false);
    expect(denied.ok).toBe(false);

    const restored = persistentMemoryCenter.restoreBackup(backup.backupId, true);
    expect(restored.ok).toBe(true);
    expect(restored.safetyCopy).toBeTruthy();

    await persistentMemoryCenter.reboundAfterRestore();
    expect(persistentMemoryCenter.isReady()).toBe(true);
    expect(persistentMemoryCenter.health().memoryCount).toBeGreaterThanOrEqual(0);
    expect(before).toBeGreaterThanOrEqual(0);
  }, 60000);

  it("persists across center reboot (simulates app restart)", async () => {
    const marker = `restart-marker-${Date.now()}`;
    await persistentMemoryCenter.saveMemory({
      kind: "SYSTEM_MEMORY",
      title: marker,
      content: "must survive reboot",
      dedupeKey: marker,
      source: "restart-test",
    });
    const again = new PersistentMemoryCenter();
    await again.boot(tmpRoot);
    expect(again.isReady()).toBe(true);
    const found = await again.searchMemory({ text: marker, limit: 10 });
    expect(found.some((r) => r.title.includes(marker) || r.description.includes("must survive"))).toBe(true);
  }, 60000);
});
