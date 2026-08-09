import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 600_000;

describe("Professional Planning Intelligence (Step 3)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-planning-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-planning-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "creates a grounded multi-domain professional plan with tasks and dependencies",
    async () => {
      const engine = core.getManager().planningEngine!;
      const result = await engine.planProfessional({
        request: "create a professional plan for camera lighting marketing and social media product advertisement",
        objective: "Plan a professional product advertisement",
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "marketing-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarPlans: true,
      });

      expect(result.grounded).toBe(true);
      expect(result.unsupported).toBe(false);
      expect(result.framework.goal).toBeTruthy();
      expect(result.framework.taskBreakdown.length).toBeGreaterThanOrEqual(4);
      expect(result.framework.taskBreakdown.some((task) => task.kind === "main")).toBe(true);
      expect(result.framework.taskBreakdown.some((task) => task.kind === "validation")).toBe(true);
      expect(result.framework.dependencies.length).toBeGreaterThan(0);
      expect(result.framework.stepOrder.length).toBe(result.framework.taskBreakdown.length);
      expect(result.framework.estimatedExecutionMinutes).toBeGreaterThan(0);
      expect(result.explanation.knowledgePacksUsed.length + result.explanation.knowledgeIdsUsed.length).toBeGreaterThan(0);
      expect(result.relatedDecisionId).toBeTruthy();
      expect(fs.existsSync(path.join(storageRoot, "plans", "professional-plan-memory.jsonl"))).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "modifies and optimizes plans and can explain them",
    async () => {
      const engine = core.getManager().planningEngine!;
      const created = await engine.planProfessional({
        request: "create a professional plan for lighting composition product video",
        objective: "Lighting plan",
        requiredDomains: ["lighting-knowledge", "composition-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
      });
      const modified = engine.modifyProfessionalPlan(created.planId, {
        addRequirements: ["Keep brand-safe soft lighting"],
        notes: "Added brand-safe lighting requirement",
      });
      const optimized = engine.optimizeProfessionalPlan(modified.planId);
      const explained = engine.explainProfessionalPlan(optimized.planId);

      expect(modified.framework.requirements.some((item) => item.includes("brand-safe"))).toBe(true);
      expect(optimized.framework.recommendations.some((item) => /parallel/i.test(item))).toBe(true);
      expect(explained.planId).toBe(optimized.planId);
      expect(explained.whySelected.toLowerCase()).toContain("optim");
      expect(engine.getAiMeProfessionalPlanningAwareness().workflowIntelligenceEnabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "reuses similar plans and keeps planning memory healthy",
    async () => {
      const engine = core.getManager().planningEngine!;
      const first = await engine.planProfessional({
        request: "create a professional plan for social media product advertisement lighting",
        objective: "Social product ad plan",
        context: { product: "serum", platform: "tiktok" },
        requiredDomains: ["lighting-knowledge", "social-media-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
        reuseSimilarPlans: true,
      });
      const second = await engine.planProfessional({
        request: "create a professional plan for social media product advertisement lighting",
        objective: "Social product ad plan",
        context: { product: "serum", platform: "tiktok" },
        requiredDomains: ["lighting-knowledge", "social-media-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
        reuseSimilarPlans: true,
      });

      expect(first.grounded).toBe(true);
      expect(second.memoryRecord.priorPlanIds.length).toBeGreaterThan(0);
      expect(engine.getProfessionalPlanHistory().length).toBeGreaterThanOrEqual(2);

      let health = await engine.runProfessionalPlanningHealthCheck();
      if (!health.healthy) {
        const repair = await engine.repairProfessionalPlanningIntelligence();
        expect(repair.repaired || repair.remainingIssues.length === 0).toBe(true);
        health = await engine.runProfessionalPlanningHealthCheck();
      }
      expect(health.healthy).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
