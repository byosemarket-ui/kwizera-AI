import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { buildConfirmedCommercial } from "../../../../ai/creative-planning/commercial.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import { computeOutputStatus, timelineFingerprint } from "../../../../ai/video-production/output-stale.js";
import { profileForPlatform, VIDEO_PLATFORM_PROFILES } from "../../../../ai/video-production/platform-profiles.js";
import { buildRenderPlan, sceneTextLayers } from "../../../../ai/video-production/plan-to-timeline.js";
import { validateBeforeRender, validateRenderedOutput } from "../../../../ai/video-production/render-validation.js";
import { VideoProductionManager } from "../../../../ai/video-production/video-production-manager.js";
import type { PlanScene } from "../../../../ai/creative-planning/creative-planning-manager.js";
import type { VideoProject } from "../../../../ai/video-production/types.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("STEP 5 platform profiles", () => {
  it("maps destination platforms to real output dimensions", () => {
    expect(profileForPlatform("tiktok")).toMatchObject({ width: 1080, height: 1920, aspectRatio: "9:16" });
    expect(profileForPlatform("youtube")).toMatchObject({ width: 1920, height: 1080, aspectRatio: "16:9" });
    expect(profileForPlatform("instagram feed")).toMatchObject({ width: 1080, height: 1080, aspectRatio: "1:1" });
    expect(profileForPlatform("youtube shorts")).toMatchObject({ width: 1080, height: 1920 });
    expect(buildRenderPlan("9:16", 5000, "standard", "tiktok")).toMatchObject({ width: 1080, height: 1920, platform: "tiktok" });
  });

  it("exposes all required STEP 5 destinations", () => {
    const ids = Object.keys(VIDEO_PLATFORM_PROFILES);
    expect(ids).toEqual(expect.arrayContaining([
      "tiktok", "instagram_reels", "instagram_feed", "youtube_shorts", "youtube", "facebook_feed",
    ]));
  });
});

describe("STEP 5 stale output detection", () => {
  it("marks output OUTDATED after timeline edits", () => {
    const base: VideoProject = {
      id: "vp-1",
      projectId: "p-1",
      productId: "p-1",
      creativePlanId: "plan-1",
      creativePlanVersion: 1,
      createdAt: "",
      modifiedAt: "",
      version: 2,
      timeline: [{
        id: "s1", sceneId: "s1", order: 1, purpose: "HOOK", assetId: "a1", startMs: 0, durationMs: 2000,
        layer: "video", camera: "hero", motion: "slow-zoom", lighting: "", background: "", transitionIn: "cut",
        transitionOut: "cut", text: [], audioDirection: "",
      }],
      timelineMode: "full",
      audioPlan: { backgroundMusic: "none", voiceover: "none", soundEffects: "none", status: "UNAVAILABLE", message: "" },
      renderPlan: buildRenderPlan("9:16", 2000, "standard", "tiktok"),
      renderState: "completed",
      output: {
        assetId: "out-1", mimeType: "video/mp4", durationMs: 2000, width: 1080, height: 1920, sizeBytes: 1000,
        url: "/videos/out-1.mp4", renderJobId: "job-1", createdAt: "",
      },
      outputSourceFingerprint: timelineFingerprint({
        id: "vp-1", projectId: "p-1", productId: "p-1", creativePlanId: "plan-1", creativePlanVersion: 1,
        createdAt: "", modifiedAt: "", version: 1, timeline: [{
          id: "s1", sceneId: "s1", order: 1, purpose: "HOOK", assetId: "a1", startMs: 0, durationMs: 2000,
          layer: "video", camera: "hero", motion: "slow-zoom", lighting: "", background: "", transitionIn: "cut",
          transitionOut: "cut", text: [], audioDirection: "",
        }],
        timelineMode: "full",
        audioPlan: { backgroundMusic: "none", voiceover: "none", soundEffects: "none", status: "UNAVAILABLE", message: "" },
        renderPlan: buildRenderPlan("9:16", 2000, "standard", "tiktok"),
        renderState: "completed",
        videoGenerationProvider: "UNAVAILABLE",
        videoGenerationProviderMessage: "",
      }),
      videoGenerationProvider: "UNAVAILABLE",
      videoGenerationProviderMessage: "",
    };
    expect(computeOutputStatus(base)).toBe("CURRENT");
    const edited = {
      ...base,
      timeline: [{ ...base.timeline[0]!, durationMs: 2500 }],
      renderPlan: buildRenderPlan("9:16", 2500, "standard", "tiktok"),
    };
    expect(computeOutputStatus(edited)).toBe("OUTDATED");
  });
});

