import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("AiModelManager", () => {
  it("installs, validates, loads, unloads, updates, monitors, and restores managed local models", async () => {
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
    const loaded = await manager.loader.load(installed.id);
    expect(loaded.status).toBe("loaded");
    expect((await manager.detectHardware()).cpu.cores).toBeGreaterThan(0);
    expect((await manager.dashboard()).performance.loadedModels).toBe(1);

    await manager.loader.unload(installed.id);
    const updated = await manager.updates.update(installed.id, "1.1.0");
    expect(updated.version).toBe("1.1.0");
    expect((await manager.settings.update({ cacheLimit: 2 })).cacheLimit).toBe(2);

    const restored = new AiModelManager();
    await restored.initialize(storageRoot);
    expect(restored.registry.list()[0]?.version).toBe("1.1.0");
    expect((await restored.health.scan())[0]?.health).toBe("healthy");
  });
});