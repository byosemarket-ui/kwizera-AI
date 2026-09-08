import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { assertAdminAccess, maskCredential, rolesFromHeaders } from "../../../../ai/admin-control-plane/admin-auth-boundary.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("Admin Control Plane foundation", () => {
  it("seeds registries, maps features, masks credentials, and persists settings", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-admin-"));
    roots.push(storageRoot);
    const manager = new AdminControlPlaneManager();
    await manager.initialize(storageRoot);

    expect(manager.listProviders().length).toBeGreaterThan(0);
    expect(manager.listModels().total).toBeGreaterThan(0);
    expect(manager.listFeatureMappings().length).toBeGreaterThan(0);

    const provider = await manager.upsertProvider({
      name: "Fixture Provider",
      type: "custom",
      enabled: true,
      status: "active",
      credentialReference: "secret-ref-fixture-abcdef",
    });
    expect(provider.hasCredential).toBe(true);
    expect(provider.credentialMasked).toBe(maskCredential("secret-ref-fixture-abcdef"));
    expect(JSON.stringify(provider)).not.toContain("secret-ref-fixture-abcdef");

    const model = await manager.upsertModel({
      name: "Fixture Vision",
      providerId: provider.id,
      category: "VISION",
      capability: "vision-analysis",
      modelId: "fixture-vision",
      enabled: true,
      status: "active",
      priority: 10,
      inputType: "image",
      outputType: "json",
      currency: "USD",
      timeoutMs: 30_000,
      metadata: {},
    });

    const mapping = await manager.upsertFeatureMapping({
      feature: "VISION_ANALYSIS",
      label: "Vision Analysis",
      primaryModelId: model.id,
      providerId: provider.id,
      enabled: true,
    });
    expect(mapping.primaryModelId).toBe(model.id);

    const resolved = manager.resolveFeature("VISION_ANALYSIS");
    expect(resolved.primaryModel?.id).toBe(model.id);
    expect(resolved.provider?.id).toBe(provider.id);

    const setting = await manager.updateSetting("limits.queueConcurrency", 4);
    expect(setting.value).toBe(4);

    const dashboard = manager.buildDashboard({ aiCoreOnline: true, storageOk: true, projectCount: 2 });
    expect(dashboard.system.aiStatus).toBe("online");
    expect(dashboard.business.totalCustomers).toBe("Not available yet");
    expect(dashboard.ai.activeModels).toBeGreaterThan(0);

    const restored = new AdminControlPlaneManager();
    await restored.initialize(storageRoot);
    expect(restored.getModel(model.id)?.name).toBe("Fixture Vision");
    expect(restored.getSetting("limits.queueConcurrency")?.value).toBe(4);
  });

  it("supports future customer/project isolation fields without fabricating customers", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-admin-tenant-"));
    roots.push(storageRoot);
    const manager = new AdminControlPlaneManager();
    await manager.initialize(storageRoot);
    const provider = manager.listProviders()[0]!;
    const model = await manager.upsertModel({
      name: "Tenant Scoped",
      providerId: provider.id,
      category: "LLM",
      capability: "chat",
      modelId: "tenant-llm",
      enabled: true,
      status: "active",
      customerId: "customer-a",
      projectId: "project-a",
      metadata: {},
      currency: "USD",
      timeoutMs: 10_000,
      inputType: "text",
      outputType: "text",
      priority: 1,
    });
    expect(model.customerId).toBe("customer-a");
    expect(model.projectId).toBe("project-a");
  });

  it("enforces auth boundary modes and never reveals secrets", () => {
    expect(assertAdminAccess({
      roles: [],
      path: "/api/admin/providers",
      adminApi: true,
    }).allowed).toBe(true);
    expect(assertAdminAccess({
      roles: [],
      path: "/api/admin/providers",
      adminApi: true,
    }).mayRevealSecrets).toBe(false);

    process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-role";
    expect(assertAdminAccess({
      roles: rolesFromHeaders({ "x-kwizera-admin-role": "viewer" }),
      path: "/api/admin/models",
      adminApi: true,
    }).allowed).toBe(false);
    expect(assertAdminAccess({
      roles: rolesFromHeaders({ "x-kwizera-admin-role": "admin" }),
      path: "/api/admin/models",
      adminApi: true,
    }).allowed).toBe(true);
    process.env.KWIZERA_ADMIN_AUTH_MODE = "development-open";

    expect(maskCredential("sk-abcdefghijklmnop")).toMatch(/^sk•+op$/);
  });

  it("paginates model list instead of dumping unbounded records", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-admin-page-"));
    roots.push(storageRoot);
    const manager = new AdminControlPlaneManager();
    await manager.initialize(storageRoot);
    const provider = manager.listProviders()[0]!;
    for (let i = 0; i < 30; i++) {
      await manager.upsertModel({
        name: `Model ${i}`,
        providerId: provider.id,
        category: "OTHER",
        capability: "other",
        modelId: `model-${i}`,
        enabled: true,
        status: "active",
        metadata: {},
        currency: "USD",
        timeoutMs: 1000,
        inputType: "any",
        outputType: "any",
        priority: i,
      });
    }
    const page1 = manager.listModels({ page: 1, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBeGreaterThanOrEqual(30);
  });
});
