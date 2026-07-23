import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  FailureType,
  PROTECTED_MEMORY_CATEGORIES,
  ProjectState,
  RecoveryResultStatus,
  TaskStateManaged,
  WorkflowStateManaged,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-recovery-engine-test-"));
}

describe("AiRecoveryEngine", () => {
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

  it("initializes and runs startup recovery with AI Core", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("recovery-engine-test");

    const recovery = core.getManager().recoveryEngine!;
    expect(recovery.isInitialized()).toBe(true);
    expect(recovery.isStartupRecoveryComplete()).toBe(true);

    await core.stop();
  });

  it("detects failures across monitored components", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("failure-detection-test");

    const recovery = core.getManager().recoveryEngine!;
    const failures = await recovery.scanForFailures();
    expect(Array.isArray(failures)).toBe(true);

    await core.stop();
  });

  it("executes full recovery sequence for module failure", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-recovery-test");

    const recovery = core.getManager().recoveryEngine!;
    const result = await recovery.recoverModule("task-manager");

    expect(result.status).toBe(RecoveryResultStatus.Success);
    expect(result.recoveredData.length).toBeGreaterThan(0);
    expect(recovery.history.getCount()).toBeGreaterThan(0);

    await core.stop();
  });

  it("protects memory categories during recovery", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("memory-protection-test");

    const recovery = core.getManager().recoveryEngine!;
    const report = recovery.buildStatusReport();
    expect(report.dataProtectionStatus).toContain("protected");
    expect(PROTECTED_MEMORY_CATEGORIES.length).toBeGreaterThanOrEqual(8);

    await core.stop();
  });

  it("recovers project and video state from interrupted work", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("project-video-recovery-test");

    const state = core.getManager().stateManager!;
    state.updateProjectState("proj-1", ProjectState.Modified, {
      userAction: "edit",
    });
    state.updateTaskState("video-task-1", TaskStateManaged.Running, {
      systemAction: "video-generation",
      metadata: {
        taskType: "video-generation",
        videoId: "vid-1",
        progressPercent: 65,
        completedSegments: ["seg-1", "seg-2"],
      },
    });

    const recovery = core.getManager().recoveryEngine!;
    const result = await recovery.recoverFromFailure({
      failureId: "test-fail-1",
      failureType: FailureType.Task,
      affectedComponent: "task-manager",
      rootCause: "Video generation interrupted",
      timestamp: new Date().toISOString(),
      severity: "high",
      diagnostics: { videoId: "vid-1" },
    });

    expect(result.recoveredData.some((d) => d.includes("video:vid-1"))).toBe(true);

    await core.stop();
  });

  it("recovers from unclean shutdown on restart", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("unclean-1");

    const state1 = core1.getManager().stateManager!;
    state1.updateWorkflowState("wf-unclean", WorkflowStateManaged.Running);
    state1.snapshots.persistCurrentState(state1.getCurrentSnapshot(), false);
    AiCore.resetInstance();

    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("unclean-2");

    const recovery2 = core2.getManager().recoveryEngine!;
    expect(recovery2.isStartupRecoveryComplete()).toBe(true);
    expect(recovery2.history.getCount()).toBeGreaterThan(0);

    await core2.stop();
  });

  it("writes recovery logs and history to storage", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("recovery-logging-test");

    const recovery = core.getManager().recoveryEngine!;
    await recovery.recoverModule("reasoning-engine");

    expect(fs.existsSync(recovery.logger.getLogDirectory()!)).toBe(true);
    expect(fs.existsSync(recovery.history.getHistoryPath()!)).toBe(true);

    await core.stop();
  });

  it("builds status report with performance metrics", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("recovery-report-test");

    const recovery = core.getManager().recoveryEngine!;
    const report = recovery.buildStatusReport();

    expect(report.recoveryEngineStatus).toBe("operational");
    expect(report.readinessScore).toBeGreaterThanOrEqual(80);

    await core.stop();
  });
});
