import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../../../../ai/creative-workspace/project-asset.js";
import { CanonicalProductManager } from "../../../../ai/product-record/canonical-product-manager.js";
import { humanizeList, humanizeValue } from "../../../../ai/product-record/humanize.js";
import { detectCanonicalView, normalizeViewKind } from "../../../../ai/product-record/view-kinds.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("humanizeValue", () => {
  it("renders selling-point objects and never [object Object]", () => {
    expect(humanizeValue({ point: "brown leather", source: "image-evidence", confidence: 0.9 })).toBe("brown leather");
    expect(humanizeList([
      { point: "lace-up design" },
      { message: "formal style" },
      "extra",
    ])).toEqual(["lace-up design", "formal style", "extra"]);
    expect(humanizeValue({ nested: true })).not.toContain("[object Object]");
    expect(humanizeValue("[object Object]")).toBe("");
  });
});

describe("canonical view detection", () => {
  it("detects compound views before simple left/right/front", () => {
    expect(detectCanonicalView("shoe-front-left.jpg")).toEqual({ view: "front_left", confidence: 0.94 });
    expect(detectCanonicalView("product_back.png").view).toBe("back");
    expect(normalizeViewKind("LEFT SIDE")).toBe("left");
    expect(normalizeViewKind("CLOSE-UP")).toBe("close-up");
    expect(detectCanonicalView("random-photo.jpg").view).toBe("unknown");
  });
});

describe("CanonicalProductManager", () => {
  it("persists original assets, excludes final videos, keeps user view corrections, and does not break asset prep", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-canonical-product-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("Oxford Launch");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "Brown leather oxford",
        category: "shoes",
        description: "Formal lace-up leather oxford shoe",
        price: 85000,
      },
    });
    const front = await workspace.uploadImage(project.id, {
      fileName: "oxford-front.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    await workspace.uploadImage(project.id, {
      fileName: "oxford-left.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });

    const videoPath = path.join(root, "dummy-product-video.mp4");
    await fs.writeFile(videoPath, Buffer.alloc(256, 7));
    const registered = await workspace.registerOutputAsset(project.id, {
      sourcePath: videoPath,
      fileName: "product-video.mp4",
      mimeType: "video/mp4",
      width: 1080,
      height: 1920,
      sizeBytes: 256,
      durationMs: 15000,
    });
    expect(isOriginalProductImage(registered)).toBe(false);
    expect(registered.fileName).toBe("product-video.mp4");

    const mixed = await workspace.getProject(project.id);
    expect(mixed?.productImages.length).toBe(3);
    expect(mixed?.productImages.filter(isOriginalProductImage)).toHaveLength(2);
    expect(await workspace.getOriginalImagePath(project.id, registered.id)).toBeNull();

    const canonical = new CanonicalProductManager();
    await canonical.initialize(root, { workspace });
    const synced = await canonical.sync(project.id);
    expect(synced.originalAssets).toHaveLength(2);
    expect(synced.finalOutputs.some((item) => item.originalFilename.includes("product-video") || item.storedFileName.endsWith(".mp4"))).toBe(true);
    expect(synced.originalAssets.every((asset) => asset.fileAccessible)).toBe(true);
    expect(synced.originalAssets.every((asset) => asset.assetId !== registered.id)).toBe(true);

    const disk = JSON.parse(await fs.readFile(path.join(root, "creative-workspace", "projects", project.id, "product-record.json"), "utf8")) as typeof synced;
    expect(disk.originalAssets).toHaveLength(2);

    const resolved = await canonical.resolveProductionPath(project.id, front.id);
    expect(resolved?.absolutePath).toBeTruthy();
    await fs.access(resolved!.absolutePath);

    await canonical.correctView(project.id, front.id, "back");
    const afterCorrect = await canonical.get(project.id);
    const view = afterCorrect?.productViews.find((entry) => entry.assetId === front.id);
    expect(view?.view).toBe("back");
    expect(view?.source).toBe("user");
    expect(view?.confidence).toBe(1);

    const resynced = await canonical.sync(project.id);
    expect(resynced.productViews.find((entry) => entry.assetId === front.id)?.source).toBe("user");
    expect(resynced.productViews.find((entry) => entry.assetId === front.id)?.view).toBe("back");
    expect(resynced.assetMap.back).toContain(front.id);

    const images = new ImageIntelligenceManager();
    await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    products.attachImageIntelligence(images);
    const prep = new ProductAssetPreparationManager();
    await prep.initialize(root, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      images,
    });
    const prepared = await prep.prepareProductAssets(project.id);
    expect(prepared.assets).toHaveLength(2);
    expect(prepared.assets.every((asset) => asset.sourceImageId !== registered.id)).toBe(true);
  });
});
