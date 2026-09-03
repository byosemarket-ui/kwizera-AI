import { describe, expect, it } from "vitest";
import { describeIntelligencePipeline, OLLAMA_INSTALL_ALLOWED, validateNormalizedPlan } from "../../../../ai/ai-director/intelligence-pipeline.js";
import { toPublicOllamaReadiness } from "../../../../ai/media-intelligence/ollama-readiness.js";
import { timelineUsesStaleAssets } from "../../../../ai/video-production/output-stale.js";
import { displayProductionProgress } from "../../../../desktop/final-review/final-review-engine.js";

describe("Step 8 production hardening", () => {
  it("does not allow Ollama install from the intelligence boundary", () => {
    expect(OLLAMA_INSTALL_ALLOWED).toBe(false);
    const pipeline = describeIntelligencePipeline();
    expect(pipeline.installOllamaNow).toBe(false);
    expect(pipeline.autoDownloadModels).toBe(false);
    expect(pipeline.fallback).toBe("deterministic");
    expect(pipeline.providerSeam).toBe("setCreativeReasoningProvider");
  });

  it("rejects intelligence output that invents a different project", () => {
    const result = validateNormalizedPlan({
      projectId: "other-project",
      scenes: [{ id: "s1", purpose: "HOOK", assetId: "img-1", duration: 3 }],
    }, {
      projectId: "proj-1",
      allowedAssetIds: ["img-1"],
      targetDurationSeconds: 15,
      productionMode: "AI_PRODUCT_MOTION",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /projectId/i.test(error))).toBe(true);
  });

  it("redacts host capacity from public Ollama readiness", () => {
    const publicReport = toPublicOllamaReadiness({
      ready: false,
      status: "UNAVAILABLE",
      installationStatus: "NOT_INSTALLED",
      ollamaInstalled: false,
      ollamaReachable: false,
      disabled: false,
      baseUrl: "http://127.0.0.1:11434",
      installedModels: [],
      selectedModel: null,
      recommendedAction: "defer",
      modelStrategy: {
        tier: "none",
        recommendedModelIds: [],
        selectedInstalledModel: null,
        reason: "test",
        safeToInstall: false,
        maxConcurrent: 1,
      },
      cpuCores: 8,
      totalMemoryGb: 3.3,
      freeMemoryGb: 1.1,
      loadAverage: [4, 3, 2],
      notes: ["Ollama not installed"],
      fallbackActive: true,
    });
    expect(publicReport.autoInstallDisabled).toBe(true);
    expect(publicReport.fallbackActive).toBe(true);
    expect(publicReport.installationStatus).toBe("NOT_INSTALLED");
    expect(JSON.stringify(publicReport)).not.toContain("127.0.0.1");
    expect(JSON.stringify(publicReport)).not.toContain("cpuCores");
    expect(JSON.stringify(publicReport)).not.toContain("3.3");
  });

  it("detects stale timeline asset IDs against current originals", () => {
    expect(timelineUsesStaleAssets(
      [{ id: "img-new", origin: "upload", mimeType: "image/png" }],
      [{ assetId: "img-old" } as never],
    )).toBe(true);
    expect(timelineUsesStaleAssets(
      [{ id: "img-new", origin: "upload", mimeType: "image/png" }],
      [{ assetId: "img-new" } as never],
    )).toBe(false);
  });

  it("caps render progress until the video file is verified", () => {
    expect(displayProductionProgress({
      verified: false,
      uiStage: "awaiting-output",
      jobProgress: 100,
      localProgress: 100,
    })).toBeLessThan(100);
    expect(displayProductionProgress({
      verified: true,
      uiStage: "completed",
      jobProgress: 100,
      localProgress: 100,
    })).toBe(100);
  });
});
