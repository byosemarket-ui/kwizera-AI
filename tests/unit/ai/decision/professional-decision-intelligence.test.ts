import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 600_000;

describe("Professional Decision Intelligence (Step 2)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-decision-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-decision-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "makes a grounded multi-domain professional decision with full framework",
    async () => {
      const engine = core.getManager().decisionEngine!;
      const result = await engine.decideProfessional({
        request: "decide camera lighting composition and social media approach for a product advertisement",
        objective: "Select the best professional approach for a product ad",
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "composition-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
      });

      expect(result.grounded).toBe(true);
      expect(result.unsupported).toBe(false);
      expect(result.framework.finalRecommendation).toBeTruthy();
      expect(result.framework.availableOptions.length).toBeGreaterThan(0);
      expect(result.framework.advantages.length + result.framework.disadvantages.length).toBeGreaterThan(0);
      expect(result.framework.professionalStandards.length + result.framework.bestPractices.length).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(50);
      expect(result.explanation.whySelected.toLowerCase()).toMatch(/selected|because|confidence/);
      expect(result.explanation.knowledgeIdsUsed.length + result.explanation.knowledgePacksUsed.length).toBeGreaterThan(0);
      expect(result.memoryRecord.decisionId).toBe(result.decisionId);
      expect(result.memoryRecord.reasoningPath.length).toBeGreaterThan(0);
      expect(result.memoryRecord.timestamp).toBeTruthy();
      expect(fs.existsSync(path.join(storageRoot, "decisions", "professional-decision-memory.jsonl"))).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "uses decision history to improve consistency on a similar follow-up decision",
    async () => {
      const engine = core.getManager().decisionEngine!;
      const first = await engine.decideProfessional({
        request: "recommend professional lighting for a luxury product video",
        objective: "Luxury product lighting decision",
        context: { product: "luxury watch", audience: "affluent buyers" },
        requiredDomains: ["lighting-knowledge", "camera-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
      });
      const second = await engine.decideProfessional({
        request: "recommend professional lighting for a luxury product video advertisement",
        objective: "Luxury product lighting decision",
        context: { product: "luxury watch", audience: "affluent buyers" },
        requiredDomains: ["lighting-knowledge", "camera-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
      });

      expect(first.grounded).toBe(true);
      expect(second.grounded).toBe(true);
      expect(second.learnedFromHistory).toBe(true);
      expect(second.memoryRecord.priorDecisionIds.length).toBeGreaterThan(0);
      expect(engine.getProfessionalDecisionHistory().length).toBeGreaterThanOrEqual(2);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "refuses unsupported decisions when editing knowledge is missing",
    async () => {
      const engine = core.getManager().decisionEngine!;
      const result = await engine.decideProfessional({
        request: "decide a complete professional video editing cut and timeline strategy with no other guidance",
        objective: "Editing-only decision",
        requiredDomains: ["video-editing-knowledge"],
        includeDomainModules: true,
      });

      expect(result.missingInformation.some((item) => item.field.includes("video-editing")) || result.unsupported || result.confidenceScore < 80).toBe(
        true
      );
      expect(engine.getAiMeProfessionalDecisionAwareness().planningIntelligenceEnabled).toBe(true);
      expect(engine.getAiMeProfessionalDecisionAwareness().enabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "health check and repair keep professional decision intelligence healthy",
    async () => {
      const engine = core.getManager().decisionEngine!;
      let health = await engine.runProfessionalDecisionHealthCheck();
      if (!health.healthy) {
        const repair = await engine.repairProfessionalDecisionIntelligence();
        expect(repair.repaired || repair.remainingIssues.length === 0).toBe(true);
        health = await engine.runProfessionalDecisionHealthCheck();
      }
      expect(health.healthy).toBe(true);
      expect(health.canDecide).toBe(true);
      expect(health.memoryWritable).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