describe("STEP 5 commercial text layers", () => {
  it("formats price, old price, and discount only from confirmed commercial data", () => {
    const scene = { purpose: "PRICE_OR_OFFER" } as PlanScene;
    const commercial = buildConfirmedCommercial({
      productName: "Oxford",
      currentPrice: 50000,
      originalPrice: 65000,
      currency: "RWF",
    });
    const layers = sceneTextLayers(scene, 0, 2000, commercial);
    expect(layers.some((layer) => /65,000|65000/.test(layer.content))).toBe(true);
    expect(layers.some((layer) => /50,000|50000/.test(layer.content))).toBe(true);
    expect(layers.some((layer) => layer.content.includes("SAVE 23%"))).toBe(true);
  });
});

describe("STEP 5 render validation", () => {
  it("blocks final export when timeline exceeds platform duration", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step5-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });
    const created = await workspace.createProject("STEP5-VALIDATE");
    await workspace.updateProject(created.id, {
      platform: "tiktok",
      productInformation: { name: "Validate Shoe", category: "Footwear", description: "Test product" },
    });
    const rgba = Buffer.alloc(32 * 32 * 4, 255);
    await workspace.uploadImage(created.id, {
      fileName: "front.png",
      mimeType: "image/png",
      dataBase64: encodeRgbaPng(32, 32, rgba).toString("base64"),
    });
    const project = await workspace.getProject(created.id) ?? created;
    await planning.createPlan(project, planning.validateForPlan(project));
    const video = await production.createOrRefresh(project.id);
    const longTimeline = {
      ...video,
      timeline: Array.from({ length: 40 }, (_, index) => ({
        ...video.timeline[0]!,
        id: `scene-${index}`,
        sceneId: `scene-${index}`,
        order: index + 1,
        startMs: index * 2000,
        durationMs: 2000,
      })),
      renderPlan: buildRenderPlan("9:16", 80_000, "standard", "tiktok"),
      platform: "tiktok" as const,
    };
    await fs.writeFile(
      path.join(storageRoot, "video-production", "projects", `${project.id}.json`),
      `${JSON.stringify(longTimeline, null, 2)}\n`,
    );
    const validation = await production.validateRender(project.id, "standard");
    expect(validation.ready).toBe(false);
    expect(validation.issues.some((issue) => /exceeds/i.test(issue))).toBe(true);
  });

  it("validates probed output dimensions and duration", () => {
    const ok = validateRenderedOutput({
      probed: { durationMs: 10_000, width: 1080, height: 1920, codec: "h264", sizeBytes: 500_000 },
      plannedDurationMs: 10_200,
      plannedWidth: 1080,
      plannedHeight: 1920,
      sceneCount: 5,
      preset: "standard",
    });
    expect(ok.valid).toBe(true);
    const bad = validateRenderedOutput({
      probed: { durationMs: 1000, width: 640, height: 360, codec: "h264", sizeBytes: 500 },
      plannedDurationMs: 10_000,
      plannedWidth: 1080,
      plannedHeight: 1920,
      sceneCount: 5,
      preset: "standard",
    });
    expect(bad.valid).toBe(false);
    expect(bad.issues.length).toBeGreaterThan(0);
  });
});

describe("STEP 5 manager integration", () => {
  it("marks output outdated after timeline edits and exposes output details after render metadata exists", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step5-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });
    const created = await workspace.createProject("STEP5-STALE");
    await workspace.updateProject(created.id, {
      productInformation: { name: "Stale Shoe", category: "Footwear", description: "Test product" },
    });
    const rgba = Buffer.alloc(32 * 32 * 4, 255);
    await workspace.uploadImage(created.id, {
      fileName: "front.png",
      mimeType: "image/png",
      dataBase64: encodeRgbaPng(32, 32, rgba).toString("base64"),
    });
    const project = await workspace.getProject(created.id) ?? created;
    await planning.createPlan(project, planning.validateForPlan(project));
    let video = await production.createOrRefresh(project.id);
    const fingerprint = timelineFingerprint(video);
    video = {
      ...video,
      output: {
        assetId: "out-1",
        mimeType: "video/mp4",
        durationMs: 2000,
        width: 1080,
        height: 1920,
        sizeBytes: 1000,
        url: "/videos/out-1.mp4",
        renderJobId: "job-1",
        createdAt: new Date().toISOString(),
        preset: "standard",
        platform: "tiktok",
        validationStatus: "TECHNICALLY_VALIDATED",
      },
      outputSourceFingerprint: fingerprint,
      renderState: "completed",
    };
    await fs.writeFile(path.join(storageRoot, "video-production", "projects", `${project.id}.json`), `${JSON.stringify(video, null, 2)}\n`);
    expect((await production.getVideoProject(project.id))?.outputStatus).toBe("CURRENT");
    const updated = await production.updateVideoProject(project.id, {
      clip: { id: video.timeline[0]!.id, durationMs: 1800 },
    });
    expect(updated.outputStatus).toBe("OUTDATED");
    const details = await production.getOutputDetails(project.id);
    expect(details?.validationStatus).toBe("TECHNICALLY_VALIDATED");
    expect(details?.sceneCount).toBeGreaterThan(0);
  });
});
