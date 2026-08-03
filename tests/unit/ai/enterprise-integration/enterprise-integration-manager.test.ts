import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiConnectorManager } from "../../../../ai/connector-management/connector-manager.js";
import { EnterpriseIntegrationManager } from "../../../../ai/enterprise-integration/enterprise-integration-manager.js";
import { AiToolManager } from "../../../../ai/tool-management/tool-manager.js";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";

const roots: string[] = [];
const core = (): AiCoreManager => ({ registry: { getEntry: () => undefined } } as unknown as AiCoreManager);
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("EnterpriseIntegrationManager", () => {
  it("keeps connectors optional while enforcing gateway permissions and signed webhook delivery", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-enterprise-integration-")); roots.push(root);
    const tools = new AiToolManager(); await tools.initialize(core(), root);
    const connectors = new AiConnectorManager(async () => ({ status: 200, headers: {}, body: { received: true } })); await connectors.initialize(core(), tools, root, "test-passphrase");
    await connectors.register({ id: "test.webhook", name: "Webhook", description: "Test delivery", version: "1.0.0", provider: "Test", category: "developer-api", authentication: { type: "api-key", secretId: "api-key" }, endpoint: { baseUrl: "https://example.test", allowedPaths: ["/hooks/"] }, requiredPermissions: ["integrations.send"], retryPolicy: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, retryStatusCodes: [] }, timeoutMs: 1000 });
    await connectors.secrets.set("api-key", "value"); await connectors.secrets.set("webhook-signature", "signing-value"); await connectors.enable("test.webhook");
    const manager = new EnterpriseIntegrationManager(connectors); await manager.initialize(root);
    await manager.registerRoute({ id: "gateway.webhook", protocol: "rest", method: "POST", path: "/webhooks/outgoing", target: "connector", connectorId: "test.webhook", connectorPath: "/hooks/outgoing", requiredPermissions: ["integrations.send"] });
    expect((await manager.invoke({ routeId: "gateway.webhook" })).status).toBe("rejected");
    expect((await manager.invoke({ routeId: "gateway.webhook", body: { ok: true }, permissions: ["integrations.send"] })).status).toBe("succeeded");
    await manager.registerWebhook({ id: "webhook.incoming", direction: "incoming", event: "order.created", secretId: "webhook-signature", retryAttempts: 1, requiredPermissions: ["integrations.receive"] });
    const signature = (await import("node:crypto")).createHmac("sha256", "signing-value").update(JSON.stringify({ order: 1 })).digest("hex");
    expect(await manager.receiveWebhook("webhook.incoming", { order: 1 }, signature, ["integrations.receive"])).toMatchObject({ status: "accepted" });
    expect(manager.getStatus()).toMatchObject({ externalIntegrationsOptional: true, gateway: { routes: 1, requests: 2 }, webhooks: { incoming: 1 } });
  });
});