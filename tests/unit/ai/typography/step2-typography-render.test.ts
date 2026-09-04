import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { composeTypographyDecision } from "../../../../ai/typography/typography-engine.js";
import { buildDrawtextFilter, drawtextX } from "../../../../ai/typography/drawtext-integration.js";
import { applyTypographyDecisionToTimeline, typographySceneToLayers } from "../../../../ai/typography/to-video-layers.js";
import { sanitizeAiTypographyDecision, validateTypographyDecision } from "../../../../ai/typography/validator.js";
import { getVerifiedFonts, pickFallbackFont } from "../../../../ai/typography/font-registry.js";
import {
  ffmpegAvailable,
  ffprobeAvailable,
  probeVideo,
  renderStillClip,
  resolveFontFile,
} from "../../../../ai/video-production/ffmpeg-renderer.js";
import { VideoProductionManager } from "../../../../ai/video-production/video-production-manager.js";
import type { VideoRenderPlan, VideoTimelineClip } from "../../../../ai/video-production/types.js";
import type { TypographyDecision, VerifiedFont } from "../../../../ai/typography/types.js";
import { TEXT_ROLES } from "../../../../ai/typography/types.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function makeFont(overrides: Partial<VerifiedFont> & Pick<VerifiedFont, "id" | "family" | "filePath">): VerifiedFont {
  return {
    style: "regular",
    weight: 400,
    italic: false,
    bold: false,
    category: "sans",
    personalities: ["clean-sans", "tech", "modern-sans"],
    roles: [...TEXT_ROLES],
    latinExtended: true,
    verified: true,
    ...overrides,
  };
}

function clipBase(sceneId: string, text: VideoTimelineClip["text"]): VideoTimelineClip {
  return {
    id: sceneId,
    sceneId,
    order: 1,
    purpose: "hero",
    assetId: "asset-1",
    startMs: 0,
    durationMs: 1200,
    layer: "video",
    camera: "front",
    motion: "hold",
    lighting: "studio",
    background: "product still",
    transitionIn: "cut",
    transitionOut: "cut",
    text,
    audioDirection: "none",
  };
}

const plan9x16: VideoRenderPlan = {
  width: 360,
  height: 640,
  aspectRatio: "9:16",
  frameRate: 15,
  durationMs: 1200,
  videoCodec: "libx264",
  audioCodec: "none",
  outputFormat: "mp4",
  preset: "preview",
  x264Preset: "ultrafast",
  crf: 28,
};

