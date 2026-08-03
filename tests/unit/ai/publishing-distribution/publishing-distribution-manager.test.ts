import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiConnectorManager } from "../../../../ai/connector-management/connector-manager.js";
import { CreativeReviewManager } from "../../../../ai/creative-review/creative-review-manager.js";
import { PublishingDistributionManager } from "../../../../ai/publishing-distribution/publishing-distribution-manager.js";
import { AiToolManager } from "../../../../ai/tool-management/tool-manager.js";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";

const roots: string[] = [];
const core = (): AiCoreManager => ({ registry: { getEntry: () => undefined } } as unknown as AiCoreManager);
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("PublishingDistributionManager", () => {
  it("packages approved local exports and falls back to local delivery when publishing is unavailable", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-publishing-")); roots.push(root);
    const review = new CreativeReviewManager(); await review.initialize(root);
    const asset = await review.ingestAsset("project-1", { name: "Campaign Poster", mimeType: "image/png", dataBase64: Buffer.from("image").toString("base64") }); await review.approve("project-1", asset.id);
    const exported = await review.exportAsset("project-1", asset.id, { format: "png", platform: "instagram", resolution: "source", quality: "high" });
    const tools = new AiToolManager(); await tools.initialize(core(), root); const connectors = new AiConnectorManager(); await connectors.initialize(core(), tools, root, "test-passphrase");
    const manager = new PublishingDistributionManager(review, connectors); await manager.initialize(root);
    const publishingPackage = await manager.packageExport("project-1", exported.fileName, { caption: "A caption", hashtags: ["#Launch"] });
    expect(await fs.readFile(publishingPackage.packagePath, "utf8")).toBe("image");
    expect(manager.getPlatformTemplates()).toHaveLength(9);
    await manager.registerProfile({ id: "social.instagram", platform: "instagram", maxCaptionLength: 20, supportedAspectRatios: ["4:5"], requiredPermissions: ["publishing.deliver"], enabled: true });
    const job = await manager.schedule(publishingPackage.id, "social.instagram", new Date(Date.now() - 1_000).toISOString(), "Africa/Kigali");
    expect((await manager.processDue())[0]).toMatchObject({ id: job.id, status: "ready-local" });
    expect(manager.getOptimizationRecommendation(publishingPackage.id, "social.instagram")).toMatchObject({ sourcePreserved: true, captionWillBeTruncated: false });
    expect(manager.getStatus()).toMatchObject({ offlineFirst: true, packages: 1, jobs: { readyLocal: 1 } });
  });
});