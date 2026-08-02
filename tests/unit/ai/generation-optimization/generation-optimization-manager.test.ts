import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { GenerationOptimizationManager } from "../../../../ai/generation-optimization/generation-optimization-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { VideoAudioGenerationManager } from "../../../../ai/video-audio-generation/video-audio-generation-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("GenerationOptimizationManager", () => {
  it("runs a multi-model image batch, selects the best validated result, records analytics, and restores history", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-optimization-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); const planning = new CreativePlanningManager(); const models = new AiModelManager();
    await workspace.initialize(root); await planning.initialize(root); await models.initialize(root);
    for (const id of ["image-alpha", "image-beta", "video-test", "audio-test"]) await models.registry.register({ id, name: id, category: id.startsWith("image") ? "image" : id.startsWith("video") ? "video" : "audio", version: "1.0.0", description: "Test model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["generation"] });
    const project = await workspace.createProject("Optimization Launch"); await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Insulated reusable bottle" }, brandInformation: { name: "KWIZERA" }, campaignInformation: { name: "Launch", objective: "Awareness", callToAction: "Shop now" }, targetAudience: "Urban professionals" });
    const images = new ImageGenerationManager(); await images.initialize(root, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
    const videoAudio = new VideoAudioGenerationManager(); await videoAudio.initialize(root, { core: undefined as unknown as AiCoreManager, models, workspace, planning, images });
    const manager = new GenerationOptimizationManager(); await manager.initialize(root, { core: undefined as unknown as AiCoreManager, models, images, videoAudio });
    const completed = await manager.batch.submit([{ target: "image", projectId: project.id, candidateModelIds: ["image-alpha", "image-beta"], image: { projectId: project.id, prompt: "Premium Studio Bottle brand campaign image", mode: "text-to-image", style: "luxury", aspectRatio: "1:1", resolution: "high", count: 1 } }]);
    expect(completed[0].status).toBe("completed"); expect(completed[0].results).toHaveLength(2); expect(completed[0].selectedResultId).toBeTruthy(); expect(completed[0].results.every((result) => result.quality.valid)).toBe(true);
    const dashboard = await manager.getDashboard(project.id); expect(dashboard.analytics.completed).toBe(1); expect(dashboard.analytics.averageQuality).toBeGreaterThan(80); expect(dashboard.performance.ramUsageMb).toBeGreaterThan(0); expect(dashboard.queue.completed).toBe(1);
    const restored = new GenerationOptimizationManager(); await restored.initialize(root, { core: undefined as unknown as AiCoreManager, models, images, videoAudio }); expect((await restored.getDashboard(project.id)).history).toHaveLength(1);
  });
});