describe("STEP 2 typography render integration", () => {
  it("maps validated typography into drawtext with font, size, and placement", async () => {
    const fonts = await getVerifiedFonts();
    const fallback = pickFallbackFont(fonts);
    expect(fallback).toBeTruthy();
    const decision = await composeTypographyDecision({
      projectId: "proj-drawtext",
      productCategory: "technology gadgets",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      platform: "tiktok",
      useOllama: false,
      scenes: [{
        sceneId: "scene-1",
        texts: [{ role: "headline", text: "Precision tech" }],
        image: { productLikelyCentered: true },
      }],
    }, fonts);
    const layers = typographySceneToLayers(decision, "scene-1", 0, 1200);
    expect(layers[0]?.typography?.fontId).toBeTruthy();
    expect(layers[0]?.typography?.normalizedY).toBeLessThan(0.4);
    const built = await buildDrawtextFilter(clipBase("scene-1", layers), plan9x16, fallback!.filePath);
    expect(built.layersDrawn).toBeGreaterThan(0);
    expect(built.filter).toContain("drawtext=fontfile=");
    expect(built.filter).toMatch(/fontsize=\d+/);
    expect(built.filter).toMatch(/y=h\*0\.\d+/);
    expect(built.filter).not.toMatch(/FakeScript|not-installed/);
  });

  it("uses different drawtext coordinates for different placements", async () => {
    const fonts = await getVerifiedFonts();
    const decision = await composeTypographyDecision({
      projectId: "proj-place-render",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      useOllama: false,
      scenes: [
        {
          sceneId: "top-scene",
          texts: [{ role: "headline", text: "Top copy" }],
          image: { productLikelyCentered: true },
        },
        {
          sceneId: "cta-scene",
          texts: [{ role: "cta", text: "Shop now" }],
          image: { productLikelyCentered: true },
        },
      ],
    }, fonts);
    const top = typographySceneToLayers(decision, "top-scene", 0, 1000)[0]!;
    const cta = typographySceneToLayers(decision, "cta-scene", 0, 1000)[0]!;
    expect(top.typography!.normalizedY).not.toEqual(cta.typography!.normalizedY);
    expect(drawtextX("center", 0.5)).toContain("text_w/2");
    expect(drawtextX("left", 0.1)).toContain("w*0.1000");
  });

  it("rejects invalid AI fonts before drawtext generation", async () => {
    const fonts = await getVerifiedFonts();
    const fallback = pickFallbackFont(fonts)!;
    const unsafe: TypographyDecision = {
      projectId: "proj-bad-font",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      source: "ai-validated",
      fallbackUsed: false,
      scenes: [{
        sceneId: "s1",
        items: [{
          id: "i1",
          role: "headline",
          text: "Hello",
          lines: ["Hello"],
          font: {
            id: "missing:Fake.ttf",
            family: "Fake",
            filePath: "/no/font.ttf",
            style: "regular",
            weight: 400,
            weightName: "regular",
            personality: "script",
          },
          layout: { region: "top-center", normalizedX: 0.5, normalizedY: 0.12, alignment: "center" },
          size: { fontSizePx: 40, maxLines: 2, maxWidthPx: 800 },
          visual: { color: "white", contrastStrategy: "outline" },
          hierarchy: 1,
          hierarchyLevel: "PRIMARY",
          importanceScore: 0.1,
          emphasis: [],
          boundingArea: { x: 0.3, y: 0.12, width: 0.4, height: 0.08 },
          confidence: 0.1,
        }],
      }],
      warnings: [],
      createdAt: new Date().toISOString(),
    };
    expect(validateTypographyDecision(unsafe, fonts).valid).toBe(false);
    const safe = sanitizeAiTypographyDecision(unsafe, fonts);
    expect(safe.scenes[0]!.items[0]!.font.id).toBe(fallback.id);
    const layers = typographySceneToLayers(safe, "s1", 0, 1000);
    const built = await buildDrawtextFilter(clipBase("s1", layers), plan9x16, fallback.filePath);
    expect(built.filter).toContain("drawtext=fontfile=");
    expect(built.filter).not.toContain("Fake.ttf");
  });

  it("renders a real clip with typography overlays when FFmpeg is available", async () => {
    if (!(await ffmpegAvailable()) || !(await ffprobeAvailable())) {
      expect(true).toBe(true);
      return;
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-typo-render-"));
    roots.push(root);
    const imagePath = path.join(root, "product.png");
    await fs.writeFile(imagePath, encodeRgbaPng(64, 64, Buffer.alloc(64 * 64 * 4, 90)));
    const fonts = await getVerifiedFonts();
    const fontFile = (await resolveFontFile()) ?? pickFallbackFont(fonts)?.filePath;
    expect(fontFile).toBeTruthy();
    const decision = await composeTypographyDecision({
      projectId: "proj-ffmpeg",
      productCategory: "fashion apparel",
      width: plan9x16.width,
      height: plan9x16.height,
      aspectRatio: "9:16",
      useOllama: false,
      scenes: [{
        sceneId: "scene-rw",
        texts: [
          { role: "headline", text: "Kwamamaza ibicuruzwa byawe" },
          { role: "cta", text: "Gura nonaha" },
        ],
        image: { productLikelyCentered: true, backgroundComplexity: "high" },
      }],
    }, fonts);
    const layers = typographySceneToLayers(decision, "scene-rw", 0, 1200);
    expect(layers.every((layer) => layer.typography)).toBe(true);
    const out = path.join(root, "clip.mp4");
    const rendered = await renderStillClip(
      { clip: clipBase("scene-rw", layers), imagePath },
      plan9x16,
      out,
      fontFile,
    );
    expect(rendered.overlay).toBe("applied");
    const probed = await probeVideo(out);
    expect(probed.sizeBytes).toBeGreaterThan(500);
    expect(probed.width).toBe(plan9x16.width);
    expect(probed.height).toBe(plan9x16.height);
    expect(probed.durationMs).toBeGreaterThan(200);
  });

  it("keeps project typography isolated through VideoProductionManager refresh", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-typo-mgr-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });

    const projectA = await seedProject(workspace, "TECH-A", "technology gadgets", "Smart Sensor");
    const projectB = await seedProject(workspace, "FASHION-B", "fashion apparel", "Silk Dress");
    await planning.createPlan(projectA, planning.validateForPlan(await workspace.getProject(projectA.id) ?? projectA));
    await planning.createPlan(projectB, planning.validateForPlan(await workspace.getProject(projectB.id) ?? projectB));

    const videoA = await production.createOrRefresh(projectA.id);
    const videoB = await production.createOrRefresh(projectB.id);
    expect(videoA.projectId).toBe(projectA.id);
    expect(videoB.projectId).toBe(projectB.id);
    expect(videoA.typographyPlan?.projectId).toBe(projectA.id);
    expect(videoB.typographyPlan?.projectId).toBe(projectB.id);
    expect(videoA.timeline.some((clip) => clip.text.some((layer) => layer.typography))).toBe(true);
    expect(videoB.timeline.some((clip) => clip.text.some((layer) => layer.typography))).toBe(true);
    const regionsA = new Set(videoA.timeline.flatMap((clip) => clip.text.map((layer) => layer.typographyRegion ?? layer.position)));
    expect(regionsA.size).toBeGreaterThan(0);
    expect(JSON.stringify(videoA.typographyPlan)).not.toContain(projectB.id);
  });

  it("renders a production video with applied typography overlays end-to-end", async () => {
    if (!(await ffmpegAvailable()) || !(await ffprobeAvailable())) {
      expect(true).toBe(true);
      return;
    }
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-typo-e2e-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    const production = new VideoProductionManager();
    await production.initialize(storageRoot, { workspace, planning });
    const project = await seedProject(workspace, "E2E-TECH", "technology gadgets", "Aurora Phone");
    const created = await planning.createPlan(project, planning.validateForPlan(project));
    expect(created.plan).toBeTruthy();
    await planning.finalize(project.id);
    const video = await production.createOrRefresh(project.id);
    expect(video.timeline.some((clip) => clip.text.some((layer) => layer.typography))).toBe(true);
    const { job } = await production.startRender(project.id, "standard");
    const finished = await waitForJob(production, job.id);
    expect(finished.status).toBe("completed");
    expect(finished.textOverlay).toBe("applied");
    const complete = await production.getVideoProject(project.id);
    expect(complete?.output?.sizeBytes).toBeGreaterThan(1000);
    expect(complete?.typographyPlan?.projectId).toBe(project.id);
    const filePath = await production.getOutputFilePath(project.id);
    expect(filePath).toBeTruthy();
    const probed = await probeVideo(filePath!);
    expect(probed.durationMs).toBeGreaterThan(500);
    expect(probed.width).toBeGreaterThan(100);
  }, 180_000);

  it("applies timeline typography without leaking across scene ids", async () => {
    const fonts = [
      makeFont({ id: "arial:Arial.ttf", family: "Arial", filePath: "C:\\Windows\\Fonts\\arial.ttf", personalities: ["tech", "clean-sans"] }),
      makeFont({
        id: "georgia:Georgia.ttf",
        family: "Georgia",
        filePath: "C:\\Windows\\Fonts\\georgia.ttf",
        category: "serif",
        personalities: ["fashion", "luxury-serif", "serif"],
        roles: ["title", "headline", "productName", "brand", "sceneCaption", "hook"],
      }),
    ];
    const decision = await composeTypographyDecision({
      projectId: "proj-iso",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      useOllama: false,
      scenes: [{ sceneId: "only-a", texts: [{ role: "headline", text: "Only A" }] }],
    }, fonts);
    const clips = applyTypographyDecisionToTimeline([
      clipBase("only-a", [{ content: "legacy", kind: "headline", startMs: 0, durationMs: 1000, position: "top" }]),
      clipBase("only-b", [{ content: "legacy-b", kind: "headline", startMs: 0, durationMs: 1000, position: "top" }]),
    ], decision);
    expect(clips[0]!.text[0]!.content).toContain("Only A");
    expect(clips[1]!.text[0]!.content).toBe("legacy-b");
  });
});

