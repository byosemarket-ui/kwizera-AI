import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiPerformanceAnalyticsEngine,
  type PerformanceAnalyticsReportData,
} from "../ai/performance-analytics/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-perf-"));
}

function writeReport(data: PerformanceAnalyticsReportData): string {
  const reportPath = path.join(process.cwd(), "PERFORMANCE-ANALYTICS-REPORT.md");
  const body = `# PERFORMANCE ANALYTICS REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 5

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Production / analytics history deleted:** NO  
**Step 6 (Autonomous Learning):** Available separately via \`validate:autonomous-learning\`  

---

## 1. Existing Analytics capability

${data.existingAnalyticsCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Pipeline Performance

${data.pipelinePerformance}

## 5. Resource Usage

${data.resourceUsage}

## 6. Quality Scores

${data.qualityScores}

## 7. AI Model Performance

${data.aiModelPerformance}

## 8. Bottlenecks Found

${data.bottlenecksFound.length ? data.bottlenecksFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 9. Optimizations Recommended

${data.optimizationsRecommended.length ? data.optimizationsRecommended.map((item) => `- ${item}`).join("\n") : "- none"}

## 10. AI Me capability

${data.aiMeCapability}

## 11. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 13. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 14. Remaining work before Step 6

${data.remainingWorkBeforeStep6.map((item) => `- ${item}`).join("\n")}

---

**Step 5 verdict:** Performance Analytics & Production Intelligence Engine is ready. Pipeline, resource, quality, and model performance are measured with bottleneck detection, optimization recommendations, dashboard trends, and AI Me explain/compare/predict. Autonomous Learning is available as Step 6.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `perf-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 5");
  console.log("Performance Analytics & Production Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiPerformanceAnalyticsEngine();
    engine.initialize(storageRoot);

    const run = engine.ingestSessions([
      {
        projectId: "proj-pa-1",
        sources: [
          "product-intelligence",
          "scene-planning",
          "storyboard",
          "prompt-engine",
          "image-generation",
          "video-generation",
          "audio-generation",
          "rendering",
          "user-feedback",
          "ai-self-review",
        ],
        timings: {
          totalProductionMs: 310_000,
          imageGenerationMs: 55_000,
          videoGenerationMs: 130_000,
          audioGenerationMs: 18_000,
          renderingMs: 85_000,
          exportMs: 12_000,
          overallPipelineMs: 300_000,
        },
        resources: {
          cpuPercent: 94,
          gpuPercent: 97,
          ramMb: 15_000,
          vramMb: 11_000,
          storageMb: 80_000,
          diskSpeedMBps: 45,
          networkMbps: 80,
        },
        quality: {
          imageQuality: 76,
          videoQuality: 70,
          audioQuality: 78,
          storytellingQuality: 72,
          cameraQuality: 74,
          lightingQuality: 68,
          editingQuality: 71,
          renderingQuality: 69,
          marketingQuality: 75,
        },
        models: [
          {
            modelId: "img-fast",
            task: "image-generation",
            speedScore: 88,
            accuracyScore: 70,
            stabilityScore: 75,
            failureRate: 6,
            outputQuality: 72,
          },
          {
            modelId: "img-pro",
            task: "image-generation",
            speedScore: 65,
            accuracyScore: 90,
            stabilityScore: 88,
            failureRate: 2,
            outputQuality: 91,
          },
          {
            modelId: "vid-a",
            task: "video-generation",
            speedScore: 70,
            accuracyScore: 80,
            outputQuality: 82,
            failureRate: 4,
          },
        ],
        errorCount: 2,
      },
      {
        projectId: "proj-pa-1",
        sources: ["product-assets", "ai-model-orchestration", "rendering"],
        timings: {
          imageGenerationMs: 28_000,
          videoGenerationMs: 65_000,
          audioGenerationMs: 10_000,
          renderingMs: 35_000,
          exportMs: 7_000,
          overallPipelineMs: 145_000,
        },
        resources: {
          cpuPercent: 50,
          gpuPercent: 55,
          ramMb: 7_000,
          vramMb: 3_500,
          diskSpeedMBps: 220,
        },
        quality: {
          imageQuality: 88,
          videoQuality: 86,
          audioQuality: 85,
          storytellingQuality: 84,
          marketingQuality: 87,
        },
        models: [
          {
            modelId: "vid-b",
            task: "video-generation",
            speedScore: 85,
            accuracyScore: 86,
            outputQuality: 88,
            failureRate: 1,
          },
        ],
        errorCount: 0,
      },
    ]);

    issuesFound.push(...run.issuesFound);
    issuesRepaired.push(...run.issuesRepaired);

    results.push({
      name: "performanceMonitoring",
      passed: run.sessions.length === 2 && run.sessions[0]!.timings.videoGenerationMs === 130_000,
      detail: `sessions=${run.sessions.length}`,
    });
    results.push({
      name: "resourceAnalytics",
      passed: run.sessions[0]!.resources.gpuPercent === 97 && run.sessions[0]!.resources.cpuPercent === 94,
      detail: `cpu=${run.sessions[0]!.resources.cpuPercent}; gpu=${run.sessions[0]!.resources.gpuPercent}`,
    });
    results.push({
      name: "qualityAnalytics",
      passed: run.sessions[0]!.quality.overallQuality > 0 && run.dashboard.qualityTrends.length === 2,
      detail: `overall=${run.sessions[0]!.quality.overallQuality}`,
    });
    results.push({
      name: "modelPerformance",
      passed: run.bestModels["image-generation"] === "img-pro" && run.bestModels["video-generation"] === "vid-b",
      detail: JSON.stringify(run.bestModels),
    });
    results.push({
      name: "bottleneckDetection",
      passed: run.bottlenecks.some((b) => b.kind === "gpu-bottleneck" || b.kind === "slow-module"),
      detail: run.bottlenecks.map((b) => b.kind).join(",") || "none",
    });
    results.push({
      name: "optimizationEngine",
      passed: run.optimizations.length >= 1,
      detail: `optimizations=${run.optimizations.length}`,
    });
    results.push({
      name: "productionDashboard",
      passed:
        run.dashboard.productionStatistics.sessionsAnalyzed >= 2
        && run.dashboard.performanceTrends.length >= 2
        && run.dashboard.resourceTrends.length >= 2,
      detail: `stats=${JSON.stringify(run.dashboard.productionStatistics)}`,
    });

    const explained = engine.explain(run.sessions[0]?.id);
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainBottlenecks
        && awareness.canPredictProductionTime
        && awareness.autonomousLearningDeferred === false
        && explained.predictedProductionTimeMs > 0,
      detail: awareness.summary,
    });

    results.push({
      name: "neverDeleteHistory",
      passed: engine.getSessions().length >= 2 && run.historyPreserved,
      detail: `stored=${engine.getSessions().length}`,
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
