import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("CreativeWorkspaceManager", () => {
  it("persists projects, restores the active session, stores images, and validates required inputs", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-workspace-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);

    const project = await workspace.createProject("Launch Campaign");
    expect(workspace.validate(project).valid).toBe(false);

    await workspace.updateProject(project.id, {
      productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Summer launch", objective: "Increase awareness" },
      targetAudience: "Active urban professionals",
      language: "en",
      platform: "instagram",
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle.png",
      mimeType: "image/png",
      dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    });

    const restoredWorkspace = new CreativeWorkspaceManager();
    await restoredWorkspace.initialize(storageRoot);
    const restored = await restoredWorkspace.getActiveProject();

    expect(restored?.name).toBe("Launch Campaign");
    expect(restored?.productImages).toHaveLength(1);
    expect(restoredWorkspace.validate(restored).valid).toBe(true);
  });

  it("keeps every original when concurrent uploads and derived assets race", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-workspace-race-"));
    storageRoots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Race Safe");
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    const uploads = await Promise.all(
      Array.from({ length: 6 }, (_, index) => workspace.uploadImage(project.id, {
        fileName: `race-${index + 1}.png`,
        mimeType: "image/png",
        dataBase64: png,
        allowDuplicateContent: true,
      })),
    );
    await Promise.all(uploads.map((image) => workspace.registerDerivedAsset(project.id, {
      fileName: `${image.fileName}-thumb.png`,
      mimeType: "image/png",
      dataBase64: png,
      parentAssetId: image.id,
      derivedKind: "thumbnail",
    })));

    const restored = await workspace.getProject(project.id);
    const originals = (restored?.productImages ?? []).filter((img) => !img.parentAssetId && img.origin !== "derived");
    expect(originals).toHaveLength(6);
    expect(restored?.productImages.length).toBeGreaterThanOrEqual(12);

    const pathById = await workspace.getImagePath(project.id, uploads[0]!.id);
    expect(pathById).toBeTruthy();
  });
});