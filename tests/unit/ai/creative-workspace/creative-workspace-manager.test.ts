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
      dataBase64: "iVBORw0KGgo=",
    });

    const restoredWorkspace = new CreativeWorkspaceManager();
    await restoredWorkspace.initialize(storageRoot);
    const restored = await restoredWorkspace.getActiveProject();

    expect(restored?.name).toBe("Launch Campaign");
    expect(restored?.productImages).toHaveLength(1);
    expect(restoredWorkspace.validate(restored).valid).toBe(true);
  });
});