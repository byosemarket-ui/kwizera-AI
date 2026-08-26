import { describe, expect, it, beforeEach } from "vitest";
import { ProductionPipelineEngine } from "../../../desktop/production-pipeline/pipeline-engine.ts";
import { buildLiveStateFromPipeline } from "../../../desktop/production-command-center/command-center-engine.ts";
import { COMMAND_CENTER_HANDOFF_KEY } from "../../../desktop/production-command-center/types.ts";
import {
  ProductionFinalEngine,
  productionFinalEngine,
  listProductionHistory,
} from "../../../desktop/production-final/final-engine.ts";
import { creativeReviewEngine } from "../../../desktop/creative-review/review-engine.ts";
import { CreativeAssistantEngine } from "../../../desktop/creative-assistant/index.ts";
import { creativeDecisionEngine } from "../../../desktop/creative-decision/index.ts";
import {
  CreativeMemoryEngine,
  buildCreativeProfile,
  resolveNextAction,
  detectWorkflowPhase,
  retrieveRelevantMemory,
  CREATIVE_MEMORY_KEY,
  PHASE6_COMPLETE_KEY,
  loadPhase6Complete,
} from "../../../desktop/creative-memory/index.ts";
import { emptyPreferences } from "../../../desktop/creative-decision/types.ts";
import { refreshAssistantContext } from "../../../desktop/creative-assistant/context.ts";
import { mockStorage, seedPackage } from "./production-test-helpers.ts";

