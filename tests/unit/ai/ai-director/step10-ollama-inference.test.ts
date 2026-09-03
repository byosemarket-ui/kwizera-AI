import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ollamaGenerateJson,
  ollamaInFlightCount,
  ollamaMaxConcurrent,
  withOllamaSlot,
} from "../../../../ai/ai-provider/ollama-client.js";
import {
  generateCreativeScenes,
  setCreativeReasoningProvider,
  type CreativeReasoningProvider,
} from "../../../../ai/creative-planning/ai-creative-planner.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

function projectFixture(id = "project-a"): CreativeProject {
  const now = new Date().toISOString();
  return {
    id,
    name: "Chestnut Oxford",
    createdAt: now,
    modifiedAt: now,
    productImages: [
      { id: `${id}-front`, fileName: "front.png", mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: "/front.png" },
    ],
    productInformation: {
      name: "Chestnut Oxford",
      category: "Shoes",
      description: "Formal brown oxford shoe",
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

function plannerInput(projectId = "project-a") {
  const project = projectFixture(projectId);
  return {
    project,
    assets: [],
    videoSettings: {
      productionMode: "AI_PRODUCT_MOTION" as const,
      creativeTone: "Premium" as const,
      platform: "tiktok",
      durationSeconds: 15,
      language: "English",
      objective: "Product Showcase",
    },
  };
}

afterEach(() => {
  setCreativeReasoningProvider(null);
  vi.unstubAllGlobals();
});

describe("Step 10 Ollama inference hardening", () => {
  it("retries once after invalid structured output then accepts valid AI", async () => {
    let calls = 0;
    const provider: CreativeReasoningProvider = {
      id: "retry-then-ok",
      async isAvailable() { return true; },
      getLastModel() { return "llama3.2:1b"; },
      async planCreativeScenes(input) {
        calls += 1;
        if (calls === 1) return { projectId: input.project.id, scenes: "not-an-array" };
        return {
          projectId: input.project.id,
          scenes: [{ id: "s1", purpose: "HOOK", assetId: `${input.project.id}-front`, duration: 3 }],
        };
      },
    };
    setCreativeReasoningProvider(provider);
    const result = await generateCreativeScenes(plannerInput());
    expect(calls).toBe(2);
    expect(result.source).toBe("ai");
    expect(result.modelId).toBe("llama3.2:1b");
    expect(result.warnings.some((w) => /retry/i.test(w))).toBe(true);
  });

  it("falls back after two invalid outputs and never leaks invented assets", async () => {
    const provider: CreativeReasoningProvider = {
      id: "always-bad",
      async isAvailable() { return true; },
      async planCreativeScenes() {
        return { projectId: "other-project", scenes: [{ id: "s1", purpose: "HOOK", assetId: "fake", duration: 3 }] };
      },
    };
    setCreativeReasoningProvider(provider);
    const result = await generateCreativeScenes(plannerInput("project-a"));
    expect(result.source).toBe("deterministic");
    expect(result.scenes.every((scene) => scene.assetId === "project-a-front" || scene.assetId)).toBe(true);
    expect(result.scenes.some((scene) => scene.assetId === "fake")).toBe(false);
    expect(result.warnings.some((w) => /VALIDATION|projectId|Hallucinated/i.test(w))).toBe(true);
  });

  it("does not retry timeouts", async () => {
    let calls = 0;
    const provider: CreativeReasoningProvider = {
      id: "timeout",
      async isAvailable() { return true; },
      async planCreativeScenes() {
        calls += 1;
        throw Object.assign(new Error("aborted"), { code: "MODEL_TIMEOUT" });
      },
    };
    setCreativeReasoningProvider(provider);
    const result = await generateCreativeScenes(plannerInput());
    expect(calls).toBe(1);
    expect(result.source).toBe("deterministic");
    expect(result.warnings.some((w) => /TIMEOUT/i.test(w))).toBe(true);
  });

  it("keeps project A and project B isolated in planner output", async () => {
    const provider: CreativeReasoningProvider = {
      id: "cross-project",
      async isAvailable() { return true; },
      async planCreativeScenes(input) {
        return {
          projectId: input.project.id,
          scenes: [{
            id: "s1",
            purpose: "HOOK",
            assetId: input.project.id === "project-a" ? "project-b-front" : input.project.productImages[0]?.id,
            duration: 3,
          }],
        };
      },
    };
    setCreativeReasoningProvider(provider);
    const a = await generateCreativeScenes(plannerInput("project-a"));
    expect(a.scenes.some((scene) => scene.assetId === "project-b-front")).toBe(false);
    const b = await generateCreativeScenes(plannerInput("project-b"));
    expect(b.decisionTrace?.projectId).toBe("project-b");
  });

  it("serializes Ollama slots so concurrency stays at 1 by default", async () => {
    expect(ollamaMaxConcurrent()).toBe(1);
    let peak = 0;
    const work = async () => {
      expect(ollamaInFlightCount()).toBeLessThanOrEqual(1);
      peak = Math.max(peak, ollamaInFlightCount());
      await new Promise((resolve) => setTimeout(resolve, 20));
      return true;
    };
    await Promise.all([withOllamaSlot(work), withOllamaSlot(work), withOllamaSlot(work)]);
    expect(peak).toBe(1);
  });

  it("rejects oversized generate responses", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ response: "x".repeat(80_000) }),
    }));
    const result = await ollamaGenerateJson({ model: "llama3.2:1b", prompt: "{}" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_AI_OUTPUT");
  });

  it("maps generate abort to MODEL_TIMEOUT", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("This operation was aborted due to timeout");
    });
    const result = await ollamaGenerateJson({ model: "llama3.2:1b", prompt: "{}", timeoutMs: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MODEL_TIMEOUT");
  });
});
