import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import {
  buildEndCardClip,
  buildEndCardPlan,
  END_CARD_DURATION_MS,
  validateEndCardPlan,
  writeEndCardBackground,
} from "../../../../ai/video-production/end-card.js";
import { ffmpegAvailable, ffprobeAvailable, probeVideo, renderStillClip } from "../../../../ai/video-production/ffmpeg-renderer.js";
import { buildRenderPlanForProfile } from "../../../../ai/video-production/plan-to-timeline.js";
import { profileForPlatform } from "../../../../ai/video-production/platform-profiles.js";
import { getEngine1FinalDiagnostics } from "../../../../ai/video-production/production-capabilities.js";
import {
  validateEngine1FinalPlan,
  validateRenderedOutput,
} from "../../../../ai/video-production/render-validation.js";
import { VIDEO_PRODUCTION_VERSION } from "../../../../ai/video-production/types.js";
import { VideoProductionManager } from "../../../../ai/video-production/video-production-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function solidPng(r: number, g: number, b: number, w = 320, h = 480) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodeRgbaPng(w, h, rgba).toString("base64");
}

async function seedProject(workspace: CreativeWorkspaceManager, name: string) {
  const created = await workspace.createProject(name);
  await workspace.updateProject(created.id, {
    productInformation: {
      name,
      category: "Footwear",
      description: `${name} trail product`,
      price: 75000,
      originalPrice: 90000,
      currency: "RWF",
      website: `https://www.example-${name.toLowerCase().replace(/\s+/g, "")}.rw`,
      phone: "+250788111222",
      callToAction: "Shop Now",
    },
    brandInformation: {
      name: `${name} Brand`,
      website: `https://www.example-${name.toLowerCase().replace(/\s+/g, "")}.rw`,
      colors: "#1a2b3c",
    },
    campaignInformation: { name: `${name} Campaign`, objective: "conversions", callToAction: "Order Today" },
    platform: "tiktok",
    language: "en",
  });
  await workspace.uploadImage(created.id, {
    fileName: `${name}.png`,
    mimeType: "image/png",
    dataBase64: await solidPng(40, 90, 160),
  });
  return (await workspace.getProject(created.id))!;
}

