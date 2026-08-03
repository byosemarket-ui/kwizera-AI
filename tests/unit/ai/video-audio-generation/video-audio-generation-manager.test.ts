import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { VideoAudioGenerationManager } from "../../../../ai/video-audio-generation/video-audio-generation-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("VideoAudioGenerationManager", () => {
  it("renders a persisted image-to-video package through a local ComfyUI workflow with subtitles, timeline, and cache reuse", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-video-audio-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager(); const planning = new CreativePlanningManager(); const models = new AiModelManager();
    await workspace.initialize(storageRoot); await planning.initialize(storageRoot); await models.initialize(storageRoot);
    for (const [id, category] of [["test-image-model", "image"], ["test-video-model", "video"], ["test-audio-model", "audio"]] as const) await models.registry.register({ id, name: id, category, version: "1.0.0", description: "Test model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["generation"] });
    const server = createServer(async (request, response) => {
      if (request.url === "/sdapi/v1/options") { response.writeHead(200, { "Content-Type": "application/json" }); response.end("{}"); return; }
      if (request.url === "/sdapi/v1/txt2img" && request.method === "POST") { let body = ""; for await (const chunk of request) body += chunk; const payload = JSON.parse(body) as { width: number; height: number }; response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ images: [pngBase64(payload.width, payload.height)] })); return; }
      if (request.url === "/system_stats") { response.writeHead(200, { "Content-Type": "application/json" }); response.end("{}"); return; }
      if (request.url === "/upload/image" && request.method === "POST") { for await (const _chunk of request) { /* consume multipart source image */ } response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ name: "source.png" })); return; }
      if (request.url === "/prompt" && request.method === "POST") { let body = ""; for await (const chunk of request) body += chunk; expect(JSON.parse(body).prompt["1"].inputs.text).toContain("Studio Bottle"); response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ prompt_id: "video-job" })); return; }
      if (request.url === "/history/video-job") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ "video-job": { status: { status_str: "success" }, outputs: { "9": { videos: [{ filename: "render.mp4" }] } } } })); return; }
      if (request.url?.startsWith("/view?")) { response.writeHead(200, { "Content-Type": "video/mp4" }); response.end(mp4Bytes()); return; }
      response.writeHead(404); response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Unable to start image inference fixture");
    models.inference.configure({ id: "automatic1111-fixture", name: "Automatic1111 Fixture", kind: "automatic1111", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["image"] });
    models.inference.configure({ id: "comfyui-video-fixture", name: "ComfyUI Video Fixture", kind: "comfyui-video", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["video"], configuration: { workflow: { "1": { inputs: {} }, "2": { inputs: {} } }, promptNodeId: "1", imageNodeId: "2" } });
    try {
    const project = await workspace.createProject("Video Launch");
    await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" }, brandInformation: { name: "KWIZERA" }, campaignInformation: { name: "Launch", objective: "Increase awareness", callToAction: "Shop now" }, targetAudience: "Urban professionals" });
    const imageRuntime = new ImageGenerationManager();
    await imageRuntime.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
    const image = (await imageRuntime.generate({ projectId: project.id, prompt: "Studio Bottle luxury product marketing image", mode: "text-to-image", modelId: "test-image-model", style: "luxury", aspectRatio: "1:1", resolution: "standard", count: 1 }))[0];
    const manager = new VideoAudioGenerationManager();
    await manager.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning, images: imageRuntime });
    const request = { projectId: project.id, prompt: "Fast premium Studio Bottle launch film with a confident close", mode: "image-to-video" as const, videoModelId: "test-video-model", audioModelId: "test-audio-model", imageId: image.id, durationSeconds: 6, resolution: "720p" as const, frameRate: 30 as const, voice: "narrator" as const, music: "uplifting" as const, soundEffects: true, subtitles: true };
    const generated = await manager.generate(request);
    expect(generated.timeline).toHaveLength(1);
    expect((await fs.readFile((await manager.getAssetPath(generated.id, "preview"))!)).subarray(4, 8).toString()).toBe("ftyp");
    expect(await manager.getAssetPath(generated.id, "audio")).toBeNull();
    expect(await fs.readFile((await manager.getAssetPath(generated.id, "subtitles"))!, "utf8")).toContain("WEBVTT");
    expect(generated.metadata.provider).toBe("comfyui-video-fixture");
    expect(models.getMutable("test-video-model")).toMatchObject({ status: "loaded", runtimeProviderId: "comfyui-video-fixture" });
    expect((await manager.generate(request)).cached).toBe(true);
    expect((await manager.getDashboard(project.id)).history).toHaveLength(1);
    const restored = new VideoAudioGenerationManager();
    await restored.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning, images: imageRuntime });
    expect((await restored.getDashboard(project.id)).packages).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

function pngBase64(width: number, height: number): string {
  const scanlines = Buffer.alloc((width + 1) * height);
  const chunk = (name: string, data: Buffer) => { const output = Buffer.alloc(12 + data.length); output.writeUInt32BE(data.length, 0); output.write(name, 4); data.copy(output, 8); output.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name), data])), 8 + data.length); return output; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

function crc32(input: Buffer): number { let value = 0xffffffff; for (const byte of input) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; }

function mp4Bytes(): Buffer { return Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(16)]); }