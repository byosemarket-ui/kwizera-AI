import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativePipelineManager } from "../../../../ai/creative-pipeline/creative-pipeline-manager.js";
import { CreativeReviewManager } from "../../../../ai/creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("CreativePipelineManager", () => {
  it("automates a valid project through planning, source-media review, approval, export, and persisted history", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-pipeline-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    const review = new CreativeReviewManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    await review.initialize(storageRoot);

    const project = await workspace.createProject("Pipeline Launch");
    await workspace.updateProject(project.id, {
      productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" },
      brandInformation: { name: "KWIZERA", voice: "confident and warm" },
      campaignInformation: { name: "Summer launch", objective: "Increase awareness", callToAction: "Shop now" },
      targetAudience: "Active urban professionals",
    });
    await workspace.uploadImage(project.id, { fileName: "bottle.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });

    const pipeline = new CreativePipelineManager();
    await pipeline.initialize(storageRoot, { core: {} as AiCoreManager, workspace, planning, review });
    const job = await pipeline.enqueue(project.id);

    expect(job.status).toBe("completed");
    expect((await planning.getPlan(project.id))?.workflow).toHaveLength(5);
    expect((await review.getProjectState(project.id)).assets[0]?.approved).toBe(true);
    expect((await review.getProjectState(project.id)).exports).toHaveLength(1);
    expect(pipeline.getDashboard().history).toHaveLength(1);

    const restored = new CreativePipelineManager();
    await restored.initialize(storageRoot, { core: {} as AiCoreManager, workspace, planning, review });
    expect(restored.getDashboard().history[0]?.projectId).toBe(project.id);
  });
});