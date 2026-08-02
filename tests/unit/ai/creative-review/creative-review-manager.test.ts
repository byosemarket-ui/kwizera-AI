import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeReviewManager } from "../../../../ai/creative-review/creative-review-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("CreativeReviewManager", () => {
  it("stores preview assets, versions, review history, regeneration requests, approvals, and compatible exports", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-review-"));
    roots.push(storageRoot);
    const manager = new CreativeReviewManager();
    await manager.initialize(storageRoot);

    const first = await manager.ingestAsset("project-1", { name: "launch-frame", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });
    const second = await manager.ingestAsset("project-1", { name: "launch-frame", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const queued = await manager.requestRegeneration("project-1", second.id, "Improve the product contrast");
    expect(queued.regenerationQueue).toHaveLength(1);

    await manager.approve("project-1", second.id);
    const exported = await manager.exportAsset("project-1", second.id, { format: "png", platform: "instagram", resolution: "1080p", quality: "high" });
    expect(exported.progress).toBe(100);
    expect(await manager.getAssetPath("project-1", exported.fileName, true)).not.toBeNull();

    await expect(manager.exportAsset("project-1", second.id, { format: "jpg", platform: "instagram", resolution: "1080p", quality: "high" })).rejects.toThrow("matching rendered artifact");
    await expect(manager.ingestAsset("project-1", { name: "bad", mimeType: "image/gif", dataBase64: "AA==" })).rejects.toThrow("Only PNG");

    const restored = new CreativeReviewManager();
    await restored.initialize(storageRoot);
    expect((await restored.getProjectState("project-1")).exports).toHaveLength(1);
  });
});