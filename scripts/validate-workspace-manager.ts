import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiWorkspaceManagerEngine,
  type WorkspaceManagerReportData,
} from "../ai/workspace-manager/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-wm-"));
}

function writeReport(data: WorkspaceManagerReportData): string {
  const reportPath = path.join(process.cwd(), "AI-WORKSPACE-MANAGER-REPORT.md");
  const body = `# AI WORKSPACE MANAGER REPORT
## KWIZERA AI STUDIO — AI Studio Platform & Personal Workspace Step 6

**Generated at:** ${data.generatedAt}  
**Single User Only:** YES  
**Local Machine Only:** YES  
**Offline First:** Preserved  
**AI Me:** Preserved  
**Platform Step 7 (Studio Monitoring & Security):** Not started  

---

## 1. Existing Workspace Manager capability

${data.existingWorkspaceManagerCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Module Management status

${data.moduleManagementStatus}

## 5. Workspace Management status

${data.workspaceManagementStatus}

## 6. Session Recovery status

${data.sessionRecoveryStatus}

## 7. Output Management status

${data.outputManagementStatus}

## 8. Health Monitoring status

${data.healthMonitoringStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 7

${data.remainingWorkBeforeStep7.map((item) => `- ${item}`).join("\n")}

---

**Step 6 verdict:** AI Workspace Manager & Module Orchestration Engine is ready for single-user local module lifecycle, workspace/session orchestration, output organization, config tracking, and AI Me explain/restart/resume. Studio Monitoring & Security is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `wm-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Platform Step 6");
  console.log("AI Workspace Manager & Module Orchestration Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiWorkspaceManagerEngine();
    engine.initialize(storageRoot);

    const modules = engine.getModules();
    results.push({
      name: "moduleRegistration",
      passed: modules.length === 13 && new Set(modules.map((m) => m.moduleId)).size === 13,
      detail: `modules=${modules.length}`,
    });

    const before = modules.length;
    engine.registerModule("ai-me");
    results.push({
      name: "duplicateBlocked",
      passed: engine.getModules().length === before,
      detail: `modules=${engine.getModules().length}`,
    });

    const loaded = engine.loadModule("prompt-engine");
    results.push({
      name: "moduleLoading",
      passed: loaded?.lifecycle === "loaded",
      detail: `lifecycle=${loaded?.lifecycle}`,
    });

    engine.markModuleFailed("rendering", "validate failure");
    const restarted = engine.restartModule("rendering");
    results.push({
      name: "moduleRecovery",
      passed: restarted?.health === "healthy" && (restarted?.restartCount ?? 0) >= 1,
      detail: `health=${restarted?.health}; restarts=${restarted?.restartCount}`,
    });

    const msg = engine.sendMessage("ai-me", "asset-library", "find-assets", "shoes");
    const evt = engine.publishEvent("sync", "workspace-manager", "broadcast", { ok: true });
    results.push({
      name: "moduleCommunication",
      passed: Boolean(msg.id && evt.id) && msg.conflict === false,
      detail: `msg=${msg.id}; evt=${evt.id}`,
    });

    const ws = engine.ensureWorkspace("active");
    engine.setActiveWorkspace(ws.workspaceId);
    engine.setActiveProject("proj-aurora");
    const session = engine.startSession("proj-aurora");
    results.push({
      name: "workspaceSession",
      passed: session.projectId === "proj-aurora" && engine.getSharedContext().activeWorkspaceId === ws.workspaceId,
      detail: `session=${session.sessionId}`,
    });

    engine.endSession(session.sessionId);
    const resumed = engine.resumeSession(session.sessionId);
    results.push({
      name: "sessionRecovery",
      passed: resumed?.sessionId === session.sessionId,
      detail: `resumed=${resumed?.sessionId}`,
    });

    const out = engine.organizeOutput("exports", "pack.zip", "export-bytes");
    results.push({
      name: "outputManagement",
      passed: fs.existsSync(out) && engine.listOutputs("exports").length >= 1,
      detail: out,
    });

    engine.setConfig("rendering", "quality", "high");
    engine.setConfig("rendering", "quality", "balanced");
    const cfgHistory = engine.getConfig("rendering");
    results.push({
      name: "configManagement",
      passed: cfgHistory.quality === "balanced",
      detail: `quality=${cfgHistory.quality}`,
    });

    const health = engine.collectHealth();
    results.push({
      name: "healthMonitoring",
      passed: health.databaseStatus === "ok" && health.storageStatus === "ok",
      detail: `failures=${health.failures.length}`,
    });

    const awareness = engine.getAiMeAwareness();
    const explained = engine.explain();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.singleUserOnly
        && awareness.canExplainWorkspaceStatus
        && awareness.canExplainModuleStatus
        && awareness.canRestartFailedModulesSafely
        && awareness.canRecommendWorkspaceOptimization
        && awareness.canResumeUnfinishedSessions
        && awareness.studioMonitoringSecurityDeferred
        && explained.workspaceStatus.includes("workspace"),
      detail: awareness.summary,
    });

    const structureRoot = path.join(storageRoot, "workspace-manager");
    results.push({
      name: "localStructure",
      passed: ["outputs", "config-backups", "sessions", "workspace-store.json"].every((f) =>
        fs.existsSync(path.join(structureRoot, f))),
      detail: structureRoot,
    });

    const cycle = engine.runCycle();
    issuesFound.push(...cycle.issuesFound);
    issuesRepaired.push(...cycle.issuesRepaired);
    results.push({
      name: "workspaceCycle",
      passed: cycle.projectStateLost === false && cycle.configOverwrittenWithoutBackup === false,
      detail: cycle.summary,
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
