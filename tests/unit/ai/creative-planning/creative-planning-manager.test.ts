import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import type { CreativeProject, ValidationResult } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("CreativePlanningManager", () => {
  it("rejects incomplete workspace inputs and persists editable complete plans", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-planning-"));
    roots.push(storageRoot);
    const manager = new CreativePlanningManager();
    await manager.initialize(storageRoot);
    const project = projectFixture();
    const invalid: ValidationResult = { valid: false, errors: ["Product name is required."] };

    expect((await manager.createPlan(project, invalid)).plan).toBeUndefined();

    const result = await manager.createPlan(project, { valid: true, errors: [] });
    expect(result.plan?.storyboard).toContain("Scene 1");
    expect(result.plan?.script).toContain("Studio Bottle");
    expect(result.plan?.scenes).toHaveLength(3);
    expect(result.plan?.scenes[0]?.assetId).toBe("image-1");
    expect(result.plan?.prompts.video).toContain("vertical social video");
    expect(result.plan?.workflow).toHaveLength(5);

    const updated = await manager.updatePlan(project.id, { creativeBrief: "Approved custom creative brief." });
    const restoredManager = new CreativePlanningManager();
    await restoredManager.initialize(storageRoot);

    expect(updated.version).toBe(2);
    expect((await restoredManager.getPlan(project.id))?.creativeBrief).toBe("Approved custom creative brief.");
  });
});

function projectFixture(): CreativeProject {
  const now = new Date().toISOString();
  return {
    id: "project-creative-plan", name: "Bottle Campaign", createdAt: now, modifiedAt: now,
    productImages: [{ id: "image-1", fileName: "bottle.png", mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: "/product.png" }],
    productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" },
    brandInformation: { name: "KWIZERA", voice: "confident and warm" },
    campaignInformation: { name: "Summer launch", objective: "Increase awareness", callToAction: "Shop the collection" },
    targetAudience: "Active urban professionals", language: "en", platform: "instagram", workspaceSettings: {},
  };
}