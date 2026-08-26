/**
 * Post-Phase 7 Step 3 — persistence restart simulation (new manager instance = app reopen).
 * Does not delete production data; uses isolated temp storage roots.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("Creative workspace persistence (Step 3)", () => {
  it("survives manager restart with project, assets, product, marketing, workflow", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-persist-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);

    const project = await workspace.createProject("KWIZERA-PERSISTENCE-TEST");
    const projectId = project.id;

    for (let i = 0; i < 3; i++) {
      await workspace.uploadImage(projectId, {
        fileName: `test-${i + 1}.png`,
        mimeType: "image/png",
        dataBase64: PNG_1X1,
        width: 1,
        height: 1,
      });
    }

    await workspace.updateProject(projectId, {
      productInformation: {
        name: "Persist Bottle",
        category: "Beverage",
        description: "Insulated steel bottle for persistence verification",
        price: 29.99,
        currency: "USD",
        sku: "PERSIST-001",
        materials: ["steel"],
        colors: ["black"],
        sizes: ["500ml"],
      },
      campaignInformation: {
        name: "Persist Launch",
        objective: "Awareness",
        callToAction: "Shop now",
        platforms: ["instagram"],
        contentFormat: "feed",
      },
      targetAudience: "Urban professionals",
      language: "en",
      platform: "instagram",
      workspaceSettings: {
        productCreation: {
          currentStep: 3,
          completedSteps: [1, 2],
          updatedAt: new Date().toISOString(),
        },
        marketingInputBrief: { audience: "Urban professionals", goal: "Awareness" },
      },
    });

    const healthBefore = await workspace.runPersistenceHealth();
    expect(healthBefore.ok).toBe(true);
    expect(healthBefore.assetsOk).toBe(3);
    expect(healthBefore.productPresent).toBeGreaterThanOrEqual(1);
    expect(healthBefore.marketingPresent).toBeGreaterThanOrEqual(1);
    expect(healthBefore.workflowPresent).toBeGreaterThanOrEqual(1);

    const backup = await workspace.createPersistenceBackup();
    expect(backup.ok).toBe(true);

    // Simulate application close → reopen (new manager, same KWIZERA_STORAGE_ROOT)
    const restored = new CreativeWorkspaceManager();
    await restored.initialize(storageRoot);
    const again = await restored.getProject(projectId);
    expect(again?.id).toBe(projectId);
    expect(again?.name).toBe("KWIZERA-PERSISTENCE-TEST");
    expect(again?.productImages).toHaveLength(3);
    expect(again?.productInformation.name).toBe("Persist Bottle");
    expect(again?.productInformation.sku).toBe("PERSIST-001");
    expect(again?.campaignInformation.objective).toBe("Awareness");
    expect(again?.targetAudience).toBe("Urban professionals");
    const wf = again?.workspaceSettings?.productCreation as { currentStep?: number; completedSteps?: number[] };
    expect(wf?.currentStep).toBe(3);
    expect(wf?.completedSteps).toEqual([1, 2]);

    for (const image of again!.productImages) {
      const imagePath = await restored.getOriginalImagePath(projectId, image.id);
      expect(imagePath).toBeTruthy();
      const st = await fs.stat(imagePath!);
      expect(st.size).toBeGreaterThan(0);
    }

    const healthAfter = await restored.runPersistenceHealth();
    expect(healthAfter.ok).toBe(true);
    expect(healthAfter.orphanCount).toBe(0);
  });

  it("keeps project A and B data isolated when switching", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-persist-ab-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);

    const a = await workspace.createProject("KWIZERA-PERSISTENCE-TEST");
    await workspace.updateProject(a.id, {
      productInformation: { name: "Product A", category: "A", description: "A only" },
      campaignInformation: { name: "Camp A", objective: "Obj A" },
      targetAudience: "Audience A",
    });
    await workspace.uploadImage(a.id, {
      fileName: "a.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });

    const b = await workspace.createProject("KWIZERA-PERSISTENCE-TEST-B");
    await workspace.updateProject(b.id, {
      productInformation: { name: "Product B", category: "B", description: "B only" },
      campaignInformation: { name: "Camp B", objective: "Obj B" },
      targetAudience: "Audience B",
    });
    await workspace.uploadImage(b.id, {
      fileName: "b.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });

    const openedB = await workspace.openProject(b.id);
    expect(openedB.productInformation.name).toBe("Product B");
    expect(openedB.productImages).toHaveLength(1);

    const openedA = await workspace.openProject(a.id);
    expect(openedA.productInformation.name).toBe("Product A");
    expect(openedA.targetAudience).toBe("Audience A");
    expect(openedA.productImages[0]?.fileName).toBe("a.png");

    const afterRestart = new CreativeWorkspaceManager();
    await afterRestart.initialize(storageRoot);
    const a2 = await afterRestart.getProject(a.id);
    const b2 = await afterRestart.getProject(b.id);
    expect(a2?.productInformation.name).toBe("Product A");
    expect(b2?.productInformation.name).toBe("Product B");
    expect(a2?.productImages[0]?.id).not.toBe(b2?.productImages[0]?.id);
  });

  it("reports orphan when metadata references missing file (no auto-delete)", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-orphan-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Orphan Probe");
    const image = await workspace.uploadImage(project.id, {
      fileName: "gone.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const imagePath = await workspace.getOriginalImagePath(project.id, image.id);
    expect(imagePath).toBeTruthy();
    await fs.unlink(imagePath!);

    const health = await workspace.runPersistenceHealth();
    expect(health.ok).toBe(false);
    expect(health.assetsMissingFile).toBe(1);
    expect(health.orphans.some((o) => o.kind === "asset-meta-missing-file")).toBe(true);
    // Project record must still load
    const still = await workspace.getProject(project.id);
    expect(still?.id).toBe(project.id);
  });
});
