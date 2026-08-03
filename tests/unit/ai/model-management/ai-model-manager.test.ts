import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("AiModelManager", () => {
  it("installs, validates, protects metadata-only profiles from executable loading, updates, monitors, and restores managed local models", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-models-"));
    roots.push(storageRoot);
    const artifact = path.join(storageRoot, "embedding.bin");
    await fs.writeFile(artifact, "local model fixture");
    const manager = new AiModelManager();
    await manager.initialize(storageRoot);

    const installed = await manager.installer.install("studio-embedding-base", artifact);
    expect(installed.status).toBe("installed");
    expect(installed.artifactPath).toContain("ai-model-management");
    await manager.validation.validate(manager.getMutable(installed.id));
    manager.getMutable(installed.id).requirements = { ramMb: 0, storageMb: 0 };
    await manager.preparePreview(installed.id);
    await expect(manager.loader.load(installed.id)).rejects.toThrow("verified local inference provider");
    expect(manager.getMutable(installed.id).status).toBe("installed");
    expect((await manager.detectHardware()).cpu.cores).toBeGreaterThan(0);
    expect((await manager.dashboard()).performance.loadedModels).toBe(0);

    await manager.loader.unload(installed.id);
    const updated = await manager.updates.update(installed.id, "1.1.0");
    expect(updated.version).toBe("1.1.0");
    expect((await manager.settings.update({ cacheLimit: 2 })).cacheLimit).toBe(2);

    const restored = new AiModelManager();
    await restored.initialize(storageRoot);
    expect(restored.registry.list()[0]?.version).toBe("1.1.0");
    expect((await restored.health.scan())[0]?.health).toBe("healthy");
  });

  it("executes real requests through a configured local inference provider", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-inference-"));
    roots.push(storageRoot);
    const server = createServer((request, response) => {
      if (request.url === "/v1/models") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ data: [{ id: "local-language" }] })); return; }
      if (request.url === "/v1/chat/completions" && request.method === "POST") { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content: "A real local provider response." } }] })); return; }
      response.writeHead(404); response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to start local inference fixture");

    try {
      const manager = new AiModelManager();
      await manager.initialize(storageRoot);
      await manager.registry.register({ id: "local-language", name: "Local Language", category: "language", version: "1.0.0", description: "Local test model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["language"] });
      manager.inference.configure({ id: "fixture", name: "Fixture", kind: "openai-compatible", endpoint: `http://127.0.0.1:${address.port}`, enabled: true, supportedCategories: ["language"] });

      const result = await manager.inference.infer({ modelId: "local-language", category: "language", prompt: "Reply from the local runtime", priority: "high" });
      expect(result.output).toBe("A real local provider response.");
      expect(result.providerId).toBe("fixture");
      expect(manager.getMutable("local-language")).toMatchObject({ status: "loaded", runtimeProviderId: "fixture" });
      expect(manager.inference.status()).toMatchObject({ completed: 1, failed: 0, running: 0 });
      await expect(manager.inference.infer({ modelId: "local-language", category: "audio", prompt: "unsupported" })).rejects.toThrow("does not support audio");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});