import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import { createCapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import { OpenAiProviderAdapter } from "../../../../ai/admin-control-plane/openai-adapter.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";
import { AdminRuntimeCreativeReasoningProvider } from "../../../../ai/creative-planning/admin-runtime-creative-reasoning-provider.js";
import { CascadingCreativeReasoningProvider } from "../../../../ai/creative-planning/cascading-creative-reasoning-provider.js";
import {
  generateCreativeScenes,
  setCreativeReasoningProvider,
  type CreativeReasoningProvider,
  type AiCreativePlannerInput,
} from "../../../../ai/creative-planning/ai-creative-planner.js";
import {
  buildCreativeDirectorSystemInstructions,
  extractIdentityLockFromProject,
} from "../../../../ai/creative-planning/creative-director-prompt.js";
import { validateAiPlannerOutput } from "../../../../ai/creative-planning/plan-validator.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const roots: string[] = [];
const originalEnv = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setCreativeReasoningProvider(null);
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-phase3-"));
  roots.push(storageRoot);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-phase3-creative");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { storageRoot, manager, credentials };
}

function minimalInput(overrides?: Partial<AiCreativePlannerInput>): AiCreativePlannerInput {
  const project = {
    id: "proj-phase3",
    productImages: [
      { id: "asset-a", fileName: "a.png", mimeType: "image/png" },
      { id: "asset-b", fileName: "b.png", mimeType: "image/png" },
    ],
    productInformation: {
      name: "Oak Boot",
      category: "Footwear",
      description: "Leather boot",
      materials: ["leather"],
      colors: ["brown"],
      features: [],
      benefits: [],
    },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: {
      name: "Launch",
      objective: "Showcase product",
      callToAction: "Shop now",
      notes: "",
    },
    language: "en",
    targetAudience: "Shoppers",
    workspaceSettings: {
      productIdentityLock: {
        status: "LOCKED",
        protectedAttributes: ["shape", "color", "logo", "material"],
        allowedCreativeChanges: ["background", "lighting", "camera", "motion"],
        heroAssetId: "asset-a",
        productName: { value: "Oak Boot" },
        material: { value: "leather" },
        colors: [{ value: "brown" }],
      },
    },
  } as unknown as CreativeProject;

  return {
    project,
    productIntelligence: null,
    assets: [],
    marketingSettings: null,
    videoSettings: {
      productionMode: "EXACT_PRODUCT" as const,
      platform: "instagram",
      durationSeconds: 15,
      language: "English",
      objective: "Showcase product",
    },
    productIdentityLock: extractIdentityLockFromProject(project.workspaceSettings),
    ...overrides,
  };
}

