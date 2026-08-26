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
import {
  CreativeDecisionEngine,
  detectIssues,
  buildRecommendations,
  createCorrectionPlan,
  DECISION_STORE_KEY,
  DECISION_HANDOFF_KEY,
} from "../../../desktop/creative-decision/index.ts";
import { refreshAssistantContext } from "../../../desktop/creative-assistant/context.ts";
import { emptyPreferences } from "../../../desktop/creative-decision/types.ts";
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

describe("creative decision analyze", () => {
  it("detects issues from evidence and prioritizes user feedback", () => {
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
      marketingSummary: "Goal: Sales · Platforms: TikTok · CTA: Shop Now",
      creativeSummary: "3 scenes",
      productionId: "prod-1",
      runId: "run-1",
      versionLabel: "v1.0",
      reviewStatus: "IN_REVIEW",
      productionStatus: "COMPLETED",
      qcOverall: "PASS",
      qcFailures: [],
      qcWarnings: ["Check unavailable: frame hash"],
      scenes: [
        { id: "s1", name: "Intro", number: 1, hasVisual: true, hasVoice: true, hasText: false },
        { id: "s3", name: "Product", number: 3, hasVisual: false, hasVoice: true, hasText: false },
      ],
      selectedSceneId: "s3",
      feedbackCount: 1,
      commentCount: 0,
      noteCount: 0,
      packageId: "pkg-1",
      videoAvailable: true,
      videoMeta: "1080x1920 · 30 FPS · 12s",
      progress: 100,
      currentStage: "COMPLETE",
      etaLabel: null,
      resourceSummary: null,
      availableActions: [],
    };

    const review = {
      feedback: [{
        feedbackId: "fb1",
        productionId: "prod-1",
        versionLabel: "v1.0",
        runId: "run-1",
        sceneId: "s3",
        category: "PRODUCT_VISIBILITY" as const,
        timestampSec: null,
        comment: "Scene 3 ndashaka ko product iba nini.",
        createdAt: new Date().toISOString(),
      }],
      timestampComments: [],
      notes: [],
      aiReview: {
        availability: "NOT_AVAILABLE" as const,
        looksGood: [],
        issues: [],
        suggestions: [],
        warnings: [],
        attention: [],
        note: "",
      },
    };

    const issues = detectIssues({
      ctx,
      review: review as never,
      claimAudit: [],
      prefs: { ...emptyPreferences(), preferProductCentered: true },
    });
    expect(issues.some((i) => i.fromUserFeedback)).toBe(true);
    expect(issues.some((i) => i.category === "PRODUCT_VISIBILITY")).toBe(true);
    const userIssue = issues.find((i) => i.fromUserFeedback)!;
    expect(userIssue.priorityScore).toBeGreaterThan(issues.find((i) => !i.fromUserFeedback && i.category === "OUTPUT_QUALITY")?.priorityScore ?? 0);

    const recs = buildRecommendations({ issues, ctx, claimAudit: [], ignoredIds: new Set() });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].confidenceLabel).toBe("NOT AVAILABLE");
    expect(["MUST_FIX", "SHOULD_IMPROVE", "OPTIONAL"]).toContain(recs[0].group);

    const plan = createCorrectionPlan({ ctx, recommendations: recs.map((r) => ({ ...r, selected: true })) });
    expect(plan.sourceVersion).toBe("v1.0");
    expect(plan.targetVersion).toBe("v1.1");
    expect(plan.status).toBe("PENDING_APPROVAL");
    expect(plan.impact.partialSupported).toBe(false);
    expect(plan.impact.notAffected).toContain("Product database");
  });
});

describe("creative decision engine e2e", () => {
  beforeEach(() => { mockStorage(); });

  it("analyzes, prepares plan, applies via existing production, keeps v1.0", async () => {
    const store = mockStorage();
    const versionLabel = await seedThroughReview(store);

    creativeReviewEngine.addFeedback({
      sceneId: creativeReviewEngine.snapshot().state!.scenes[0]?.sceneId ?? null,
      category: "PRODUCT_VISIBILITY",
      comment: "Scene 3 ndashaka ko product iba nini.",
      timestampSec: null,
    });

    const decision = new CreativeDecisionEngine();
    expect(decision.hydrate()).toBe(true);
    const analysis = await decision.runAnalysis(true);
    expect(analysis).toBeTruthy();
    expect(analysis!.recommendations.length).toBeGreaterThan(0);
    expect(analysis!.mustFix.length + analysis!.shouldImprove.length + analysis!.optional.length).toBeGreaterThan(0);

    decision.selectAll("MUST_FIX");
    if (!decision.snapshot().recommendations.some((r) => r.selected)) {
      decision.selectRecommendation(decision.snapshot().recommendations[0].recommendationId, true);
    }
    const plan = decision.preparePlan();
    expect(plan?.status).toBe("PENDING_APPROVAL");
    expect(plan?.sourceVersion).toBe(versionLabel);

    const applied = await decision.applyPlan(plan!.planId);
    expect(applied?.status).toBe("APPLIED");
    expect(applied?.verification?.available).toBe(true);

    const history = listProductionHistory();
    expect(history.some((h) => h.versionLabel === versionLabel)).toBe(true);
    expect(store[DECISION_STORE_KEY]).toBeTruthy();
    expect(store[DECISION_HANDOFF_KEY]).toBeTruthy();
  }, 120_000);

  it("AI Me suggest path uses decision engine", async () => {
    const store = mockStorage();
    await seedThroughReview(store);
    const assistant = new CreativeAssistantEngine();
    expect(assistant.hydrate()).toBe(true);
    await assistant.sendMessage("Ni iki nakosora?");
    const last = assistant.snapshot().conversation?.messages.at(-1);
    expect(last?.intent).toBe("SUGGEST");
    expect(last?.body.toLowerCase()).toMatch(/recommend/);
    expect(refreshAssistantContext().available).toBe(true);
  }, 120_000);

  it("ignore does not resurface until content changes", async () => {
    const store = mockStorage();
    await seedThroughReview(store);
    const decision = new CreativeDecisionEngine();
    decision.hydrate();
    await decision.runAnalysis(true);
    const id = decision.snapshot().recommendations[0]?.recommendationId;
    expect(id).toBeTruthy();
    decision.ignoreRecommendation(id!);
    await decision.runAnalysis(false);
    // cached — still ignored in list filter of UI; status IGNORED remains
    expect(decision.snapshot().recommendations.find((r) => r.recommendationId === id)?.status).toBe("IGNORED");
    expect(store[DECISION_STORE_KEY]).toBeTruthy();
  }, 120_000);
});
