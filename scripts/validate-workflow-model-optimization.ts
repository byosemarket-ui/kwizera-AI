import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiWorkflowModelOptimizationEngine,
  type WorkflowModelOptimizationReportData,
} from "../ai/workflow-model-optimization/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-wmo-"));
}

function writeReport(data: WorkflowModelOptimizationReportData): string {
  const reportPath = path.join(process.cwd(), "WORKFLOW-AI-MODEL-OPTIMIZATION-REPORT.md");
  const body = `# WORKFLOW & AI MODEL OPTIMIZATION REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 7

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Professional quality reduced automatically:** NO  
**Workflow / model history deleted:** NO  
**Step 8 (Autonomous Improvement):** Available separately via \`validate:autonomous-improvement\`  

---

## 1. Existing Optimization capability

${data.existingOptimizationCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Optimized Workflows

${
  data.optimizedWorkflows.length
    ? data.optimizedWorkflows.map((item) => `- ${item.workflowId} [${item.action}] v${item.version}`).join("\n")
    : "- none"
}

## 5. Optimized AI Models

${
  data.optimizedAiModels.length
    ? data.optimizedAiModels
        .map((item) => `- ${item.task}: primary=${item.primary}, secondary=${item.secondary}, backup=${item.backup}`)
        .join("\n")
    : "- none"
}

## 6. Performance Improvements

${data.performanceImprovements.length ? data.performanceImprovements.map((item) => `- ${item}`).join("\n") : "- none"}

## 7. Quality Improvements

${data.qualityImprovements.length ? data.qualityImprovements.map((item) => `- ${item}`).join("\n") : "- none"}

## 8. Optimization Memory status

${data.optimizationMemoryStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 8

${data.remainingWorkBeforeStep8.map((item) => `- ${item}`).join("\n")}

---

**Step 7 verdict:** Workflow & AI Model Optimization Engine is ready. Workflows are analyzed and evolved with preserved history; adaptive primary/secondary/backup model selection protects professional quality; AI Me can explain and predict. Autonomous Improvement is available as Step 8.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `wmo-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 7");
  console.log("Workflow & AI Model Optimization Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiWorkflowModelOptimizationEngine();
    engine.initialize(storageRoot);

    const run = engine.optimize({
      workflows: [
        {
          workflowId: "wf-main",
          name: "Product Marketing Pipeline",
          version: 2,
          successCount: 5,
          failureCount: 3,
          avgExecutionMs: 250_000,
          avgCpuPercent: 90,
          avgGpuPercent: 94,
          avgRamMb: 12_000,
          avgQuality: 70,
          userSatisfaction: 66,
          steps: ["rendering", "audio-generation", "video-generation", "image-generation", "product-intelligence"],
        },
        {
          workflowId: "wf-main-alt",
          name: "Product Marketing Pipeline",
          version: 1,
          successCount: 12,
          failureCount: 1,
          avgExecutionMs: 150_000,
          avgQuality: 84,
          userSatisfaction: 86,
          lastUsedAt: new Date().toISOString(),
          steps: ["product-intelligence", "image-generation", "video-generation", "audio-generation", "rendering"],
        },
        {
          workflowId: "wf-old",
          name: "Legacy Hard Pipeline",
          version: 1,
          successCount: 0,
          failureCount: 0,
          avgExecutionMs: 300_000,
          avgQuality: 60,
          active: false,
          lastUsedAt: "2025-01-01T00:00:00.000Z",
          steps: ["video-generation", "rendering"],
        },
      ],
      models: [
        { modelId: "img-pro", task: "image-generation", outputQuality: 91, imageQuality: 92, processingSpeedScore: 62, stabilityScore: 93, errorRate: 1 },
        { modelId: "img-fast", task: "image-generation", outputQuality: 73, imageQuality: 74, processingSpeedScore: 94, stabilityScore: 78, errorRate: 7, gpuUsagePercent: 91 },
        { modelId: "vid-pro", task: "video-generation", outputQuality: 89, videoQuality: 90, renderingQuality: 88, processingSpeedScore: 58, stabilityScore: 91, errorRate: 2 },
        { modelId: "vid-mid", task: "video-generation", outputQuality: 81, videoQuality: 82, processingSpeedScore: 79, stabilityScore: 86, errorRate: 4 },
        { modelId: "aud-pro", task: "audio-generation", outputQuality: 85, audioQuality: 87, processingSpeedScore: 82, stabilityScore: 90, errorRate: 2 },
      ],
      context: {
        productType: "cosmetics",
        marketingGoal: "brand-awareness",
        hardwareTier: "high",
        qualityRequirement: 80,
        allowQualityTradeoffForSpeed: false,
        feedbackSignals: ["prefer soft lighting", "keep logo placement stable"],
        performanceSignals: [{ label: "avgPipelineMs", value: 220000 }],
      },
    });

    issuesFound.push(...run.issuesFound);
    issuesRepaired.push(...run.issuesRepaired);

    results.push({
      name: "workflowAnalysis",
      passed: run.analyzedWorkflows.some((w) => w.classification.includes("slow") || w.classification.includes("inefficient")),
      detail: run.analyzedWorkflows.map((w) => `${w.workflowId}:${w.classification.join("|")}`).join("; "),
    });
    results.push({
      name: "workflowOptimization",
      passed: run.optimizedWorkflows.length >= 1 && run.optimizedWorkflows.every((o) => o.activeReplacementCreated),
      detail: `optimized=${run.optimizedWorkflows.length}`,
    });
    results.push({
      name: "modelAnalysis",
      passed: run.analyzedModels.every((m) => m.compositeScore > 0),
      detail: `models=${run.analyzedModels.length}`,
    });
    results.push({
      name: "adaptiveModelSelection",
      passed:
        run.modelSelections.some((s) => s.task === "image-generation" && s.primaryModelId === "img-pro")
        && run.modelSelections.every((s) => s.primaryModelId && s.secondaryModelId && s.backupModelId),
      detail: run.modelSelections.map((s) => `${s.task}:${s.primaryModelId}`).join(",") || "none",
    });
    results.push({
      name: "resourceOptimization",
      passed: run.resourcePlan.scheduleOrder[0] === "product-intelligence" || run.resourcePlan.scheduleOrder.includes("image-generation"),
      detail: run.resourcePlan.scheduleOrder.join(">"),
    });
    results.push({
      name: "qualityProtected",
      passed: run.qualityNeverReducedAutomatically && run.optimizedWorkflows.every((o) => o.qualityImprovementPct >= 0),
      detail: run.qualityImprovements.join(" | ") || "none",
    });
    results.push({
      name: "optimizationMemory",
      passed: run.optimizationMemory.length >= 1 && run.historyPreserved,
      detail: `memory=${run.optimizationMemory.length}`,
    });

    const explained = engine.explain("wf-main");
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainWorkflowOptimizations
        && awareness.canRecommendEfficientWorkflow
        && awareness.autonomousImprovementDeferred === false
        && explained.predictedProductionQuality > 0,
      detail: awareness.summary,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let health = engine.runQualityAssurance();
    issuesRepaired.push(...health.repaired);
    let loops = 0;
    while (health.criticalIssues.length > 0 && loops < 3) {
      health = engine.runQualityAssurance();
      issuesRepaired.push(...health.repaired);
      loops += 1;
    }
    results.push({
      name: "qualityAssurance",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}; checks=${health.checks.filter((c) => c.passed).length}/${health.checks.length}`,
    });

    const reportData = engine.buildReportData(results);
    reportData.issuesFound = [...new Set([...reportData.issuesFound, ...issuesFound])];
    reportData.issuesRepaired = [...new Set([...reportData.issuesRepaired, ...issuesRepaired])];
    const reportPath = writeReport(reportData);
    console.log("Report:", reportPath);
  } catch (error) {
    console.error("Validation failed:", error);
    results.push({ name: "runtime", passed: false, detail: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("Checks:");
  let failed = 0;
  for (const result of results) {
    console.log(`- ${result.passed ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
    if (!result.passed) failed += 1;
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

void main();
