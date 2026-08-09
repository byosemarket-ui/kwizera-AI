import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 600_000;

describe("Professional Self-Review & Evaluation (Step 7)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-self-review-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-self-review-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "reviews multi-domain professional output with evaluation and quality scores",
    async () => {
      const engine = core.getManager().selfReviewEngine!;
      const result = await engine.reviewProfessional({
        request:
          "self-review a professional camera lighting marketing and social media product advertisement recommendation",
        objective: "Self-review product advertisement output",
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "marketing-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarReviews: true,
      });

      expect(result.grounded).toBe(true);
      expect(result.unsupported).toBe(false);
      expect(result.framework.evaluationScores.length).toBeGreaterThanOrEqual(8);
      expect(result.framework.qualityScores.overallReadiness).toBeGreaterThan(0);
      expect(result.relatedReasoningId).toBeTruthy();
      expect(fs.existsSync(path.join(storageRoot, "self-review", "professional-self-review-memory.jsonl"))).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "reuses equivalent reviews and keeps certification disabled",
    async () => {
      const engine = core.getManager().selfReviewEngine!;
      const first = await engine.reviewProfessional({
        request: "self-review lighting composition storytelling marketing recommendation",
        objective: "Self-review lighting composition output",
        requiredDomains: [
          "lighting-knowledge",
          "composition-knowledge",
          "storytelling-knowledge",
          "marketing-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarReviews: true,
      });
      const second = await engine.reviewProfessional({
        request: "self-review lighting composition storytelling marketing recommendation",
        objective: "Self-review lighting composition output",
        requiredDomains: [
          "lighting-knowledge",
          "composition-knowledge",
          "storytelling-knowledge",
          "marketing-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarReviews: true,
      });
      const explained = engine.explainProfessionalSelfReview(second.reviewId);
      const awareness = engine.getAiMeProfessionalSelfReviewAwareness();
      const multiDomainAwareness = core.getManager().multiDomainEngine!.getAiMeProfessionalMultiDomainAwareness();

      expect(second.reused || second.framework.improvedRecommendation === first.framework.improvedRecommendation).toBe(true);
      expect(explained.strengths.length + explained.weaknesses.length).toBeGreaterThan(0);
      expect(awareness.professionalReasoningCertificationEnabled).toBe(true);
      expect(multiDomainAwareness.selfReviewEnabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "health check reports self-review capability",
    async () => {
      const engine = core.getManager().selfReviewEngine!;
      const health = await engine.runProfessionalSelfReviewHealthCheck();
      expect(health.canSelfReview).toBe(true);
      expect(health.memoryWritable).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
