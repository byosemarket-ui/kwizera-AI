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
  buildTimelineFromPlan,
  mapCamera,
  mapMotion,
  mapTransition,
} from "../../../../ai/video-production/plan-to-timeline.js";
import { VideoProductionManager } from "../../../../ai/video-production/video-production-manager.js";
import type { PlanScene } from "../../../../ai/creative-planning/creative-planning-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("STEP 8 video production", () => {
  it("maps camera, motion, and renderer-supported transitions from the Creative Plan", () => {
    const scene = {
      purpose: "hero close-up",
      cameraDirection: "push-in",
      camera: "macro",
      transition: "fade",
    } as PlanScene;
    expect(mapCamera(scene)).toBe("macro");
    expect(mapMotion("push-in")).toBe("slow-zoom");
    expect(mapTransition("dissolve")).toBe("fade");
    expect(mapTransition("wipe")).toBe("cut");
  });

  it("builds a timeline from original assets only and preserves user edits", async () => {
    const { workspace, planning, project } = await setupProject("STEP8-A");
    const plan = (await planning.createPlan(project, planning.validateForPlan(project))).plan!;
    const timeline = buildTimelineFromPlan(project, plan, { preview: true });
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.length).toBeLessThanOrEqual(3);
    expect(timeline.every((clip) => clip.assetId === project.productImages[0]!.id)).toBe(true);
    expect(timeline.every((clip) => Number.isInteger(clip.startMs) && Number.isInteger(clip.durationMs))).toBe(true);

    const edited = timeline.map((clip, index) => index === 0 ? { ...clip, durationMs: 1800, userEdited: true, camera: "hero" as const } : clip);
    const rebuilt = buildTimelineFromPlan(project, plan, { preview: true, existing: edited });
    expect(rebuilt[0]?.userEdited).toBe(true);
    expect(rebuilt[0]?.camera).toBe("hero");
    expect(rebuilt[0]?.durationMs).toBeLessThanOrEqual(2000);
  });

  it("creates an isolated video project, persists edits, and registers generated video separately from originals", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-video-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });

    const projectA = await seedProject(workspace, "STEP8-ISO-A");
    const projectB = await seedProject(workspace, "STEP8-ISO-B");
    await planning.createPlan(projectA, planning.validateForPlan(await workspace.getProject(projectA.id) ?? projectA));
    await planning.createPlan(projectB, planning.validateForPlan(await workspace.getProject(projectB.id) ?? projectB));

    const videoA = await production.createOrRefresh(projectA.id);
    expect(videoA.timeline[0]?.assetId).toBe(projectA.productImages[0]!.id);
    expect(videoA.videoGenerationProvider).toBe("UNAVAILABLE");
    expect(videoA.audioPlan.status).toBe("UNAVAILABLE");
    expect(await production.getVideoProject(projectB.id)).toBeNull();

    const updated = await production.updateVideoProject(projectA.id, {
      clip: { id: videoA.timeline[0]!.id, durationMs: 1500, motion: "pan-left", text: "Studio Bottle" },
    });
    expect(updated.timeline[0]?.userEdited).toBe(true);
    expect(updated.timeline[0]?.motion).toBe("pan-left");
    expect(updated.timeline[0]?.text[0]?.content).toBe("Studio Bottle");

    const dummy = path.join(storageRoot, "dummy.mp4");
    await fs.writeFile(dummy, Buffer.alloc(256, 1));
    const registered = await workspace.registerOutputAsset(projectA.id, {
      sourcePath: dummy,
      fileName: "out.mp4",
      mimeType: "video/mp4",
      width: 640,
      height: 360,
      sizeBytes: 256,
      durationMs: 1000,
      parentAssetId: projectA.productImages[0]!.id,
      renderJobId: "job-test",
    });
    expect(registered.assetType).toBe("video");
    expect(registered.origin).toBe("generated");
    expect(isOriginalProductImage(registered)).toBe(false);
    const restored = await workspace.getProject(projectA.id);
    expect(restored?.productImages.some((item) => item.id === registered.id)).toBe(true);
    expect(await workspace.getVideoPath(projectA.id, `${registered.id}.mp4`)).toBeTruthy();
    expect(await production.createOrRefresh(projectA.id).then((item) => item.timeline[0]?.motion)).toBe("pan-left");
  });

  it("renders a small preview with FFmpeg when available, otherwise reports a structured failure", async () => {
    const { storageRoot, workspace, planning, project } = await setupProject("STEP8-RENDER");
    await planning.createPlan(project, planning.validateForPlan(project));
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });
    const video = await production.createOrRefresh(project.id);
    await production.updateVideoProject(project.id, {
      clip: { id: video.timeline[0]!.id, durationMs: 1000 },
    });

    const available = await ffmpegAvailable();
    if (!available) {
      await expect(production.startRender(project.id, "preview")).rejects.toMatchObject({ code: "FFMPEG_UNAVAILABLE" });
      return;
    }
    if (!(await ffprobeAvailable())) {
      await expect(production.startRender(project.id, "preview")).rejects.toMatchObject({ code: "FFPROBE_UNAVAILABLE" });
      return;
    }

    const original = (await workspace.getProject(project.id))!.productImages.find(isOriginalProductImage)!;
    const checksumBefore = original.checksumSha256;
    const { job } = await production.startRender(project.id, "preview");
    expect(job.status).toBe("queued");
    const finished = await waitForJob(production, job.id);
    expect(finished.status).toBe("completed");
    expect(finished.stage).toBe("completed");
    expect(finished.outputAssetId).toBeTruthy();
    expect(["applied", "skipped", "unavailable", "failed"]).toContain(finished.textOverlay);
    const complete = await production.getVideoProject(project.id);
    expect(complete?.renderState).toBe("completed");
    expect(complete?.output?.sizeBytes).toBeGreaterThan(100);
    expect(complete?.output?.mimeType).toBe("video/mp4");
    const filePath = await production.getOutputFilePath(project.id);
    expect(filePath).toBeTruthy();
    const probed = await probeVideo(filePath!);
    expect(probed.width).toBe(640);
    expect(probed.height).toBe(360);
    expect(probed.durationMs).toBeGreaterThan(500);
    const restored = await workspace.getProject(project.id);
    const asset = restored?.productImages.find((item) => item.id === complete?.output?.assetId);
    expect(asset?.assetType).toBe("video");
    expect(isOriginalProductImage(asset!)).toBe(false);
    expect(restored?.productImages.find((item) => item.id === original.id)?.checksumSha256).toBe(checksumBefore);
  }, 120_000);
});

