import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceError, CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ANALYSIS_VERSION } from "../../../../ai/image-intelligence/visual-metrics.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function solidPng(r: number, g: number, b: number, width = 8, height = 8): string {
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodeRgbaPng(width, height, rgba).toString("base64");
}

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("STEP 6 image ingestion and intelligence", () => {
  it("preserves the original checksum, stores a separate thumbnail, and labels analysis provenance", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step6-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("STEP6-A");
    await workspace.updateProject(project.id, {
      productInformation: { name: "Studio Bottle", category: "Beverage", description: "Black insulated steel bottle in a studio" },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Awareness" },
    });
    const red = solidPng(220, 20, 20);
    const uploaded = await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-front-studio.png",
      mimeType: "image/png",
      dataBase64: red,
    });
    const originalPath = await workspace.getOriginalImagePath(project.id, uploaded.id);
    const before = createHash("sha256").update(await fs.readFile(originalPath!)).digest("hex");
    expect(uploaded.checksumSha256).toBe(before);
    expect(uploaded.analysisState).toBe("pending");

    const manager = new ImageIntelligenceManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const profiles = await manager.analyzeProject(project.id);
    expect(profiles).toHaveLength(1);
    const profile = profiles[0]!;
    expect(profile.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(profile.aiVisionStatus).toBe("IMAGE_ANALYSIS_UNAVAILABLE");
    expect(profile.visualMetrics?.pixelAnalysisAvailable).toBe(true);
    expect(profile.visualMetrics?.width).toBe(8);
    expect(profile.visualMetrics?.height).toBe(8);
    expect(profile.visualMetrics?.dominantColors[0]?.name).toBe("Red");
    expect(profile.observations?.some((item) => item.kind === "observed-from-image" && item.field === "color" && item.value === "Red")).toBe(true);
    expect(profile.observations?.some((item) => item.kind === "user-provided" && item.field === "productName")).toBe(true);
    expect(profile.provenance?.provider).toBe("local-deterministic-image-processing");
    expect(profile.objects.some((object) => object.label === "bottle" && object.kind === "inferred")).toBe(true);

    const after = createHash("sha256").update(await fs.readFile(originalPath!)).digest("hex");
    expect(after).toBe(before);

    const refreshed = await workspace.getProject(project.id);
    const thumbs = refreshed!.productImages.filter((image) => image.parentAssetId === uploaded.id);
    expect(thumbs.length).toBeGreaterThanOrEqual(1);
    expect(thumbs[0]!.id).not.toBe(uploaded.id);
    expect(thumbs[0]!.origin).toBe("derived");
    expect(thumbs[0]!.derivedKind).toBe("thumbnail");
    expect(profile.derivedThumbnailId).toBe(thumbs[0]!.id);

    const restored = new ImageIntelligenceManager();
    await restored.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const dashboard = await restored.getDashboard(project.id);
    expect(dashboard.profiles[0]?.imageId).toBe(uploaded.id);
    expect(dashboard.profiles[0]?.visualMetrics?.dominantColors[0]?.name).toBe("Red");
  });

  it("does not hard-code visual colors and keeps projects isolated", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step6-iso-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const projectA = await workspace.createProject("STEP6-TEMP-A");
    const projectB = await workspace.createProject("STEP6-TEMP-B");
    const red = await workspace.uploadImage(projectA.id, {
      fileName: "a-front.png",
      mimeType: "image/png",
      dataBase64: solidPng(220, 16, 16),
    });
    const blue = await workspace.uploadImage(projectB.id, {
      fileName: "b-front.png",
      mimeType: "image/png",
      dataBase64: solidPng(20, 40, 210),
    });
    const manager = new ImageIntelligenceManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const profileA = (await manager.analyzeProject(projectA.id))[0]!;
    const profileB = (await manager.analyzeProject(projectB.id))[0]!;
    expect(profileA.visualMetrics?.dominantColors[0]?.name).toBe("Red");
    expect(profileB.visualMetrics?.dominantColors[0]?.name).toBe("Blue");
    expect(profileA.imageId).toBe(red.id);
    expect(profileB.imageId).toBe(blue.id);
    expect((await manager.getProfiles(projectA.id)).every((item) => item.imageId !== blue.id)).toBe(true);
    expect((await workspace.getProject(projectA.id))?.productImages.some((image) => image.id === blue.id)).toBe(false);
  });

  it("rejects invalid images with a structured error", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step6-bad-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("STEP6-INVALID");
    await expect(workspace.uploadImage(project.id, {
      fileName: "notes.txt",
      mimeType: "image/png",
      dataBase64: Buffer.from("not-an-image").toString("base64"),
    })).rejects.toBeInstanceOf(CreativeWorkspaceError);
  });

  it("decodes the standard 1x1 PNG used by Creative Workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step6-1x1-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("STEP6-1x1");
    const uploaded = await workspace.uploadImage(project.id, {
      fileName: "tiny.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    expect(uploaded.width).toBe(1);
    expect(uploaded.height).toBe(1);
    const manager = new ImageIntelligenceManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const profile = (await manager.analyzeProject(project.id))[0]!;
    expect(profile.visualMetrics?.pixelAnalysisAvailable).toBe(true);
    expect(profile.aiVisionStatus).toBe("IMAGE_ANALYSIS_UNAVAILABLE");
    expect(profile.quality.classification).toBeTruthy();
  });
});
