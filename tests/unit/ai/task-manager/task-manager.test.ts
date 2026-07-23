import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiTaskManager,
  ManagedTaskState,
  ManagedTaskType,
  TaskManagerError,
  TaskPriority,
  TaskQueueCategory,
} from "@ai/task-manager/index.js";
import { AiCore, createAiCore } from "@ai/core";
import { DecisionPriority, DecisionType } from "@ai/decision/index.js";
import { PlanningType } from "@ai/planning/index.js";
import { WorkflowState } from "@ai/workflow/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-task-manager-test-"));
}

describe("AiTaskManager", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("task-manager-test");
    const manager = core.getManager().taskManager;
    expect(manager).toBeTruthy();
    return { core, manager: manager! };
  }

  it("initializes with AI Core and writes logs", async () => {
    const { core, manager } = await startCore();
    expect(manager.isInitialized()).toBe(true);
    expect(manager.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));
    await core.stop("cleanup");
  });

  it("creates, queues, and completes a task", async () => {
    const { core, manager } = await startCore();

    const task = manager.createTask({
      name: "validate plan",
      taskType: ManagedTaskType.Backup,
      priority: TaskPriority.Normal,
      queueCategory: TaskQueueCategory.Maintenance,
      moduleId: "decision-engine",
    });
    manager.queueTask(task.id);

    const result = await manager.runWorkflowTask({
      planTask: {
        id: "task-validate-plan",
        name: "validate plan",
        moduleId: "decision-engine",
        dependsOn: [],
        estimatedMs: 500,
        priority: "critical" as import("@ai/planning/types.js").PlanTaskPriority,
        description: "validate",
      },
      workflowRunId: "wf-001",
      workflowId: "workflow-general",
      taskType: ManagedTaskType.Backup,
      priority: TaskPriority.Normal,
      queueCategory: TaskQueueCategory.Maintenance,
      completedTaskIds: [],
    });

    expect(result.success).toBe(true);
    expect(result.task.state).toBe(ManagedTaskState.Completed);
    await core.stop("cleanup");
  });

  it("prioritizes critical tasks in scheduler", async () => {
    const { core, manager } = await startCore();
    const scheduler = manager.priorityScheduler;
    const tasks = new Map([
      [
        "t1",
        {
          id: "t1",
          priority: TaskPriority.Background,
        } as import("@ai/task-manager/types.js").ManagedTask,
      ],
      [
        "t2",
        {
          id: "t2",
          priority: TaskPriority.Critical,
        } as import("@ai/task-manager/types.js").ManagedTask,
      ],
    ]);

    const next = scheduler.selectNext(tasks, ["t1", "t2"]);
    expect(next?.id).toBe("t2");
    await core.stop("cleanup");
  });

  it("recovers from simulated task failure", async () => {
    const { core, manager } = await startCore();

    const result = await manager.runWorkflowTask({
      planTask: {
        id: "task-execute-workflow",
        name: "execute workflow",
        moduleId: "decision-engine",
        dependsOn: ["task-validate-plan"],
        estimatedMs: 3000,
        priority: "high" as import("@ai/planning/types.js").PlanTaskPriority,
        description: "execute",
      },
      workflowRunId: "wf-recovery",
      workflowId: "workflow-general",
      taskType: ManagedTaskType.General,
      priority: TaskPriority.High,
      queueCategory: TaskQueueCategory.Background,
      completedTaskIds: ["task-validate-plan"],
      simulateFailure: true,
    });

    expect(result.success).toBe(true);
    expect(result.task.state).toBe(ManagedTaskState.Recovered);
    expect(result.task.progress.recoveryAttempts).toBeGreaterThan(0);
    await core.stop("cleanup");
  });

  it("pauses and cancels tasks", async () => {
    const { core, manager } = await startCore();
    const task = manager.createTask({
      name: "cancel me",
      taskType: ManagedTaskType.Export,
      priority: TaskPriority.Low,
      queueCategory: TaskQueueCategory.Interactive,
      moduleId: "decision-engine",
    });
    manager.queueTask(task.id);
    manager.pauseTask(task.id);
    expect(manager.getTask(task.id)?.state).toBe(ManagedTaskState.Paused);
    manager.cancelTask(task.id);
    expect(manager.getTask(task.id)?.state).toBe(ManagedTaskState.Cancelled);
    await core.stop("cleanup");
  });

  it("stores task history", async () => {
    const { core, manager } = await startCore();
    await manager.runWorkflowTask({
      planTask: {
        id: "task-hist",
        name: "history",
        moduleId: "decision-engine",
        dependsOn: [],
        estimatedMs: 500,
        priority: "normal" as import("@ai/planning/types.js").PlanTaskPriority,
        description: "history",
      },
      workflowRunId: "wf-hist",
      workflowId: "workflow-general",
      taskType: ManagedTaskType.Backup,
      priority: TaskPriority.Normal,
      queueCategory: TaskQueueCategory.Maintenance,
      completedTaskIds: [],
    });

    expect(manager.history.getCount()).toBe(1);
    expect(fs.existsSync(manager.history.getHistoryPath()!)).toBe(true);
    await core.stop("cleanup");
  });

  it("tracks queue status by category", async () => {
    const { core, manager } = await startCore();
    const task = manager.createTask({
      name: "queued",
      taskType: ManagedTaskType.Learning,
      priority: TaskPriority.Background,
      queueCategory: TaskQueueCategory.Learning,
      moduleId: "learning-engine",
    });
    manager.queueTask(task.id);
    const status = manager.getQueueStatus();
    expect(status.learning).toBeGreaterThanOrEqual(1);
    await core.stop("cleanup");
  });

  it("rejects when not initialized", async () => {
    const manager = new AiTaskManager({ storageRoot });
    expect(() =>
      manager.createTask({
        name: "fail",
        taskType: ManagedTaskType.General,
        priority: TaskPriority.Normal,
        queueCategory: TaskQueueCategory.Background,
        moduleId: "decision-engine",
      })
    ).toThrow(TaskManagerError);
  });
});

describe("Workflow integration", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("runs full pipeline with Task Manager coordinating workflow tasks", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("pipeline");

    const decision = await core.getManager().decisionEngine!.decide({
      requestId: "req-task-pipeline",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Full pipeline with task manager",
      statedObjective: "Validate task manager integration",
      availableData: {
        objective: "Validate task manager integration",
        brandProfile: { name: "KWIZERA" },
      },
    });

    const workflow = await core.getManager().workflowEngine!.execute(
      decision.planningResult!.workflowHandoff!
    );

    expect(workflow.success).toBe(true);
    expect(workflow.state).toBe(WorkflowState.Completed);
    expect(core.getManager().taskManager!.history.getCount()).toBeGreaterThan(0);

    await core.stop("cleanup");
  });
});
