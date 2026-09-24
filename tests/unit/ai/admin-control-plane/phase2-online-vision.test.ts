import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import { createCapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import { OpenAiProviderAdapter } from "../../../../ai/admin-control-plane/openai-adapter.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";
import { AdminRuntimeVisionProvider } from "../../../../ai/ai-provider/admin-runtime-vision-provider.js";
import { CascadingVisionProvider } from "../../../../ai/ai-provider/cascading-vision-provider.js";
import { normalizeVisionModelOutput } from "../../../../ai/ai-provider/vision-normalize.js";
import type { VisionProvider } from "../../../../ai/ai-provider/vision-capabilities.js";
import { enrichProductIntelligence } from "../../../../ai/product-intelligence/step7-builder.js";
import type { ProductIntelligenceProfile } from "../../../../ai/product-intelligence/types.js";
import type { ImageIntelligenceProfile } from "../../../../ai/image-intelligence/types.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const roots: string[] = [];
const originalEnv = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-phase2-"));
  roots.push(storageRoot);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-phase2-vision");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { storageRoot, manager, credentials };
}

describe("Phase 2 — online vision → product intelligence", () => {
  it("normalizes valid vision JSON and rejects malformed output", () => {
    const ok = normalizeVisionModelOutput({
      provider: "openai",
      model: "gpt-4o-mini",
      outputText: JSON.stringify({
        view: "front",
        viewConfidence: 0.9,
        backgroundType: "studio",
        backgroundConfidence: 0.8,
        category: "sneakers",
        categoryConfidence: 0.85,
        shape: "low-top",
        primaryColor: "white",
        material: "leather",
        logo: "unknown",
        dominantColors: [{ name: "white", confidence: 0.9 }],
      }),
      source: "ONLINE",
    });
    expect(ok.available).toBe(true);
    expect(ok.views?.[0]?.view).toBe("front");
    expect(ok.productCategory?.category).toBe("sneakers");
    expect(ok.productObservations?.some((o) => o.field === "shape" && o.value === "low-top")).toBe(true);
    expect(ok.productObservations?.find((o) => o.field === "logo")?.uncertain).toBe(true);

    const bad = normalizeVisionModelOutput({
      provider: "openai",
      model: "gpt-4o-mini",
      outputText: "not-json",
      source: "ONLINE",
    });
    expect(bad.available).toBe(false);
  });

  it("resolves VISION_ANALYSIS to OpenAI when credentialed", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-openai", "sk-test-phase2-not-real", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "VISION_ANALYSIS",
      label: "Vision Analysis",
      primaryModelId: "model-openai-gpt-4o-mini",
      fallbackModelId: "model-local-vision",
      providerId: "provider-openai",
      enabled: true,
    });
    const resolution = manager.resolveFeatureExecution("VISION_ANALYSIS");
    expect(resolution.status).toBe("READY");
    expect(resolution.providerId).toBe("provider-openai");
    expect(resolution.selectedModel?.modelId).toBe("gpt-4o-mini");
    expect(credentials.getProviderSecret("provider-openai")).toBe("sk-test-phase2-not-real");
    const publicView = manager.getProvider("provider-openai");
    expect(publicView?.hasCredential).toBe(true);
    expect(JSON.stringify(publicView)).not.toContain("sk-test-phase2-not-real");
  });

  it("OpenAI adapter builds multimodal vision request without leaking secrets", async () => {
    const adapter = new OpenAiProviderAdapter();
    let captured: { url?: string; body?: Record<string, unknown>; headers?: HeadersInit } = {};
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      captured = {
        url,
        body: JSON.parse(String(init?.body ?? "{}")),
        headers: init?.headers,
      };
      return new Response(JSON.stringify({
        id: "chatcmpl-test",
        model: "gpt-4o-mini",
        choices: [{ message: { content: JSON.stringify({
          view: "front",
          viewConfidence: 0.7,
          backgroundType: "plain",
          backgroundConfidence: 0.6,
          category: "bottle",
          categoryConfidence: 0.7,
          dominantColors: [{ name: "blue", confidence: 0.8 }],
        }) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
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
        mode: "vision",
        prompt: "Analyze",
        images: [{ mimeType: "image/png", base64: "aaa" }],
      },
      timeoutMs: 10_000,
      requestId: "phase2-unit",
    });

    expect(result.ok).toBe(true);
    expect(captured.url).toContain("/v1/chat/completions");
    expect(captured.body?.max_tokens).toBe(2048);
    expect(captured.body?.response_format).toEqual({ type: "json_object" });
    const messages = captured.body?.messages as Array<{ content: unknown }>;
    expect(Array.isArray(messages?.[1]?.content)).toBe(true);
    expect(JSON.stringify(captured.headers)).toContain("Bearer");
    expect(JSON.stringify(result)).not.toContain("sk-unit-test-secret-do-not-log");
  });

  it("AdminRuntimeVisionProvider executes VISION_ANALYSIS and normalizes output", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-openai", "sk-test-phase2-vision", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "VISION_ANALYSIS",
      label: "Vision Analysis",
      primaryModelId: "model-openai-gpt-4o-mini",
      fallbackModelId: "model-local-vision",
      providerId: "provider-openai",
      enabled: true,
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "chatcmpl-vision",
      model: "gpt-4o-mini",
      choices: [{ message: { content: JSON.stringify({
        view: "side",
        viewConfidence: 0.8,
        backgroundType: "studio",
        backgroundConfidence: 0.7,
        category: "shoe",
        categoryConfidence: 0.75,
        shape: "sneaker",
        primaryColor: "red",
        dominantColors: [{ name: "red", confidence: 0.9 }],
      }) } }],
    }), { status: 200 })));

    const runtime = createCapabilityRuntime(manager, credentials);
    const vision = new AdminRuntimeVisionProvider(() => runtime);
    expect(await vision.isAvailable()).toBe(true);
    const result = await vision.analyzeImage({
      projectId: "p1",
      assetId: "a1",
      mimeType: "image/png",
      fileName: "product.png",
      userProductName: "Test Shoe",
      imageBase64: "AAA",
    });
    expect(result.available).toBe(true);
    expect(result.source).toBe("ONLINE");
    expect(result.views?.[0]?.view).toBe("side");
    expect(result.productObservations?.some((o) => o.field === "shape")).toBe(true);
  });

  it("CascadingVisionProvider falls back when online is unavailable", async () => {
    const offline: VisionProvider = {
      id: "admin-runtime",
      capabilities: ["image-understanding"],
      isAvailable: async () => false,
      analyzeImage: async () => ({ provider: "admin-runtime", model: null, available: false, notes: ["offline"] }),
    };
    const local: VisionProvider = {
      id: "ollama",
      capabilities: ["image-understanding"],
      isAvailable: async () => true,
      analyzeImage: async () => ({
        provider: "ollama",
        model: "llava",
        available: true,
        source: "LOCAL_FALLBACK",
        views: [{ view: "front", confidence: 0.6 }],
        notes: ["local"],
      }),
    };
    const cascade = new CascadingVisionProvider([offline, local]);
    const result = await cascade.analyzeImage({
      projectId: "p1",
      assetId: "a1",
      mimeType: "image/png",
      fileName: "x.png",
    });
    expect(result.available).toBe(true);
    expect(result.provider).toBe("ollama");
    expect(result.source).toBe("LOCAL_FALLBACK");
  });

  it("Product Intelligence marks vision-online when image profiles completed online", () => {
    const project = {
      id: "proj-1",
      productInformation: { name: "Bottle", category: "drinkware", description: "", materials: [], colors: [], features: [], benefits: [] },
      brandInformation: { name: "" },
      targetAudience: "",
      campaignInformation: { objective: "", callToAction: "", notes: "" },
    } as unknown as CreativeProject;

    const imageProfiles = [{
      id: "img-1",
      projectId: "proj-1",
      imageId: "asset-1",
      fileName: "hero.png",
      mimeType: "image/png",
      aiVisionStatus: "completed",
      metadata: { visionSource: "ONLINE" },
      observations: [{ field: "shape", value: "cylinder", kind: "observed-from-image", confidence: 80 }],
      colors: [{ name: "blue", role: "primary", confidence: 0.8, kind: "observed-from-image" }],
      missingInformation: [],
    }] as unknown as ImageIntelligenceProfile[];

    const profile = {
      id: "pi-1",
      projectId: "proj-1",
      productId: "proj-1",
      productName: "Bottle",
      identifiedAs: "Bottle",
      productType: "bottle",
      category: "drinkware",
      brand: "",
      description: "",
      materials: [],
      colours: [],
      textures: [],
      shapes: [],
      patterns: [],
      style: "",
      features: [],
      functions: [],
      visibleLogos: [],
      imageIds: ["asset-1"],
      multiView: false,
      imageAnalysis: {},
      missingInformation: [],
      photoRecommendations: [],
      detailRecommendations: [],
      readyForCreativeGeneration: true,
      originalImagesUnmodified: true,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cached: false,
      sellingPoints: [],
      targetAudience: [],
      marketingKeywords: [],
      quality: { score: 70, confidence: 70, notes: [] },
    } as unknown as ProductIntelligenceProfile;

    const enriched = enrichProductIntelligence(project, profile, imageProfiles);
    expect(enriched.aiInferenceStatus).toBe("vision-online");
    expect(enriched.originalImagesUnmodified).toBe(true);
    expect(enriched.imageObservations?.some((o) => o.field === "shape")).toBe(true);
  });
});
