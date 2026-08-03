import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { AiToolManager } from "../../../../ai/tool-management/tool-manager.js";
import type { ToolDefinition } from "../../../../ai/tool-management/types.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

const definition: ToolDefinition = {
  id: "utility.echo", name: "Echo", description: "Returns an approved message.", category: "utility", version: "1.0.0", author: "KWIZERA AI",
  inputSchema: { type: "object", required: ["message"] }, outputSchema: { type: "object" }, requiredPermissions: ["tools.execute"], dependencies: ["ai-core"], supportedModels: [], executionType: "synchronous", locality: "local",
};

function core(): AiCoreManager { return { registry: { getEntry: () => undefined } } as unknown as AiCoreManager; }

describe("AiToolManager", () => {
  it("registers, validates, executes, monitors, configures, and restores local tools", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-tools-")); roots.push(root);
    const manager = new AiToolManager(); await manager.initialize(core(), root);
    await manager.register(definition, async (input) => ({ echoed: input.message }));

    expect(manager.validate(definition.id)).toEqual({ valid: true, errors: [] });
    expect((await manager.execute({ toolId: definition.id, input: { message: "hello" } })).status).toBe("rejected");
    const result = await manager.execute({ toolId: definition.id, input: { message: "hello" }, permissions: ["tools.execute"] });
    expect(result).toMatchObject({ status: "succeeded", output: { echoed: "hello" } });

    await manager.configure(definition.id, { locale: "en" });
    const health = await manager.monitor(definition.id);
    expect(health[definition.id]).toMatchObject({ executionCount: 2, failureCount: 1, available: true });

    const restored = new AiToolManager(); await restored.initialize(core(), root);
    expect(restored.get(definition.id)).toMatchObject({ configuration: { locale: "en" }, status: "enabled" });
    expect(restored.validate(definition.id)).toMatchObject({ valid: false, errors: ["No executable handler is loaded"] });
    await restored.discover([{ definition, handler: async (input) => ({ echoed: input.message }) }]);
    expect(restored.validate(definition.id)).toEqual({ valid: true, errors: [] });
    expect((await restored.execute({ toolId: definition.id, input: { message: "restored" }, permissions: ["tools.execute"] })).output).toEqual({ echoed: "restored" });
  });
});