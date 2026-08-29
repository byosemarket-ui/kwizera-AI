import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceError, CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { inspectImageBuffer } from "../../../../ai/creative-workspace/image-inspect.js";
import { AssetIndexManager } from "../../../../desktop/project-workspace/asset-index.ts";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("STEP 5 image inspect", () => {
  it("accepts a real PNG and rejects garbage", () => {
    const png = inspectImageBuffer(Buffer.from(PNG_1X1, "base64"), "image/png");
    expect(png.ok).toBe(true);
    if (png.ok) {
      expect(png.mimeType).toBe("image/png");
      expect(png.width).toBe(1);
      expect(png.height).toBe(1);
    }
    const bad = inspectImageBuffer(Buffer.from("not-an-image"), "image/png");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("INVALID_IMAGE");
  });
});

describe("STEP 5 project and asset foundation", () => {
  it("creates, persists, isolates, and reopens projects with stable asset refs", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step5-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);

    const projectA = await workspace.createProject("STEP5-A");
    expect(projectA.id).toMatch(/^[0-9a-f-]{36}$/i);
    const assetA = await workspace.uploadImage(projectA.id, {
      fileName: "a.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    expect(assetA.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(assetA.assetType).toBe("original-image");
    expect(assetA.origin).toBe("upload");
    expect(assetA.url).toBe(`/api/workspace/projects/${projectA.id}/images/${assetA.id}.png`);
    expect(assetA.url).not.toMatch(/[/\\]var[/\\]lib/);

    const originalPath = await workspace.getOriginalImagePath(projectA.id, assetA.id);
    expect(originalPath).toBeTruthy();
    const originalBytes = await fs.readFile(originalPath!);
    expect(originalBytes.equals(Buffer.from(PNG_1X1, "base64"))).toBe(true);

    const derived = await workspace.registerDerivedAsset(projectA.id, {
      fileName: "a-thumb.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
      parentAssetId: assetA.id,
    });
    expect(derived.parentAssetId).toBe(assetA.id);
    expect(derived.origin).toBe("derived");
    expect(derived.id).not.toBe(assetA.id);
    const originalAfter = await workspace.getOriginalImagePath(projectA.id, assetA.id);
    expect(originalAfter).toBe(originalPath);

    const projectB = await workspace.createProject("STEP5-B");
    const assetB = await workspace.uploadImage(projectB.id, {
      fileName: "b.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });

    const openedA = await workspace.openProject(projectA.id);
    expect(openedA.productImages.map((image) => image.id)).toContain(assetA.id);
    expect(openedA.productImages.map((image) => image.id)).not.toContain(assetB.id);
    expect(workspace.listProjectAssets(openedA).every((ref) => ref.projectId === projectA.id)).toBe(true);
    expect(workspace.getAsset(openedA, assetB.id)).toBeNull();

    const openedB = await workspace.openProject(projectB.id);
    expect(openedB.productImages[0]?.id).toBe(assetB.id);
    expect(await workspace.getImagePath(projectB.id, `${assetA.id}.png`)).toBeNull();

    await workspace.closeProject(projectB.id);
    expect(await workspace.getActiveProject()).toBeNull();

    const restored = new CreativeWorkspaceManager();
    await restored.initialize(storageRoot);
    const again = await restored.getProject(projectA.id);
    expect(again?.id).toBe(projectA.id);
    expect(again?.productImages.some((image) => image.id === assetA.id)).toBe(true);
    expect(again?.productImages.some((image) => image.id === derived.id && image.parentAssetId === assetA.id)).toBe(true);
  });

  it("rejects invalid uploads with a structured error and does not store them", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step5-bad-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("STEP5-INVALID");
    await expect(workspace.uploadImage(project.id, {
      fileName: "notes.txt",
      mimeType: "image/png",
      dataBase64: Buffer.from("hello").toString("base64"),
    })).rejects.toBeInstanceOf(CreativeWorkspaceError);

    const still = await workspace.getProject(project.id);
    expect(still?.productImages).toHaveLength(0);
  });

  it("does not mix Project A assets into Project B in the Studio index", () => {
    const index = new AssetIndexManager();
    const payload = {
      activeProject: {
        id: "11111111-1111-1111-1111-111111111111",
        name: "A",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
        productImages: [{ id: "asset-a", fileName: "a.png", mimeType: "image/png", sizeBytes: 10, uploadedAt: "2026-01-01T00:00:00.000Z", url: "/a" }],
        productInformation: { name: "A", category: "A" },
      },
      projects: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          name: "A",
          createdAt: "2026-01-01T00:00:00.000Z",
          modifiedAt: "2026-01-01T00:00:00.000Z",
          productImages: [{ id: "asset-a", fileName: "a.png", mimeType: "image/png", sizeBytes: 10, uploadedAt: "2026-01-01T00:00:00.000Z", url: "/a" }],
          productInformation: { name: "A", category: "A" },
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          name: "B",
          createdAt: "2026-01-01T00:00:00.000Z",
          modifiedAt: "2026-01-01T00:00:00.000Z",
          productImages: [{ id: "asset-b", fileName: "b.png", mimeType: "image/png", sizeBytes: 10, uploadedAt: "2026-01-01T00:00:00.000Z", url: "/b" }],
          productInformation: { name: "B", category: "B" },
        },
      ],
      integrations: {},
    };
    const assets = index.build(payload, new Set());
    expect(assets.map((asset) => asset.id)).toEqual(["asset-a"]);
  });
});
