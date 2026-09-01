import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../../../../ai/creative-workspace/project-asset.js";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import { ffmpegAvailable, ffprobeAvailable, probeVideo } from "../../../../ai/video-production/ffmpeg-renderer.js";
import {
  buildRenderPlan,
  buildTimelineFromPlan,
  rebindCreativePlanScenes,
  sliceTimelineForRender,
} from "../../../../ai/video-production/plan-to-timeline.js";
import { timelineUsesStaleAssets } from "../../../../ai/video-production/output-stale.js";
import { VideoProductionManager } from "../../../../ai/video-production/video-production-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("STEP 4 professional video production", () => {
  it("builds the full approved timeline and slices preview renders only at render time", async () => {
    const { workspace, planning, project } = await setupMultiImageProject("STEP4-TIMELINE");
    const plan = (await planning.createPlan(project, planning.validateForPlan(project))).plan!;
    const timeline = buildTimelineFromPlan(project, plan);
    expect(timeline.length).toBeGreaterThan(1);
    expect(timeline.every((clip) => project.productImages.some((image) => image.id === clip.assetId))).toBe(true);

    const preview = sliceTimelineForRender(timeline, "preview");
    expect(preview.length).toBeLessThanOrEqual(2);
    expect(preview.every((clip) => clip.durationMs <= 2000)).toBe(true);

    const standard = sliceTimelineForRender(timeline, "standard");
    expect(standard.length).toBe(timeline.length);
  });

  it("uses production resolution for standard preset and preview resolution for preview preset", () => {
    const preview916 = buildRenderPlan("9:16", 8000, "preview");
    const standard916 = buildRenderPlan("9:16", 8000, "standard");
    const preview169 = buildRenderPlan("16:9", 8000, "preview");
    const standard169 = buildRenderPlan("16:9", 8000, "standard");

    expect(preview916).toMatchObject({ width: 240, height: 426, crf: 28, x264Preset: "ultrafast", frameRate: 15 });
    expect(standard916).toMatchObject({ width: 1080, height: 1920, crf: 23, x264Preset: "medium" });
    expect(preview169).toMatchObject({ width: 426, height: 240 });
    expect(standard169).toMatchObject({ width: 1920, height: 1080 });
  });

  it("rebinds stale creative plan and timeline asset IDs to current project originals", async () => {
    const { workspace, planning, project } = await setupMultiImageProject("STEP4-REBIND");
    const plan = (await planning.createPlan(project, planning.validateForPlan(project))).plan!;
    const staleId = "00000000-0000-4000-8000-000000000099";
    const stalePlan = {
      ...plan,
      scenes: plan.scenes.map((scene, index) => ({ ...scene, assetId: staleId })),
    };
    expect(timelineUsesStaleAssets(project.productImages, buildTimelineFromPlan(project, stalePlan))).toBe(true);
    const rebound = rebindCreativePlanScenes(project, stalePlan);
    const timeline = buildTimelineFromPlan(project, rebound);
    const originals = project.productImages.filter(isOriginalProductImage).map((image) => image.id);
    expect(timeline.every((clip) => originals.includes(clip.assetId))).toBe(true);
    expect(timelineUsesStaleAssets(project.productImages, timeline)).toBe(false);
  });

  it("persists video versions without overwriting prior successful outputs", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step4-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });

    const project = await seedMultiImageProject(workspace, "STEP4-VERSION");
    await planning.createPlan(project, planning.validateForPlan(await workspace.getProject(project.id) ?? project));
    const video = await production.createOrRefresh(project.id);
    expect(video.timeline.length).toBeGreaterThan(0);

    const dummy = path.join(storageRoot, "dummy-preview.mp4");
    await fs.writeFile(dummy, Buffer.alloc(512, 1));
    const previewAsset = await workspace.registerOutputAsset(project.id, {
      sourcePath: dummy,
      fileName: "preview.mp4",
      mimeType: "video/mp4",
      width: 360,
      height: 640,
      sizeBytes: 512,
      durationMs: 2000,
      parentAssetId: project.productImages[0]!.id,
      renderJobId: "preview-job",
    });

    const version1 = {
      versionId: "v1",
      renderJobId: "preview-job",
      preset: "preview" as const,
      creativePlanId: video.creativePlanId,
      creativePlanVersion: video.creativePlanVersion,
      aspectRatio: "9:16" as const,
      sceneCount: 3,
      durationMs: 2000,
      sourceFingerprint: "abc123",
      output: {
        assetId: previewAsset.id,
        mimeType: "video/mp4" as const,
        durationMs: 2000,
        width: 360,
        height: 640,
        sizeBytes: 512,
        url: previewAsset.url,
        renderJobId: "preview-job",
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    const withVersion = {
      ...video,
      output: version1.output,
      versions: [version1],
    };
    await fs.writeFile(
      path.join(storageRoot, "video-production", "projects", `${project.id}.json`),
      `${JSON.stringify(withVersion, null, 2)}\n`,
    );

    const restored = await production.getVideoProject(project.id);
    expect(restored?.versions?.length).toBe(1);
    expect(restored?.output?.assetId).toBe(previewAsset.id);
    expect(restored?.timeline.length).toBeGreaterThan(0);
  });

  it("renders final video at platform dimensions when FFmpeg is available", async () => {
    const { storageRoot, workspace, planning, project } = await setupMultiImageProject("STEP4-FINAL");
    await planning.createPlan(project, planning.validateForPlan(project));
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });

    const video = await production.createOrRefresh(project.id);
    expect(video.timeline.length).toBeGreaterThan(0);

    const trimmed = {
      ...video,
      timeline: video.timeline.slice(0, 2).map((clip, index) => ({
        ...clip,
        order: index + 1,
        startMs: index * 1000,
        durationMs: 1000,
      })),
      renderPlan: buildRenderPlan(video.renderPlan.aspectRatio, 2000, "standard"),
    };
    await fs.writeFile(
      path.join(storageRoot, "video-production", "projects", `${project.id}.json`),
      `${JSON.stringify(trimmed, null, 2)}\n`,
    );

    const available = await ffmpegAvailable();
    if (!available) {
      await expect(production.startRender(project.id, "standard")).rejects.toMatchObject({ code: "FFMPEG_UNAVAILABLE" });
      return;
    }
    if (!(await ffprobeAvailable())) {
      await expect(production.startRender(project.id, "standard")).rejects.toMatchObject({ code: "FFPROBE_UNAVAILABLE" });
      return;
    }

    const original = project.productImages.find(isOriginalProductImage)!;
    const checksumBefore = original.checksumSha256;
    const { job } = await production.startRender(project.id, "standard");
    expect(job.preset).toBe("standard");
    const finished = await waitForJob(production, job.id);
    expect(finished.status).toBe("completed");
    expect(finished.stage).toBe("completed");

    const complete = await production.getVideoProject(project.id);
    expect(complete?.renderState).toBe("completed");
    expect(complete?.output?.width).toBe(1920);
    expect(complete?.output?.height).toBe(1080);
    expect(complete?.versions?.length).toBeGreaterThan(0);
    expect(complete?.versions?.at(-1)?.preset).toBe("standard");
    expect(complete?.versions?.at(-1)?.sceneCount).toBe(2);

    const filePath = await production.getOutputFilePath(project.id);
    const probed = await probeVideo(filePath!);
    expect(probed.width).toBe(1920);
    expect(probed.height).toBe(1080);
    expect(probed.durationMs).toBeGreaterThan(1000);

    const restored = await workspace.getProject(project.id);
    expect(restored?.productImages.find((item) => item.id === original.id)?.checksumSha256).toBe(checksumBefore);
  }, 180_000);
});

