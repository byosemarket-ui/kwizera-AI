import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeReviewManager } from "../../../../ai/creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { MarketingContentManager } from "../../../../ai/marketing-content/marketing-content-manager.js";
import { MarketingIntelligenceManager } from "../../../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("MarketingContentManager", () => {
  it("creates localized platform marketing assets through local image inference and exports them", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-marketing-content-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); const planning = new CreativePlanningManager(); const review = new CreativeReviewManager(); const models = new AiModelManager();
    await workspace.initialize(root); await planning.initialize(root); await review.initialize(root); await models.initialize(root);
    await models.registry.register({ id: "marketing-image-model", name: "Marketing Image Model", category: "image", version: "1.0.0", description: "Fixture model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["image-generation"] });
    const requests: Array<{ prompt: string; width: number; height: number }> = [];
    const server = createServer(async (request, response) => {
      if (request.url === "/sdapi/v1/options") { response.writeHead(200, { "Content-Type": "application/json" }); response.end("{}"); return; }
      if (request.url === "/sdapi/v1/sd-models") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify([{ title: "marketing-image-model" }])); return; }
      if (request.url === "/sdapi/v1/img2img" && request.method === "POST") { let body = ""; for await (const chunk of request) body += chunk; const payload = JSON.parse(body) as { prompt: string; width: number; height: number }; requests.push(payload); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ images: [png(payload.width, payload.height)] })); return; }
      response.writeHead(404); response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
    models.inference.configure({ id: "marketing-fixture", name: "Marketing Fixture", kind: "automatic1111", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["image"] });
    try {
      const project = await workspace.createProject("Marketing launch");
      await workspace.updateProject(project.id, { productInformation: { name: "Steel Bottle", category: "Bottles", description: "Black stainless steel insulated bottle" }, brandInformation: { name: "KWIZERA", voice: "clear and confident", guidelines: "Use mint accent and clear hierarchy" }, campaignInformation: { name: "Launch", objective: "Increase conversion", callToAction: "Shop now" }, targetAudience: "Urban professionals", platform: "instagram" });
      await workspace.uploadImage(project.id, { fileName: "bottle.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });
      const images = new ImageGenerationManager(); await images.initialize(root, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
      const imageIntelligence = new ImageIntelligenceManager(); await imageIntelligence.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
      const products = new ProductIntelligenceManager(); await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); products.attachImageIntelligence(imageIntelligence);
      const marketing = new MarketingIntelligenceManager(); await marketing.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, images: imageIntelligence });
      const content = new MarketingContentManager(workspace, products, marketing, images, review); await content.initialize(root);
      const job = await content.start({ projectId: project.id, assetTypes: ["social-post", "banner"], platforms: ["instagram"], language: "rw" });
      expect(job.status).toBe("completed"); expect(job.copy?.headline).toContain("Steel Bottle"); expect(job.completedAssets).toHaveLength(2); expect(requests).toHaveLength(2);
      expect(requests.every((request) => request.width <= 2048 && request.height <= 2048)).toBe(true);
      expect(requests[0].prompt).toContain("KWIZERA brand identity"); expect((await review.getProjectState(project.id)).exports).toHaveLength(2);
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
});

function png(width: number, height: number): string { const scanlines = Buffer.alloc((width + 1) * height); for (let row = 0; row < height; row++) scanlines[row * (width + 1)] = 0; const chunk = (name: string, data: Buffer) => { const output = Buffer.alloc(12 + data.length); output.writeUInt32BE(data.length, 0); output.write(name, 4); data.copy(output, 8); output.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name), data])), 8 + data.length); return output; }; const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 0; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]).toString("base64"); }
function crc32(input: Buffer): number { let value = 0xffffffff; for (const byte of input) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; }