import { describe, expect, it } from "vitest";
import {
  isSmallReasoningModel,
  isVisionCapableModel,
  selectPreferredReasoningModel,
  selectPreferredVisionModel,
} from "../../../../ai/ai-provider/ollama-client.js";
import { OllamaVisionProvider } from "../../../../ai/ai-provider/ollama-vision-provider.js";
import { validateAiPlannerOutput } from "../../../../ai/creative-planning/plan-validator.js";
import { toPublicOllamaReadiness } from "../../../../ai/media-intelligence/ollama-readiness.js";
import { OLLAMA_INSTALL_ALLOWED } from "../../../../ai/ai-director/intelligence-pipeline.js";

describe("Step 9 Ollama readiness hardening", () => {
  it("keeps auto-install permanently disabled", () => {
    expect(OLLAMA_INSTALL_ALLOWED).toBe(false);
  });

  it("selects tiny reasoning models and rejects inventing names", () => {
    expect(selectPreferredReasoningModel([], "llama3.2:1b")).toBeNull();
    expect(selectPreferredReasoningModel(
      [{ name: "llama3.2:1b" }, { name: "mistral:7b" }],
      "llama3.2:1b",
    )).toBe("llama3.2:1b");
    expect(isSmallReasoningModel("llama3.2:1b")).toBe(true);
    expect(isSmallReasoningModel("llama3.1:8b")).toBe(false);
  });

  it("requires a vision-capable model before vision availability", async () => {
    expect(isVisionCapableModel("llama3.2:1b")).toBe(false);
    expect(isVisionCapableModel("llava:7b")).toBe(true);
    expect(selectPreferredVisionModel([{ name: "llama3.2:1b" }], "llava")).toBeNull();
    expect(selectPreferredVisionModel([{ name: "llava:7b" }], "llava")).toBe("llava:7b");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ models: [{ name: "llama3.2:1b" }] }),
    })) as typeof fetch;
    try {
      const vision = new OllamaVisionProvider({ model: "llava" });
      expect(await vision.isAvailable()).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("strips invented prices and unsupported material claims", () => {
    const result = validateAiPlannerOutput({
      projectId: "p1",
      primarySellingPoint: "Made from Italian leather",
      textStrategy: { headline: "Shop now", price: "999999 RWF", cta: "Buy" },
      scenes: [{ id: "s1", purpose: "HOOK", assetId: "img-1", duration: 3, narration: "Genuine leather certified warranty" }],
    }, {
      projectId: "p1",
      allowedAssetIds: ["img-1"],
      targetDurationSeconds: 15,
      verifiedFacts: {
        priceAllowed: false,
        discountAllowed: false,
        ctaAllowed: "Buy",
        allowedFacts: ["Product name: Chestnut Oxford"],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.textStrategy?.price).toBeUndefined();
    expect(result.warnings.some((w) => /price/i.test(w))).toBe(true);
    expect(result.primarySellingPoint ?? "").not.toMatch(/Italian leather/i);
    expect(result.scenes[0]?.narration ?? "").not.toMatch(/genuine leather|certified|warranty/i);
  });

  it("rejects hallucinated asset IDs", () => {
    const result = validateAiPlannerOutput({
      projectId: "p1",
      scenes: [{ id: "s1", purpose: "HOOK", assetId: "fake-asset", duration: 3 }],
    }, {
      projectId: "p1",
      allowedAssetIds: ["real-asset"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /Hallucinated asset/i.test(e))).toBe(true);
  });

  it("public readiness never exposes private base URL or RAM figures", () => {
    const publicReport = toPublicOllamaReadiness({
      ready: false,
      status: "UNAVAILABLE",
      installationStatus: "NOT_INSTALLED",
      ollamaInstalled: false,
      ollamaReachable: false,
      disabled: false,
      baseUrl: "http://127.0.0.1:11434",
      installedModels: ["secret-model"],
      selectedModel: null,
      recommendedAction: "defer",
      modelStrategy: {
        tier: "tiny",
        recommendedModelIds: ["llama3.2:1b"],
        selectedInstalledModel: null,
        reason: "Limited RAM",
        safeToInstall: true,
        maxConcurrent: 1,
      },
      cpuCores: 2,
      totalMemoryGb: 3.2,
      freeMemoryGb: 1.4,
      loadAverage: [1, 1, 1],
      notes: ["Ollama not installed"],
      fallbackActive: true,
    });
    const serialized = JSON.stringify(publicReport);
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("totalMemoryGb");
    expect(serialized).not.toContain("freeMemoryGb");
    expect(serialized).not.toContain("secret-model");
    expect(publicReport.installedModelCount).toBe(1);
    expect(publicReport.fallbackActive).toBe(true);
    expect(publicReport.autoInstallDisabled).toBe(true);
  });
});
