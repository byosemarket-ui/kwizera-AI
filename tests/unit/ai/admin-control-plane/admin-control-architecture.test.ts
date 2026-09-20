import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import { AdminConfiguration } from "../../../../ai/admin-control-plane/configuration-access.js";
import { createDefaultAdapterRegistry } from "../../../../ai/admin-control-plane/provider-adapters.js";
import { assertLayerAccess, assertTenantIsolation } from "../../../../ai/admin-control-plane/access-layers.js";
import { AdminValidationError } from "../../../../ai/admin-control-plane/validation.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-admin-b-"));
  roots.push(storageRoot);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-for-admin-control");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { storageRoot, manager, credentials };
}

describe("Admin control architecture — registries", () => {
  it("creates, reads, updates models and rejects unknown providers, duplicates, and bad timeouts", async () => {
    const { manager } = await boot();
    const provider = manager.listProviders()[0]!;
    const created = await manager.upsertModel({
      name: "Arch Vision",
      providerId: provider.id,
      category: "VISION",
      capability: "vision-analysis",
      modelId: "arch-vision-1",
      enabled: true,
      status: "active",
      timeoutMs: 15_000,
      priority: 20,
      inputType: "image",
      outputType: "json",
      currency: "USD",
      metadata: {},
      costModel: { billingUnit: "REQUEST", inputCost: null, outputCost: 0.01, currency: "USD" },
    });
    expect(manager.getModel(created.id)?.name).toBe("Arch Vision");
    expect(created.costModel?.billingUnit).toBe("REQUEST");
    expect(created.inputTypes).toContain("image");

    await expect(manager.upsertModel({
      name: "Missing provider",
      providerId: "does-not-exist",
      category: "OTHER",
      capability: "other",
      modelId: "x",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "any",
      outputType: "any",
    })).rejects.toBeInstanceOf(AdminValidationError);

    await expect(manager.upsertModel({
      name: "Dup",
      providerId: provider.id,
      category: "VISION",
      capability: "vision-analysis",
      modelId: "arch-vision-1",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "image",
      outputType: "json",
    })).rejects.toMatchObject({ code: "DUPLICATE_MODEL" });

    await expect(manager.upsertModel({
      name: "Bad timeout",
      providerId: provider.id,
      category: "OTHER",
      capability: "other",
      modelId: "bad-timeout",
      metadata: {},
      currency: "USD",
      timeoutMs: 0,
      inputType: "any",
      outputType: "any",
    })).rejects.toMatchObject({ code: "INVALID_TIMEOUT" });

    await expect(manager.upsertModel({
      name: "Bad category",
      providerId: provider.id,
      category: "NOT_A_CATEGORY" as never,
      capability: "other",
      modelId: "bad-category",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "any",
      outputType: "any",
    })).rejects.toMatchObject({ code: "INVALID_CATEGORY" });
  });

  it("creates, reads, updates providers and never exposes secrets", async () => {
    const { manager } = await boot();
    const saved = await manager.upsertProvider({
      name: "Fixture External",
      type: "custom",
      kind: "EXTERNAL_API",
      enabled: true,
      status: "active",
    });
    expect(saved.kind).toBe("EXTERNAL_API");
    const withSecret = await manager.setProviderSecret(saved.id, "sk-live-architecture-secret-value");
    expect(withSecret.hasCredential).toBe(true);
    expect(JSON.stringify(withSecret)).not.toContain("sk-live-architecture-secret-value");
    expect(withSecret.credentialMasked).toMatch(/•/);
    expect(manager.getProvider(saved.id)?.hasCredential).toBe(true);
  });
});