async function setupProject(name: string) {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-video-"));
  roots.push(storageRoot);
  const workspace = new CreativeWorkspaceManager();
  const planning = new CreativePlanningManager();
  await workspace.initialize(storageRoot);
  await planning.initialize(storageRoot);
  const project = await seedProject(workspace, name);
  return { storageRoot, workspace, planning, project };
}

async function seedProject(workspace: CreativeWorkspaceManager, name: string) {
  const created = await workspace.createProject(name);
  await workspace.updateProject(created.id, {
    productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable bottle" },
    platform: "youtube",
  });
  const rgba = Buffer.alloc(64 * 40 * 4);
  for (let i = 0; i < 64 * 40; i += 1) {
    rgba[i * 4] = 110;
    rgba[i * 4 + 1] = 72;
    rgba[i * 4 + 2] = 42;
    rgba[i * 4 + 3] = 255;
  }
  await workspace.uploadImage(created.id, {
    fileName: "bottle.png",
    mimeType: "image/png",
    dataBase64: encodeRgbaPng(64, 40, rgba).toString("base64"),
  });
  return (await workspace.getProject(created.id))!;
}

async function waitForJob(production: VideoProductionManager, jobId: string) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    const job = await production.getJob(jobId);
    if (job?.status === "completed" || job?.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for render job");
}
