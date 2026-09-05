import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const fetchOllamaTags = vi.fn();
const ollamaGenerateJson = vi.fn();
const isOllamaDisabled = vi.fn(() => false);

vi.mock("../../../../ai/ai-provider/ollama-client.js", () => ({
  fetchOllamaTags: (...args: unknown[]) => fetchOllamaTags(...args),
  ollamaGenerateJson: (...args: unknown[]) => ollamaGenerateJson(...args),
  isOllamaDisabled: () => isOllamaDisabled(),
  ollamaBaseUrl: () => "http://127.0.0.1:11434",
  ollamaTimeoutMs: () => 30_000,
  preferredReasoningModelId: () => "llama3.2:1b",
  selectPreferredReasoningModel: (models: Array<{ name: string }>, preferred: string) =>
    models.find((m) => m.name === preferred)?.name
    ?? models.find((m) => m.name.includes("llama"))?.name
    ?? null,
  parseJsonObject: (text: string) => {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < 0) return null;
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  },
}));

import {
  OllamaAdapter,
  resetOllamaAdapterForTests,
} from "../../../../ai/ai-provider/ollama-adapter.js";
import {
  buildAiCacheKey,
  getCachedAiResult,
  setCachedAiResult,
  invalidateAiCache,
} from "../../../../ai/ai-provider/ai-response-cache.js";
import {
  retrieveVideoKnowledge,
  getVideoKnowledgePackMeta,
  VIDEO_KNOWLEDGE_PACK_VERSION,
} from "../../../../ai/video-knowledge-engine/video-knowledge-pack.js";
import {
  mapTransitionToSupported,
  selectApplicableSkills,
  listVideoSkills,
} from "../../../../ai/video-skills/video-skills.js";
import {
  OllamaCreativeAdvisor,
  normalizeAdvisorContext,
} from "../../../../ai/creative-planning/ollama-creative-advisor.js";
import { buildCreativeQualityReport } from "../../../../ai/video-production/creative-quality-report.js";
import {
  recordProductionLearning,
  getProductionLearning,
  clearProductionLearningForTests,
} from "../../../../ai/creative-planning/production-learning-loop.js";

