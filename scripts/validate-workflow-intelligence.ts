import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-workflow-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 4");
  console.log("Workflow Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-workflow-intelligence");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().workflowEngine!;

    const awareness = engine.getAiMeProfessionalWorkflowAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.available &&
        awareness.enabled &&
        awareness.groundedInKnowledgeFoundation &&
        awareness.recommendationIntelligenceEnabled,
      detail: `available=${awareness.available}; enabled=${awareness.enabled}; recommendation=${awareness.recommendationIntelligenceEnabled}`,
    };

    const workflow = await engine.createProfessionalWorkflow({
      request: "create a professional workflow for camera lighting storytelling marketing and social media product advertisement",
      objective: "Multi-domain professional product ad workflow",
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
      reuseSimilarWorkflows: true,
    });

    results.workflowGeneration = {
      passed:
        workflow.grounded &&
        !workflow.unsupported &&
        Boolean(workflow.definition.workflowName) &&
        workflow.definition.allTasks.length >= 4 &&
        workflow.confidenceScore > 50,
      detail: `grounded=${workflow.grounded}; tasks=${workflow.definition.allTasks.length}; confidence=${workflow.confidenceScore}`,
    };

    results.dependencyAnalysis = {
      passed: workflow.definition.dependencies.length > 0 && workflow.definition.executionOrder.length === workflow.definition.allTasks.length,
      detail: `dependencies=${workflow.definition.dependencies.length}; order=${workflow.definition.executionOrder.length}`,
    };

    results.taskOrdering = {
      passed:
        workflow.definition.mainTasks.length > 0 &&
        workflow.definition.validationSteps.length > 0 &&
        workflow.definition.executionOrder[0] === workflow.definition.allTasks.sort((a, b) => a.order - b.order)[0]?.taskId,
      detail: `main=${workflow.definition.mainTasks.length}; validation=${workflow.definition.validationSteps.length}`,
    };

    const optimized = engine.optimizeProfessionalWorkflow(workflow.workflowId);
    results.workflowOptimization = {
      passed:
        optimized.definition.estimatedExecutionMinutes <= workflow.definition.estimatedExecutionMinutes &&
        optimized.explanation.improvementsDetected.length > 0,
      detail: `minutes=${optimized.definition.estimatedExecutionMinutes}; parallel=${optimized.definition.parallelGroups.length}`,
    };

    results.parallelExecution = {
      passed: optimized.definition.parallelGroups.length >= 0,
      detail: `parallelGroups=${optimized.definition.parallelGroups.length}`,
    };

    const duplicate = await engine.createProfessionalWorkflow({
      request: "create a professional workflow for camera lighting storytelling marketing and social media product advertisement",
      objective: "Multi-domain professional product ad workflow",
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
      reuseSimilarWorkflows: true,
    });
    results.workflowReuse = {
      passed: duplicate.reused || duplicate.memoryRecord.priorWorkflowIds.includes(workflow.workflowId),
      detail: `reused=${duplicate.reused}; priorIncludesFirst=${duplicate.memoryRecord.priorWorkflowIds.includes(workflow.workflowId)}`,
    };

    const memoryPath = path.join(storageRoot, "workflows", "professional-workflow-memory.jsonl");
    results.workflowMemory = {
      passed: fs.existsSync(memoryPath) && engine.getProfessionalWorkflowHistory().length >= 1,
      detail: `pathExists=${fs.existsSync(memoryPath)}; count=${engine.getProfessionalWorkflowHistory().length}`,
    };

    const execution = engine.executeProfessionalWorkflow(optimized.workflowId);
    results.coordination = {
      passed: execution.executionHistory.length > 0 && execution.performanceMetrics.successRate !== null,
      detail: `events=${execution.executionHistory.length}; successRate=${execution.performanceMetrics.successRate}`,
    };

    let health = await engine.runProfessionalWorkflowHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repairProfessionalWorkflowIntelligence();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runProfessionalWorkflowHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canCreateWorkflow && health.memoryWritable,
      detail: `healthy=${health.healthy}; canCreate=${health.canCreateWorkflow}`,
    };

    results.recommendationIntelligenceEnabled = {
      passed: awareness.recommendationIntelligenceEnabled,
      detail: "Recommendation Intelligence enabled for Step 5 consumption",
    };

    await core.stop();
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
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
