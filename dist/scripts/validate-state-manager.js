import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ApplicationState, createAiCore, AiCore, ProjectState, SessionStateManaged, TaskStateManaged, WorkflowStateManaged, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-state-manager-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 2I State Manager Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-2i-validation");
        const state = core.getManager().stateManager;
        results.initialization = {
            passed: state.isInitialized(),
            detail: state.isInitialized() ? "State Manager initialized" : "Not initialized",
        };
        results.applicationState = {
            passed: state.getApplicationState() === ApplicationState.Ready,
            detail: `Application: ${state.getApplicationState()}`,
        };
        state.updateWorkflowState("val-wf", WorkflowStateManaged.Created);
        state.updateWorkflowState("val-wf", WorkflowStateManaged.Running);
        results.workflowState = {
            passed: state.getWorkflowState("val-wf")?.state === WorkflowStateManaged.Running,
            detail: `Workflow: ${state.getWorkflowState("val-wf")?.state}`,
        };
        state.updateTaskState("val-task", TaskStateManaged.Queued);
        state.updateTaskState("val-task", TaskStateManaged.Running);
        results.taskState = {
            passed: state.getTaskState("val-task")?.state === TaskStateManaged.Running,
            detail: `Task: ${state.getTaskState("val-task")?.state}`,
        };
        state.updateProjectState("val-proj", ProjectState.New);
        state.updateProjectState("val-proj", ProjectState.Open);
        state.updateProjectState("val-proj", ProjectState.Modified);
        results.projectState = {
            passed: state.getProjectState("val-proj")?.state === ProjectState.Modified,
            detail: `Project: ${state.getProjectState("val-proj")?.state}`,
        };
        state.updateSessionState("val-sess", SessionStateManaged.Created);
        state.updateSessionState("val-sess", SessionStateManaged.Active);
        results.sessionState = {
            passed: state.getSessionState("val-sess")?.state === SessionStateManaged.Active,
            detail: `Session: ${state.getSessionState("val-sess")?.state}`,
        };
        const invalid = state.updateWorkflowState("val-wf", WorkflowStateManaged.Created);
        results.transitionValidation = {
            passed: !invalid.accepted,
            detail: invalid.accepted ? "Invalid transition accepted" : "Invalid transition rejected",
        };
        state.createSnapshot("validation-snapshot");
        results.snapshots = {
            passed: state.snapshots.getSnapshotCount() >= 1 && fs.existsSync(state.snapshots.getStateDirectory()),
            detail: `${state.snapshots.getSnapshotCount()} snapshot(s)`,
        };
        state.triggerAutoSave("workflow-execution");
        state.triggerAutoSave("recovery");
        const autoSaveReport = state.buildStatusReport();
        const autoSaveMatch = autoSaveReport.autoSaveStatus.match(/(\d+) auto-save/);
        const autoSaveCount = autoSaveMatch ? Number(autoSaveMatch[1]) : 0;
        results.autoSave = {
            passed: autoSaveCount >= 2,
            detail: autoSaveReport.autoSaveStatus,
        };
        await core.stop("validation-pass-1");
        AiCore.resetInstance();
        const core2 = createAiCore({ storageRootOverride: storageRoot });
        await core2.start("step-2i-restore");
        const state2 = core2.getManager().stateManager;
        const restored = state2.getLastRestoration();
        results.stateRestoration = {
            passed: Boolean(restored?.restored && state2.getWorkflowState("val-wf")),
            detail: restored?.message ?? "No restoration",
        };
        state2.snapshots.persistCurrentState(state2.getCurrentSnapshot(), false);
        AiCore.resetInstance();
        const core3 = createAiCore({ storageRootOverride: storageRoot });
        await core3.start("step-2i-recovery");
        const state3 = core3.getManager().stateManager;
        results.recovery = {
            passed: Boolean(state3.getLastRecoveryMessage()?.includes("Recovered")),
            detail: state3.getLastRecoveryMessage() ?? "No recovery",
        };
        results.history = {
            passed: state3.history.getCount() > 0,
            detail: `${state3.history.getCount()} history record(s)`,
        };
        results.logging = {
            passed: Boolean(state3.logger.getLogDirectory() && fs.existsSync(state3.logger.getLogDirectory())),
            detail: state3.logger.getLogDirectory() ?? "none",
        };
        const status = state3.buildStatusReport();
        results.performance = {
            passed: status.performance.stateUpdates > 0 && status.performance.snapshotsCreated > 0,
            detail: `${status.performance.stateUpdates} updates, ${status.performance.averageUpdateMs}ms avg`,
        };
        results.readiness = {
            passed: status.readinessScore >= 80,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        await core3.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-2I-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(status, results, storageRoot, allPassed), "utf8");
        console.log(buildReport(status, results, storageRoot, allPassed));
        console.log("---");
        console.log(`Report written to: ${reportPath}`);
        if (useTemp && fs.existsSync(storageRoot)) {
            fs.rmSync(storageRoot, { recursive: true, force: true });
        }
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildReport(status, results, storageRoot, allPassed) {
    return `# KWIZERA AI STUDIO — Step 2I Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2I — AI State Manager  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **State Manager Status** | ${status.stateManagerStatus} |
| **Snapshot Status** | ${status.snapshotStatus} |
| **Recovery Status** | ${status.recoveryStatus} |
| **Auto Save Status** | ${status.autoSaveStatus} |
| **State Updates** | ${status.performance.stateUpdates} |
| **Snapshots Created** | ${status.performance.snapshotsCreated} |
| **Average Update Time** | ${status.performance.averageUpdateMs}ms |
| **Disk Writes** | ${status.performance.diskWrites} |
| **Memory Usage** | ${status.performance.memoryUsageMb}MB |
| **Readiness Score** | **${status.readinessScore}/100** |
| **Overall** | ${allPassed ? "✅ PASS" : "❌ FAIL"} |

---

## Validation Checks

${Object.entries(results)
        .map(([name, r]) => `- **${name}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`)
        .join("\n")}

---

## Supported State Domains

Application, AI Core, Workflow, Task, Project, Session, Module, System

---

## Snapshot Triggers

Project changes, workflow changes, AI state changes, module state changes, application start/shutdown

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI State Manager (\`ai/state-manager/state-manager.ts\`)
- State Transition Validator (\`ai/state-manager/state-transition-validator.ts\`)
- State Snapshot Store (\`ai/state-manager/state-snapshot-store.ts\`)
- State Restoration (\`ai/state-manager/state-restoration.ts\`)
- State Recovery (\`ai/state-manager/state-recovery.ts\`)
- State Auto Save (\`ai/state-manager/state-auto-save.ts\`)
- State History Store & Logger

---

## Not Implemented (by design — Step 2I scope)

- User Interface, Product Management, Video Generator
- Memory Engine, Knowledge Engine (real implementations)
- AI models

---

**KWIZERA AI** — State Manager ready for Step 2J upon approval.
`;
}
main();
//# sourceMappingURL=validate-state-manager.js.map