describe("Phase 3 — Admin-routed Creative Director", () => {
  it("seeds CREATIVE_REASONING and resolves to OpenAI when credentialed", async () => {
    const { manager, credentials } = await boot();
    expect(manager.getFeatureMapping("CREATIVE_REASONING")?.feature).toBe("CREATIVE_REASONING");
    await manager.setProviderSecret("provider-openai", "sk-test-phase3-not-real", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "CREATIVE_REASONING",
      label: "Creative Reasoning",
      primaryModelId: "model-openai-gpt-4o-mini",
      fallbackModelId: "model-local-llm",
      providerId: "provider-openai",
      enabled: true,
    });
    const resolution = manager.resolveFeatureExecution("CREATIVE_REASONING");
    expect(resolution.status).toBe("READY");
    expect(resolution.providerId).toBe("provider-openai");
    expect(resolution.selectedModel?.modelId).toBe("gpt-4o-mini");
    expect(credentials.getProviderSecret("provider-openai")).toBe("sk-test-phase3-not-real");
    expect(JSON.stringify(manager.getProvider("provider-openai"))).not.toContain("sk-test-phase3-not-real");
  });

  it("OpenAI adapter uses chat JSON mode with higher max_tokens", async () => {
    const adapter = new OpenAiProviderAdapter();
    let captured: { body?: Record<string, unknown> } = {};
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      captured = { body: JSON.parse(String(init?.body ?? "{}")) };
      return new Response(JSON.stringify({
        id: "chatcmpl-p3",
        model: "gpt-4o-mini",
        choices: [{ message: { content: JSON.stringify({
          projectId: "proj-phase3",
          creativeDirection: "product-first",
          primarySellingPoint: "comfort",
          textStrategy: { headline: "Oak Boot", price: "", cta: "Shop" },
          scenes: [
            { id: "scene-1", purpose: "HOOK", assetId: "asset-a", duration: 3, camera: "hold", motion: "hold", narration: "", transitionOut: "cut" },
            { id: "scene-2", purpose: "REVEAL", assetId: "asset-b", duration: 3, camera: "hold", motion: "hold", narration: "", transitionOut: "fade" },
          ],
        }) } }],
      }), { status: 200 });
    }));

    const result = await adapter.execute({
      provider: {
        id: "provider-openai",
        name: "OpenAI",
        type: "openai",
        kind: "EXTERNAL_API",
        baseEndpoint: "https://api.openai.com",
        status: "active",
        enabled: true,
        healthStatus: "unchecked",
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      model: {
        id: "model-openai-gpt-4o-mini",
        name: "OpenAI GPT-4o mini",
        providerId: "provider-openai",
        category: "LLM",
        capability: "chat",
        modelId: "gpt-4o-mini",
        status: "active",
        priority: 80,
        inputType: "text",
        outputType: "text",
        currency: "USD",
        timeoutMs: 30_000,
        enabled: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      getSecret: () => "sk-unit-test-secret-do-not-log",
      input: {
        mode: "chat",
        messages: [
          { role: "system", content: buildCreativeDirectorSystemInstructions() },
          { role: "user", content: "Return creative plan JSON" },
        ],
      },
      timeoutMs: 10_000,
      requestId: "phase3-unit",
    });

    expect(result.ok).toBe(true);
    expect(captured.body?.max_tokens).toBe(1024);
    expect(captured.body?.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(result)).not.toContain("sk-unit-test-secret-do-not-log");
  });

  it("AdminRuntimeCreativeReasoningProvider executes CREATIVE_REASONING without exposing secrets", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-openai", "sk-test-phase3-creative", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "CREATIVE_REASONING",
      label: "Creative Reasoning",
      primaryModelId: "model-openai-gpt-4o-mini",
      fallbackModelId: "model-local-llm",
      providerId: "provider-openai",
      enabled: true,
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "chatcmpl-creative",
      model: "gpt-4o-mini",
      choices: [{ message: { content: JSON.stringify({
        projectId: "proj-phase3",
        creativeDirection: "product-first",
        primarySellingPoint: "durable leather",
        textStrategy: { headline: "Oak Boot", price: "", cta: "Buy now" },
        scenes: [
          { id: "scene-1", purpose: "HOOK", assetId: "asset-a", duration: 3, camera: "slow push", motion: "subtle zoom", narration: "", transitionOut: "cut" },
          { id: "scene-2", purpose: "REVEAL", assetId: "asset-b", duration: 4, camera: "hold", motion: "hold", narration: "", transitionOut: "fade" },
        ],
      }) } }],
    }), { status: 200 })));

    const runtime = createCapabilityRuntime(manager, credentials);
    const provider = new AdminRuntimeCreativeReasoningProvider(() => runtime);
    expect(await provider.isAvailable()).toBe(true);
    const raw = await provider.planCreativeScenes(minimalInput());
    const validated = validateAiPlannerOutput(raw, {
      projectId: "proj-phase3",
      allowedAssetIds: ["asset-a", "asset-b"],
      targetDurationSeconds: 15,
      productionMode: "EXACT_PRODUCT",
    });
    expect(validated.valid).toBe(true);
    expect(provider.getLastModel()).toBe("gpt-4o-mini");
    expect(JSON.stringify(raw)).not.toContain("sk-test-phase3-creative");
  });

  it("falls back to deterministic when online creative reasoning is unavailable", async () => {
    const offline: CreativeReasoningProvider = {
      id: "admin-runtime-creative-director",
      isAvailable: async () => false,
      planCreativeScenes: async () => null,
    };
    setCreativeReasoningProvider(new CascadingCreativeReasoningProvider([offline]));
    const result = await generateCreativeScenes(minimalInput());
    expect(result.source).toBe("deterministic");
    expect(result.scenes.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /unavailable|deterministic/i.test(w))).toBe(true);
  });

  it("malformed online output falls back safely", async () => {
    const bad: CreativeReasoningProvider = {
      id: "admin-runtime-creative-director",
      isAvailable: async () => true,
      planCreativeScenes: async () => ({ not: "a plan" }),
      getLastModel: () => "gpt-4o-mini",
    };
    setCreativeReasoningProvider(bad);
    const result = await generateCreativeScenes(minimalInput());
    expect(result.source).toBe("deterministic");
    expect(result.warnings.some((w) => /validation|invalid|deterministic/i.test(w))).toBe(true);
  });

  it("identity lock extraction preserves protected attributes for prompt context", () => {
    const lock = extractIdentityLockFromProject({
      productIdentityLock: {
        status: "LOCKED",
        protectedAttributes: ["shape", "color", "logo"],
        allowedCreativeChanges: ["background", "lighting"],
        heroAssetId: "hero-1",
      },
    });
    expect(lock?.locked).toBe(true);
    expect(lock?.protectedAttributes).toContain("logo");
    expect(lock?.allowedCreativeChanges).toContain("background");
    expect(buildCreativeDirectorSystemInstructions()).toMatch(/protected attributes/i);
  });

  it("cascade prefers online provider when available", async () => {
    const online: CreativeReasoningProvider = {
      id: "admin-runtime-creative-director",
      isAvailable: async () => true,
      planCreativeScenes: async () => ({
        projectId: "proj-phase3",
        creativeDirection: "online",
        primarySellingPoint: "x",
        textStrategy: { headline: "H", price: "", cta: "C" },
        scenes: [
          { id: "scene-1", purpose: "HOOK", assetId: "asset-a", duration: 3, camera: "hold", motion: "hold", narration: "", transitionOut: "cut" },
        ],
      }),
      getLastModel: () => "gpt-4o-mini",
    };
    const local: CreativeReasoningProvider = {
      id: "ollama-creative-director",
      isAvailable: async () => true,
      planCreativeScenes: async () => {
        throw new Error("should not be called");
      },
    };
    const cascade = new CascadingCreativeReasoningProvider([online, local]);
    const raw = await cascade.planCreativeScenes(minimalInput());
    expect((raw as { creativeDirection?: string }).creativeDirection).toBe("online");
    expect(cascade.getLastProviderId()).toBe("admin-runtime-creative-director");
  });
});