describe("Admin control architecture — feature mapping and resolution", () => {
  it("validates model references and will not enable a mapping on a disabled provider", async () => {
    const { manager } = await boot();
    const disabled = await manager.upsertProvider({
      name: "Disabled External",
      type: "fal",
      kind: "EXTERNAL_API",
      enabled: false,
      status: "inactive",
    });
    const model = await manager.upsertModel({
      name: "Off model",
      providerId: disabled.id,
      category: "IMAGE",
      capability: "image-generation",
      modelId: "off-model",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "text",
      outputType: "image",
    });
    await expect(manager.upsertFeatureMapping({
      feature: "IMAGE_GENERATION",
      label: "Image Generation",
      primaryModelId: model.id,
      providerId: disabled.id,
      enabled: true,
    })).rejects.toMatchObject({ code: "PROVIDER_DISABLED" });

    await expect(manager.upsertFeatureMapping({
      feature: "IMAGE_GENERATION",
      label: "Image Generation",
      primaryModelId: "missing-model",
      enabled: false,
    })).rejects.toMatchObject({ code: "UNKNOWN_MODEL" });
  });

  it("resolves primary, then secondary, then fallback, then unavailable — deterministically", async () => {
    const { manager } = await boot();
    const local = manager.listProviders().find((p) => p.type === "ollama")!;
    const primary = await manager.upsertModel({
      name: "Primary LLM",
      providerId: local.id,
      category: "LLM",
      capability: "chat",
      modelId: "primary-llm",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "text",
      outputType: "text",
    });
    const secondary = await manager.upsertModel({
      name: "Secondary LLM",
      providerId: local.id,
      category: "LLM",
      capability: "chat",
      modelId: "secondary-llm",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "text",
      outputType: "text",
    });
    const fallback = await manager.upsertModel({
      name: "Fallback LLM",
      providerId: local.id,
      category: "LLM",
      capability: "chat",
      modelId: "fallback-llm",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "text",
      outputType: "text",
    });
    await manager.upsertFeatureMapping({
      feature: "LLM_CHAT",
      label: "LLM Chat",
      primaryModelId: primary.id,
      secondaryModelId: secondary.id,
      fallbackModelId: fallback.id,
      providerId: local.id,
      enabled: true,
    });

    const ready = manager.resolveFeatureExecution("LLM_CHAT");
    expect(ready.status).toBe("READY");
    expect(ready.source).toBe("PRIMARY");
    expect(ready.selectedModelId).toBe(primary.id);

    await manager.setModelEnabled(primary.id, false);
    const viaSecondary = manager.resolveFeatureExecution("LLM_CHAT");
    expect(viaSecondary.status).toBe("FALLBACK");
    expect(viaSecondary.source).toBe("SECONDARY");
    expect(viaSecondary.selectedModelId).toBe(secondary.id);

    await manager.setModelEnabled(secondary.id, false);
    const viaFallback = manager.resolveFeatureExecution("LLM_CHAT");
    expect(viaFallback.status).toBe("FALLBACK");
    expect(viaFallback.source).toBe("FALLBACK");
    expect(viaFallback.selectedModelId).toBe(fallback.id);

    await manager.setModelEnabled(fallback.id, false);
    const none = manager.resolveFeatureExecution("LLM_CHAT");
    expect(none.status).toBe("UNAVAILABLE");
    expect(none.source).toBe("NONE");
    expect(none.selectedModelId).toBeNull();
  });

  it("does not silently select a disabled provider as primary", async () => {
    const { manager } = await boot();
    const provider = await manager.upsertProvider({
      name: "Toggle Provider",
      type: "local",
      enabled: true,
      status: "active",
    });
    const model = await manager.upsertModel({
      name: "Toggle model",
      providerId: provider.id,
      category: "OTHER",
      capability: "other",
      modelId: "toggle-model",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "any",
      outputType: "any",
    });
    await manager.upsertFeatureMapping({
      feature: "EMBEDDING",
      label: "Embedding",
      primaryModelId: model.id,
      providerId: provider.id,
      enabled: true,
    });
    expect(manager.resolveFeatureExecution("EMBEDDING").status).toBe("READY");
    await manager.upsertProvider({
      id: provider.id,
      name: provider.name,
      type: "local",
      enabled: false,
      status: "inactive",
    });
    const resolved = manager.resolveFeatureExecution("EMBEDDING");
    expect(resolved.status).toBe("UNAVAILABLE");
    expect(resolved.attempts[0]?.reason).toBe("PRIMARY_PROVIDER_DISABLED");
  });
});

describe("Admin control architecture — settings, usage, isolation, adapters", () => {
  it("persists typed settings and migrates new keys from an older registry", async () => {
    const { storageRoot, manager } = await boot();
    const saved = await manager.updateSetting("limits.queueConcurrency", 3);
    expect(saved.value).toBe(3);
    expect(manager.getSetting("ai.requestTimeoutMs")?.value).toBe(120_000);

    const v1Path = path.join(storageRoot, "admin-control-plane", "registry.json");
    const current = JSON.parse(await fs.readFile(v1Path, "utf8")) as { version: number; settings: unknown[] };
    current.version = 1;
    current.settings = current.settings.filter((item: { key: string }) => item.key !== "ai.requestTimeoutMs");
    await fs.writeFile(v1Path, JSON.stringify(current));
    const restored = new AdminControlPlaneManager();
    await restored.initialize(storageRoot);
    expect(restored.getSetting("limits.queueConcurrency")?.value).toBe(3);
    expect(restored.getSetting("ai.requestTimeoutMs")?.value).toBe(120_000);
  });

  it("records usage with nullable customer/project and cost fields without fabricating customers", async () => {
    const { manager } = await boot();
    const record = await manager.recordUsage({
      feature: "VISION_ANALYSIS",
      operation: "analyze",
      status: "succeeded",
      durationMs: 12,
      estimatedCost: 0,
      actualCost: undefined,
      currency: "USD",
      metadata: {},
    });
    expect(record.customerId).toBeUndefined();
    expect(record.projectId).toBeUndefined();
    expect(record.createdAt).toBeTruthy();
    expect(manager.listUsage()[0]?.id).toBe(record.id);
  });

  it("keeps tenant isolation and layered access ready without login", () => {
    expect(assertTenantIsolation(
      { customerId: "a" },
      { customerId: "b", layer: "CUSTOMER" },
    ).allowed).toBe(false);
    expect(assertTenantIsolation(
      { customerId: "a" },
      { customerId: "a", layer: "CUSTOMER" },
    ).allowed).toBe(true);
    expect(assertTenantIsolation(
      { customerId: "a" },
      { layer: "ADMIN" },
    ).allowed).toBe(true);
    expect(assertLayerAccess("ADMIN", { roles: [], path: "/api/admin/models", adminApi: true }).allowed).toBe(true);
    expect(assertLayerAccess("CUSTOMER", { roles: [], path: "/api/projects", adminApi: false, customerId: "c1" }).allowed).toBe(true);
  });

  it("resolves Ollama through the adapter registry and configuration access without secrets", async () => {
    const { manager } = await boot();
    const ollama = manager.listProviders().find((p) => p.type === "ollama")!;
    const adapters = createDefaultAdapterRegistry();
    const record = manager.getProviderRecord(ollama.id)!;
    expect(adapters.resolve(record)?.id).toBe("ollama");
    const config = new AdminConfiguration(manager).getProviderConfiguration(ollama.id);
    expect(config?.kind).toBe("LOCAL");
    expect(JSON.stringify(config)).not.toMatch(/sk-|passphrase|secret=/i);
    const mapped = new AdminConfiguration(manager).resolveFeatureModel("LLM_CHAT");
    expect(["READY", "FALLBACK", "UNAVAILABLE"]).toContain(mapped.status);
  });
});
