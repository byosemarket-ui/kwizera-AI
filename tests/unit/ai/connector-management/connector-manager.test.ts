import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { AiConnectorManager } from "../../../../ai/connector-management/connector-manager.js";
import type { ConnectorDefinition } from "../../../../ai/connector-management/types.js";
import { AiToolManager } from "../../../../ai/tool-management/tool-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });
const core = (): AiCoreManager => ({ registry: { getEntry: () => undefined } } as unknown as AiCoreManager);
const base = (id: string): ConnectorDefinition => ({ id, name: id, description: "Test connector", version: "1.0.0", provider: "KWIZERA AI", category: "developer-api", authentication: { type: "api-key", secretId: "test-api-key" }, endpoint: { baseUrl: "https://api.example.test", allowedPaths: ["/v1/"] }, requiredPermissions: ["connectors.execute"], retryPolicy: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0, retryStatusCodes: [429, 503] }, timeoutMs: 1000 });

describe("AiConnectorManager", () => {
  it("secures secrets and executes approved requests with retry, fallback, profiles, and restored metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-connectors-")); roots.push(root); let primaryAttempts = 0;
    const transport = async (request: { url: string; headers: Record<string, string> }) => { if (request.url.includes("primary")) { primaryAttempts++; return { status: 503, headers: {}, body: { unavailable: true } }; } expect(request.headers["X-API-Key"]).toBe("secret-value"); return { status: 200, headers: {}, body: { provider: "backup" } }; };
    const tools = new AiToolManager(); await tools.initialize(core(), root);
    const manager = new AiConnectorManager(transport); await manager.initialize(core(), tools, root, "test-passphrase");
    const primary = { ...base("test.primary"), endpoint: { baseUrl: "https://primary.example.test", allowedPaths: ["/v1/"] }, fallbackConnectorId: "test.backup" };
    const backup = { ...base("test.backup"), retryPolicy: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, retryStatusCodes: [] } };
    await manager.register(primary); await manager.register(backup); await manager.secrets.set("test-api-key", "secret-value"); await manager.enable("test.primary"); await manager.enable("test.backup");

    expect((await manager.execute({ connectorId: "test.primary", path: "/v1/status" })).status).toBe("failed");
    const result = await manager.execute({ connectorId: "test.primary", path: "/v1/status", permissions: ["connectors.execute"] });
    expect(result).toMatchObject({ status: "fallback-succeeded", connectorId: "test.backup", data: { provider: "backup" }, fallbackConnectorId: "test.backup" });
    expect(primaryAttempts).toBe(2);
    await manager.configureProfile("test.backup", "testing", { timeoutMs: 2000 });
    expect(manager.get("test.backup")?.profiles.testing).toEqual({ timeoutMs: 2000 });
    expect((await manager.monitor("test.backup"))["test.backup"]).toMatchObject({ available: true, authenticated: true });
    expect(await fs.readFile(path.join(root, "connector-management", "secrets.json"), "utf8")).not.toContain("secret-value");

    const restored = new AiConnectorManager(transport); await restored.initialize(core(), tools, root, "test-passphrase");
    expect(restored.get("test.backup")).toMatchObject({ status: "enabled", profiles: { testing: { timeoutMs: 2000 } } });
    expect(restored.validate("test.backup")).toEqual({ valid: true, errors: [] });
  });
});