import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { AiPluginManager } from "../../../../ai/plugin-management/plugin-manager.js";
import type { PluginManifest } from "../../../../ai/plugin-management/types.js";
import { AiToolManager } from "../../../../ai/tool-management/tool-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });
const core = (): AiCoreManager => ({ registry: { getEntry: (id: string) => id === "workflow-engine" ? { id } : undefined } } as unknown as AiCoreManager);
const manifest: PluginManifest = { id: "utility.echo-plugin", name: "Echo Plugin", description: "A trusted local test plugin.", version: "1.0.0", author: "KWIZERA AI", category: "utility", requiredPermissions: ["plugin.execute"], dependencies: [], compatiblePlatformVersion: ">=0.1.0", entryPoint: "trusted:utility.echo-plugin", configuration: {}, external: false };

describe("AiPluginManager", () => {
  it("installs, validates, loads, executes, monitors, configures, and restores trusted plugins", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-plugins-")); roots.push(root);
    const tools = new AiToolManager(); await tools.initialize(core(), root);
    const manager = new AiPluginManager(); await manager.initialize(core(), tools, root);
    const factory = () => ({ async initialize() {}, async execute(action: string, input: Record<string, unknown>) { if (action !== "echo") throw new Error("Unsupported action"); return { echoed: input.message }; }, async shutdown() {}, async healthCheck() { return { healthy: true, message: "ok" }; } });
    await manager.install(manifest, factory);
    await expect(manager.install(manifest, factory)).rejects.toThrow("already installed");
    expect(manager.validate(manifest.id)).toEqual({ valid: true, errors: [] });
    await manager.load(manifest.id);
    expect((await manager.execute({ pluginId: manifest.id, action: "echo", input: { message: "hi" } })).status).toBe("rejected");
    expect(await manager.execute({ pluginId: manifest.id, action: "echo", input: { message: "hi" }, permissions: ["plugin.execute"] })).toMatchObject({ status: "succeeded", output: { echoed: "hi" } });
    await manager.pause(manifest.id); await manager.resume(manifest.id); await manager.configure(manifest.id, { locale: "en" });
    expect((await manager.monitor(manifest.id))[manifest.id]).toMatchObject({ available: true, executionCount: 2, failureCount: 1 });
    const restored = new AiPluginManager(); await restored.initialize(core(), tools, root);
    expect(restored.get(manifest.id)).toMatchObject({ configuration: { locale: "en" }, status: "loaded" });
    expect(restored.validate(manifest.id).valid).toBe(false);
    await restored.discover([{ manifest, factory }]);
    expect(restored.get(manifest.id)?.status).toBe("installed");
    expect(restored.validate(manifest.id)).toEqual({ valid: true, errors: [] });
    await restored.load(manifest.id);
    expect(await restored.execute({ pluginId: manifest.id, action: "echo", input: { message: "restored" }, permissions: ["plugin.execute"] })).toMatchObject({ status: "succeeded", output: { echoed: "restored" } });
    await restored.shutdown();
    expect(restored.isInitialized()).toBe(false);
  });
});