async function setupMultiImageProject(name: string) {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step4-"));
  roots.push(storageRoot);
  const workspace = new CreativeWorkspaceManager();
  const planning = new CreativePlanningManager();
  await workspace.initialize(storageRoot);
  await planning.initialize(storageRoot);
  const project = await seedMultiImageProject(workspace, name);
  return { storageRoot, workspace, planning, project };
}

async function seedMultiImageProject(workspace: CreativeWorkspaceManager, name: string) {
  const created = await workspace.createProject(name);
  await workspace.updateProject(created.id, {
    productInformation: {
      name: "Chestnut Oxford",
      category: "Footwear",
      description: "Premium leather oxford shoe",
      price: 35000,
      originalPrice: 45000,
      currency: "RWF",
      website: "https://example.com/shop",
      callToAction: "Shop now",
    },
    platform: "youtube",
  });

  const views = ["front", "side-left", "side-right", "rear", "detail"];
  for (const view of views) {
    const rgba = Buffer.alloc(80 * 60 * 4);
    for (let i = 0; i < 80 * 60; i += 1) {
      rgba[i * 4] = 90 + views.indexOf(view) * 10;
      rgba[i * 4 + 1] = 60;
      rgba[i * 4 + 2] = 40;
      rgba[i * 4 + 3] = 255;
    }
    await workspace.uploadImage(created.id, {
      fileName: `${view}.png`,
      mimeType: "image/png",
      dataBase64: encodeRgbaPng(80, 60, rgba).toString("base64"),
    });
  }
  return (await workspace.getProject(created.id))!;
}

async function waitForJob(production: VideoProductionManager, jobId: string) {
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const job = await production.getJob(jobId);
    if (job?.status === "completed" || job?.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for render job");
}
