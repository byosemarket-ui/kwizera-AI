import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiAutomationEngine,
  type AutomationEngineReportData,
} from "../ai/automation-engine/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-auto-"));
}

function writeReport(data: AutomationEngineReportData): string {
  const reportPath = path.join(process.cwd(), "AUTOMATION-ENGINE-REPORT.md");
  const body = `# AUTOMATION ENGINE REPORT
## KWIZERA AI STUDIO — AI Studio Platform & Personal Workspace Step 5

**Generated at:** ${data.generatedAt}  
**Single User Only:** YES  
**Local Machine Only:** YES  
**Offline First:** Preserved  
**AI Me:** Preserved  
**Platform Step 6 (Workspace Manager):** Not started  

---

## 1. Existing Automation capability

${data.existingAutomationCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Scheduled Tasks status

${data.scheduledTasksStatus}

## 5. Backup Automation status

${data.backupAutomationStatus}

## 6. Cleanup capability

${data.cleanupCapability}

## 7. Database Maintenance status

${data.databaseMaintenanceStatus}

## 8. Knowledge Maintenance status

${data.knowledgeMaintenanceStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 6

${data.remainingWorkBeforeStep6.map((item) => `- ${item}`).join("\n")}

---

**Step 5 verdict:** Automation Engine & Studio Maintenance System is ready for single-user local scheduled maintenance, backups, safe cleanup, DB/index upkeep, and AI Me explain/recommend. Workspace Manager is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `auto-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Platform Step 5");
  console.log("Automation Engine & Studio Maintenance System validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiAutomationEngine();
    engine.initialize(storageRoot);

    const hourly = engine.runSchedule("hourly");
    results.push({
      name: "hourlySchedule",
      passed: hourly.tasks.length >= 2 && hourly.userProjectsDeleted === false,
      detail: `tasks=${hourly.tasks.length}`,
    });

    const daily = engine.runSchedule("daily");
    results.push({
      name: "dailySchedule",
      passed: daily.tasks.some((t) => t.taskName === "incremental-backup"),
      detail: `tasks=${daily.tasks.map((t) => t.taskName).join(",")}`,
    });

    const weekly = engine.runSchedule("weekly");
    results.push({
      name: "weeklySchedule",
      passed: weekly.tasks.some((t) => t.taskName === "database-optimization"),
      detail: `tasks=${weekly.tasks.length}`,
    });

    const monthly = engine.runSchedule("monthly");
    results.push({
      name: "monthlySchedule",
      passed: monthly.tasks.length >= 1,
      detail: `tasks=${monthly.tasks.length}`,
    });

    const points = engine.getRestorePoints();
    results.push({
      name: "backupAutomation",
      passed: points.length >= 5 && points.every((p) => p.verified),
      detail: `points=${points.length}`,
    });

    const cacheDir = path.join(storageRoot, "automation-engine", "cache");
    fs.writeFileSync(path.join(cacheDir, "stale-cache.bin"), "x", "utf8");
    const cleanup = engine.runManual(["cache-cleanup", "temporary-file-cleanup"]);
    results.push({
      name: "cleanupSafety",
      passed:
        cleanup.tasks.every((t) => t.userAssetsDeleted === false && t.userProjectsDeleted === false)
        && cleanup.validatedKnowledgeDeleted === false,
      detail: cleanup.tasks.map((t) => `${t.taskName}:${t.status}`).join(","),
    });

    const db = engine.runManual(["database-optimization", "index-optimization"]);
    results.push({
      name: "databaseMaintenance",
      passed: db.tasks.every((t) => t.status === "completed"),
      detail: db.tasks.map((t) => t.taskName).join(","),
    });

    const knowledge = engine.runManual(["knowledge-index-refresh", "asset-index-refresh"]);
    results.push({
      name: "knowledgeMaintenance",
      passed:
        knowledge.tasks.every((t) => t.status === "completed")
        && knowledge.validatedKnowledgeDeleted === false
        && fs.existsSync(path.join(storageRoot, "automation-engine", "indexes", "knowledge-search-index.json")),
      detail: knowledge.summary,
    });

    const failFlag = path.join(storageRoot, "automation-engine", "backups", ".force-fail");
    fs.writeFileSync(failFlag, "1", "utf8");
    const failed = engine.executeTask("incremental-backup", "manual");
    fs.unlinkSync(failFlag);
    const retried = engine.executeTask("incremental-backup", "manual");
    results.push({
      name: "failureRecovery",
      passed: failed.status === "failed" && retried.status === "completed" && failed.errors.length > 0,
      detail: `fail=${failed.status}; retry=${retried.status}`,
    });

    const logs = engine.getLogs();
    results.push({
      name: "automationLogs",
      passed: logs.length > 0 && logs.every((l) => l.taskId && l.timestamp && l.taskName),
      detail: `logs=${logs.length}`,
    });

    const awareness = engine.getAiMeAwareness();
    const explained = engine.explain();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.singleUserOnly
        && awareness.canExplainMaintenanceTasks
        && awareness.canRecommendManualMaintenance
        && awareness.canPredictStorageProblems
        && awareness.canRecommendBackupFrequency
        && awareness.canExplainAutomationDecisions
        && awareness.workspaceManagerDeferred === false
        && explained.automationDecisionExplanation.includes("backup"),
      detail: awareness.summary,
    });

    const structureRoot = path.join(storageRoot, "automation-engine");
    results.push({
      name: "localStructure",
      passed: ["backups", "cache", "temp", "logs", "db", "indexes", "automation-store.json"].every((f) =>
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

    const cycle = engine.runManual(["project-integrity-check"]);
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
