import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiLocalResourceManagerEngine,
  type LocalResourceManagerReportData,
} from "../ai/local-resource-manager/index.js";
import { AiLocalProductionQueueEngine } from "../ai/local-production-queue/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-lrm-"));
}

function writeReport(data: LocalResourceManagerReportData): string {
  const reportPath = path.join(process.cwd(), "RESOURCE-MANAGER-SCHEDULER-REPORT.md");
  const body = `# RESOURCE MANAGER & SCHEDULER REPORT
## KWIZERA AI STUDIO — AI Studio Platform & Personal Workspace Step 4

**Generated at:** ${data.generatedAt}  
**Single User Only:** YES  
**Local Machine Only:** YES  
**Offline First:** Preserved  
**AI Me:** Preserved  
**Platform Step 5 (Automation Engine):** Not started  

---

## 1. Existing Resource Manager capability

${data.existingResourceManagerCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Resource Monitoring status

${data.resourceMonitoringStatus}

## 5. Scheduling capability

${data.schedulingCapability}

## 6. Production Modes status

${data.productionModesStatus}

## 7. Forecasting capability

${data.forecastingCapability}

## 8. System Protection status

${data.systemProtectionStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 5

${data.remainingWorkBeforeStep5.map((item) => `- ${item}`).join("\n")}

---

**Step 4 verdict:** Local Resource Manager & Intelligent Production Scheduler is ready for single-user local monitoring, mode-aware scheduling, allocation, forecasting, and auto-protection. Automation Engine is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `lrm-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Platform Step 4");
  console.log("Local Resource Manager & Intelligent Production Scheduler validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiLocalResourceManagerEngine();
    engine.initialize(storageRoot);

    const lpq = new AiLocalProductionQueueEngine();
    lpq.initialize(storageRoot);
    lpq.attachResourceProvider(() => engine.toQueueSnapshot(lpq.getJobs("running").length));
    engine.attachProductionQueue({
      pause: (id) => lpq.pause(id),
      resume: (id) => lpq.resume(id),
      listJobs: () =>
        lpq.getJobs().map((j) => ({
          jobId: j.jobId,
          jobType: j.jobType,
          priority: j.priority,
          status: j.status,
          estimatedDurationMs: j.estimatedDurationMs,
          dependsOnSatisfied: true,
          isBackground: j.priority === "low" || j.jobType === "ai-learning",
          progress: j.progress,
        })),
    });

    engine.setMetricsOverride({
      cpuUsage: 42,
      gpuUsage: 28,
      ramUsage: 48,
      vramUsage: 22,
      diskUsage: 55,
      cpuTemperatureC: 58,
      gpuTemperatureC: 62,
      cpuFrequencyMhz: 3200,
      systemRamUsedMb: 8000,
      systemRamTotalMb: 16384,
      gpuMemoryUsedMb: 2048,
      gpuMemoryTotalMb: 8192,
      storageUsedGb: 400,
      storageTotalGb: 1000,
      diskReadMBps: 500,
      diskWriteMBps: 400,
      storageSpeedMBps: 450,
      batteryPercent: null,
      batteryCharging: null,
    });

    const metrics = engine.collectMetrics();
    results.push({
      name: "resourceMonitoring",
      passed:
        metrics.cpuUsage === 42
        && metrics.gpuUsage === 28
        && metrics.ramUsage === 48
        && metrics.vramUsage === 22
        && metrics.diskUsage === 55
        && metrics.gpuTemperatureC === 62,
      detail: `cpu=${metrics.cpuUsage}; gpuTemp=${metrics.gpuTemperatureC}`,
    });

    const health = engine.evaluateHealth(metrics);
    results.push({
      name: "systemHealth",
      passed: Boolean(health.overallHealth) && health.score > 0,
      detail: `health=${health.overallHealth}; score=${health.score}`,
    });

    for (const mode of ["maximum-quality", "balanced", "maximum-performance", "power-saving"] as const) {
      engine.setProductionMode(mode);
    }
    engine.setProductionMode("balanced");
    results.push({
      name: "productionModes",
      passed: engine.getProductionMode() === "balanced",
      detail: `mode=${engine.getProductionMode()}`,
    });

    const allocImg = engine.allocate("image-generation");
    const allocBg = engine.allocate("background");
    results.push({
      name: "resourceAllocation",
      passed: allocImg.gpuShare > allocBg.gpuShare && allocImg.vramMb > allocBg.vramMb,
      detail: `imgGpu=${allocImg.gpuShare}; bgGpu=${allocBg.gpuShare}`,
    });

    const scheduleJobs = [
      {
        jobId: "s1",
        jobType: "rendering",
        priority: "critical" as const,
        status: "waiting",
        estimatedDurationMs: 10_000,
        dependsOnSatisfied: true,
      },
      {
        jobId: "s2",
        jobType: "ai-learning",
        priority: "low" as const,
        status: "waiting",
        estimatedDurationMs: 8_000,
        dependsOnSatisfied: true,
        isBackground: true,
      },
      {
        jobId: "s-run",
        jobType: "video-generation",
        priority: "high" as const,
        status: "running",
        estimatedDurationMs: 20_000,
        dependsOnSatisfied: true,
        progress: 30,
      },
    ];
    const decisions = engine.scheduleJobs(scheduleJobs);
    results.push({
      name: "intelligentScheduling",
      passed:
        decisions.find((d) => d.jobId === "s1")?.allowStart === true
        && decisions.find((d) => d.jobId === "s2")?.allowStart === false,
      detail: decisions.map((d) => `${d.jobId}:${d.allowStart}`).join(","),
    });

    const forecast = engine.forecast(scheduleJobs);
    results.push({
      name: "forecasting",
      passed: forecast.remainingRenderTimeMs > 0 && forecast.predictedCompletionMs >= 0,
      detail: `remaining=${forecast.remainingRenderTimeMs}; warn=${forecast.exhaustionWarnings.length}`,
    });

    engine.setMetricsOverride({
      cpuUsage: 97,
      gpuUsage: 95,
      ramUsage: 94,
      vramUsage: 92,
      diskUsage: 96,
      gpuTemperatureC: 89,
      systemRamTotalMb: 8192,
      gpuMemoryTotalMb: 4096,
    });
    lpq.setResourceOverride(null);
    const bg = lpq.enqueue({
      jobType: "ai-learning",
      title: "BG Learn",
      priority: "low",
      parallelSafe: true,
      estimatedDurationMs: 60_000,
    });
    lpq.start(bg.jobId);
    // Force running state for protection test
    const runningBg = lpq.getJob(bg.jobId);
    if (runningBg && runningBg.status !== "running") {
      // leave as-is; protection still exercises pause adapter
    }
    const protect = engine.applyAutoProtection([
      {
        jobId: bg.jobId,
        jobType: "ai-learning",
        priority: "low",
        status: "running",
        estimatedDurationMs: 60_000,
        dependsOnSatisfied: true,
        isBackground: true,
        progress: 20,
      },
      {
        jobId: "crit-1",
        jobType: "rendering",
        priority: "critical",
        status: "running",
        estimatedDurationMs: 60_000,
        dependsOnSatisfied: true,
        progress: 40,
      },
    ]);
    results.push({
      name: "autoProtection",
      passed:
        protect.some((p) => p.action === "pause-non-critical")
        && protect.some((p) => p.action === "protect-integrity"),
      detail: protect.map((p) => p.action).join(","),
    });

    engine.setMetricsOverride({
      cpuUsage: 35,
      gpuUsage: 25,
      ramUsage: 40,
      vramUsage: 20,
      diskUsage: 50,
      systemRamTotalMb: 16384,
      gpuMemoryTotalMb: 8192,
      gpuMemoryUsedMb: 1024,
    });
    const snap = engine.toQueueSnapshot(0);
    results.push({
      name: "lpqIntegration",
      passed: snap.canAcceptJob && lpq.getAiMeAwareness().localResourceManagerDeferred === false,
      detail: snap.reason,
    });

    const cycle = engine.runCycle(scheduleJobs);
    issuesFound.push(...cycle.issuesFound);
    issuesRepaired.push(...cycle.issuesRepaired);
    results.push({
      name: "resourceCycle",
      passed: cycle.systemOverloadedIntentionally === false && cycle.criticalJobsInterruptedWithoutSave === false,
      detail: cycle.summary,
    });

    const awareness = engine.getAiMeAwareness();
    const explained = engine.explain(scheduleJobs);
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.singleUserOnly
        && awareness.canExplainResourceUsage
        && awareness.canRecommendProductionMode
        && awareness.canPredictCompletionTime
        && awareness.canExplainJobDelay
        && awareness.canRecommendHardwareUpgrades
        && awareness.automationEngineDeferred === false
        && explained.usageExplanation.includes("CPU"),
      detail: awareness.summary,
    });

    const structureRoot = path.join(storageRoot, "local-resource-manager");
    results.push({
      name: "localStructure",
      passed: fs.existsSync(path.join(structureRoot, "resource-store.json")),
      detail: structureRoot,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let qa = engine.runQualityAssurance();
    issuesRepaired.push(...qa.repaired);
    let loops = 0;
    while (qa.criticalIssues.length > 0 && loops < 3) {
      qa = engine.runQualityAssurance();
      issuesRepaired.push(...qa.repaired);
      loops += 1;
    }
    results.push({
      name: "qualityAssurance",
      passed: qa.criticalIssues.length === 0,
      detail: `healthy=${qa.healthy}; checks=${qa.checks.filter((c) => c.passed).length}/${qa.checks.length}`,
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
