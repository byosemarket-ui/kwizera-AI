import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  LearningCategory,
  LearningOutcome,
  LearningSource,
  MemoryStorageType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-learning-memory-test-"));
}

describe("AiLearningMemoryEngine", () => {
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
    await core.start("learning-memory-test");
    const foundation = core.getManager().memoryFoundation!;
    const learning = foundation.getLearningMemoryEngine();
    const storage = foundation.getStorageEngine();
    return { core, foundation, learning, storage };
  }

  it("initializes with memory foundation startup", async () => {
    const { core, learning } = await startCore();
    expect(learning.isInitialized()).toBe(true);
    expect(learning.isStartupComplete()).toBe(true);

    const learningDir = path.join(storageRoot, "memory", "learning");
    expect(fs.existsSync(learningDir)).toBe(true);

    await core.stop();
  });

  it("processes successful learning events through 9-step pipeline", async () => {
    const { core, learning, storage } = await startCore();

    await storage.storeRecord({
      memoryId: "learn-proj-001",
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "Learning Test Project",
      description: "Project for learning memory validation",
      source: "test",
      tags: ["learning"],
      relatedProject: "learn-proj-001",
    });

    const result = await learning.learnFromEvent({
      source: LearningSource.WorkflowHistory,
      category: LearningCategory.Workflow,
      title: "Successful promo workflow",
      description: "Completed promotional video workflow with high engagement metrics and positive user feedback.",
      relatedProject: "learn-proj-001",
      outcome: LearningOutcome.Success,
      qualityScore: 88,
      patterns: ["fast-export", "brand-colors"],
    });

    expect(result.success).toBe(true);
    expect(result.rejected).toBe(false);
    expect(result.stepsCompleted).toBe(9);
    expect(result.learningId).toBeDefined();

    const history = learning.getLearningHistory();
    expect(history.length).toBe(1);
    expect(history[0].relatedMemories.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("rejects low-quality learning without valuable failure lesson", async () => {
    const { core, learning } = await startCore();

    const result = await learning.learnFromEvent({
      source: LearningSource.Video,
      category: LearningCategory.Video,
      title: "Poor quality render",
      description: "Failed",
      outcome: LearningOutcome.Failure,
      qualityScore: 20,
    });

    expect(result.success).toBe(false);
    expect(result.rejected).toBe(true);
    expect(learning.getLearningHistory().length).toBe(0);

    await core.stop();
  });

  it("learns from failure when lesson is provided", async () => {
    const { core, learning } = await startCore();

    const result = await learning.learnFromEvent({
      source: LearningSource.WorkflowHistory,
      category: LearningCategory.Workflow,
      title: "Export timeout failure",
      description: "Workflow failed due to oversized assets during export phase.",
      outcome: LearningOutcome.Failure,
      qualityScore: 40,
      lessonLearned: "Compress assets before export to avoid timeout",
    });

    expect(result.success).toBe(true);
    expect(learning.getLearningHistory().length).toBe(1);

    await core.stop();
  });

  it("learns and persists user preferences", async () => {
    const { core, learning } = await startCore();

    const prefs = await learning.updateUserPreferences({
      videoStyle: "cinematic",
      marketingStyle: "bold",
      colors: ["#1a1a2e", "#e94560"],
      animationSpeed: "medium",
      preferredWorkflow: "promo-fast",
    });

    expect(prefs.videoStyle).toBe("cinematic");
    expect(prefs.colors).toEqual(["#1a1a2e", "#e94560"]);
    expect(learning.getUserPreferences().preferredWorkflow).toBe("promo-fast");

    const prefsPath = path.join(storageRoot, "memory", "learning", "user-preferences.json");
    expect(fs.existsSync(prefsPath)).toBe(true);

    await core.stop();
  });

  it("processes user corrections as high-value learning", async () => {
    const { core, learning } = await startCore();

    const result = await learning.learnFromUserCorrection(
      "Use warmer brand colors in future videos",
      { relatedProject: "learn-proj-002", category: LearningCategory.Brand }
    );

    expect(result.success).toBe(true);
    expect(result.learningValue).toBeGreaterThan(50);

    await core.stop();
  });

  it("provides self-improvement insights and recommendations", async () => {
    const { core, learning } = await startCore();

    await learning.learnFromEvent({
      source: LearningSource.DecisionHistory,
      category: LearningCategory.Decision,
      title: "Chose vertical format",
      description: "Vertical format performed well on social platforms with strong engagement.",
      outcome: LearningOutcome.Success,
      qualityScore: 90,
    });

    await learning.learnFromEvent({
      source: LearningSource.WorkflowHistory,
      category: LearningCategory.Workflow,
      title: "Skipped asset compression",
      description: "Export failed when assets were too large.",
      outcome: LearningOutcome.Failure,
      qualityScore: 40,
      lessonLearned: "Always compress before export",
    });

    const insights = learning.getSelfImprovementInsights();
    expect(insights.workedWell.length).toBeGreaterThan(0);
    expect(insights.neverRepeat.length + insights.failed.length).toBeGreaterThan(0);
    expect(insights.recommendations.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("writes learning logs to storage root", async () => {
    const { core, learning } = await startCore();

    await learning.learnFromEvent({
      source: LearningSource.UserFeedback,
      category: LearningCategory.Project,
      title: "Positive feedback",
      description: "User praised the final promotional video quality and pacing.",
      qualityScore: 85,
    });

    const logDir = path.join(storageRoot, "logs");
    const logFiles = fs.readdirSync(logDir).filter((f) => f.startsWith("learning-memory-engine"));
    expect(logFiles.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, learning } = await startCore();

    await learning.learnFromEvent({
      source: LearningSource.MarketingCampaign,
      category: LearningCategory.Marketing,
      title: "Campaign success",
      description: "Marketing campaign exceeded click-through targets on primary channels.",
      qualityScore: 92,
    });

    const report = learning.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.totalLearningRecords).toBe(1);
    expect(report.learningAccuracy).toBeGreaterThan(0);

    await core.stop();
  });
});