async function seedThroughReview(store: Record<string, string>) {
  seedPackage(store);
  const pipeline = new ProductionPipelineEngine();
  pipeline.setAllowHttp(false);
  pipeline.hydrate();
  await pipeline.start();
  for (let i = 0; i < 100; i++) {
    if (pipeline.snapshot().state?.readyForStep3) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  store[COMMAND_CENTER_HANDOFF_KEY] = JSON.stringify({
    ...buildLiveStateFromPipeline(pipeline.snapshot().state!),
    status: "READY FOR FINAL ASSEMBLY / STEP 4",
  });
  const final = new ProductionFinalEngine();
  expect(final.hydrate()).toBe(true);
  await final.start();
  expect(productionFinalEngine.hydrate()).toBe(true);
  expect(creativeReviewEngine.hydrate()).toBe(true);
  return creativeReviewEngine.snapshot().state!.versionLabel;
}

describe("creative memory helpers", () => {
  it("builds profile, retrieves memory, resolves next action", () => {
    const ctx = {
      version: 1 as const,
      refreshedAt: new Date().toISOString(),
      available: true,
      unavailableReason: null,
      contract: null,
      projectId: "p1",
      projectName: "Demo",
      productName: "Shoes",
      productSummary: "Shoes",
      marketingSummary: "Goal: Sales · Platforms: TikTok · CTA: Shop Now · Language: Kinyarwanda",
      creativeSummary: "Camera: static · Music: soft",
      productionId: "prod-1",
      runId: "run-1",
      versionLabel: "v1.0",
      reviewStatus: "READY_FOR_REVIEW",
      productionStatus: "COMPLETED",
      qcOverall: "PASS",
      qcFailures: [],
      qcWarnings: [],
      scenes: [],
      selectedSceneId: null,
      feedbackCount: 0,
      commentCount: 0,
      noteCount: 0,
      packageId: "pkg",
      videoAvailable: true,
      videoMeta: "12s",
      progress: 100,
      currentStage: "COMPLETE",
      etaLabel: null,
      resourceSummary: null,
      availableActions: [],
    };
    const prefs = { ...emptyPreferences(), preferProductCentered: true, preferStrongerCta: true };
    const profile = buildCreativeProfile({ ctx, prefs, memories: [] });
    expect(profile?.platform).toMatch(/TikTok/i);
    expect(profile?.productPresentation).toMatch(/Product-centered/i);

    const phase = detectWorkflowPhase({
      ctx,
      review: null,
      finalStatus: "COMPLETED",
      hasRecommendations: true,
      pendingPlan: false,
    });
    expect(phase).toBe("REVIEW");
    const next = resolveNextAction({
      phase,
      highPriority: 1,
      recommendationCount: 2,
      reviewStatus: "READY_FOR_REVIEW",
      qcOverall: "PASS",
    });
    expect(next.kind).toBe("FIX");
    expect(next.workspace).toBe("creative-review");

    const mems = retrieveRelevantMemory([
      {
        memoryId: "m1",
        projectId: "p1",
        category: "PREFERENCE_MEMORY",
        content: "Keep product centered.",
        importance: "HIGH",
        source: "USER",
        confidence: "CONFIRMED",
        lifecycle: "ACTIVE",
        topic: "product-presentation",
        versionLabel: "v1.0",
        relatedRecommendationId: null,
        decision: "APPROVED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        disabled: false,
      },
    ], "p1", "product");
    expect(mems.length).toBe(1);
  });
});

describe("creative memory engine e2e", () => {
  beforeEach(() => { mockStorage(); });

  it("learns from correction, stores memory, loads next action, marks phase 6 complete", async () => {
    const store = mockStorage();
    const v0 = await seedThroughReview(store);

    creativeReviewEngine.addFeedback({
      sceneId: creativeReviewEngine.snapshot().state!.scenes[0]?.sceneId ?? null,
      category: "PRODUCT_VISIBILITY",
      comment: "Scene 3 ndashaka ko product iba nini.",
      timestampSec: null,
    });

    const memory = new CreativeMemoryEngine();
    expect(memory.hydrate()).toBe(true);
    memory.syncPreferencesToMemory();

    await creativeDecisionEngine.runAnalysis(true);
    creativeDecisionEngine.selectRecommendation(
      creativeDecisionEngine.snapshot().recommendations[0].recommendationId,
      true,
    );
    const plan = creativeDecisionEngine.preparePlan();
    expect(plan?.sourceVersion).toBe(v0);
    const applied = await creativeDecisionEngine.applyPlan(plan!.planId);
    expect(applied?.status).toBe("APPLIED");

    // Allow dynamic memory follow-up
    await new Promise((r) => setTimeout(r, 80));
    memory.hydrate();
    memory.learnFromDecisionSnapshot();
    memory.runSafeAutomation("correction_complete");
    await new Promise((r) => setTimeout(r, 80));

    const snap = memory.snapshot();
    expect(snap.memories.length).toBeGreaterThan(0);
    expect(snap.nextAction).toBeTruthy();
    expect(snap.summary?.lines.length).toBeGreaterThan(3);
    expect(store[CREATIVE_MEMORY_KEY]).toBeTruthy();

    const history = listProductionHistory();
    expect(history.some((h) => h.versionLabel === v0)).toBe(true);

    memory.markPhase6Complete(refreshAssistantContext().projectId, refreshAssistantContext().productionId);
    expect(loadPhase6Complete()?.status).toBe("COMPLETE");
    expect(store[PHASE6_COMPLETE_KEY]).toBeTruthy();
  }, 120_000);

  it("AI Me smart summary uses integration layer", async () => {
    const store = mockStorage();
    await seedThroughReview(store);
    const memory = new CreativeMemoryEngine();
    memory.hydrate();
    const assistant = new CreativeAssistantEngine();
    assistant.hydrate();
    await assistant.sendMessage("Nkora iki ubu?");
    const last = assistant.snapshot().conversation?.messages.at(-1);
    expect(last?.title).toMatch(/Smart Summary/i);
    expect(last?.body).toMatch(/WHAT IS CURRENT|Version/i);
    expect(store).toBeTruthy();
  }, 120_000);

  it("project-scoped memory does not leak across projects", () => {
    mockStorage();
    const memory = new CreativeMemoryEngine();
    memory.hydrate();
    memory.remember({
      projectId: "project-a",
      category: "PREFERENCE_MEMORY",
      content: "Minimal music.",
      importance: "MEDIUM",
      source: "USER",
      confidence: "CONFIRMED",
      topic: "music-style",
    });
    memory.remember({
      projectId: "project-b",
      category: "PREFERENCE_MEMORY",
      content: "Strong music.",
      importance: "MEDIUM",
      source: "USER",
      confidence: "CONFIRMED",
      topic: "music-style",
    });
    const a = retrieveRelevantMemory(
      JSON.parse(localStorage.getItem(CREATIVE_MEMORY_KEY)!).byProject["project-a"],
      "project-a",
      "music",
    );
    expect(a[0].content).toMatch(/Minimal/);
    expect(a.every((m) => m.projectId === "project-a")).toBe(true);
  });
});
