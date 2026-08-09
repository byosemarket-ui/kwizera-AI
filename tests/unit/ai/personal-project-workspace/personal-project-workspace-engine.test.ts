import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiPersonalProjectWorkspaceEngine } from "../../../../ai/personal-project-workspace/index.js";

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

describe("AiPersonalProjectWorkspaceEngine (Platform Step 1)", () => {
  it("creates local projects, autosaves, searches, recovers, and never deletes history", () => {
    const root = path.join(os.tmpdir(), `kwizera-ppw-${Date.now()}`);
    roots.push(root);
    const engine = new AiPersonalProjectWorkspaceEngine();
    engine.initialize(root);

    const project = engine.createProject({
      projectName: "Test Video",
      projectType: "video",
      productInformation: { productName: "Kit A", category: "gadgets" },
      tags: ["test"],
      keywords: ["kit"],
    });
    expect(project.projectId).toBeTruthy();
    expect(project.version).toBe(1);

    engine.updateProject(project.projectId, { currentStatus: "active" });
    const hits = engine.searchProjects({ projectName: "Test", productName: "Kit", status: "active" });
    expect(hits.some((p) => p.projectId === project.projectId)).toBe(true);

    engine.openProject(project.projectId);
    engine.autoSave("unit");
    const recovery = engine.recoverAfterShutdown();
    expect(recovery.recovered).toBe(true);

    const before = engine.getHistory().length;
    engine.recordHistory(project.projectId, "learning", "Learned lighting preference");
    expect(engine.getHistory().length).toBe(before + 1);

    expect(engine.getAiMeAwareness().singleUserOnly).toBe(true);
    expect(engine.getAiMeAwareness().localAssetLibraryDeferred).toBe(false);
    expect(engine.runWorkspaceCycle().localAssetLibraryDeferred).toBe(false);

    const health = engine.runQualityAssurance();
    expect(health.criticalIssues).toHaveLength(0);
  });
});
