import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 600_000;

describe("Professional Workflow Intelligence (Step 4)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-workflow-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-workflow-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "creates a grounded multi-domain professional workflow with dependencies",
    async () => {
      const engine = core.getManager().workflowEngine!;
      const result = await engine.createProfessionalWorkflow({
        request: "create a professional workflow for camera lighting marketing and social media product advertisement",
        objective: "Coordinate a professional product advertisement workflow",
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "marketing-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
        includeDomainModules: true,
        reuseSimilarWorkflows: true,
      });

      expect(result.grounded).toBe(true);
      expect(result.unsupported).toBe(false);
      expect(result.definition.workflowName).toBeTruthy();
      expect(result.definition.mainTasks.length).toBeGreaterThan(0);
      expect(result.definition.validationSteps.length).toBeGreaterThan(0);
      expect(result.definition.dependencies.length).toBeGreaterThan(0);
      expect(result.definition.executionOrder.length).toBe(result.definition.allTasks.length);
      expect(result.relatedPlanId).toBeTruthy();
      expect(fs.existsSync(path.join(storageRoot, "workflows", "professional-workflow-memory.jsonl"))).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "reuses equivalent workflows and supports optimize/modify/execute/explain",
    async () => {
      const engine = core.getManager().workflowEngine!;
      const first = await engine.createProfessionalWorkflow({
        request: "create a professional workflow for lighting composition product video",
        objective: "Lighting composition workflow",
        requiredDomains: ["lighting-knowledge", "composition-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
        reuseSimilarWorkflows: true,
      });
      const second = await engine.createProfessionalWorkflow({
        request: "create a professional workflow for lighting composition product video",
        objective: "Lighting composition workflow",
        requiredDomains: ["lighting-knowledge", "composition-knowledge", "industry-standards-knowledge"],
        includeDomainModules: true,
        reuseSimilarWorkflows: true,
      });
      const modified = engine.modifyProfessionalWorkflow(second.workflowId, {
        addRecoverySteps: ["Notify operator on repeated validation failure"],
        notes: "Added operator notification recovery",
      });
      const optimized = engine.optimizeProfessionalWorkflow(modified.workflowId);
      const explained = engine.explainProfessionalWorkflow(optimized.workflowId);
      const execution = engine.executeProfessionalWorkflow(optimized.workflowId);
      const improvements = engine.detectProfessionalWorkflowImprovements(optimized.workflowId);

      expect(second.reused || second.memoryRecord.priorWorkflowIds.includes(first.workflowId)).toBe(true);
      expect(modified.definition.recoverySteps.some((step) => step.includes("operator"))).toBe(true);
      expect(optimized.definition.estimatedExecutionMinutes).toBeLessThanOrEqual(modified.definition.estimatedExecutionMinutes);
      expect(explained.workflowId).toBe(optimized.workflowId);
      expect(execution.executionHistory.length).toBeGreaterThan(0);
      expect(improvements.length).toBeGreaterThan(0);
      expect(engine.getAiMeProfessionalWorkflowAwareness().recommendationIntelligenceEnabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "keeps professional workflow intelligence healthy",
    async () => {
      const engine = core.getManager().workflowEngine!;
      let health = await engine.runProfessionalWorkflowHealthCheck();
      if (!health.healthy) {
        const repair = await engine.repairProfessionalWorkflowIntelligence();
        expect(repair.repaired || repair.remainingIssues.length === 0).toBe(true);
        health = await engine.runProfessionalWorkflowHealthCheck();
      }
      expect(health.healthy).toBe(true);
      expect(health.canCreateWorkflow).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
