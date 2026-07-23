import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  ApplicationState,
  createAiCore,
  ProjectState,
  SessionStateManaged,
  SystemState,
  TaskStateManaged,
  WorkflowStateManaged,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-state-manager-test-"));
}

describe("AiStateManager", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(async () => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes and tracks application state through startup", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("state-manager-test");

    const state = core.getManager().stateManager!;
    expect(state.isInitialized()).toBe(true);
    expect(state.getApplicationState()).toBe(ApplicationState.Ready);
    expect(state.getCurrentSnapshot().system).toBe(SystemState.Operational);

    await core.stop();
    expect(state.getApplicationState()).toBe(ApplicationState.Stopped);
  });

  it("tracks workflow, task, project, and session states", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("state-tracking-test");

    const state = core.getManager().stateManager!;

    state.updateWorkflowState("wf-1", WorkflowStateManaged.Created);
    state.updateWorkflowState("wf-1", WorkflowStateManaged.Running);
    state.updateTaskState("task-1", TaskStateManaged.Queued);
    state.updateTaskState("task-1", TaskStateManaged.Running);
    state.updateProjectState("proj-1", ProjectState.New);
    state.updateProjectState("proj-1", ProjectState.Open);
    state.updateSessionState("sess-1", SessionStateManaged.Created);
    state.updateSessionState("sess-1", SessionStateManaged.Active);

    expect(state.getWorkflowState("wf-1")?.state).toBe(WorkflowStateManaged.Running);
    expect(state.getTaskState("task-1")?.state).toBe(TaskStateManaged.Running);
    expect(state.getProjectState("proj-1")?.state).toBe(ProjectState.Open);
    expect(state.getSessionState("sess-1")?.state).toBe(SessionStateManaged.Active);

    await core.stop();
  });

  it("rejects invalid state transitions", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("state-validation-test");

    const state = core.getManager().stateManager!;
    state.updateWorkflowState("wf-invalid", WorkflowStateManaged.Created);
    state.updateWorkflowState("wf-invalid", WorkflowStateManaged.Running);
    state.updateWorkflowState("wf-invalid", WorkflowStateManaged.Completed);
    const rejected = state.updateWorkflowState("wf-invalid", WorkflowStateManaged.Running);

    expect(rejected.accepted).toBe(false);

    await core.stop();
  });

  it("creates snapshots and writes logs to storage", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("state-snapshot-test");

    const state = core.getManager().stateManager!;
    state.createSnapshot("test-snapshot");

    expect(state.snapshots.getSnapshotCount()).toBeGreaterThan(0);
    expect(fs.existsSync(state.snapshots.getStateDirectory()!)).toBe(true);

    const logDir = state.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);

    await core.stop();
  });

  it("restores state after restart", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("restore-test-1");

    const state1 = core1.getManager().stateManager!;
    state1.updateWorkflowState("wf-restore", WorkflowStateManaged.Running);
    state1.updateTaskState("task-restore", TaskStateManaged.Running);
    state1.updateProjectState("proj-restore", ProjectState.Modified);
    await core1.stop("save-for-restore");

    AiCore.resetInstance();

    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("restore-test-2");

    const state2 = core2.getManager().stateManager!;
    const restored = state2.getLastRestoration();
    expect(restored?.restored).toBe(true);
    expect(["running", "recovered"]).toContain(state2.getWorkflowState("wf-restore")?.state);
    expect(["running", "recovered"]).toContain(state2.getTaskState("task-restore")?.state);

    await core2.stop();
  });

  it("recovers from unclean shutdown", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("recovery-test-1");

    const state1 = core1.getManager().stateManager!;
    state1.updateWorkflowState("wf-unclean", WorkflowStateManaged.Running);
    state1.updateTaskState("task-unclean", TaskStateManaged.Running);
    state1.snapshots.persistCurrentState(state1.getCurrentSnapshot(), false);

    AiCore.resetInstance();

    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("recovery-test-2");

    const state2 = core2.getManager().stateManager!;
    expect(state2.getLastRecoveryMessage()).toContain("Recovered");
    expect(state2.getWorkflowState("wf-unclean")?.state).toBe(WorkflowStateManaged.Recovered);

    await core2.stop();
  });

  it("supports auto-save triggers", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("auto-save-test");

    const state = core.getManager().stateManager!;
    state.triggerAutoSave("workflow-execution");
    state.triggerAutoSave("memory-update");

    const report = state.buildStatusReport();
    expect(report.autoSaveStatus).toContain("2 auto-save");

    await core.stop();
  });

  it("records state history and builds status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("history-test");

    const state = core.getManager().stateManager!;
    const report = state.buildStatusReport();

    expect(report.stateManagerStatus).toBe("operational");
    expect(state.history.getCount()).toBeGreaterThan(0);
    expect(report.readinessScore).toBeGreaterThanOrEqual(80);

    await core.stop();
  });
});
