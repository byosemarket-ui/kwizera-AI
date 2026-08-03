import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("ImageGenerationManager", () => {
  it("uses a local image provider to persist cached product-aware PNG marketing variations", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-images-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    const models = new AiModelManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    await models.initialize(storageRoot);
    await models.registry.register({ id: "test-image-model", name: "Test Image Model", category: "image", version: "1.0.0", description: "Test model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["image-generation"] });
    const requests: Array<{ url?: string; body: string }> = [];
    const server = createServer(async (request, response) => {
      if (request.url === "/sdapi/v1/options") { response.writeHead(200, { "Content-Type": "application/json" }); response.end("{}"); return; }
      if ((request.url === "/sdapi/v1/img2img" || request.url === "/sdapi/v1/txt2img") && request.method === "POST") {
        let body = ""; for await (const chunk of request) body += chunk;
        requests.push({ url: request.url, body }); const payload = JSON.parse(body) as { width: number; height: number };
        response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ images: [pngBase64(payload.width, payload.height)] })); return;
      }
      response.writeHead(404); response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Unable to start image inference fixture");
    models.inference.configure({ id: "automatic1111-fixture", name: "Automatic1111 Fixture", kind: "automatic1111", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["image"] });

    const project = await workspace.createProject("Image Launch");
    await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" }, brandInformation: { name: "KWIZERA", voice: "confident" }, campaignInformation: { name: "Launch", objective: "Increase awareness", callToAction: "Shop now" }, targetAudience: "Urban professionals" });
    const source = await workspace.uploadImage(project.id, { fileName: "bottle.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });

    try {
      const manager = new ImageGenerationManager();
      await manager.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
      const request = { projectId: project.id, prompt: "Luxury studio marketing image for the reusable Studio Bottle", mode: "product-to-image" as const, modelId: "test-image-model", style: "luxury" as const, aspectRatio: "1:1" as const, resolution: "high" as const, count: 2, productImageId: source.id, scene: "luxury-studio" as const, background: "marble" as const, lighting: "luxury" as const, shadow: "soft" as const, reflection: "gloss" as const };
      const generated = await manager.generate(request);

      expect(generated).toHaveLength(2);
      expect(generated[0].sourceImageUrl).toContain(source.fileName);
      expect((await fs.readFile((await manager.getAssetPath(generated[0].id))!)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(generated[0].metadata.provider).toBe("automatic1111-fixture");
      expect(models.getMutable("test-image-model")).toMatchObject({ status: "loaded", runtimeProviderId: "automatic1111-fixture" });
      expect(requests).toHaveLength(2); expect(requests.every((entry) => entry.url === "/sdapi/v1/img2img" && entry.body.includes("Studio Bottle"))).toBe(true);
      expect((await manager.generate(request))[0].cached).toBe(true);
      expect((await manager.getDashboard(project.id)).history).toHaveLength(1);

      const restored = new ImageGenerationManager();
      await restored.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
      expect((await restored.getDashboard(project.id)).images).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

function pngBase64(width: number, height: number): string {
  const scanlines = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row++) scanlines[row * (width + 1)] = 0;
  const chunk = (name: string, data: Buffer) => { const output = Buffer.alloc(12 + data.length); output.writeUInt32BE(data.length, 0); output.write(name, 4); data.copy(output, 8); output.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name), data])), 8 + data.length); return output; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

function crc32(input: Buffer): number { let value = 0xffffffff; for (const byte of input) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; }