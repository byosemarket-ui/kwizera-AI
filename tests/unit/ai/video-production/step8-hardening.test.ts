import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../../../../ai/creative-workspace/project-asset.js";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import {
  classifyTextOverlay,
  ffmpegAvailable,
  ffprobeAvailable,
  probeVideo,
  stillFilter,
} from "../../../../ai/video-production/ffmpeg-renderer.js";
import { buildRenderPlan } from "../../../../ai/video-production/plan-to-timeline.js";
import { VideoProductionManager } from "../../../../ai/video-production/video-production-manager.js";
import {
  buildVideoKnowledgeContent,
  resolveVideoKnowledgeTeach,
} from "../../../../ai/video-production/video-production-foundation.js";
import type { VideoProject, VideoTimelineClip } from "../../../../ai/video-production/types.js";
import type { TeachKnowledgeResult } from "../../../../ai/knowledge-foundation/knowledge-teaching-service.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function equivalentTaught(duplicateId: string): TeachKnowledgeResult {
  return {
    ok: false,
    scope: "project",
    requestId: "req-video",
    error: "Equivalent knowledge already exists in the Knowledge Foundation.",
    preview: {
      requestId: "req-video",
      topic: "Video production",
      knowledgeType: "video-knowledge" as never,
      status: "rejected",
      sources: [],
      duplicateKnowledgeIds: [duplicateId],
      conflicts: [],
      confidenceScore: 40,
      qualityScore: 40,
      rejectionReasons: ["Equivalent knowledge already exists in the Knowledge Foundation."],
      createdAt: new Date().toISOString(),
    } as never,
  };
}

describe("STEP 8 hardening: Video Knowledge isolation", () => {
  it("reuses same-project equivalent knowledge as already-linked, never error", async () => {
    const records = new Map<string, { projectId: string; status: string }>([
      ["know-video-a", { projectId: "project-a", status: "active" }],
    ]);
    const teaching = {
      findReusableProjectEquivalents: async (projectId: string, ids: string[]) =>
        ids.filter((id) => records.get(id)?.projectId === projectId && records.get(id)?.status === "active"),
      storeTaughtKnowledge: async () => ({ ok: true, knowledgeId: "know-should-not-use", scope: "project" as const }),
      retrieve: async () => ({ ok: true, records: [], knowledgeIds: [], count: 0 }),
    };

    const linked = await resolveVideoKnowledgeTeach({
      taught: { ok: true, knowledgeId: "know-video-a", scope: "project" },
      teaching,
      projectId: "project-a",
      topic: "Video production for Bottle",
      content: "Project project-a Video project vp-a.",
      existingIds: [],
    });
    expect(linked.knowledgeStatus).toBe("linked");

    const again = await resolveVideoKnowledgeTeach({
      taught: equivalentTaught("know-video-a"),
      teaching,
      projectId: "project-a",
      topic: "Video production for Bottle",
      content: "Project project-a Video project vp-a.",
      existingIds: ["know-video-a"],
    });
    expect(again.knowledgeStatus).toBe("already-linked");
    expect(again.knowledgeStatus).not.toBe("error");
    expect(again.foundationKnowledgeIds).toContain("know-video-a");
    expect(again.foundationKnowledgeIds).not.toContain("know-should-not-use");
  });

  it("creates a project-scoped record when the equivalent belongs to another project", async () => {
    const stored: string[] = [];
    const teaching = {
      findReusableProjectEquivalents: async () => [],
      storeTaughtKnowledge: async (input: { projectId?: string }) => {
        stored.push(input.projectId ?? "");
        return { ok: true, knowledgeId: "know-video-b", scope: "project" as const };
      },
      retrieve: async () => ({ ok: true, records: [], knowledgeIds: [], count: 0 }),
    };

    const result = await resolveVideoKnowledgeTeach({
      taught: equivalentTaught("know-video-a"),
      teaching,
      projectId: "project-b",
      topic: "Video production for Can",
      content: "Project project-b Video project vp-b.",
      existingIds: [],
    });
    expect(result.knowledgeStatus).toBe("created");
    expect(result.knowledgeStatus).not.toBe("error");
    expect(result.foundationKnowledgeIds).toEqual(["know-video-b"]);
    expect(result.foundationKnowledgeIds).not.toContain("know-video-a");
    expect(stored).toEqual(["project-b"]);
  });

  it("reports failed, not error, when project-scoped store cannot complete", async () => {
    const teaching = {
      findReusableProjectEquivalents: async () => [],
      storeTaughtKnowledge: async () => ({ ok: false, scope: "project" as const, error: "store rejected" }),
      retrieve: async () => ({ ok: true, records: [], knowledgeIds: [], count: 0 }),
    };
    const result = await resolveVideoKnowledgeTeach({
      taught: equivalentTaught("know-video-a"),
      teaching,
      projectId: "project-b",
      topic: "Video production for Can",
      content: "Project project-b.",
      existingIds: [],
    });
    expect(result.knowledgeStatus).toBe("failed");
    expect(result.knowledgeStatus).not.toBe("error");
  });

  it("keeps video knowledge provenance in the stored content", async () => {
    const { project } = await setupProject("STEP8-HARD-PROV");
    const video = {
      id: "vp-1",
      projectId: project.id,
      productId: project.id,
      creativePlanId: "plan-1",
      creativePlanVersion: 1,
      createdAt: "2026-08-30T00:00:00.000Z",
      modifiedAt: "2026-08-30T00:00:00.000Z",
      version: 1,
      timeline: [{
        id: "clip-1",
        sceneId: "scene-1",
        order: 1,
        purpose: "hero",
        assetId: project.productImages[0]!.id,
        startMs: 0,
        durationMs: 1000,
        layer: "video",
        camera: "hero",
        motion: "slow-zoom",
        lighting: "studio",
        background: "studio",
        transitionIn: "cut",
        transitionOut: "cut",
        text: [],
        audioDirection: "none",
      }] satisfies VideoTimelineClip[],
      audioPlan: {
        backgroundMusic: "none",
        voiceover: "none",
        soundEffects: "none",
        status: "UNAVAILABLE",
        message: "none",
      },
      renderPlan: buildRenderPlan("9:16", 1000, "preview"),
      renderState: "completed",
      output: {
        assetId: "out-1",
        mimeType: "video/mp4",
        durationMs: 1000,
        width: 360,
        height: 640,
        sizeBytes: 200,
        url: `/api/workspace/projects/${project.id}/videos/out-1.mp4`,
        renderJobId: "job-1",
        createdAt: "2026-08-30T00:00:00.000Z",
      },
      videoGenerationProvider: "UNAVAILABLE",
      videoGenerationProviderMessage: "unavailable",
    } as VideoProject;
    const content = buildVideoKnowledgeContent(project, video);
    expect(content).toContain(project.id);
    expect(content).toContain("vp-1");
    expect(content).toContain("plan-1");
    expect(content).toContain(project.productImages[0]!.id);
    expect(content).toContain("out-1");
    expect(content).toContain("video-knowledge");
    expect(content).toContain("Project-scoped only");
    expect(content).toContain("step9-smart-camera-v1");
  });
});

