/**
 * Step 4 — Full Product Creation functional workflow at manager level (no UI mock).
 * Simulates Steps 1→5 data path + validation gates + restart + project switch.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import {
  pickStoreForProject,
  prerequisiteBlockReason,
} from "../desktop/product-creation/workflow.js";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function asDto(project: Awaited<ReturnType<CreativeWorkspaceManager["getProject"]>>) {
  return project as Parameters<typeof prerequisiteBlockReason>[1];
}

describe("Step 4 — Full Product Creation functional workflow", () => {
  it("runs Steps 1→5 with validation gates, restart, and project isolation", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-e2e-"));
    storageRoots.push(storageRoot);
    const ws = new CreativeWorkspaceManager();
    await ws.initialize(storageRoot);

    // Step 1
    await expect(ws.createProject("   ")).rejects.toThrow(/required/i);
    const project = await ws.createProject("KWIZERA-E2E-TEST");
    const projectId = project.id;
    expect(project.name).toBe("KWIZERA-E2E-TEST");

    for (let i = 0; i < 3; i++) {
      await ws.uploadImage(projectId, {
        fileName: `img-${i + 1}.png`,
        mimeType: "image/png",
        dataBase64: PNG,
        width: 1,
        height: 1,
      });
    }
    await expect(
      ws.uploadImage(projectId, { fileName: "x.gif", mimeType: "image/gif", dataBase64: "R0lG" }),
    ).rejects.toThrow(/unsupported/i);

    let p = await ws.getProject(projectId);
    expect(ws.validateIntake(p).valid).toBe(true);
    expect(prerequisiteBlockReason(2, asDto(p))).toBeNull();

    // Step 2
    const imageSet = {
      version: 1,
      projectId,
      images: p!.productImages.map((img, idx) => ({
        id: img.id,
        fileName: img.fileName,
        url: img.url,
        role: idx === 0 ? "hero" : "detail",
      })),
      updatedAt: new Date().toISOString(),
    };
    await ws.updateProject(projectId, {
      workspaceSettings: {
        productImageSet: imageSet,
        productCreation: { currentStep: 2, completedSteps: [1], updatedAt: new Date().toISOString() },
      },
    });
    p = await ws.getProject(projectId);
    expect(prerequisiteBlockReason(3, asDto(p))).toBeNull();

    // Step 3
    await ws.updateProject(projectId, {
      productInformation: {
        name: "E2E Bottle",
        category: "Beverage",
        description: "Functional test bottle",
        price: 19.99,
        currency: "USD",
        sku: "E2E-001",
        features: ["Insulated"],
        materials: ["Steel"],
        colors: ["Black"],
        sizes: ["500ml"],
        specifications: { weight: "300g", warranty: "1 year" },
      },
      workspaceSettings: {
        productImageSet: imageSet,
        productCreation: { currentStep: 3, completedSteps: [1, 2], updatedAt: new Date().toISOString() },
      },
    });
    p = await ws.getProject(projectId);
    expect(ws.validateProductProfile(p).valid).toBe(true);
    expect(prerequisiteBlockReason(4, asDto(p))).toBeNull();

    // Invalid product profile gate
    const badProfile = await ws.updateProject(projectId, {
      productInformation: { name: "", category: "", description: "", price: -1, currency: "" },
    });
    expect(ws.validateProductProfile(badProfile).valid).toBe(false);

    // Restore valid product
    await ws.updateProject(projectId, {
      productInformation: {
        name: "E2E Bottle",
        category: "Beverage",
        description: "Functional test bottle",
        price: 19.99,
        currency: "USD",
      },
    });

    // Step 4
    await ws.updateProject(projectId, {
      brandInformation: { name: "KWIZERA", voice: "confident" },
      campaignInformation: {
        name: "E2E Campaign",
        objective: "Awareness",
        callToAction: "Shop",
        contentFormat: "feed",
        platforms: ["instagram"],
      },
      targetAudience: "Test audience",
      language: "en",
      platform: "instagram",
      workspaceSettings: {
        productImageSet: imageSet,
        marketingInputBrief: { audience: "Test audience", goal: "Awareness" },
        productCreation: { currentStep: 4, completedSteps: [1, 2, 3], updatedAt: new Date().toISOString() },
      },
    });
    p = await ws.getProject(projectId);
    expect(ws.validateMarketingBrief(p).valid).toBe(true);
    expect(prerequisiteBlockReason(5, asDto(p))).toBeNull();

    // Step 5 readiness
    await ws.updateProject(projectId, {
      workspaceSettings: {
        productImageSet: imageSet,
        marketingInputBrief: { audience: "Test audience", goal: "Awareness" },
        productCreation: { currentStep: 5, completedSteps: [1, 2, 3, 4], updatedAt: new Date().toISOString() },
      },
    });
    p = await ws.getProject(projectId);
    expect(ws.validateProductionReadiness(p).valid).toBe(true);
    expect(ws.validate(p).valid).toBe(true);

    const health = await ws.runPersistenceHealth();
    expect(health.ok).toBe(true);
    expect(health.assetsOk).toBe(3);

    // Project B isolation
    const b = await ws.createProject("KWIZERA-E2E-TEST-B");
    await ws.updateProject(b.id, {
      productInformation: { name: "B Product", category: "B", description: "B only", price: 5, currency: "USD" },
    });
    await ws.uploadImage(b.id, { fileName: "b.png", mimeType: "image/png", dataBase64: PNG });

    const openedB = await ws.openProject(b.id);
    expect(openedB.productInformation.name).toBe("B Product");
    const openedA = await ws.openProject(projectId);
    expect(openedA.productInformation.name).toBe("E2E Bottle");
    expect(openedA.productImages).toHaveLength(3);

    // Restart simulation
    const restarted = new CreativeWorkspaceManager();
    await restarted.initialize(storageRoot);
    const again = await restarted.getProject(projectId);
    expect(again?.id).toBe(projectId);
    expect(again?.productInformation.sku).toBe("E2E-001");
    expect(again?.campaignInformation.objective).toBe("Awareness");
    expect(again?.workspaceSettings?.productCreation?.currentStep).toBe(5);

    for (const img of again!.productImages) {
      const fp = await restarted.getOriginalImagePath(projectId, img.id);
      expect(fp).toBeTruthy();
      const st = await fs.stat(fp!);
      expect(st.size).toBeGreaterThan(0);
    }

    const bAgain = await restarted.getProject(b.id);
    expect(bAgain?.productInformation.name).toBe("B Product");
    expect(pickStoreForProject({ [projectId]: openedA, [b.id]: openedB }, projectId)?.id).toBe(projectId);
  });

  it("blocks step navigation without prerequisites", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-gate-"));
    storageRoots.push(storageRoot);
    const ws = new CreativeWorkspaceManager();
    await ws.initialize(storageRoot);
    const project = await ws.createProject("Gate Test");
    const dto = asDto(await ws.getProject(project.id));
    expect(prerequisiteBlockReason(2, dto)).toMatch(/image/i);
    expect(prerequisiteBlockReason(3, dto)).toMatch(/image/i);
    expect(prerequisiteBlockReason(5, dto)).toMatch(/image/i);
  });
});
