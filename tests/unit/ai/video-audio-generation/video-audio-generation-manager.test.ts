import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { VideoAudioGenerationManager } from "../../../../ai/video-audio-generation/video-audio-generation-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("VideoAudioGenerationManager", () => {
  it("builds a persisted image-to-video package with animated preview, WAV mix, subtitles, sync timeline, and cache reuse", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-video-audio-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager(); const planning = new CreativePlanningManager(); const models = new AiModelManager();
    await workspace.initialize(storageRoot); await planning.initialize(storageRoot); await models.initialize(storageRoot);
    for (const [id, category] of [["test-image-model", "image"], ["test-video-model", "video"], ["test-audio-model", "audio"]] as const) await models.registry.register({ id, name: id, category, version: "1.0.0", description: "Test model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["generation"] });
    const project = await workspace.createProject("Video Launch");
    await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" }, brandInformation: { name: "KWIZERA" }, campaignInformation: { name: "Launch", objective: "Increase awareness", callToAction: "Shop now" }, targetAudience: "Urban professionals" });
    const imageRuntime = new ImageGenerationManager();
    await imageRuntime.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
    const image = (await imageRuntime.generate({ projectId: project.id, prompt: "Studio Bottle luxury product marketing image", mode: "text-to-image", modelId: "test-image-model", style: "luxury", aspectRatio: "1:1", resolution: "standard", count: 1 }))[0];
    const manager = new VideoAudioGenerationManager();
    await manager.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning, images: imageRuntime });
    const request = { projectId: project.id, prompt: "Fast premium Studio Bottle launch film with a confident close", mode: "image-to-video" as const, videoModelId: "test-video-model", audioModelId: "test-audio-model", imageId: image.id, durationSeconds: 6, resolution: "720p" as const, frameRate: 30 as const, voice: "narrator" as const, music: "uplifting" as const, soundEffects: true, subtitles: true };
    const generated = await manager.generate(request);
    expect(generated.timeline).toHaveLength(1);
    expect((await fs.readFile((await manager.getAssetPath(generated.id, "preview"))!, "utf8")).toContain(`/api/image-generation/assets/${image.id}`);
    expect((await fs.readFile((await manager.getAssetPath(generated.id, "audio"))!)).subarray(0, 4).toString()).toBe("RIFF");
    expect(await fs.readFile((await manager.getAssetPath(generated.id, "subtitles"))!, "utf8")).toContain("WEBVTT");
    expect((await manager.generate(request)).cached).toBe(true);
    expect((await manager.getDashboard(project.id)).history).toHaveLength(1);
    const restored = new VideoAudioGenerationManager();
    await restored.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning, images: imageRuntime });
    expect((await restored.getDashboard(project.id)).packages).toHaveLength(1);
  });
});