describe("STEP 8 hardening: assets, jobs, overlay, probe", () => {
  it("keeps generated videos project-scoped and distinct from originals", async () => {
    const { storageRoot, workspace, planning, project: projectA } = await setupProject("STEP8-HARD-A");
    const projectB = await seedProject(workspace, "STEP8-HARD-B");
    await planning.createPlan(projectA, planning.validateForPlan(projectA));
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });

    const checksumBefore = projectA.productImages.find(isOriginalProductImage)!.checksumSha256;
    const dummy = path.join(storageRoot, "dummy-a.mp4");
    await fs.writeFile(dummy, Buffer.alloc(256, 7));
    const registered = await workspace.registerOutputAsset(projectA.id, {
      sourcePath: dummy,
      fileName: "out.mp4",
      mimeType: "video/mp4",
      width: 360,
      height: 640,
      sizeBytes: 256,
      durationMs: 1000,
      parentAssetId: projectA.productImages[0]!.id,
      renderJobId: "job-a",
    });
    expect(registered.projectId).toBe(projectA.id);
    expect(registered.assetType).toBe("video");
    expect(registered.origin).toBe("generated");
    expect(isOriginalProductImage(registered)).toBe(false);
    expect(await workspace.getVideoPath(projectA.id, `${registered.id}.mp4`)).toBeTruthy();
    expect(await workspace.getVideoPath(projectB.id, `${registered.id}.mp4`)).toBeNull();
    expect((await workspace.getProject(projectA.id))?.productImages.find((item) => item.id === projectA.productImages[0]!.id)?.checksumSha256)
      .toBe(checksumBefore);

    const jobId = randomUUID();
    await fs.mkdir(path.join(storageRoot, "video-production", "jobs"), { recursive: true });
    await fs.writeFile(path.join(storageRoot, "video-production", "jobs", `${jobId}.json`), `${JSON.stringify({
      id: jobId,
      projectId: projectA.id,
      videoProjectId: "vp-a",
      status: "completed",
      stage: "completed",
      progress: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`);
    expect(await production.getJob(jobId, projectA.id)).toMatchObject({ id: jobId, projectId: projectA.id });
    expect(await production.getJob(jobId, projectB.id)).toBeNull();
  });

  it("does not mark a job completed when output registration fails", async () => {
    const ffmpeg = await ffmpegAvailable();
    const probe = await ffprobeAvailable();
    if (!ffmpeg || !probe) return;

    const { storageRoot, workspace, planning, project } = await setupProject("STEP8-HARD-REG");
    await planning.createPlan(project, planning.validateForPlan(project));
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });
    await production.createOrRefresh(project.id);
    const original = workspace.registerOutputAsset.bind(workspace);
    workspace.registerOutputAsset = async () => {
      throw new Error("Video output path must be absolute");
    };
    try {
      const { job } = await production.startRender(project.id, "preview");
      const finished = await waitForJob(production, job.id);
      expect(finished.status).toBe("failed");
      expect(finished.stage).toBe("failed");
      expect(finished.outputAssetId).toBeUndefined();
      expect(finished.errorCode).toBeTruthy();
      const video = await production.getVideoProject(project.id);
      expect(video?.renderState).toBe("failed");
      expect(video?.output).toBeUndefined();
    } finally {
      workspace.registerOutputAsset = original;
    }
  }, 120_000);

  it("records truthful overlay status and preserves aspect without stretching", async () => {
    expect(classifyTextOverlay({ hasText: false, fontAvailable: false })).toBe("skipped");
    expect(classifyTextOverlay({ hasText: true, fontAvailable: false })).toBe("unavailable");
    expect(classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: true })).toBe("applied");
    expect(classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: false })).toBe("failed");

    expect(buildRenderPlan("16:9", 1000, "preview")).toMatchObject({ width: 426, height: 240 });
    expect(buildRenderPlan("9:16", 1000, "preview")).toMatchObject({ width: 240, height: 426 });
    expect(buildRenderPlan("1:1", 1000, "preview")).toMatchObject({ width: 320, height: 320 });

    const clip: VideoTimelineClip = {
      id: "c1",
      sceneId: "s1",
      order: 1,
      purpose: "hero",
      assetId: "asset",
      startMs: 0,
      durationMs: 1000,
      layer: "video",
      camera: "hero",
      motion: "hold",
      lighting: "studio",
      background: "studio",
      transitionIn: "cut",
      transitionOut: "cut",
      text: [],
      audioDirection: "none",
    };
    for (const aspect of ["16:9", "9:16", "1:1"] as const) {
      const plan = buildRenderPlan(aspect, 1000, "preview");
      const filter = await stillFilter({ clip, imagePath: "/tmp/in.png" }, plan, { motion: false, fade: false, text: false });
      expect(filter).toContain("force_original_aspect_ratio=increase");
      expect(filter).toContain(`crop=${plan.width}:${plan.height}`);
      expect(filter).not.toContain(`scale=${plan.width}:${plan.height}:flags`);
    }
  });

  it("renders 16:9, 9:16, and 1:1 without stretching when FFmpeg is present", async () => {
    const ffmpeg = await ffmpegAvailable();
    const probe = await ffprobeAvailable();
    if (!ffmpeg || !probe) return;

    const { storageRoot, workspace, planning, project } = await setupProject("STEP8-HARD-ASPECT");
    await planning.createPlan(project, planning.validateForPlan(project));
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });
    const original = (await workspace.getProject(project.id))!.productImages.find(isOriginalProductImage)!;
    const checksumBefore = original.checksumSha256;
    const created = await production.createOrRefresh(project.id);
    for (const clip of created.timeline) {
      await production.updateVideoProject(project.id, { clip: { id: clip.id, durationMs: 1000 } });
    }

    for (const aspect of ["16:9", "9:16", "1:1"] as const) {
      await production.updateVideoProject(project.id, { aspectRatio: aspect });
      const { job } = await production.startRender(project.id, "preview");
      const finished = await waitForJob(production, job.id);
      expect(finished.status).toBe("completed");
      const video = await production.getVideoProject(project.id);
      const plan = buildRenderPlan(aspect, video!.renderPlan.durationMs, "preview");
      expect(video?.output?.width).toBe(plan.width);
      expect(video?.output?.height).toBe(plan.height);
      const filePath = await production.getOutputFilePath(project.id);
      const probed = await probeVideo(filePath!);
      expect(probed.width).toBe(plan.width);
      expect(probed.height).toBe(plan.height);
      expect(["applied", "skipped", "unavailable", "failed"]).toContain(finished.textOverlay);
    }
    expect((await workspace.getProject(project.id))?.productImages.find((item) => item.id === original.id)?.checksumSha256)
      .toBe(checksumBefore);
  }, 180_000);

  it("rejects missing output and invalid media during ffprobe validation", async () => {
    const missing = path.join(os.tmpdir(), `kwizera-missing-${randomUUID()}.mp4`);
    await expect(probeVideo(missing)).rejects.toThrow(/not available|missing or empty/i);

    const junkRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-probe-"));
    roots.push(junkRoot);
    const junk = path.join(junkRoot, "not-a-video.mp4");
    await fs.writeFile(junk, "not a video");
    if (await ffprobeAvailable()) {
      await expect(probeVideo(junk)).rejects.toThrow(/not a valid video|FFmpeg failed|ffprobe/i);
    } else {
      await expect(probeVideo(junk)).rejects.toThrow(/ffprobe is not available/i);
    }
  });
});

async function setupProject(name: string) {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-video-hard-"));
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
    platform: "tiktok",
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
