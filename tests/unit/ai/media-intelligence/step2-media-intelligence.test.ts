import { describe, expect, it } from "vitest";
import { mapQualityToMediaStatus, countUsableAssets } from "../../../../ai/media-intelligence/quality-status.js";
import { resolveProductionImagePath } from "../../../../ai/media-intelligence/asset-resolver.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceProfile } from "../../../../ai/image-intelligence/types.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function profile(overrides: Partial<ImageIntelligenceProfile> = {}): ImageIntelligenceProfile {
  return {
    id: "p1",
    projectId: "proj",
    imageId: "img1",
    fileName: "shoe.png",
    mimeType: "image/png",
    quality: { score: 85, confidence: 0.9, notes: [], classification: "GOOD" },
    background: { type: "White Studio", removable: true, confidence: 0.9 },
    boundaries: { detected: true, confidence: 0.9, notes: "" },
    resolution: { tier: "high", estimatedFromBytes: 1000, notes: "" },
    viewRole: "front",
    lighting: "",
    shadows: "",
    reflections: "",
    cameraAngle: "",
    composition: "",
    perspective: "",
    objects: [],
    scene: "",
    defects: [],
    enhancements: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cached: false,
    analysisState: "ready",
    processingState: "ready",
    ...overrides,
  };
}

describe("media intelligence quality status", () => {
  it("maps classifications to media asset statuses", () => {
    expect(mapQualityToMediaStatus(profile(), false)).toBe("READY");
    expect(mapQualityToMediaStatus(profile({ quality: { score: 30, confidence: 0.5, notes: [], classification: "POOR" } }), false)).toBe("LOW_QUALITY");
    expect(mapQualityToMediaStatus(null, true)).toBe("FAILED");
    expect(mapQualityToMediaStatus(profile({ analysisState: "analyzing" }), false)).toBe("PROCESSING");
  });

  it("counts usable assets without blocking on one poor image", () => {
    const statuses = ["READY", "READY", "NEEDS_REVIEW", "LOW_QUALITY", "FAILED"] as const;
    expect(countUsableAssets([...statuses])).toBe(3);
  });
});

describe("resolveProductionImagePath", () => {
  it("falls back to original when no derived foreground exists", async () => {
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-mi-"));
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storage);
    const created = await workspace.createProject("Test Product");
    const projectId = created.id;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const original = await workspace.uploadImage(projectId, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
      width: 1,
      height: 1,
    });
    const resolved = await resolveProductionImagePath(workspace, projectId, original.id);
    expect(resolved?.source).toBe("original");
    expect(resolved?.path).toBeTruthy();
    await fs.rm(storage, { recursive: true, force: true });
  });

  it("prefers derived foreground when registered", async () => {
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-mi-"));
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storage);
    const created = await workspace.createProject("Test Product");
    const projectId = created.id;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const original = await workspace.uploadImage(projectId, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
      width: 1,
      height: 1,
    });
    const derived = await workspace.registerDerivedAsset(projectId, {
      fileName: "foreground-product.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
      parentAssetId: original.id,
      derivedKind: "analyzed",
    });
    await workspace.patchImage(projectId, derived.id, { processingStatus: "ready" });
    const resolved = await resolveProductionImagePath(workspace, projectId, original.id);
    expect(resolved?.source).toBe("derived-foreground");
    expect(resolved?.assetId).toBe(derived.id);
    await fs.rm(storage, { recursive: true, force: true });
  });
});

describe("creative workspace removeImage", () => {
  it("removes derived children when original is deleted", async () => {
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-mi-"));
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storage);
    const created = await workspace.createProject("Test");
    const projectId = created.id;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const original = await workspace.uploadImage(projectId, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
    });
    await workspace.registerDerivedAsset(projectId, {
      fileName: "foreground.png",
      mimeType: "image/png",
      dataBase64: png.toString("base64"),
      parentAssetId: original.id,
      derivedKind: "analyzed",
    });
    const before = (await workspace.getProject(projectId))!.productImages.length;
    expect(before).toBe(2);
    await workspace.removeImage(projectId, original.id);
    const after = (await workspace.getProject(projectId))!.productImages.length;
    expect(after).toBe(0);
    await fs.rm(storage, { recursive: true, force: true });
  });
});