async function seedProject(
  workspace: CreativeWorkspaceManager,
  name: string,
  category: string,
  productName: string,
) {
  const created = await workspace.createProject(name);
  await workspace.updateProject(created.id, {
    productInformation: {
      name: productName,
      category,
      description: `${productName} description`,
      price: 25000,
      originalPrice: 40000,
      currency: "RWF",
    },
    brandInformation: { name: "KWIZERA", website: "https://example.com" },
    campaignInformation: { name: "Launch", objective: "conversions", callToAction: "Buy now" },
    platform: "tiktok",
  });
  const rgba = Buffer.alloc(48 * 48 * 4);
  for (let i = 0; i < 48 * 48; i += 1) {
    rgba[i * 4] = 200;
    rgba[i * 4 + 1] = 120;
    rgba[i * 4 + 2] = 80;
    rgba[i * 4 + 3] = 255;
  }
  await workspace.uploadImage(created.id, {
    fileName: `${name}.png`,
    mimeType: "image/png",
    dataBase64: encodeRgbaPng(48, 48, rgba).toString("base64"),
  });
  return (await workspace.getProject(created.id))!;
}

async function waitForJob(production: VideoProductionManager, jobId: string) {
  const started = Date.now();
  while (Date.now() - started < 150_000) {
    const job = await production.getJob(jobId);
    if (job?.status === "completed" || job?.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Timed out waiting for typography render job");
}
