import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 600_000;

describe("Professional Multi-Domain Reasoning (Step 6)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-multi-domain-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-multi-domain-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "combines multiple domains with conflict-aware cross-domain analysis",
    async () => {
      const engine = core.getManager().multiDomainEngine!;
      const result = await engine.reasonMultiDomain({
        request:
          "multi-domain reason about camera lighting marketing and social media product advertisement",
        objective: "Cross-domain product advertisement reasoning",
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "marketing-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarReasoning: true,
      });

      expect(result.grounded).toBe(true);
      expect(result.unsupported).toBe(false);
      expect(result.framework.domainsParticipating.length).toBeGreaterThanOrEqual(3);
      expect(result.framework.crossDomainAnalysis.length).toBeGreaterThanOrEqual(6);
      expect(result.framework.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.framework.combinedRecommendation.length).toBeGreaterThan(20);
      expect(result.relatedRecommendationId).toBeTruthy();
      expect(fs.existsSync(path.join(storageRoot, "multi-domain", "professional-multi-domain-memory.jsonl"))).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "reuses equivalent multi-domain reasoning and keeps self-review disabled",
    async () => {
      const engine = core.getManager().multiDomainEngine!;
      const first = await engine.reasonMultiDomain({
        request: "multi-domain reason about lighting composition storytelling marketing",
        objective: "Lighting composition multi-domain reasoning",
        requiredDomains: [
          "lighting-knowledge",
          "composition-knowledge",
          "storytelling-knowledge",
          "marketing-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarReasoning: true,
      });
      const second = await engine.reasonMultiDomain({
        request: "multi-domain reason about lighting composition storytelling marketing",
        objective: "Lighting composition multi-domain reasoning",
        requiredDomains: [
          "lighting-knowledge",
          "composition-knowledge",
          "storytelling-knowledge",
          "marketing-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarReasoning: true,
      });
      const explained = engine.explainMultiDomainReasoning(second.reasoningId);
      const awareness = engine.getAiMeProfessionalMultiDomainAwareness();
      const recommendationAwareness = core.getManager().recommendationEngine!.getAiMeProfessionalRecommendationAwareness();

      expect(second.reused || second.framework.combinedRecommendation === first.framework.combinedRecommendation).toBe(true);
      expect(explained.domainsParticipating.length).toBeGreaterThanOrEqual(2);
      expect(awareness.selfReviewEnabled).toBe(true);
      expect(recommendationAwareness.multiDomainReasoningEnabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "health check reports multi-domain capability",
    async () => {
      const engine = core.getManager().multiDomainEngine!;
      const health = await engine.runMultiDomainHealthCheck();
      expect(health.canReasonMultiDomain).toBe(true);
      expect(health.memoryWritable).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
