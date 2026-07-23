import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiWorkflowEngine,
  WorkflowEngineError,
  WorkflowState,
  WorkflowStep,
  WorkflowType,
} from "@ai/workflow/index.js";
import { AiCore, createAiCore } from "@ai/core";
import { DecisionPriority, DecisionType } from "@ai/decision/index.js";
import { PlanningType } from "@ai/planning/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-workflow-test-"));
}

describe("AiWorkflowEngine", () => {
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

  async function startCoreWithWorkflowEngine() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("workflow-test");
    const engine = core.getManager().workflowEngine;
    expect(engine).toBeTruthy();
    return { core, engine: engine! };
  }

  async function createPlanHandoff(
    core: Awaited<ReturnType<typeof startCoreWithWorkflowEngine>>["core"]
  ) {
    const planning = core.getManager().planningEngine!;
    const result = await planning.planFromDecision({
      decisionId: "dec-wf-001",
      requestId: "req-wf-001",
      planningType: PlanningType.Backup,
      priority: DecisionPriority.Normal,
      objective: "Execute backup workflow",
      userRequest: "Run backup workflow",
      availableData: { brandProfile: { name: "KWIZERA" } },
      workflowHandoff: {
        workflowId: "workflow-general-validated",
        requiredModules: ["decision-engine"],
        executionPriority: DecisionPriority.Normal,
        objective: "Execute backup workflow",
        parameters: {},
        qualityAssessment: {
          sufficient: true,
          score: 90,
          checks: [],
          recommendations: [],
        },
      },
    });
    expect(result.workflowHandoff).toBeTruthy();
    return result.workflowHandoff!;
  }

  it("initializes with AI Core and writes logs to storage logs directory", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();

    expect(engine.isInitialized()).toBe(true);
    expect(engine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(engine.logger.getLogDirectory()!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("executes all 13 workflow steps from an execution plan", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    const result = await engine.execute(handoff);

    expect(result.success).toBe(true);
    expect(result.stepsCompleted.length).toBeGreaterThanOrEqual(13);
    expect(result.stepsCompleted).toContain(WorkflowStep.NotifyUser);
    expect(result.state).toBe(WorkflowState.Completed);
    expect(result.taskHistory.length).toBeGreaterThan(0);

    await core.stop("test cleanup");
  });

  it("schedules and executes tasks in plan order", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    const result = await engine.execute(handoff);
    const order = handoff.executionPlan.executionOrder;

    expect(result.taskHistory.map((t) => t.taskId)).toEqual(order);
    expect(result.tracking.completedTasks).toEqual(order);
    expect(result.tracking.remainingTasks).toHaveLength(0);

    await core.stop("test cleanup");
  });

  it("tracks progress including execution time", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    const result = await engine.execute(handoff);

    expect(result.tracking.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.tracking.estimatedRemainingMs).toBeGreaterThanOrEqual(0);
    expect(result.tracking.currentTaskId).toBeTruthy();

    await core.stop("test cleanup");
  });

  it("recovers from simulated task failure", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);
    const failTaskId = handoff.executionPlan.executionOrder[1];

    const result = await engine.execute({
      ...handoff,
      simulateTaskFailure: failTaskId,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe(WorkflowState.Recovered);
    expect(result.recoveryEvents.length).toBeGreaterThan(0);
    expect(result.tracking.recoveryAttempts).toBeGreaterThan(0);

    await core.stop("test cleanup");
  });

  it("stores workflow history records", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    await engine.execute(handoff);

    expect(engine.history.getCount()).toBe(1);
    const historyPath = engine.history.getHistoryPath();
    expect(historyPath).toBe(path.join(storageRoot, "workflows", "workflow-history.jsonl"));
    expect(fs.existsSync(historyPath!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("logs workflow start, tasks, and end", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    await engine.execute(handoff);

    const entries = engine.logger.getEntries();
    expect(entries.some((e) => e.event === "workflow-start")).toBe(true);
    expect(entries.some((e) => e.event === "task")).toBe(true);
    expect(entries.some((e) => e.event === "workflow-end")).toBe(true);

    await core.stop("test cleanup");
  });

  it("notifies AI Core and user on completion", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    const result = await engine.execute(handoff);

    expect(result.coreNotification).toContain("completed");
    expect(result.userNotification).toContain("KWIZERA AI workflow complete");

    await core.stop("test cleanup");
  });

  it("rejects when engine is not initialized", async () => {
    const engine = new AiWorkflowEngine({ storageRoot });
    const { core } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    await expect(engine.execute(handoff)).rejects.toMatchObject({
      code: "NOT_INITIALIZED",
    });

    await core.stop("test cleanup");
  });

  it("builds a status report with readiness metrics", async () => {
    const { core, engine } = await startCoreWithWorkflowEngine();
    const handoff = await createPlanHandoff(core);

    await engine.execute(handoff);

    const report = engine.buildStatusReport();
    expect(report.workflowEngineStatus).toBe("operational");
    expect(report.performance.totalWorkflows).toBe(1);
    expect(report.readinessScore).toBeGreaterThanOrEqual(50);

    await core.stop("test cleanup");
  });
});

describe("Full pipeline integration", () => {
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

  it("runs reasoning → decision → planning → workflow", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("full-pipeline");

    const decision = await core.getManager().decisionEngine!.decide({
      requestId: "req-full-pipeline",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Run full AI pipeline",
      statedObjective: "Validate end-to-end coordination",
      availableData: {
        objective: "Validate end-to-end coordination",
        brandProfile: { name: "KWIZERA" },
      },
    });

    expect(decision.approved).toBe(true);
    expect(decision.planningResult?.workflowHandoff).toBeTruthy();

    const workflow = await core.getManager().workflowEngine!.execute(
      decision.planningResult!.workflowHandoff!
    );

    expect(workflow.success).toBe(true);
    expect(workflow.workflowType).toBe(WorkflowType.Backup);

    await core.stop("test cleanup");
  });
});

describe("WorkflowEngineError", () => {
  it("does not perform AI work — coordinates only", () => {
    const error = new WorkflowEngineError("Coordination only", "COORDINATION_ONLY");
    expect(error.code).toBe("COORDINATION_ONLY");
  });
});
