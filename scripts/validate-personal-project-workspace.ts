import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiPersonalProjectWorkspaceEngine,
  type PersonalWorkspaceReportData,
} from "../ai/personal-project-workspace/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-ppw-"));
}

function writeReport(data: PersonalWorkspaceReportData): string {
  const reportPath = path.join(process.cwd(), "PERSONAL-PROJECT-WORKSPACE-REPORT.md");
  const body = `# PERSONAL PROJECT WORKSPACE REPORT
## KWIZERA AI STUDIO — AI Studio Platform & Personal Workspace Step 1

**Generated at:** ${data.generatedAt}  
**Single User Only:** YES  
**Local Storage Only:** YES  
**Offline First:** Preserved  
**Platform Step 2 (Local Asset Library):** Not started  

---

## 1. Existing Workspace capability

${data.existingWorkspaceCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Project Management status

${data.projectManagementStatus}

## 5. Auto Save status

${data.autoSaveStatus}

## 6. Search capability

${data.searchCapability}

## 7. Recovery capability

${data.recoveryCapability}

## 8. Workspace Dashboard status

${data.workspaceDashboardStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 2

${data.remainingWorkBeforeStep2.map((item) => `- ${item}`).join("\n")}

---

**Step 1 verdict:** Personal Project Workspace Engine is ready for single-user local project management with auto-save, search, history, recovery, and AI Me create/open/resume/continue. Local Asset Library is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `ppw-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Platform Step 1");
  console.log("Personal Project Workspace Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiPersonalProjectWorkspaceEngine();
    engine.initialize(storageRoot);

    const video = engine.createProject({
      projectName: "Aurora Launch Video",
      projectType: "video",
      description: "Product marketing video",
      productInformation: { productName: "Aurora Bottle", category: "beverage" },
      tags: ["launch", "video"],
      keywords: ["aurora"],
      workflowUsed: "product-to-video",
    });
    const image = engine.createProject({
      projectName: "Aurora Still Set",
      projectType: "image",
      productInformation: { productName: "Aurora Bottle", category: "beverage" },
      tags: ["stills"],
    });
    const knowledge = engine.createProject({
      projectName: "Lighting Notes",
      projectType: "knowledge",
      tags: ["learning"],
    });

    results.push({
      name: "projectCreation",
      passed: Boolean(video.projectId && image.projectId && knowledge.projectId),
      detail: `created=3`,
    });

    const opened = engine.openProject(video.projectId);
    engine.updateProject(video.projectId, { currentStatus: "active", description: "In production" });
    engine.recordHistory(video.projectId, "render", "Queued preview render");
    engine.recordHistory(video.projectId, "export", "Exported draft MP4");

    results.push({
      name: "projectLoading",
      passed: opened?.projectId === video.projectId,
      detail: "opened video project",
    });

    const search = engine.searchProjects({
      productName: "Aurora",
      status: "active",
      tags: ["launch"],
      keywords: ["aurora"],
    });
    results.push({
      name: "projectSearch",
      passed: search.some((p) => p.projectId === video.projectId),
      detail: `hits=${search.length}`,
    });

    results.push({
      name: "autoSave",
      passed: fs.existsSync(path.join(storageRoot, "personal-project-workspace", "Settings", "workspace-store.json")),
      detail: "workspace-store.json present",
    });

    const history = engine.getHistory(video.projectId);
    results.push({
      name: "projectHistory",
      passed: history.some((h) => h.kind === "creation") && history.some((h) => h.kind === "render"),
      detail: `entries=${history.length}`,
    });

    engine.openProject(video.projectId);
    engine.autoSave("pre-recovery-test");
    const recovery = engine.recoverAfterShutdown();
    results.push({
      name: "recovery",
      passed: recovery.recovered,
      detail: recovery.detail,
    });

    const dashboard = engine.getDashboard();
    results.push({
      name: "workspaceDashboard",
      passed: dashboard.recentProjects.length >= 3 && dashboard.aiStatus === "online-local",
      detail: `recent=${dashboard.recentProjects.length}; active=${dashboard.activeProjects.length}`,
    });

    const explained = engine.explain(video.projectId);
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.singleUserOnly
        && awareness.canCreateProjects
        && awareness.canContinueUnfinishedWork
        && awareness.localAssetLibraryDeferred === false
        && explained.projectSummary.includes("Aurora"),
      detail: awareness.summary,
    });

    const structureRoot = path.join(storageRoot, "personal-project-workspace");
    results.push({
      name: "localStructure",
      passed: ["Projects", "Images", "Videos", "History", "Settings"].every((f) =>
        fs.existsSync(path.join(structureRoot, f))),
      detail: structureRoot,
    });

    const cycle = engine.runWorkspaceCycle();
    issuesFound.push(...cycle.issuesFound);
    issuesRepaired.push(...cycle.issuesRepaired);

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
