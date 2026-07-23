import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiPlanningEngine,
  PlanningEngineError,
  PlanningStatus,
  PlanningStep,
  PlanningType,
  mapDecisionTypeToPlanningType,
} from "@ai/planning/index.js";
import { AiCore, createAiCore } from "@ai/core";
import { DecisionPriority, DecisionType } from "@ai/decision/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-planning-test-"));
}

describe("AiPlanningEngine", () => {
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

  async function startCoreWithPlanningEngine() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("planning-test");
    const engine = core.getManager().planningEngine;
    expect(engine).toBeTruthy();
    return { core, engine: engine! };
  }

  function approvedInput(overrides: Record<string, unknown> = {}) {
    return {
      decisionId: "dec-001",
      requestId: "req-001",
      planningType: PlanningType.Backup,
      priority: DecisionPriority.Normal,
      objective: "Plan backup workflow",
      userRequest: "Create backup plan",
      availableData: { brandProfile: { name: "KWIZERA" } },
      workflowHandoff: {
        workflowId: "workflow-general-validated",
        requiredModules: ["decision-engine"],
        executionPriority: DecisionPriority.Normal,
        objective: "Plan backup workflow",
        parameters: {},
        qualityAssessment: {
          sufficient: true,
          score: 90,
          checks: [],
          recommendations: [],
        },
      },
      ...overrides,
    };
  }

  it("initializes with AI Core and writes logs to storage logs directory", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    expect(engine.isInitialized()).toBe(true);
    expect(engine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(engine.logger.getLogDirectory()!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("generates a complete execution plan through all 13 steps", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    const result = await engine.planFromDecision(approvedInput());

    expect(result.readyForWorkflow).toBe(true);
    expect(result.status).toBe(PlanningStatus.Complete);
    expect(result.stepsCompleted.length).toBe(13);
    expect(result.stepsCompleted).toContain(PlanningStep.SendToWorkflowEngine);
    expect(result.executionPlan?.taskList.length).toBeGreaterThan(0);
    expect(result.executionPlan?.recoveryStrategy.checkpoints.length).toBeGreaterThan(0);
    expect(result.workflowHandoff?.executionPlan).toBeTruthy();

    await core.stop("test cleanup");
  });

  it("breaks work into ordered tasks with dependencies", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    const result = await engine.planFromDecision(
      approvedInput({ planningType: PlanningType.MarketingCampaign })
    );

    expect(result.executionPlan!.executionOrder.length).toBe(
      result.executionPlan!.taskList.length
    );
    expect(result.executionPlan!.dependencies.every((d) => d.satisfied)).toBe(true);

    await core.stop("test cleanup");
  });

  it("estimates resources and execution time", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    const result = await engine.planFromDecision(
      approvedInput({ planningType: PlanningType.PromotionalVideoProduction })
    );

    expect(result.executionPlan!.estimatedTime.totalMs).toBeGreaterThan(0);
    expect(result.executionPlan!.requiredResources.storageBytes).toBeGreaterThan(0);
    expect(result.executionPlan!.requiredResources.memoryMb).toBeGreaterThan(0);

    await core.stop("test cleanup");
  });

  it("performs risk analysis with recovery options", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    const result = await engine.planFromDecision(approvedInput());

    expect(result.riskAnalysis.possibleRisks.length).toBeGreaterThan(0);
    expect(result.riskAnalysis.recoveryOptions.length).toBeGreaterThan(0);
    expect(result.riskAnalysis.expectedSuccessRate).toBeGreaterThan(0);

    await core.stop("test cleanup");
  });

  it("stops planning when critical information is missing", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    const result = await engine.planFromDecision(
      approvedInput({
        planningType: PlanningType.ProductAnalysis,
        availableData: {},
      })
    );

    expect(result.readyForWorkflow).toBe(false);
    expect(result.status).toBe(PlanningStatus.AwaitingInput);
    expect(result.missingInformation.some((m) => m.field === "productName")).toBe(true);

    await core.stop("test cleanup");
  });

  it("stores planning history records", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    await engine.planFromDecision(approvedInput());

    expect(engine.history.getCount()).toBe(1);
    const historyPath = engine.history.getHistoryPath();
    expect(historyPath).toBe(path.join(storageRoot, "plans", "planning-history.jsonl"));
    expect(fs.existsSync(historyPath!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("logs planning tasks, plans, and validation", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    await engine.planFromDecision(approvedInput());

    const entries = engine.logger.getEntries();
    expect(entries.some((e) => e.event === "planning")).toBe(true);
    expect(entries.some((e) => e.event === "plan")).toBe(true);
    expect(entries.some((e) => e.event === "validation")).toBe(true);

    await core.stop("test cleanup");
  });

  it("rejects when engine is not initialized", async () => {
    const engine = new AiPlanningEngine({ storageRoot });

    await expect(engine.planFromDecision(approvedInput())).rejects.toMatchObject({
      code: "NOT_INITIALIZED",
    });
  });

  it("builds a status report with readiness metrics", async () => {
    const { core, engine } = await startCoreWithPlanningEngine();

    await engine.planFromDecision(approvedInput());

    const report = engine.buildStatusReport();
    expect(report.planningEngineStatus).toBe("operational");
    expect(report.performance.totalPlans).toBe(1);
    expect(report.readinessScore).toBeGreaterThanOrEqual(50);

    await core.stop("test cleanup");
  });
});

describe("Decision integration", () => {
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

  it("creates execution plan after approved decision", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("integration-test");

    const result = await core.getManager().decisionEngine!.decide({
      requestId: "req-planning-gate",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Plan workflow with planning gate",
      statedObjective: "Validate planning-decision pipeline",
      availableData: {
        objective: "Validate planning-decision pipeline",
        brandProfile: { name: "KWIZERA" },
      },
    });

    expect(result.approved).toBe(true);
    expect(result.planningResult).toBeTruthy();
    expect(result.planningResult!.readyForWorkflow).toBe(true);
    expect(result.planningResult!.stepsCompleted.length).toBe(13);
    expect(mapDecisionTypeToPlanningType(DecisionType.General)).toBe(PlanningType.Backup);

    await core.stop("test cleanup");
  });
});

describe("PlanningEngineError", () => {
  it("never executes work — planning only", () => {
    const error = new PlanningEngineError("Planning only", "PLANNING_ONLY");
    expect(error.code).toBe("PLANNING_ONLY");
  });
});
