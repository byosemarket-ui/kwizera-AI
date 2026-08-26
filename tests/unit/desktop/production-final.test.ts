import { describe, expect, it, beforeEach } from "vitest";
import { assemblePipelineState } from "../../../desktop/production-pipeline/assemble.ts";
import { ProductionPipelineEngine } from "../../../desktop/production-pipeline/pipeline-engine.ts";
import { buildLiveStateFromPipeline, loadStep4FinalAssemblyHandoff } from "../../../desktop/production-command-center/command-center-engine.ts";
import { COMMAND_CENTER_HANDOFF_KEY } from "../../../desktop/production-command-center/types.ts";
import {
  assembleMasterTimeline,
  computeFinalProgress,
  integrityChecksum,
  resolveOutputConfig,
  runAvSync,
  runQualityControl,
  validateFinalInputs,
  validateScenes,
  buildAiMeFinalExplanation,
  composeText,
  buildAudioMix,
  buildRenderResult,
  buildThumbnail,
  buildOutputPackage,
  validateOutputConfig,
} from "../../../desktop/production-final/assemble.ts";
import {
  ProductionFinalEngine,
  loadPhase5Complete,
  listProductionHistory,
} from "../../../desktop/production-final/final-engine.ts";
import { PHASE5_COMPLETE_KEY, FINAL_HISTORY_KEY } from "../../../desktop/production-final/types.ts";
import { makeExecutionPackage, mockStorage, seedPackage } from "./production-test-helpers.ts";

describe("production final assemble", () => {
  it("validates inputs, scenes, timeline, sync, and output config", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    // Simulate Step 2 intermediates
    state.readyForStep3 = true;
    state.step2Complete = true;
    state.artifacts = [
      {
        artifactId: "a1", productionId: state.run.productionId, runId: state.run.runId, taskId: "t1",
        sceneId: state.snapshot.scenes[0]?.id ?? null, kind: "Scene", version: "v1", versionNumber: 1,
        source: "test", engine: "Local", model: "n/a", createdAt: new Date().toISOString(),
        outputPath: "projects/local/production/x/scenes/s1.v1", inputRefs: [], validationState: "VALID",
        validationNotes: [], cacheKey: "k1", productConsistency: "OK",
      },
      {
        artifactId: "a2", productionId: state.run.productionId, runId: state.run.runId, taskId: "t2",
        sceneId: null, kind: "Audio", version: "v1", versionNumber: 1,
        source: "test", engine: "Local", model: "n/a", createdAt: new Date().toISOString(),
        outputPath: "projects/local/production/x/audio/v1", inputRefs: [], validationState: "VALID",
        validationNotes: [], cacheKey: "k2", productConsistency: "N/A",
      },
      {
        artifactId: "a3", productionId: state.run.productionId, runId: state.run.runId, taskId: "t3",
        sceneId: null, kind: "Image", version: "v1", versionNumber: 1,
        source: "test", engine: "Local", model: "n/a", createdAt: new Date().toISOString(),
        outputPath: "projects/local/production/x/visuals/v1", inputRefs: [], validationState: "VALID",
        validationNotes: [], cacheKey: "k3", productConsistency: "OK",
      },
    ];
    const live = buildLiveStateFromPipeline(state);
    const inputs = validateFinalInputs(live, state);
    expect(inputs.every((i) => !i.critical || i.ok)).toBe(true);
    const scenes = validateScenes(state);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((s) => s.ok)).toBe(true);
    const timeline = assembleMasterTimeline(state);
    expect(timeline.valid).toBe(true);
    expect(timeline.clips.length).toBe(scenes.length);
    const sync = runAvSync(timeline, state);
    expect(sync.every((c) => c.ok)).toBe(true);
    const resolved = resolveOutputConfig(state.snapshot.plan.output);
    expect(validateOutputConfig(resolved.config).every((c) => !c.critical || c.ok)).toBe(true);
  });

  it("builds mix, text, render, QC, thumbnail, package with integrity", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    state.readyForStep3 = true;
    state.artifacts = [{
      artifactId: "a1", productionId: state.run.productionId, runId: state.run.runId, taskId: "VOICE_1",
      sceneId: null, kind: "Audio", version: "v1", versionNumber: 1, source: "test", engine: "Local", model: "n/a",
      createdAt: new Date().toISOString(), outputPath: "audio/v1", inputRefs: [], validationState: "VALID",
      validationNotes: [], cacheKey: "k", productConsistency: "N/A",
    }];
    const timeline = assembleMasterTimeline(state);
    const mix = buildAudioMix(state, timeline);
    const text = composeText(state, timeline);
    const resolved = resolveOutputConfig(state.snapshot.plan.output);
    const render = buildRenderResult(state, timeline, resolved.config, "v1.0");
    const qc = runQualityControl({ pipeline: state, timeline, render, text, config: resolved.config });
    expect(qc.overall).toBe("PASS");
    const thumb = buildThumbnail(state, "v1.0");
    const pkgOut = buildOutputPackage({
      pipeline: state, render, mix, text, thumb, qc, versionLabel: "v1.0", versionNumber: 1,
    });
    expect(pkgOut.outputs.length).toBeGreaterThanOrEqual(5);
    expect(integrityChecksum(["a", 1])).toMatch(/^fnv1a-/);
    expect(computeFinalProgress(["INPUT_VALIDATION"], "SCENE_VALIDATION", 50)).toBeGreaterThan(0);
  });

  it("blocks QC when claim audit has blocking entries", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    state.snapshot.plan.claimAudit = [{
      id: "bad", text: "Cures everything", location: "narration", status: "DO NOT USE", reason: "medical", blocks: true,
    }];
    const timeline = assembleMasterTimeline(state);
    const text = composeText(state, timeline);
    expect(text.claimsSafe).toBe(false);
    const resolved = resolveOutputConfig(state.snapshot.plan.output);
    const render = buildRenderResult(state, timeline, resolved.config, "v1.0");
    const qc = runQualityControl({ pipeline: state, timeline, render, text, config: resolved.config });
    expect(qc.overall).toBe("FAILED");
  });
});

