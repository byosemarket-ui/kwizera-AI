import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CommercialVideoManager } from "../../../../ai/commercial-video/commercial-video-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeReviewManager } from "../../../../ai/creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { MarketingIntelligenceManager } from "../../../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { VideoAudioGenerationManager } from "../../../../ai/video-audio-generation/video-audio-generation-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("CommercialVideoManager", () => {
  it("builds a commercial storyboard and exports a provider-backed video with synchronized subtitles", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-commercial-video-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); const planning = new CreativePlanningManager(); const review = new CreativeReviewManager(); const models = new AiModelManager();
    await workspace.initialize(root); await planning.initialize(root); await review.initialize(root); await models.initialize(root);
    for (const [id, category] of [["commercial-image", "image"], ["commercial-video", "video"], ["commercial-audio", "audio"]] as const) await models.registry.register({ id, name: id, category, version: "1.0.0", description: "Fixture model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["generation"] });
    const prompts: string[] = [];
    const server = createServer(async (request, response) => {
      if (request.url === "/sdapi/v1/options" || request.url === "/system_stats") { response.writeHead(200, { "Content-Type": "application/json" }); response.end("{}"); return; }
      if (request.url === "/sdapi/v1/sd-models") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify([{ title: "commercial-image" }])); return; }
      if (request.url === "/object_info") { response.writeHead(200, { "Content-Type": "application/json" }); response.end("{}"); return; }
      if (request.url === "/sdapi/v1/img2img" && request.method === "POST") { let body = ""; for await (const chunk of request) body += chunk; const payload = JSON.parse(body) as { width: number; height: number; prompt: string }; prompts.push(payload.prompt); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ images: [png(payload.width, payload.height)] })); return; }
      if (request.url === "/upload/image" && request.method === "POST") { for await (const _chunk of request) { /* consume source image */ } response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ name: "source.png" })); return; }
      if (request.url === "/prompt" && request.method === "POST") { let body = ""; for await (const chunk of request) body += chunk; const payload = JSON.parse(body) as { prompt: Record<string, { inputs: { text?: string } }> }; prompts.push(payload.prompt["1"].inputs.text ?? ""); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ prompt_id: "commercial-job" })); return; }
      if (request.url === "/history/commercial-job") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ "commercial-job": { status: { status_str: "success" }, outputs: { "9": { videos: [{ filename: "commercial.mp4" }] } } } })); return; }
      if (request.url?.startsWith("/view?")) { response.writeHead(200, { "Content-Type": "video/mp4" }); response.end(mp4()); return; }
      response.writeHead(404); response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture server did not bind");
    models.inference.configure({ id: "a1111-commercial", name: "A1111 Commercial", kind: "automatic1111", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["image"] });
    models.inference.configure({ id: "comfy-commercial", name: "Comfy Commercial", kind: "comfyui-video", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["video"], configuration: { modelIds: ["commercial-video"], workflow: { "1": { inputs: {} }, "2": { inputs: {} } }, promptNodeId: "1", imageNodeId: "2" } });
    try {
      const project = await workspace.createProject("Commercial launch");
      await workspace.updateProject(project.id, { productInformation: { name: "Steel Bottle", category: "Bottles", description: "Black stainless steel insulated bottle" }, brandInformation: { name: "KWIZERA", voice: "confident", guidelines: "Premium product visual language" }, campaignInformation: { name: "Launch", objective: "Increase conversion", callToAction: "Shop now" }, targetAudience: "Urban professionals" });
      await workspace.uploadImage(project.id, { fileName: "bottle.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });
      const images = new ImageGenerationManager(); await images.initialize(root, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
      const imageIntelligence = new ImageIntelligenceManager(); await imageIntelligence.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
      const products = new ProductIntelligenceManager(); await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); products.attachImageIntelligence(imageIntelligence);
      const marketing = new MarketingIntelligenceManager(); await marketing.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, images: imageIntelligence });
      const videos = new VideoAudioGenerationManager(); await videos.initialize(root, { core: undefined as unknown as AiCoreManager, models, workspace, planning, images });
      const commercial = new CommercialVideoManager(workspace, products, marketing, images, videos, review); await commercial.initialize(root);
      const job = await commercial.start({ projectId: project.id, format: "instagram-reel", language: "en" });
      expect(job.status).toBe("completed"); expect(job.storyboard).toHaveLength(8); expect(job.storyboard[2]?.camera).toBe("hero-shot"); expect(job.videoPackageId).toBeTruthy(); expect(job.subtitleFileName).toMatch(/\.vtt$/); expect(job.exportFileName).toMatch(/\.mp4$/);
      expect(prompts.some((prompt) => prompt.includes("cinematic story"))).toBe(true); expect((await review.getProjectState(project.id)).exports).toHaveLength(1);
      expect((await fs.readFile((await videos.getAssetPath(job.videoPackageId!, "subtitles"))!, "utf8")).toContain("WEBVTT");
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
});

function png(width: number, height: number): string { const scanlines = Buffer.alloc((width + 1) * height); const chunk = (name: string, data: Buffer) => { const output = Buffer.alloc(12 + data.length); output.writeUInt32BE(data.length, 0); output.write(name, 4); data.copy(output, 8); output.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name), data])), 8 + data.length); return output; }; const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 0; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]).toString("base64"); }
function crc32(input: Buffer): number { let value = 0xffffffff; for (const byte of input) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; }
function mp4(): Buffer { return Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(16)]); }