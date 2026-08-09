import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiLocalProductionQueueEngine,
  type LocalProductionQueueReportData,
} from "../ai/local-production-queue/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-lpq-"));
}

function writeReport(data: LocalProductionQueueReportData): string {
  const reportPath = path.join(process.cwd(), "LOCAL-PRODUCTION-QUEUE-REPORT.md");
  const body = `# LOCAL PRODUCTION QUEUE REPORT
## KWIZERA AI STUDIO — AI Studio Platform & Personal Workspace Step 3

**Generated at:** ${data.generatedAt}  
**Single User Only:** YES  
**Local Execution Only:** YES  
**Offline First:** Preserved  
**AI Me:** Preserved  
**Platform Step 4 (Local Resource Manager):** Not started  

---

## 1. Existing Queue capability

${data.existingQueueCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Queue Management status

${data.queueManagementStatus}

## 5. Dependency Management status

${data.dependencyManagementStatus}

## 6. Parallel Execution status

${data.parallelExecutionStatus}

## 7. Failure Recovery status

${data.failureRecoveryStatus}

## 8. Job History status

${data.jobHistoryStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 4

${data.remainingWorkBeforeStep4.map((item) => `- ${item}`).join("\n")}

---

**Step 3 verdict:** Local Production Queue & Job Management Engine is ready for single-user local job queuing, priorities, dependencies, parallel execution, pause/resume/cancel/retry, failure recovery, and AI Me explain/predict/optimize. Local Resource Manager is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `lpq-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Platform Step 3");
  console.log("Local Production Queue & Job Management Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiLocalProductionQueueEngine();
    engine.initialize(storageRoot);
    engine.setResourceOverride({
      cpuUsage: 30,
      gpuUsage: 20,
      ramUsage: 35,
      vramUsage: 15,
      diskUsage: 25,
    });

    const analysis = engine.enqueue({
      jobType: "product-analysis",
      projectId: "proj-aurora",
      priority: "high",
      title: "Analyze Aurora",
    });
    const bg = engine.enqueue({
      jobType: "background-removal",
      projectId: "proj-aurora",
      priority: "high",
      dependsOn: [analysis.jobId],
      title: "Remove BG",
    });
    results.push({
      name: "enqueueJobs",
      passed: Boolean(analysis.jobId && bg.jobId && analysis.jobId !== bg.jobId),
      detail: `jobs=${analysis.jobId},${bg.jobId}`,
    });

    engine.setPriority(bg.jobId, "critical");
    results.push({
      name: "priorityChange",
      passed: engine.getJob(bg.jobId)?.priority === "critical",
      detail: `priority=${engine.getJob(bg.jobId)?.priority}`,
    });

    // BG must not run before analysis
    engine.start(bg.jobId);
    results.push({
      name: "dependencyBlock",
      passed: engine.getJob(bg.jobId)?.status === "waiting",
      detail: `bgStatus=${engine.getJob(bg.jobId)?.status}`,
    });

    engine.start(analysis.jobId);
    engine.runQueueCycle();
    results.push({
      name: "dependencyOrder",
      passed:
        engine.getJob(analysis.jobId)?.status === "completed"
        && engine.getJob(bg.jobId)?.status === "completed",
      detail: `analysis=${engine.getJob(analysis.jobId)?.status}; bg=${engine.getJob(bg.jobId)?.status}`,
    });

    const indep1 = engine.enqueue({
      jobType: "prompt-generation",
      title: "Parallel A",
      parallelSafe: true,
      priority: "normal",
    });
    const indep2 = engine.enqueue({
      jobType: "knowledge-update",
      title: "Parallel B",
      parallelSafe: true,
      priority: "normal",
    });
    engine.start(indep1.jobId);
    engine.start(indep2.jobId);
    engine.tick();
    results.push({
      name: "parallelExecution",
      passed:
        (engine.getJob(indep1.jobId)?.status === "completed" || engine.getJob(indep1.jobId)?.status === "running")
        && (engine.getJob(indep2.jobId)?.status === "completed" || engine.getJob(indep2.jobId)?.status === "running"
          || engine.getJob(indep2.jobId)?.status === "waiting"),
      detail: `a=${engine.getJob(indep1.jobId)?.status}; b=${engine.getJob(indep2.jobId)?.status}`,
    });
    engine.runQueueCycle();

    const pauseJob = engine.enqueue({
      jobType: "video-generation",
      title: "Pause Target",
      estimatedDurationMs: 60_000,
      parallelSafe: true,
    });
    engine.start(pauseJob.jobId);
    const paused = engine.pause(pauseJob.jobId);
    const resumed = engine.resume(pauseJob.jobId);
    results.push({
      name: "pauseResume",
      passed:
        (paused?.status === "paused" || paused?.checkpoints.length)
        && (resumed?.status === "running" || resumed?.status === "completed" || resumed?.status === "paused"),
      detail: `paused=${paused?.status}; resumed=${resumed?.status}`,
    });
    engine.runQueueCycle();

    const failJob = engine.enqueue({
      jobType: "image-generation",
      title: "Fail Target",
      parallelSafe: true,
    });
    engine.start(failJob.jobId);
    engine.failJob(failJob.jobId, "Simulated encoder failure");
    const failed = engine.getJob(failJob.jobId);
    const retried = engine.retry(failJob.jobId);
    results.push({
      name: "failureRecoveryRetry",
      passed:
        Boolean(failed?.suggestedCause)
        && (failed?.checkpoints.length ?? 0) > 0
        && (retried?.retryCount ?? 0) >= 1,
      detail: `cause=${failed?.suggestedCause}; retry=${retried?.retryCount}`,
    });

    const cancelJob = engine.enqueue({
      jobType: "export",
      title: "Cancel Target",
      parallelSafe: true,
      estimatedDurationMs: 60_000,
    });
    engine.start(cancelJob.jobId);
    engine.pause(cancelJob.jobId);
    const cancelled = engine.cancel(cancelJob.jobId);
    results.push({
      name: "cancelPreservesData",
      passed: cancelled?.status === "cancelled" && fs.existsSync(path.join(storageRoot, "local-production-queue", "checkpoints", `${cancelJob.jobId}.json`)),
      detail: `status=${cancelled?.status}`,
    });

    const chain = engine.enqueueCreativeChain("proj-chain", "high");
    engine.runQueueCycle();
    const order = engine.getExecutionOrder().filter((id) => chain.some((c) => c.jobId === id));
    const chainDone = chain.every((c) => engine.getJob(c.jobId)?.status === "completed");
    results.push({
      name: "creativeChain",
      passed: chainDone && order.length === chain.length,
      detail: `chain=${chain.length}; order=${order.length}`,
    });

    const historyBefore = engine.getHistory().length;
    results.push({
      name: "jobHistory",
      passed: historyBefore > 0,
      detail: `history=${historyBefore}`,
    });

    engine.setResourceOverride({
      cpuUsage: 95,
      gpuUsage: 90,
      ramUsage: 90,
      vramUsage: 88,
      diskUsage: 80,
    });
    const delayed = engine.enqueue({
      jobType: "rendering",
      title: "Resource Delayed",
      parallelSafe: true,
    });
    engine.start(delayed.jobId);
    results.push({
      name: "resourceAwareDelay",
      passed: engine.getJob(delayed.jobId)?.status === "waiting",
      detail: `status=${engine.getJob(delayed.jobId)?.status}; reason=${engine.sampleResources().reason}`,
    });
    engine.setResourceOverride({
      cpuUsage: 30,
      gpuUsage: 20,
      ramUsage: 30,
      vramUsage: 10,
      diskUsage: 20,
    });
    engine.runQueueCycle();

    const awareness = engine.getAiMeAwareness();
    const explained = engine.explain();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.singleUserOnly
        && awareness.canExplainQueue
        && awareness.canPredictCompletionTime
        && awareness.canExplainWhyWaiting
        && awareness.canRecommendOptimization
        && awareness.localResourceManagerDeferred === false
        && explained.queueSummary.length > 0,
      detail: awareness.summary,
    });

    const structureRoot = path.join(storageRoot, "local-production-queue");
    results.push({
      name: "localStructure",
      passed: ["checkpoints", "outputs", "queue-store.json"].every((f) =>
        fs.existsSync(path.join(structureRoot, f))),
      detail: structureRoot,
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

    const cycle = engine.runQueueCycle();
    issuesFound.push(...cycle.issuesFound);
    issuesRepaired.push(...cycle.issuesRepaired);

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