describe("production final engine e2e", () => {
  beforeEach(() => { mockStorage(); });

  it("runs Step2 → Step3 handoff → Step4 complete → Phase 5 COMPLETE", async () => {
    const store = mockStorage();
    seedPackage(store);
    const pipeline = new ProductionPipelineEngine();
    pipeline.setAllowHttp(false);
    expect(pipeline.hydrate()).toBe(true);
    await pipeline.start();
    for (let i = 0; i < 100; i++) {
      if (pipeline.snapshot().state?.readyForStep3) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    const pipeState = pipeline.snapshot().state!;
    expect(pipeState.readyForStep3).toBe(true);

    const live = buildLiveStateFromPipeline(pipeState);
    store[COMMAND_CENTER_HANDOFF_KEY] = JSON.stringify({
      ...live,
      status: "READY FOR FINAL ASSEMBLY / STEP 4",
    });
    expect(loadStep4FinalAssemblyHandoff()?.step).toBe("phase-5-step-4-final-assembly");

    const events: string[] = [];
    const final = new ProductionFinalEngine();
    final.setEventEmitter((_t, payload) => {
      if (typeof payload.action === "string") events.push(payload.action);
    });
    expect(final.hydrate()).toBe(true);
    await final.start();

    const snap = final.snapshot().state!;
    expect(snap.status).toBe("COMPLETED");
    expect(snap.progress).toBe(100);
    expect(snap.phase5Complete).toBe(true);
    expect(snap.package?.videoId).toBeTruthy();
    expect(snap.qcReport?.overall).toBe("PASS");
    expect(snap.thumbnail?.thumbnailId).toBeTruthy();
    expect(events).toContain("ProductionCompleted");
    expect(events).toContain("FinalRenderCompleted");
    expect(loadPhase5Complete()?.status).toBe("COMPLETE");
    expect(store[PHASE5_COMPLETE_KEY]).toBeTruthy();
    expect(store[FINAL_HISTORY_KEY]).toBeTruthy();
    expect(listProductionHistory().length).toBeGreaterThan(0);
    expect(buildAiMeFinalExplanation(snap)).toMatch(/yarangiye|COMPLETE|100%/i);
  }, 60000);

  it("blocks when live state missing", () => {
    mockStorage();
    const final = new ProductionFinalEngine();
    expect(final.hydrate()).toBe(false);
  });
});
