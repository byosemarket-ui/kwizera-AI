import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiDecisionEngine,
  DecisionEngineError,
  DecisionPriority,
  DecisionStatus,
  DecisionStep,
  DecisionType,
} from "@ai/decision/index.js";
import { AiCore, createAiCore } from "@ai/core";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-decision-test-"));
}

describe("AiDecisionEngine", () => {
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

  async function startCoreWithDecisionEngine() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("decision-test");
    const engine = core.getManager().decisionEngine;
    expect(engine).toBeTruthy();
    return { core, engine: engine! };
  }

  it("initializes with AI Core and writes logs to storage logs directory", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    expect(engine.isInitialized()).toBe(true);
    expect(engine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(engine.logger.getLogDirectory()!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("approves a general decision through all 12 steps", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    const result = await engine.decide({
      requestId: "req-general-1",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Plan next creative workflow step",
      statedObjective: "Determine optimal workflow",
      availableData: {
        objective: "Determine optimal workflow",
        brandProfile: { name: "KWIZERA" },
      },
    });

    expect(result.approved).toBe(true);
    expect(result.canExecute).toBe(true);
    expect(result.status).toBe(DecisionStatus.Approved);
    expect(result.stepsCompleted).toContain(DecisionStep.PassToWorkflow);
    expect(result.stepsCompleted.length).toBe(12);
    expect(result.workflowHandoff?.workflowId).toBeTruthy();
    expect(result.validation?.passed).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    await core.stop("test cleanup");
  });

  it("blocks execution when critical information is missing", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    const result = await engine.decide({
      requestId: "req-product-missing",
      type: DecisionType.ProductAnalysis,
      priority: DecisionPriority.High,
      userRequest: "Analyze my product",
      availableData: {},
    });

    expect(result.approved).toBe(false);
    expect(result.canExecute).toBe(false);
    expect(result.status).toBe(DecisionStatus.AwaitingInput);
    expect(result.missingInformation.some((m) => m.field === "productName")).toBe(true);
    expect(result.workflowHandoff).toBeUndefined();

    await core.stop("test cleanup");
  });

  it("generates quality recommendations without approving insufficient data", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    const result = await engine.decide({
      requestId: "req-export-incomplete",
      type: DecisionType.Export,
      priority: DecisionPriority.Normal,
      userRequest: "Export project deliverables",
      availableData: { projectId: "" },
    });

    expect(result.approved).toBe(false);
    expect(result.canExecute).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);

    await core.stop("test cleanup");
  });

  it("stores decision history records", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    await engine.decide({
      requestId: "req-history-1",
      type: DecisionType.General,
      priority: DecisionPriority.Low,
      userRequest: "Record history test",
      availableData: { brandProfile: { name: "KWIZERA" } },
    });

    expect(engine.history.getCount()).toBe(1);
    const historyPath = engine.history.getHistoryPath();
    expect(historyPath).toBe(path.join(storageRoot, "decisions", "decision-history.jsonl"));
    expect(fs.existsSync(historyPath!)).toBe(true);

    await core.stop("test cleanup");
  });

  it("logs decisions, validation, and warnings", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    await engine.decide({
      requestId: "req-log-1",
      type: DecisionType.ProductAnalysis,
      priority: DecisionPriority.Normal,
      userRequest: "Analyze product without required fields",
      availableData: {},
    });

    const entries = engine.logger.getEntries();
    expect(entries.some((e) => e.event === "decision")).toBe(true);
    expect(entries.some((e) => e.level === "warn")).toBe(true);

    await core.stop("test cleanup");
  });

  it("allows only one critical decision at a time", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    const request = {
      requestId: "req-critical",
      type: DecisionType.General,
      priority: DecisionPriority.Critical,
      userRequest: "Critical workflow planning",
      availableData: { brandProfile: { name: "KWIZERA" } },
    };

    engine.priorityManager.acquire(DecisionPriority.Critical, "blocking-id");

    await expect(engine.decide(request)).rejects.toMatchObject({
      code: "CRITICAL_TASK_LIMIT",
    });

    engine.priorityManager.release("blocking-id");
    await core.stop("test cleanup");
  });

  it("rejects decisions when engine is not initialized", async () => {
    const engine = new AiDecisionEngine({ storageRoot });

    await expect(
      engine.decide({
        requestId: "req-uninit",
        type: DecisionType.General,
        priority: DecisionPriority.Normal,
        userRequest: "Should fail",
        availableData: {},
      })
    ).rejects.toMatchObject({ code: "NOT_INITIALIZED" });
  });

  it("builds a status report with readiness metrics", async () => {
    const { core, engine } = await startCoreWithDecisionEngine();

    await engine.decide({
      requestId: "req-status",
      type: DecisionType.General,
      priority: DecisionPriority.Background,
      userRequest: "Status report test",
      availableData: { brandProfile: { name: "KWIZERA" } },
    });

    const report = engine.buildStatusReport();
    expect(report.decisionEngineStatus).toBe("operational");
    expect(report.validationStatus).toBe("ready");
    expect(report.performance.totalDecisions).toBe(1);
    expect(report.readinessScore).toBeGreaterThanOrEqual(50);

    await core.stop("test cleanup");
  });
});

describe("DecisionEngineError", () => {
  it("never pretends completion when information is missing", () => {
    const error = new DecisionEngineError("Missing data", "MISSING_INFO", [
      { field: "productName", severity: "critical", message: "Required" },
    ]);

    expect(error.missingInformation).toHaveLength(1);
    expect(error.code).toBe("MISSING_INFO");
  });
});
