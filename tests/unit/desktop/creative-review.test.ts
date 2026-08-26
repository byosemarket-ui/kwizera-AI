import { describe, expect, it, beforeEach } from "vitest";
import { assemblePipelineState } from "../../../desktop/production-pipeline/assemble.ts";
import { ProductionPipelineEngine } from "../../../desktop/production-pipeline/pipeline-engine.ts";
import { buildLiveStateFromPipeline } from "../../../desktop/production-command-center/command-center-engine.ts";
import { COMMAND_CENTER_HANDOFF_KEY } from "../../../desktop/production-command-center/types.ts";
import { ProductionFinalEngine, loadFinalCompleteHandoff } from "../../../desktop/production-final/final-engine.ts";
import {
  assembleReviewState,
  buildCreativeScore,
  buildVideoMeta,
  buildAiMeContract,
  formatClock,
  versionKey,
} from "../../../desktop/creative-review/assemble.ts";
import {
  CreativeReviewEngine,
  loadStep2AssistantHandoff,
} from "../../../desktop/creative-review/review-engine.ts";
import { REVIEW_STORE_KEY, REVIEW_HANDOFF_KEY } from "../../../desktop/creative-review/types.ts";
import { makeExecutionPackage, mockStorage, seedPackage } from "./production-test-helpers.ts";

describe("creative review assemble", () => {
  it("builds video meta and never invents creative scores", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    state.readyForStep3 = true;
    const live = buildLiveStateFromPipeline(state);
    const video = buildVideoMeta(null, null);
    expect(video.available).toBe(false);
    expect(video.unavailableReason).toMatch(/not found/i);
    const score = buildCreativeScore(null);
    expect(score.available).toBe(false);
    expect(score.label).toBe("NOT AVAILABLE");
    expect(formatClock(65)).toBe("01:05");
    expect(versionKey("p1", "v1.0")).toBe("p1::v1.0");
    expect(live.productionId).toBeTruthy();
  });
});

describe("creative review engine workflow", () => {
  beforeEach(() => { mockStorage(); });

  it("loads Phase 5 package, reviews, feedback, approve, Step 2 handoff", async () => {
    const store = mockStorage();
    seedPackage(store);
    const pipeline = new ProductionPipelineEngine();
    pipeline.setAllowHttp(false);
    pipeline.hydrate();
    await pipeline.start();
    for (let i = 0; i < 100; i++) {
      if (pipeline.snapshot().state?.readyForStep3) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    const pipeState = pipeline.snapshot().state!;
    store[COMMAND_CENTER_HANDOFF_KEY] = JSON.stringify({
      ...buildLiveStateFromPipeline(pipeState),
      status: "READY FOR FINAL ASSEMBLY / STEP 4",
    });

    const final = new ProductionFinalEngine();
    expect(final.hydrate()).toBe(true);
    await final.start();
    expect(final.snapshot().state?.status).toBe("COMPLETED");
    expect(loadFinalCompleteHandoff()?.status).toBe("PRODUCTION COMPLETE");

    const events: string[] = [];
    const review = new CreativeReviewEngine();
    review.setEventEmitter((_t, payload) => {
      if (typeof payload.action === "string") events.push(payload.action);
    });
    expect(review.hydrate()).toBe(true);
    const snap = review.snapshot().state!;
    expect(snap.reviewStatus).toBe("READY_FOR_REVIEW");
    expect(snap.productionId).toBeTruthy();
    expect(snap.versionLabel).toBeTruthy();
    expect(snap.scenes.length).toBeGreaterThan(0);
    expect(snap.qc?.overall).toBe("PASS");
    expect(snap.creativeScore.label).toBe("NOT AVAILABLE");
    expect(snap.aiReview.availability).toBe("NOT_AVAILABLE");
    expect(snap.video.path).toBeTruthy();

    review.selectScene(snap.scenes[0].sceneId);
    review.addTimestampComment(3.5, "CTA should appear earlier.", snap.scenes[0].sceneId);
    review.addFeedback({
      sceneId: snap.scenes[0].sceneId,
      category: "PRODUCT_VISIBILITY",
      comment: "Make the product larger.",
      timestampSec: 6,
    });
    review.addNote("Overall look is strong.", snap.scenes[0].sceneId, 1);
    review.requestChanges();
    expect(review.snapshot().state?.reviewStatus).toBe("NEEDS_CHANGES");
    expect(review.snapshot().state?.timestampComments.length).toBe(1);
    expect(review.snapshot().state?.feedback.length).toBe(1);

    review.approve();
    expect(review.snapshot().state?.reviewStatus).toBe("APPROVED");

    const contract = review.getAiMeContract();
    expect(contract.step).toBe("phase-6-step-2-ai-assistant");
    expect(contract.explanation).toMatch(/version/i);
    expect(loadStep2AssistantHandoff()?.productionId).toBe(snap.productionId);
    expect(store[REVIEW_STORE_KEY]).toBeTruthy();
    expect(store[REVIEW_HANDOFF_KEY]).toBeTruthy();
    expect(events).toContain("FeedbackCreated");
    expect(events).toContain("ReviewUpdated");

    // Version isolation
    const assembled = assembleReviewState({
      handoff: loadFinalCompleteHandoff(),
      final: final.snapshot().state,
      history: [],
      reviewStatus: "READY_FOR_REVIEW",
      feedback: [{
        feedbackId: "x", productionId: "other", versionLabel: "v9.9", runId: "r",
        sceneId: null, category: "OTHER", timestampSec: null, comment: "wrong", createdAt: new Date().toISOString(),
      }],
      notes: [],
      timestampComments: [],
      selectedSceneId: null,
    });
    expect(assembled.feedback.length).toBe(0);
    expect(buildAiMeContract(assembled).versionLabel).toBe(assembled.versionLabel);
  }, 90000);

  it("refuses without Phase 5 package", () => {
    mockStorage();
    const review = new CreativeReviewEngine();
    expect(review.hydrate()).toBe(false);
  });
});
