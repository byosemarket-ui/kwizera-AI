import { describe, expect, it, beforeEach, vi } from "vitest";
import { assemblePipelineState } from "../../../desktop/production-pipeline/assemble.ts";
import { ProductionPipelineEngine } from "../../../desktop/production-pipeline/pipeline-engine.ts";
import { PIPELINE_STORE_KEY } from "../../../desktop/production-pipeline/types.ts";
import { QUEUE_HANDOFF_KEY } from "../../../desktop/production-queue/types.ts";
import {
  buildDashboard,
  buildPipelineNodes,
  buildQueueItems,
  buildTaskDetail,
  computeEta,
  formatDuration,
  buildAiMeCommandCenterExplanation,
} from "../../../desktop/production-command-center/assemble.ts";
import {
  ProductionCommandCenterEngine,
  loadStep4FinalAssemblyHandoff,
  buildLiveStateFromPipeline,
} from "../../../desktop/production-command-center/command-center-engine.ts";
import { COMMAND_CENTER_HANDOFF_KEY } from "../../../desktop/production-command-center/types.ts";
import { makeExecutionPackage, mockStorage, seedPackage } from "./production-test-helpers.ts";

describe("production command center assemble", () => {
  it("uses weighted progress and builds pipeline nodes", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    state.run.progress = 42;
    state.run.currentStage = "VISUAL_GENERATION";
    state.tasks = state.tasks.map((t, i) => (
      i < 3 ? { ...t, status: "COMPLETED" as const, progress: 100 } : t
    ));
    const dashboard = buildDashboard(state, {
      at: new Date().toISOString(),
      fps: 30,
      uiLagMs: 5,
      cpuUsage: 67,
      gpuUsage: 84,
      ramUsage: 70,
      ramUsedMb: 11200,
      ramTotalMb: 16384,
      vramUsage: 67,
      diskUsage: 72,
      diskUsedGb: 358,
      diskTotalGb: 500,
      jsHeapMb: 120,
      activeAiModels: 1,
      activeProductionTasks: 2,
      source: "heuristic",
    }, { cpu: 67, ram: 70, gpu: 84, vram: 67 }, {
      controlPending: "none",
      connectionState: "connected",
      syncWarning: false,
      renderSpeedFps: null,
    });
    expect(dashboard?.overallProgress).toBe(42);
    expect(dashboard?.completedTasks).toBeGreaterThan(0);
    expect(buildPipelineNodes(state).length).toBe(8);
    expect(buildQueueItems(state).length).toBe(state.tasks.length);
  });

  it("computes ETA from task durations", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    const running = state.tasks.find((t) => !t.deferredToStep4)!;
    state.tasks = state.tasks.map((t) => (
      t.taskId === running.taskId
        ? { ...t, status: "RUNNING" as const, progress: 50, startedAt: new Date(Date.now() - 60000).toISOString(), durationMs: 60000 }
        : t
    ));
    state.run.currentTaskId = running.taskId;
    const eta = computeEta(state);
    expect(["calculating", "available"]).toContain(eta.status);
    expect(formatDuration(90000)).toBe("01:30");
  });

  it("builds task detail with engine and model", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    const task = state.tasks[0];
    const detail = buildTaskDetail(state, task.taskId);
    expect(detail?.taskId).toBe(task.taskId);
    expect(detail?.engine).toBeTruthy();
  });

  it("builds AI Me explanation from real dashboard state", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    state.run.progress = 82;
    state.run.currentStage = "SCENE_PRODUCTION";
    const dashboard = buildDashboard(state, {
      at: new Date().toISOString(), fps: 0, uiLagMs: 0, cpuUsage: 67, gpuUsage: 84, ramUsage: 70,
      ramUsedMb: 11200, ramTotalMb: 16384, vramUsage: 67, diskUsage: 50, diskUsedGb: 250, diskTotalGb: 500,
      jsHeapMb: null, activeAiModels: 0, activeProductionTasks: 1, source: "heuristic",
    }, { cpu: 0, ram: 0, gpu: 0, vram: 0 }, {
      controlPending: "none", connectionState: "connected", syncWarning: false, renderSpeedFps: null,
    });
    const text = buildAiMeCommandCenterExplanation(dashboard, "connected");
    expect(text).toMatch(/82%/);
    expect(text).toMatch(/CPU 67%/);
  });
});

describe("production command center engine", () => {
  beforeEach(() => { mockStorage(); });

  it("hydrates from pipeline, writes Step 4 handoff, supports controls", async () => {
    const store = mockStorage();
    seedPackage(store);
    const pipeline = new ProductionPipelineEngine();
    pipeline.setAllowHttp(false);
    pipeline.hydrate();
    await pipeline.start();
    for (let i = 0; i < 60; i++) {
      if (pipeline.snapshot().state?.readyForStep3) break;
      await new Promise((r) => setTimeout(r, 40));
    }

    const cc = new ProductionCommandCenterEngine();
    expect(cc.hydrate()).toBe(true);
    cc.mount();
    const snap = cc.snapshot();
    expect(snap.dashboard).toBeTruthy();
    expect(snap.dashboard!.productionId).toBeTruthy();
    cc.writeStep4Handoff();
    const handoff = loadStep4FinalAssemblyHandoff();
    expect(handoff?.step).toBe("phase-5-step-4-final-assembly");
    expect(handoff?.status).toMatch(/STEP 4/i);
    expect(store[COMMAND_CENTER_HANDOFF_KEY]).toBeTruthy();

    cc.pause();
    expect(["pausing", "none"]).toContain(cc.snapshot().controlPending);
    expect(cc.snapshot().dashboard?.status).toMatch(/PAUS/i);
    cc.unmount();
  }, 30000);

  it("builds live production state from pipeline", () => {
    const pkg = makeExecutionPackage();
    const state = assemblePipelineState(pkg);
    const live = buildLiveStateFromPipeline(state);
    expect(live.productionId).toBe(state.run.productionId);
    expect(live.taskStates.length).toBe(state.tasks.length);
    expect(live.queueState.length).toBeGreaterThan(0);
  });
});
