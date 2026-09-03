import { describe, expect, it } from "vitest";
import {
  generateCreativeScenes,
  setCreativeReasoningProvider,
  type CreativeReasoningProvider,
} from "../../../../ai/creative-planning/ai-creative-planner.js";
import { buildProjectIntelligenceContext } from "../../../../ai/creative-planning/project-intelligence-context.js";
import { OllamaCreativeReasoningProvider } from "../../../../ai/creative-planning/ollama-creative-reasoning-provider.js";
import { selectPreferredReasoningModel } from "../../../../ai/ai-provider/ollama-client.js";
import {
  getVideoGenerationProvider,
  setVideoGenerationProvider,
  UnavailableVideoGenerationProvider,
} from "../../../../ai/video-production/video-generation-provider.js";
import { assessOllamaReadiness } from "../../../../ai/media-intelligence/ollama-readiness.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

function projectFixture(): CreativeProject {
  const now = new Date().toISOString();
  return {
    id: "project-step5",
    name: "Oxford",
    createdAt: now,
    modifiedAt: now,
    productImages: [
      { id: "asset-front", fileName: "front.png", mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: "/front.png" },
      { id: "asset-side", fileName: "left.png", mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: "/left.png" },
    ],
    productInformation: {
      name: "Oxford",
      category: "Shoes",
      description: "Brown leather shoe",
      price: 45000,
      originalPrice: 60000,
      currency: "RWF",
    },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: { name: "Launch", objective: "Product Showcase", callToAction: "Shop now" },
    targetAudience: "Professionals 25-40",
    language: "English",
    platform: "tiktok",
    workspaceSettings: {},
  };
}

function baseInput() {
  return {
    project: projectFixture(),
    assets: [],
    videoSettings: {
      productionMode: "CLASSIC_SHOWCASE" as const,
      creativeTone: "Premium" as const,
      platform: "tiktok",
      durationSeconds: 15,
      language: "English",
      objective: "Product Showcase",
    },
  };
}

describe("Step 5 Creative Director foundations", () => {
  it("builds project-scoped intelligence context from Steps 1-3 data", () => {
    const context = buildProjectIntelligenceContext(baseInput());
    expect(context.projectId).toBe("project-step5");
    expect(context.product.name).toBe("Oxford");
    expect(context.marketing.platform).toBe("tiktok");
    expect(context.style.productionMode).toBe("CLASSIC_SHOWCASE");
    expect(context.constraints.mustUseOnlyAssetIds).toEqual(["asset-front", "asset-side"]);
  });

  it("falls back safely when Ollama creative director is unavailable", async () => {
    setCreativeReasoningProvider(null);
    const result = await generateCreativeScenes(baseInput());
    expect(result.source).toBe("deterministic");
    expect(result.scenes.length).toBeGreaterThan(0);
    expect(result.scenes.every((scene) => scene.assetId)).toBe(true);
    expect(result.warnings.some((w) => /unavailable|deterministic/i.test(w))).toBe(true);
  });

  it("rejects hallucinated asset IDs from AI output", async () => {
    const provider: CreativeReasoningProvider = {
      id: "test-bad-assets",
      async isAvailable() { return true; },
      async planCreativeScenes() {
        return {
          projectId: "project-step5",
          scenes: [{ id: "s1", purpose: "HOOK", assetId: "does-not-exist", duration: 3 }],
        };
      },
    };
    setCreativeReasoningProvider(provider);
    const result = await generateCreativeScenes(baseInput());
    expect(result.source).toBe("deterministic");
    expect(result.warnings.some((w) => /HALLUCINATED|VALIDATION|invalid/i.test(w))).toBe(true);
    setCreativeReasoningProvider(null);
  });

  it("merges validated AI output while respecting user production mode assets", async () => {
    const provider: CreativeReasoningProvider = {
      id: "test-good",
      async isAvailable() { return true; },
      getLastModel() { return "mock-model"; },
      async planCreativeScenes(input) {
        return {
          projectId: input.project.id,
          creativeDirection: "Premium shoe hero",
          primarySellingPoint: "Crafted leather",
          scenes: [
            { id: "s1", purpose: "HOOK", assetId: "asset-front", duration: 3, camera: "push-in", motion: "slow-zoom" },
          ],
        };
      },
    };
    setCreativeReasoningProvider(provider);
    const result = await generateCreativeScenes(baseInput());
    expect(result.source).toBe("ai");
    expect(result.modelId).toBe("mock-model");
    expect(result.scenes[0]?.purpose).toBe("HOOK");
    expect(result.scenes[0]?.assetId).toBe("asset-front");
    setCreativeReasoningProvider(null);
  });

  it("selects small installed models preferentially", () => {
    const selected = selectPreferredReasoningModel([
      { name: "llama3.1:8b" },
      { name: "llama3.2:1b" },
    ], "llama3.2:1b");
    expect(selected).toBe("llama3.2:1b");
  });

  it("keeps video generation provider unavailable by default", async () => {
    setVideoGenerationProvider(null);
    const provider = getVideoGenerationProvider();
    expect(provider).toBeInstanceOf(UnavailableVideoGenerationProvider);
    expect(await provider.isAvailable()).toBe(false);
    expect(provider.status).toBe("UNAVAILABLE");
  });

  it("assesses Ollama readiness without crashing when Ollama is missing", async () => {
    const report = await assessOllamaReadiness();
    expect(report.status).toBeTruthy();
    expect(report.modelStrategy.tier).toBeTruthy();
    expect(Array.isArray(report.installedModels)).toBe(true);
    expect(["defer", "install-small-model", "insufficient-resources", "use-installed-model", "disabled"]).toContain(
      report.recommendedAction,
    );
  });

  it("Ollama creative provider reports unavailable when host has no Ollama", async () => {
    const provider = new OllamaCreativeReasoningProvider({
      baseUrl: "http://127.0.0.1:1",
      model: "llama3.2:1b",
    });
    expect(await provider.isAvailable()).toBe(false);
  });
});
