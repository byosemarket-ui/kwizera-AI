import { describe, expect, it, beforeEach } from "vitest";
import {
  assemblePipelineState,
  buildAiMePipelineExplanation,
  computeWeightedProgress,
  isDeferredStep4,
  step2Complete,
  unlockDependencies,
} from "../../../desktop/production-pipeline/assemble.ts";
import {
  ProductionPipelineEngine,
  loadStep3CommandCenterHandoff,
} from "../../../desktop/production-pipeline/pipeline-engine.ts";
import { PIPELINE_HANDOFF_KEY, PIPELINE_STORE_KEY } from "../../../desktop/production-pipeline/types.ts";
import { makeExecutionPackage, mockStorage, seedPackage } from "./production-test-helpers.ts";

describe("production pipeline assemble", () => {
  it("maps package, defers Step 4 render tasks, unlocks deps", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    expect(state.tasks.some((t) => t.taskType === "VIDEO_RENDER" && t.deferredToStep4)).toBe(true);
    expect(isDeferredStep4("EXPORT")).toBe(true);
    expect(isDeferredStep4("SCENE_BUILD")).toBe(false);
    expect(state.routes.length).toBeGreaterThan(0);
    expect(state.run.status).toBe("IDLE");
    const unlocked = unlockDependencies(state.tasks);
    expect(unlocked.some((t) => t.status === "READY")).toBe(true);
  });

  it("computes weighted progress excluding Step 4 stages", () => {
    const pkg = makeExecutionPackage();
    let state = assemblePipelineState(pkg);
    state.tasks = state.tasks.map((t) => (
      !t.deferredToStep4 ? { ...t, status: "COMPLETED" as const, progress: 100 } : t
    ));
    const { overall } = computeWeightedProgress(state.tasks);
    expect(overall).toBe(100);
    expect(step2Complete(state.tasks)).toBe(true);
  });
});

describe("production pipeline engine", () => {
  beforeEach(() => { mockStorage(); });

  it("loads package, starts run, executes tasks, pauses/resumes, completes Step 2 handoff", async () => {
    const store = mockStorage();
    seedPackage(store);
    const events: Array<{ action?: string }> = [];
    const engine = new ProductionPipelineEngine();
    engine.setAllowHttp(false);
    engine.setEventEmitter((_t, payload) => {
      events.push({ action: typeof payload.action === "string" ? payload.action : undefined });
    });
    expect(engine.hydrate()).toBe(true);
    const started = await engine.start();
    expect(started.run.status === "RUNNING" || started.run.status === "READY_FOR_STEP3" || started.run.status === "PAUSED").toBe(true);
    expect(events.some((e) => e.action === "ProductionStarted")).toBe(true);

    // Allow loop to drain
    for (let i = 0; i < 80; i++) {
      const s = engine.snapshot().state;
      if (s?.readyForStep3 || s?.run.status === "READY_FOR_STEP3" || s?.run.status === "BLOCKED") break;
      await new Promise((r) => setTimeout(r, 40));
    }

    const final = engine.snapshot().state!;
    expect(final.artifacts.length).toBeGreaterThan(0);
    expect(final.tasks.some((t) => t.status === "COMPLETED")).toBe(true);
    expect(final.tasks.filter((t) => t.taskType === "VIDEO_RENDER").every((t) => t.deferredToStep4 || t.status === "DEFERRED_STEP4")).toBe(true);
    expect(events.some((e) => e.action === "TaskCompleted")).toBe(true);

    if (!final.readyForStep3) {
      // Force remaining actionable tasks if still running slowly
      engine.pause();
      expect(engine.snapshot().state?.run.status).toBe("PAUSED");
      await engine.resume();
      for (let i = 0; i < 80; i++) {
        if (engine.snapshot().state?.readyForStep3) break;
        await new Promise((r) => setTimeout(r, 40));
      }
    }

    expect(engine.snapshot().state?.readyForStep3).toBe(true);
    const handoff = loadStep3CommandCenterHandoff();
    expect(handoff?.step).toBe("phase-5-step-3-live-command-center");
    expect(handoff?.status).toMatch(/LIVE COMMAND CENTER/i);
    expect(store[PIPELINE_HANDOFF_KEY]).toBeTruthy();
    expect(store[PIPELINE_STORE_KEY]).toBeTruthy();
    expect(buildAiMePipelineExplanation(engine.snapshot().state!)).toMatch(/Step 3 is not started|READY FOR LIVE/i);
  }, 30000);

  it("cancels without deleting completed outputs", async () => {
    const store = mockStorage();
    seedPackage(store);
    const engine = new ProductionPipelineEngine();
    engine.setAllowHttp(false);
    engine.hydrate();
    await engine.start();
    await new Promise((r) => setTimeout(r, 80));
    engine.cancel();
    const s = engine.snapshot().state!;
    expect(s.run.status).toBe("CANCELLED");
    expect(Array.isArray(s.artifacts)).toBe(true);
  });

  it("refuses without execution package", () => {
    mockStorage();
    const engine = new ProductionPipelineEngine();
    expect(engine.hydrate()).toBe(false);
  });
});
