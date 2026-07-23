import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiReasoningEngine,
  ConfidenceCalculator,
  ConfidenceLevel,
  ReasoningEngineError,
  ReasoningStatus,
  ReasoningStep,
  ReasoningType,
} from "@ai/reasoning/index.js";
import { AiCore, createAiCore } from "@ai/core";
import { DecisionPriority, DecisionType } from "@ai/decision/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-reasoning-test-"));
}

describe("AiReasoningEngine", () => {
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

  async function startCoreWithReasoningEngine() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("reasoning-test");
    const engine = core.getManager().reasoningEngine;
    expect(engine).toBeTruthy();
    return { core, engine: engine! };
  }

  it("initializes with AI Core and writes logs to storage logs directory", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    expect(engine.isInitialized()).toBe(true);
    expect(engine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(engine.logger.getLogDirectory()!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("completes all 12 reasoning steps for workflow planning", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    const result = await engine.reason({
      taskId: "task-workflow-1",
      type: ReasoningType.WorkflowPlanning,
      userObjective: "Plan the next creative workflow",
      userRequest: "Plan the next creative workflow",
      inputs: {
        brandProfile: { name: "KWIZERA" },
        objective: "Plan the next creative workflow",
      },
    });

    expect(result.readyForDecision).toBe(true);
    expect(result.status).toBe(ReasoningStatus.Complete);
    expect(result.stepsCompleted.length).toBe(12);
    expect(result.stepsCompleted).toContain(ReasoningStep.SendToDecisionEngine);
    expect(result.recommendation).toBeTruthy();
    expect(result.confidence.sufficient).toBe(true);

    await core.stop("test cleanup");
  });

  it("performs context analysis with required factors", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    const result = await engine.reason({
      taskId: "task-context-1",
      type: ReasoningType.MarketingStrategy,
      userObjective: "Launch campaign for new product",
      userRequest: "Create marketing strategy",
      inputs: {
        marketingGoal: "Increase awareness",
        targetAudience: "Young professionals",
        brandProfile: { name: "KWIZERA" },
        productName: "Smart Lamp",
      },
    });

    expect(result.contextAnalysis.marketingGoal).toBe("Increase awareness");
    expect(result.contextAnalysis.targetAudience).toBe("Young professionals");
    expect(result.contextAnalysis.brandIdentity).toBe("KWIZERA");
    expect(result.contextAnalysis.completenessScore).toBeGreaterThanOrEqual(60);

    await core.stop("test cleanup");
  });

  it("blocks recommendation when confidence is too low", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    const result = await engine.reason({
      taskId: "task-low-confidence",
      type: ReasoningType.ProductAnalysis,
      userObjective: "Analyze product",
      userRequest: "Analyze my product",
      inputs: {},
    });

    expect(result.readyForDecision).toBe(false);
    expect(result.status).toBe(ReasoningStatus.AwaitingInput);
    expect(result.confidence.sufficient).toBe(false);
    expect(result.missingInformation.some((m) => m.field === "productName")).toBe(true);

    await core.stop("test cleanup");
  });

  it("stores reasoning history records", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    await engine.reason({
      taskId: "task-history-1",
      type: ReasoningType.WorkflowPlanning,
      userObjective: "History test",
      userRequest: "History test",
      inputs: { brandProfile: { name: "KWIZERA" } },
    });

    expect(engine.history.getCount()).toBe(1);
    const historyPath = engine.history.getHistoryPath();
    expect(historyPath).toBe(path.join(storageRoot, "reasoning", "reasoning-history.jsonl"));
    expect(fs.existsSync(historyPath!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("logs reasoning tasks, confidence, and recommendations", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    await engine.reason({
      taskId: "task-log-1",
      type: ReasoningType.ProductAnalysis,
      userObjective: "Analyze product",
      userRequest: "Analyze without required fields",
      inputs: {},
    });

    const entries = engine.logger.getEntries();
    expect(entries.some((e) => e.event === "reasoning")).toBe(true);
    expect(entries.some((e) => e.event === "confidence")).toBe(true);
    expect(entries.some((e) => e.level === "warn")).toBe(true);

    await core.stop("test cleanup");
  });

  it("analyzes errors and recommends safest recovery", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    const analysis = engine.analyzeError({
      errorMessage: "Missing required field: productName",
      stage: "validation",
    });

    expect(analysis.rootCause).toContain("Required input");
    expect(analysis.recoveryOptions.length).toBeGreaterThanOrEqual(3);
    expect(analysis.safestOptionId).toBeTruthy();
    expect(engine.logger.getEntries().some((e) => e.event === "recovery")).toBe(true);

    await core.stop("test cleanup");
  });

  it("maps confidence score to levels correctly", () => {
    const calculator = new ConfidenceCalculator();
    expect(calculator.scoreToLevel(95)).toBe(ConfidenceLevel.VeryHigh);
    expect(calculator.scoreToLevel(80)).toBe(ConfidenceLevel.High);
    expect(calculator.scoreToLevel(60)).toBe(ConfidenceLevel.Medium);
    expect(calculator.scoreToLevel(40)).toBe(ConfidenceLevel.Low);
    expect(calculator.scoreToLevel(20)).toBe(ConfidenceLevel.VeryLow);
  });

  it("rejects when engine is not initialized", async () => {
    const engine = new AiReasoningEngine({ storageRoot });

    await expect(
      engine.reason({
        taskId: "task-uninit",
        type: ReasoningType.WorkflowPlanning,
        userObjective: "Should fail",
        userRequest: "Should fail",
        inputs: {},
      })
    ).rejects.toMatchObject({ code: "NOT_INITIALIZED" });
  });

  it("builds a status report with readiness metrics", async () => {
    const { core, engine } = await startCoreWithReasoningEngine();

    await engine.reason({
      taskId: "task-status",
      type: ReasoningType.WorkflowPlanning,
      userObjective: "Status report test",
      userRequest: "Status report test",
      inputs: { brandProfile: { name: "KWIZERA" } },
    });

    const report = engine.buildStatusReport();
    expect(report.reasoningEngineStatus).toBe("operational");
    expect(report.performance.totalReasonings).toBe(1);
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

  it("requires reasoning before decision approval", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("integration-test");

    const result = await core.getManager().decisionEngine!.decide({
      requestId: "req-reasoning-gate",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Plan workflow with reasoning gate",
      statedObjective: "Validate reasoning-decision pipeline",
      availableData: {
        objective: "Validate reasoning-decision pipeline",
        brandProfile: { name: "KWIZERA" },
      },
    });

    expect(result.reasoningResult).toBeTruthy();
    expect(result.reasoningResult!.readyForDecision).toBe(true);
    expect(result.approved).toBe(true);

    await core.stop("test cleanup");
  });
});

describe("ReasoningEngineError", () => {
  it("never invents missing information", () => {
    const error = new ReasoningEngineError("Missing data", "MISSING_INFO", [
      { field: "productName", severity: "critical", message: "Required" },
    ]);

    expect(error.missingInformation).toHaveLength(1);
    expect(error.code).toBe("MISSING_INFO");
  });
});