describe("Ollama deep integration", () => {
  beforeEach(() => {
    resetOllamaAdapterForTests();
    invalidateAiCache();
    clearProductionLearningForTests();
    isOllamaDisabled.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adapter health is not READY on tags alone when probe fails", async () => {
    fetchOllamaTags.mockResolvedValue({
      ok: true,
      status: "READY",
      models: [{ name: "llama3.2:1b", size: 1 }],
    });
    ollamaGenerateJson.mockResolvedValue({
      ok: false,
      code: "MODEL_TIMEOUT",
      error: "timeout",
    });

    const health = await new OllamaAdapter().health({ probeInference: true });
    expect(health.code).toBe("OLLAMA_TIMEOUT");
    expect(health.ready).toBe(false);
    expect(health.probedInference).toBe(true);
  });

  it("adapter READY only after structured probe", async () => {
    fetchOllamaTags.mockResolvedValue({
      ok: true,
      status: "READY",
      models: [{ name: "llama3.2:1b", size: 1 }],
    });
    ollamaGenerateJson.mockResolvedValue({
      ok: true,
      text: '{"ok":true,"ping":"kwizera"}',
    });

    const health = await new OllamaAdapter().health({ probeInference: true });
    expect(health.code).toBe("OLLAMA_READY");
    expect(health.ready).toBe(true);
  });

  it("generateStructured rejects malformed JSON", async () => {
    fetchOllamaTags.mockResolvedValue({
      ok: true,
      status: "READY",
      models: [{ name: "llama3.2:1b", size: 1 }],
    });
    ollamaGenerateJson.mockResolvedValue({
      ok: true,
      text: "not json at all",
    });

    const result = await new OllamaAdapter().generateStructured({ prompt: "x" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("OLLAMA_INVALID_RESPONSE");
  });

  it("knowledge pack retrieves relevant rules only", () => {
    const meta = getVideoKnowledgePackMeta();
    expect(meta.version).toBe(VIDEO_KNOWLEDGE_PACK_VERSION);
    expect(meta.count).toBeGreaterThan(5);

    const fashion = retrieveVideoKnowledge("high-energy fashion product video hook reveal beat", 4);
    expect(fashion.length).toBeGreaterThan(0);
    expect(fashion.every((item) => item.sourceType === "curated")).toBe(true);
  });

  it("maps unsupported transitions to cut/fade only", () => {
    expect(mapTransitionToSupported("whip pan")).toBe("cut");
    expect(mapTransitionToSupported("soft dissolve")).toBe("fade");
    expect(mapTransitionToSupported("masked wipe")).toBe("cut");
  });

  it("selects applicable video skills", () => {
    const skills = selectApplicableSkills({
      task: "product marketing reveal cta",
      hasCta: true,
      imageCount: 3,
      tone: "energetic",
    });
    expect(listVideoSkills().length).toBeGreaterThanOrEqual(4);
    expect(skills.some((s) => s.skill.id === "supported-transition-map")).toBe(true);
    expect(skills.some((s) => s.skill.id === "final-cta")).toBe(true);
  });

  it("advisor falls back when Ollama unavailable", async () => {
    fetchOllamaTags.mockResolvedValue({
      ok: false,
      status: "UNAVAILABLE",
      models: [],
      error: "down",
    });

    const advisor = new OllamaCreativeAdvisor();
    const result = await advisor.analyzeProductForVideo(normalizeAdvisorContext({
      projectId: "proj-a",
      productName: "Shoe",
      productCategory: "Fashion",
      targetAudience: "Youth",
      imageRoles: ["HERO", "DETAIL"],
      creativeMode: "energetic",
    }));

    expect(result.source).toBe("deterministic-fallback");
    expect(result.recommendedSceneStructure.length).toBeGreaterThan(0);
    expect(result.recommendedTransitions.every((t) => t === "cut" || t === "fade")).toBe(true);
  });

  it("advisor rejects hallucinated asset IDs via fallback", async () => {
    fetchOllamaTags.mockResolvedValue({
      ok: true,
      status: "READY",
      models: [{ name: "llama3.2:1b", size: 1 }],
    });
    ollamaGenerateJson.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        productType: "Shoe",
        targetAudience: "Youth",
        visualStyle: "Clean",
        recommendedPacing: "tight",
        recommendedMotion: "PRODUCT_FOCUS",
        recommendedSceneStructure: ["HOOK", "CTA"],
        recommendedTransitions: ["whip"],
        imageSequenceHint: ["does-not-exist"],
        confidence: 0.9,
      }),
    });

    const advisor = new OllamaCreativeAdvisor();
    const result = await advisor.analyzeProductForVideo({
      projectId: "proj-b",
      productName: "Shoe",
      category: "Fashion",
      assetSummaries: [{ assetId: "img-1", fileName: "a.png", viewRole: "HERO" }],
    });
    expect(result.source).toBe("deterministic-fallback");
  });

  it("caches AI results with project isolation keys", () => {
    const keyA = buildAiCacheKey({
      task: "analyzeProductForVideo",
      model: "llama3.2:1b",
      promptVersion: "v1",
      projectId: "proj-a",
      knowledgeVersion: "k1",
    });
    const keyB = buildAiCacheKey({
      task: "analyzeProductForVideo",
      model: "llama3.2:1b",
      promptVersion: "v1",
      projectId: "proj-b",
      knowledgeVersion: "k1",
    });
    expect(keyA).not.toBe(keyB);
    setCachedAiResult(keyA, { ok: true });
    expect(getCachedAiResult(keyA)).toEqual({ ok: true });
    expect(getCachedAiResult(keyB)).toBeNull();
  });

  it("builds creative quality report deterministically", () => {
    const report = buildCreativeQualityReport({
      scenePurposes: ["HOOK", "REVEAL", "CTA"],
      durationsSec: [3, 3, 2.5],
      transitions: ["cut", "cut", "fade"],
      hasCta: true,
      hasEndCard: true,
      beatAlignedCuts: 1,
      totalBeats: 8,
    });
    expect(report.checks.productVisibility).toBe(true);
    expect(report.checks.ctaVisibility).toBe(true);
    expect(report.band).not.toBe("LOW");
  });

  it("records production learning per project only", () => {
    recordProductionLearning({
      projectId: "proj-a",
      createdAt: new Date().toISOString(),
      creativeMode: "energetic",
      sceneDurationsMs: [3000],
      transitions: ["cut"],
      motions: ["PRODUCT_FOCUS"],
      audioTimingSummary: null,
      qualityScore: 0.9,
      userApproved: true,
      advisorSource: "deterministic-fallback",
      knowledgeVersion: VIDEO_KNOWLEDGE_PACK_VERSION,
      skillsVersion: "video-skills-v1",
    });
    expect(getProductionLearning("proj-a")).toHaveLength(1);
    expect(getProductionLearning("proj-b")).toHaveLength(0);
  });
});