describe("STEP 11 ENGINE 1 end card + final validation", () => {
  it("bumps production version to step11", () => {
    expect(VIDEO_PRODUCTION_VERSION).toBe("step12-workspace-final-v1");
    expect(getEngine1FinalDiagnostics().engine1FinalAvailable).toBe(true);
    expect(getEngine1FinalDiagnostics().endCard.companyDataDriven).toBe(true);
  });

  it("builds end card from project brand data without inventing contacts", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-s11-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await seedProject(workspace, "STEP11-Brand");
    const plan = buildEndCardPlan({ project, preset: "standard", productionMode: "AI_PRODUCT_MOTION" });
    expect(plan.required).toBe(true);
    expect(plan.durationMs).toBe(END_CARD_DURATION_MS);
    expect(plan.companyName).toBe("STEP11-Brand Brand");
    expect(plan.website).toContain("example-");
    expect(plan.phone).toBe("+250788111222");
    expect(plan.cta).toBe("Order Today");
    expect(plan.lines.some((l) => l.role === "brand")).toBe(true);
    expect(validateEndCardPlan(plan).valid).toBe(true);

    const emptyStorage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-s11e-"));
    roots.push(emptyStorage);
    const ws2 = new CreativeWorkspaceManager();
    await ws2.initialize(emptyStorage);
    const bare = await ws2.createProject("Bare");
    const barePlan = buildEndCardPlan({
      project: (await ws2.getProject(bare.id))!,
      preset: "standard",
      productionMode: "AI_PRODUCT_MOTION",
    });
    expect(barePlan.website).toBe("");
    expect(barePlan.phone).toBe("");
    expect(barePlan.lines.length).toBeGreaterThan(0);
  });

  it("rejects invalid ENGINE 1 plans and missing end card in output validation", () => {
    const bad = validateEngine1FinalPlan({
      projectId: "",
      selectedEngine: "CINEMATIC_3D",
      format: "2:1",
      width: 10,
      height: 10,
      sceneIds: [],
      assetIds: [],
      assetsBelongToProject: false,
      pathsResolved: false,
      durationMs: 100,
    });
    expect(bad.valid).toBe(false);
    expect(bad.issues.length).toBeGreaterThan(3);

    const missingEnd = validateRenderedOutput({
      probed: { durationMs: 8000, width: 720, height: 1280, codec: "h264", sizeBytes: 50_000 },
      plannedDurationMs: 13000,
      plannedWidth: 720,
      plannedHeight: 1280,
      sceneCount: 3,
      preset: "standard",
      endCardRequired: true,
      endCardRendered: false,
      endCardDurationMs: 5000,
    });
    expect(missingEnd.valid).toBe(false);
    expect(missingEnd.checks.endCardPresent).toBe(false);

    const ok = validateRenderedOutput({
      probed: { durationMs: 13000, width: 720, height: 1280, codec: "h264", sizeBytes: 50_000 },
      plannedDurationMs: 13000,
      plannedWidth: 720,
      plannedHeight: 1280,
      sceneCount: 3,
      preset: "standard",
      endCardRequired: true,
      endCardRendered: true,
      endCardDurationMs: 5000,
      projectId: "p1",
      jobProjectId: "p1",
    });
    expect(ok.valid).toBe(true);
  });

  it("renders an end-card still clip via existing FFmpeg path", async () => {
    if (!(await ffmpegAvailable()) || !(await ffprobeAvailable())) return;
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-s11r-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await seedProject(workspace, "STEP11-Render");
    const plan = buildEndCardPlan({ project, preset: "standard", productionMode: "AI_PRODUCT_MOTION" });
    const profile = profileForPlatform("tiktok");
    const renderPlan = buildRenderPlanForProfile(profile, plan.durationMs, "standard");
    const bg = path.join(storageRoot, "end-bg.png");
    await writeEndCardBackground(bg, renderPlan.width, renderPlan.height);
    const clip = buildEndCardClip(plan, renderPlan);
    const out = path.join(storageRoot, "end.mp4");
    const result = await renderStillClip({ clip, imagePath: bg }, renderPlan, out, undefined);
    expect(["applied", "skipped", "unavailable", "failed"]).toContain(result.overlay);
    const probed = await probeVideo(out);
    expect(probed.durationMs).toBeGreaterThan(1500);
    expect(probed.width).toBe(renderPlan.width);
    expect(probed.height).toBe(renderPlan.height);
    expect(probed.sizeBytes).toBeGreaterThan(1000);
  }, 120_000);

  it("standard AI_PRODUCT_MOTION render includes end card and stays project-isolated", async () => {
    if (!(await ffmpegAvailable()) || !(await ffprobeAvailable())) return;
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-s11f-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });

    const projectA = await seedProject(workspace, "STEP11-A");
    const projectB = await seedProject(workspace, "STEP11-B");
    await planning.createPlan(projectA, planning.validateForPlan(projectA), {
      productionMode: "AI_PRODUCT_MOTION",
      creativeTone: "Premium",
    });
    await planning.createPlan(projectB, planning.validateForPlan(projectB), {
      productionMode: "AI_PRODUCT_MOTION",
    });

    const videoA = await production.createOrRefresh(projectA.id);
    expect(videoA.productionMode).toBe("AI_PRODUCT_MOTION");
    const { job } = await production.startRender(projectA.id, "standard");
    for (let i = 0; i < 180; i++) {
      const current = await production.getJob(job.id);
      if (current?.status === "completed" || current?.status === "failed") break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const done = await production.getJob(job.id);
    expect(done?.status).toBe("completed");
    expect(done?.endCardRendered).toBe(true);
    expect(done?.endCardDurationMs).toBeGreaterThanOrEqual(1500);
    expect(done?.progress).toBe(100);
    expect(done?.stageMessage).toBe("Video ready");

    const refreshed = await production.getVideoProject(projectA.id);
    expect(refreshed?.endCardPlan?.rendered).toBe(true);
    expect(refreshed?.endCardPlan?.projectId).toBe(projectA.id);
    expect(refreshed?.endCardPlan?.companyName).toContain("STEP11-A");
    expect(refreshed?.qualityGate).toBe("READY");
    expect(refreshed?.output?.sizeBytes).toBeGreaterThan(1000);

    const details = await production.getOutputDetails(projectA.id);
    expect(details?.url).toContain(projectA.id);
    const filePath = await production.getOutputFilePath(projectA.id);
    expect(filePath).toBeTruthy();
    const probed = await probeVideo(filePath!);
    expect(probed.durationMs).toBeGreaterThan(END_CARD_DURATION_MS);

    expect(await production.getVideoProject(projectB.id)).toBeNull();
    const videoB = await production.createOrRefresh(projectB.id);
    expect(videoB.projectId).toBe(projectB.id);
    expect(videoB.timeline.every((c) => c.assetId === projectB.productImages[0]!.id)).toBe(true);
  }, 300_000);
});
