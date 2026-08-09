import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 600_000;

describe("Professional Recommendation Intelligence (Step 5)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-recommendation-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-recommendation-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "creates a grounded multi-domain recommendation with ranked alternatives",
    async () => {
      const engine = core.getManager().recommendationEngine!;
      const result = await engine.recommendProfessional({
        request: "recommend a professional camera lighting marketing and social media product advertisement approach",
        objective: "Recommend a professional product advertisement approach",
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "marketing-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarRecommendations: true,
      });

      expect(result.grounded).toBe(true);
      expect(result.unsupported).toBe(false);
      expect(result.framework.recommendedSolution.length).toBeGreaterThan(20);
      expect(result.framework.alternativeSolutions.length).toBeGreaterThanOrEqual(2);
      expect(result.explanation.workflowsConsidered.length).toBeGreaterThan(0);
      expect(result.relatedWorkflowId).toBeTruthy();
      expect(fs.existsSync(path.join(storageRoot, "recommendations", "professional-recommendation-memory.jsonl"))).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "reuses equivalent recommendations and records feedback",
    async () => {
      const engine = core.getManager().recommendationEngine!;
      const first = await engine.recommendProfessional({
        request: "recommend a professional lighting composition product video approach",
        objective: "Lighting composition recommendation",
        requiredDomains: ["lighting-knowledge", "composition-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
        reuseSimilarRecommendations: true,
      });
      const second = await engine.recommendProfessional({
        request: "recommend a professional lighting composition product video approach",
        objective: "Lighting composition recommendation",
        requiredDomains: ["lighting-knowledge", "composition-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
        reuseSimilarRecommendations: true,
      });
      const explained = engine.explainProfessionalRecommendation(second.recommendationId);
      const withFeedback = engine.recordProfessionalRecommendationFeedback(second.recommendationId, "Clear and useful");
      const awareness = engine.getAiMeProfessionalRecommendationAwareness();
      const workflowAwareness = core.getManager().workflowEngine!.getAiMeProfessionalWorkflowAwareness();

      expect(second.reused || second.memoryRecord.priorRecommendationIds.includes(first.recommendationId)).toBe(true);
      expect(explained.whySelected.length).toBeGreaterThan(20);
      expect(withFeedback.memoryRecord.userFeedback).toBe("Clear and useful");
      expect(awareness.enabled).toBe(true);
      expect(awareness.multiDomainReasoningEnabled).toBe(true);
      expect(workflowAwareness.recommendationIntelligenceEnabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "health check reports recommend capability",
    async () => {
      const engine = core.getManager().recommendationEngine!;
      const health = await engine.runProfessionalRecommendationHealthCheck();
      expect(health.canRecommend).toBe(true);
      expect(health.memoryWritable).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
