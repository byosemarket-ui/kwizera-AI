import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-planning-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 3");
  console.log("Planning Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-planning-intelligence");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().planningEngine!;

    const awareness = engine.getAiMeProfessionalPlanningAwareness();
    results.aiMeAwareness = {
      passed: awareness.available && awareness.enabled && awareness.groundedInKnowledgeFoundation && awareness.workflowIntelligenceEnabled,
      detail: `available=${awareness.available}; enabled=${awareness.enabled}; workflow=${awareness.workflowIntelligenceEnabled}`,
    };

    const plan = await engine.planProfessional({
      request: "create a professional plan for camera lighting storytelling marketing and social media product advertisement",
      objective: "Multi-domain professional product ad plan",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
      reuseSimilarPlans: true,
    });

    results.planningQuality = {
      passed:
        plan.grounded &&
        !plan.unsupported &&
        Boolean(plan.framework.goal) &&
        plan.framework.requirements.length > 0 &&
        plan.framework.professionalWorkflow.length > 0 &&
        plan.confidenceScore > 50,
      detail: `grounded=${plan.grounded}; tasks=${plan.framework.taskBreakdown.length}; confidence=${plan.confidenceScore}`,
    };

    results.taskDecomposition = {
      passed:
        plan.framework.taskBreakdown.some((task) => task.kind === "main") &&
        plan.framework.taskBreakdown.some((task) => task.kind === "sub" || task.kind === "parallel") &&
        plan.framework.taskBreakdown.some((task) => task.kind === "validation") &&
        plan.framework.stepOrder.length === plan.framework.taskBreakdown.length,
      detail: `main=${plan.framework.taskBreakdown.filter((t) => t.kind === "main").length}; subOrParallel=${plan.framework.taskBreakdown.filter((t) => t.kind === "sub" || t.kind === "parallel").length}; validation=${plan.framework.taskBreakdown.filter((t) => t.kind === "validation").length}`,
    };

    results.dependencyDetection = {
      passed: plan.framework.dependencies.length > 0 && plan.framework.dependencies.every((dep) => dep.fromTaskId && dep.toTaskId && dep.reason),
      detail: `dependencies=${plan.framework.dependencies.length}; parallelGroups=${plan.framework.parallelTasks.length}`,
    };

    const followUp = await engine.planProfessional({
      request: "create a professional plan for camera lighting storytelling marketing and social media product advertisement",
      objective: "Multi-domain professional product ad plan",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
      reuseSimilarPlans: true,
    });

    results.planConsistency = {
      passed: followUp.grounded && followUp.memoryRecord.priorPlanIds.includes(plan.planId),
      detail: `priorIncludesFirst=${followUp.memoryRecord.priorPlanIds.includes(plan.planId)}`,
    };

    results.knowledgeUsage = {
      passed:
        plan.explanation.knowledgeIdsUsed.length + plan.explanation.knowledgePacksUsed.length > 0 &&
        plan.memoryRecord.knowledgeUsed.length > 0 &&
        Boolean(plan.relatedDecisionId),
      detail: `knowledgeIds=${plan.explanation.knowledgeIdsUsed.length}; packs=${plan.explanation.knowledgePacksUsed.length}; decision=${Boolean(plan.relatedDecisionId)}`,
    };

    const memoryPath = path.join(storageRoot, "plans", "professional-plan-memory.jsonl");
    results.planningMemory = {
      passed: fs.existsSync(memoryPath) && engine.getProfessionalPlanHistory().length >= 2,
      detail: `pathExists=${fs.existsSync(memoryPath)}; count=${engine.getProfessionalPlanHistory().length}`,
    };

    const modified = engine.modifyProfessionalPlan(plan.planId, {
      addRecommendations: ["Keep platform-native vertical framing"],
      notes: "Validation modification",
    });
    const optimized = engine.optimizeProfessionalPlan(modified.planId);
    results.modifyOptimize = {
      passed:
        modified.framework.recommendations.some((item) => item.includes("vertical")) &&
        optimized.framework.estimatedExecutionMinutes <= modified.framework.estimatedExecutionMinutes,
      detail: `modifiedRecs=${modified.framework.recommendations.length}; optimizedMinutes=${optimized.framework.estimatedExecutionMinutes}`,
    };

    let health = await engine.runProfessionalPlanningHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repairProfessionalPlanningIntelligence();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runProfessionalPlanningHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canPlan && health.memoryWritable,
      detail: `healthy=${health.healthy}; canPlan=${health.canPlan}; memoryWritable=${health.memoryWritable}`,
    };

    results.workflowIntelligenceAvailable = {
      passed: awareness.workflowIntelligenceEnabled,
      detail: "Workflow Intelligence is enabled and consumes Professional Plans",
    };

    await core.stop();
  } finally {
    if (useTemp) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
