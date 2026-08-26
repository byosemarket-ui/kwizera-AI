import { describe, expect, it, beforeEach } from "vitest";
import { assemblePipelineState } from "../../../desktop/production-pipeline/assemble.ts";
import { ProductionPipelineEngine } from "../../../desktop/production-pipeline/pipeline-engine.ts";
import { buildLiveStateFromPipeline } from "../../../desktop/production-command-center/command-center-engine.ts";
import { COMMAND_CENTER_HANDOFF_KEY } from "../../../desktop/production-command-center/types.ts";
import {
  ProductionFinalEngine,
  productionFinalEngine,
  loadFinalCompleteHandoff,
  listProductionHistory,
} from "../../../desktop/production-final/final-engine.ts";
import { creativeReviewEngine } from "../../../desktop/creative-review/review-engine.ts";
import { REVIEW_STORE_KEY, REVIEW_HANDOFF_KEY } from "../../../desktop/creative-review/types.ts";
import {
  CreativeAssistantEngine,
  detectIntent,
  detectLanguage,
  bumpVersionLabel,
  refreshAssistantContext,
  ASSISTANT_STORE_KEY,
  ASSISTANT_AUDIT_KEY,
  ASSISTANT_CHAT_KEY,
} from "../../../desktop/creative-assistant/index.ts";
import { makeExecutionPackage, mockStorage, seedPackage } from "./production-test-helpers.ts";

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

  // Hydrate shared singletons used by AI Me orchestration
  expect(productionFinalEngine.hydrate()).toBe(true);
  expect(creativeReviewEngine.hydrate()).toBe(true);
  return {
    versionLabel: creativeReviewEngine.snapshot().state!.versionLabel,
  };
}

describe("creative assistant intent + language", () => {
  it("detects EN/RW intents without inventing destructive guesses", () => {
    expect(detectLanguage("Why did QC fail?")).toBe("en");
    expect(detectLanguage("Ni iki kitagenda neza?")).toBe("rw");
    expect(detectIntent("Why did QC fail?").intent).toBe("QC_QUERY");
    expect(detectIntent("Production igeze he?").intent).toBe("PRODUCTION_QUERY");
    expect(detectIntent("Make it better.").intent).toBe("CLARIFY");
    expect(detectIntent("Delete the final output").intent).toBe("REJECT");
    expect(detectIntent("Suggest improvements").intent).toBe("SUGGEST");
    expect(detectIntent("Gabanya music.").intent).toBe("REQUEST_CHANGE");
    expect(bumpVersionLabel("v1.0")).toBe("v1.1");
  });
});

describe("creative assistant engine", () => {
  beforeEach(() => { mockStorage(); });

  it("loads context, chats, quick commands, feedback + confirmed version handoff", async () => {
    const store = mockStorage();
    const { versionLabel } = await seedThroughReview(store);

    const assistant = new CreativeAssistantEngine();
    expect(assistant.hydrate()).toBe(true);
    const ctx = refreshAssistantContext();
    expect(ctx.available).toBe(true);
    expect(ctx.productionId).toBeTruthy();
    expect(ctx.versionLabel).toBe(versionLabel);
    expect(ctx.scenes.length).toBeGreaterThan(0);

    await assistant.sendQuickCommand("explain-qc");
    let snap = assistant.snapshot();
    expect(snap.conversation?.messages.some((m) => m.role === "assistant" && m.intent === "QC_QUERY")).toBe(true);

    await assistant.sendMessage("Scene 3 ntabwo igaragara neza.");
    snap = assistant.snapshot();
    expect(creativeReviewEngine.snapshot().state?.feedback.length).toBeGreaterThan(0);
    expect(creativeReviewEngine.snapshot().state?.reviewStatus).toBe("NEEDS_CHANGES");
    expect(snap.pendingProposal?.status).toBe("PENDING_APPROVAL");
    expect(snap.pendingProposal?.sourceVersionId).toBe(versionLabel);
    expect(snap.pendingProposal?.requestedVersion).toBe(bumpVersionLabel(versionLabel));
    expect(snap.audit.some((a) => a.action === "FEEDBACK_SAVED")).toBe(true);
    expect(snap.audit.some((a) => a.action === "CHANGE_PROPOSAL_CREATED")).toBe(true);

    const changeId = snap.pendingProposal!.changeId;

    await assistant.sendMessage("Make it better.");
    snap = assistant.snapshot();
    expect(snap.conversation?.messages.at(-1)?.intent).toBe("CLARIFY");
    expect(assistant.snapshot().pendingProposal?.changeId).toBe(changeId);

    await assistant.handleAction({
      id: "apply",
      label: "APPLY",
      kind: "proceed",
      payload: { changeId },
    });

    snap = assistant.snapshot();
    const applied = snap.proposals.find((p) => p.changeId === changeId);
    expect(applied?.status).toBe("APPLIED");
    expect(snap.audit.some((a) => a.action === "USER_CONFIRMED")).toBe(true);
    expect(snap.audit.some((a) => a.action === "COMMAND_EXECUTED")).toBe(true);

    const history = listProductionHistory();
    expect(history.some((h) => h.versionLabel === versionLabel)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);

    expect(store[ASSISTANT_CHAT_KEY]).toBeTruthy();
    expect(store[ASSISTANT_STORE_KEY]).toBeTruthy();
    expect(store[ASSISTANT_AUDIT_KEY]).toBeTruthy();
    expect(store[REVIEW_HANDOFF_KEY]).toBeTruthy();
    expect(store[REVIEW_STORE_KEY]).toBeTruthy();

    expect(creativeReviewEngine.snapshot().state?.aiReview.availability).toBe("AVAILABLE");
  }, 120_000);

  it("refuses project-specific answers when context missing", async () => {
    mockStorage();
    productionFinalEngine.hydrate();
    creativeReviewEngine.hydrate();
    const assistant = new CreativeAssistantEngine();
    expect(assistant.hydrate()).toBe(false);
    expect(refreshAssistantContext().available).toBe(false);
    await assistant.sendMessage("Why did QC fail?");
    const last = assistant.snapshot().conversation?.messages.at(-1);
    expect(last?.title).toMatch(/UNAVAILABLE/i);
  });

  it("does not invent package data in assemble helpers", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    expect(state.snapshot.plan.productName).toBeTruthy();
  });
});
