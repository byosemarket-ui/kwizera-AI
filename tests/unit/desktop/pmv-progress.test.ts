import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "../../../ai/pmv-orchestrator/plan.js";
import { migrateRecord } from "../../../ai/pmv-orchestrator/engine.js";
import { estimateRenderSecondsLeft, toCustomerSummary } from "../../../ai/pmv-orchestrator/views.js";
import type { StepStatus, WorkflowRecord, WorkflowStepId } from "../../../ai/pmv-orchestrator/types.js";
import {
  displayPercent,
  elapsedMs,
  etaText,
  formatElapsed,
  runKey,
  runStatusLine,
} from "../../../desktop/customer-platform/workspace/pmv/progress-model";
import { workflowErrorMessage } from "../../../desktop/customer-platform/workspace/pmv/view-model";

const root = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const T0 = "2026-09-26T10:00:00.000Z";
const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000);

type Mode = "EXACT_PRODUCT" | "CINEMATIC";

function makeRecord(
  mode: Mode,
  statuses: Partial<Record<WorkflowStepId, StepStatus>>,
  extra: Partial<WorkflowRecord> = {},
): WorkflowRecord {
  const plan = buildExecutionPlan({
    projectId: "p1",
    generationMode: mode,
    creativeRequest: "",
    heroWidth: 2000,
    heroHeight: 2000,
    editorAcceptsMask: false,
    musicGenerationRequested: false,
    estimatedSceneCount: 4,
    visionQaAvailable: false,
  });
  const steps = plan.steps.map((s) => ({
    id: s.id,
    status: statuses[s.id] ?? "PENDING",
    dependsOn: s.dependsOn,
    capabilities: s.capabilities,
    reason: s.reason,
    inputFingerprint: null,
    attempts: 0,
    maxAttempts: 3,
    history: [],
    failure: null,
    artifactRefs: {},
    startedAt: null,
    completedAt: null,
  }));
  const running = (Object.entries(statuses).find(([, v]) => v === "RUNNING")?.[0] ?? null) as WorkflowStepId | null;
  return {
    workflowVersion: 1,
    id: "wf-1",
    projectId: "p1",
    mode: plan.mode,
    generationMode: mode,
    pendingRegenerateSceneIds: [],
    forcedSteps: [],
    status: running ? "RUNNING" : "QUEUED",
    currentStep: running,
    plan,
    steps,
    cancelRequested: false,
    customerMessage: null,
    lastFailure: null,
    qa: null,
    delivery: null,
    repairAttempts: {},
    createdAt: T0,
    updatedAt: T0,
    completedAt: null,
    runStartedAt: T0,
    ...extra,
  };
}

const BEFORE_RENDER: Partial<Record<WorkflowStepId, StepStatus>> = {
  PRODUCT_INTELLIGENCE: "COMPLETED",
  PRODUCT_LOCK: "COMPLETED",
  CREATIVE_PLANNING: "COMPLETED",
  AUDIO: "COMPLETED",
  TIMELINE: "COMPLETED",
};

const DELIVERY = {
  outputAssetId: "out-1", renderJobId: "job-1", creativePlanId: null, creativePlanVersion: null,
  identityLockVersion: null, sourceAssetIds: [], qaCheckedAt: T0, deliveredAt: T0,
};

describe("Step 4 — 1/2. progress state and step completion mapping", () => {
  it("maps real step states to customer stages (done / active / pending) in execution order", () => {
    const summary = toCustomerSummary(makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" }), null, at(30));
    expect(summary.stages.map((s) => s.label)).toEqual([
      "Understanding your product",
      "Planning the video",
      "Adding music",
      "Assembling the video",
      "Rendering final video",
      "Checking quality",
      "Finalizing",
    ]);
    expect(summary.stages.map((s) => s.state)).toEqual(["done", "done", "done", "done", "active", "pending", "pending"]);
    expect(summary.progress.completed).toBe(4);
    expect(runStatusLine(summary)).toBe("Rendering final video…");
  });

  it("merges product understanding + product check into one stage that is done only when both are", () => {
    const summary = toCustomerSummary(makeRecord("EXACT_PRODUCT", { PRODUCT_INTELLIGENCE: "COMPLETED", PRODUCT_LOCK: "RUNNING" }));
    expect(summary.stages[0]).toEqual({ label: "Understanding your product", state: "active" });
  });
});

describe("Step 4 — 3. real percentage", () => {
  it("counts finished stages by weight and the active render by its measured job progress", () => {
    const record = makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" });
    expect(toCustomerSummary(record, null, at(30)).progress.percent).toBe(28);
    const live = toCustomerSummary(record, { progress: 50, startedAt: at(0).toISOString() }, at(30));
    expect(live.progress.percent).toBe(59);
    expect(live.activeStagePercent).toBe(50);
  });

  it("ignores render progress unless the render-backed step is the one actually running", () => {
    const planning = makeRecord("EXACT_PRODUCT", { PRODUCT_INTELLIGENCE: "COMPLETED", PRODUCT_LOCK: "COMPLETED", CREATIVE_PLANNING: "RUNNING" });
    const summary = toCustomerSummary(planning, { progress: 90, startedAt: T0 }, at(60));
    expect(summary.activeStagePercent).toBeNull();
    expect(summary.etaSeconds).toBeNull();
    expect(summary.progress.percent).toBe(10);
  });

  it("the display never rewinds within a run, but a new run starts from its own real value", () => {
    const record = makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" });
    const a = displayPercent(null, toCustomerSummary(record, { progress: 50, startedAt: T0 }, at(30)));
    const b = displayPercent(a, toCustomerSummary(record, null, at(34)));
    expect(b.percent).toBe(a.percent);
    const retried = toCustomerSummary({ ...record, runStartedAt: at(100).toISOString() }, null, at(101));
    const c = displayPercent(b, retried);
    expect(c.key).not.toBe(b.key);
    expect(c.percent).toBe(28);
  });
});

describe("Step 4 — 4. 100% completion rule", () => {
  const allDone: Partial<Record<WorkflowStepId, StepStatus>> = { ...BEFORE_RENDER, RENDER: "COMPLETED", QA: "COMPLETED", DELIVERY: "COMPLETED" };

  it("shows 100% only once the workflow is COMPLETED with a delivered output", () => {
    const done = toCustomerSummary(makeRecord("EXACT_PRODUCT", allDone, { status: "COMPLETED", currentStep: null, delivery: DELIVERY, completedAt: at(90).toISOString() }));
    expect(done.progress.percent).toBe(100);
    expect(done.delivered).toBe(true);
    expect(runStatusLine(done)).toBe("Your video is ready");
  });

  it("never reaches 100% before delivery, even when every stage reports done", () => {
    const noDelivery = toCustomerSummary(makeRecord("EXACT_PRODUCT", allDone, { status: "COMPLETED", currentStep: null, delivery: null }));
    expect(noDelivery.progress.percent).toBe(99);
    const finishing = toCustomerSummary(makeRecord("EXACT_PRODUCT", { ...allDone, DELIVERY: "RUNNING" }));
    expect(finishing.progress.percent).toBeLessThan(100);
    const almost = toCustomerSummary(makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" }), { progress: 100, startedAt: T0 }, at(10));
    expect(almost.progress.percent).toBeLessThan(100);
    expect(displayPercent({ key: runKey(almost), percent: 99 }, almost).percent).toBe(99);
  });
});

describe("Step 4 — 5. failure stops progress", () => {
  it("a failed run reports no live progress or estimate, keeps the stage failed and freezes the display", () => {
    const running = makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" });
    const shown = displayPercent(null, toCustomerSummary(running, { progress: 60, startedAt: T0 }, at(40)));
    const failed = toCustomerSummary(
      { ...running, status: "FAILED", steps: running.steps.map((s) => (s.id === "RENDER" ? { ...s, status: "FAILED" as const } : s)), customerMessage: null, updatedAt: at(45).toISOString() },
      { progress: 80, startedAt: T0 },
      at(50),
    );
    expect(failed.activeStagePercent).toBeNull();
    expect(failed.etaSeconds).toBeNull();
    expect(failed.stages.find((s) => s.label === "Rendering final video")?.state).toBe("failed");
    expect(displayPercent(shown, failed).percent).toBe(shown.percent);
    expect(runStatusLine(failed)).toBe("Stopped");
    expect(elapsedMs(failed, 0, 999_999)).toBe(45_000);
    expect(workflowErrorMessage(failed)).toBe("Your video could not be completed. Please try again.");
  });

  it("the UI only animates while the run is active and marks a failed bar", () => {
    const src = read("desktop/customer-platform/workspace/pmv/PmvCreateStep.tsx");
    expect(src).toContain('if (state === "active") return <Loader2');
    expect(src).toContain("if (!active) return;");
    expect(src).toContain('workflow.status === "FAILED" ? " is-failed" : ""');
    expect(src).toContain("act(workflow.canRetry ? \"retry\" : \"resume\")");
  });
});

describe("Step 4 — 6/7. ETA only when measurable", () => {
  it("estimates from the render job's own measured rate", () => {
    expect(estimateRenderSecondsLeft({ progress: 50, startedAt: T0 }, at(60).getTime())).toBe(60);
    const summary = toCustomerSummary(makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" }), { progress: 40, startedAt: T0 }, at(40));
    expect(summary.etaSeconds).toBe(60);
    expect(etaText(summary.etaSeconds)).toBe("About 1 minute left");
    expect(etaText(25)).toBe("About 25 seconds left");
    expect(etaText(180)).toBe("About 3 minutes left");
  });

  it("gives no estimate when the rate is not yet meaningful or the start is unknown", () => {
    expect(estimateRenderSecondsLeft({ progress: 10, startedAt: T0 }, at(60).getTime())).toBeNull();
    expect(estimateRenderSecondsLeft({ progress: 50, startedAt: T0 }, at(10).getTime())).toBeNull();
    expect(estimateRenderSecondsLeft({ progress: 97, startedAt: T0 }, at(60).getTime())).toBeNull();
    expect(estimateRenderSecondsLeft({ progress: 50, startedAt: null }, at(60).getTime())).toBeNull();
    expect(estimateRenderSecondsLeft(null, at(60).getTime())).toBeNull();
    expect(etaText(null)).toBeNull();
  });
});

describe("Step 4 — 8. refresh / reconnect recovery", () => {
  it("elapsed time comes from the server run start and server clock, not the page load", () => {
    const summary = toCustomerSummary(makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" }), null, at(24));
    expect(summary.startedAt).toBe(T0);
    expect(summary.observedAt).toBe(at(24).toISOString());
    expect(formatElapsed(elapsedMs(summary, 5_000, 5_000)!)).toBe("00:24");
    expect(formatElapsed(elapsedMs(summary, 5_000, 8_000)!)).toBe("00:27");
    expect(formatElapsed(3_723_000)).toBe("1:02:03");
  });

  it("records written before the run start existed show no elapsed time instead of a guess", () => {
    const legacy = makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" });
    delete (legacy as Partial<WorkflowRecord>).runStartedAt;
    const migrated = migrateRecord(legacy);
    expect(migrated.runStartedAt).toBeNull();
    expect(elapsedMs(toCustomerSummary(migrated), 0, 1000)).toBeNull();
  });

  it("reopening loads the existing run; starting while active never creates a second job", () => {
    const hook = read("desktop/pmv-workflow/usePmvWorkflow.ts");
    expect(hook).toContain("void getPmvWorkflow(projectId)");
    expect(hook).toContain("POLL_MS = 4_000");
    expect(hook).not.toMatch(/EventSource|WebSocket/);
    const engine = read("ai/pmv-orchestrator/engine.ts");
    expect(engine).toContain("if (latest && ACTIVE.has(latest.status)) return latest;");
    expect(engine).toContain("latest.runStartedAt = latest.updatedAt;");
    const server = read("dev/server/index.ts");
    expect(server).toMatch(/toCustomerSummary\(latest, live\)/);
    expect(server).toMatch(/job\.status === "queued" \|\| job\.status === "processing"/);
  });

  it("a render that just finished for this step keeps its share instead of dipping, but a stale job never counts", () => {
    const server = read("dev/server/index.ts");
    expect(server).toContain('job?.status === "completed" && Boolean(stepStartedAt) && job.createdAt >= stepStartedAt!');
    const record = makeRecord("EXACT_PRODUCT", { ...BEFORE_RENDER, RENDER: "RUNNING" });
    expect(toCustomerSummary(record, { progress: 100, startedAt: T0 }, at(60)).progress.percent).toBe(89);
  });

  it("catches up immediately when a throttled background tab becomes visible again", () => {
    const hook = read("desktop/pmv-workflow/usePmvWorkflow.ts");
    expect(hook).toContain('document.addEventListener("visibilitychange", onVisible)');
    expect(hook).toContain('window.addEventListener("focus", refresh)');
    expect(hook).toContain('document.removeEventListener("visibilitychange", onVisible)');
  });

  it("does not show a meaningless elapsed time while waiting for the customer", () => {
    const src = read("desktop/customer-platform/workspace/pmv/PmvCreateStep.tsx");
    expect(src).toContain('workflow.status === "WAITING_FOR_USER" || workflow.status === "CANCELLED"');
  });
});

describe("Step 4 — 9. progress follows the selected mode", () => {
  it("Slideshow never shows scene creation; Cinematic shows it", () => {
    const exact = toCustomerSummary(makeRecord("EXACT_PRODUCT", {})).stages.map((s) => s.label);
    const cinematic = toCustomerSummary(makeRecord("CINEMATIC", {})).stages.map((s) => s.label);
    expect(exact).not.toContain("Creating scenes");
    expect(cinematic).toContain("Creating scenes");
    for (const labels of [exact, cinematic]) expect(labels.join(" ")).not.toMatch(/3D/i);
  });

  it("Cinematic scene creation reports the render job it runs", () => {
    const record = makeRecord("CINEMATIC", {
      ...BEFORE_RENDER,
      MEDIA_PREPARATION: "COMPLETED",
      VIDEO_GENERATION: "RUNNING",
    });
    const summary = toCustomerSummary(record, { progress: 30, startedAt: T0 }, at(60));
    expect(summary.activeStagePercent).toBe(30);
    expect(runStatusLine(summary)).toBe("Creating scenes…");
  });
});

describe("Step 4 — 10/11. platform, duration and audio are preserved", () => {
  it("the orchestrator never rewrites platform, duration or selected audio", () => {
    const engine = read("ai/pmv-orchestrator/engine.ts");
    const views = read("ai/pmv-orchestrator/views.ts");
    for (const src of [engine, views]) {
      expect(src).not.toMatch(/durationSeconds\s*=|platform\s*=|selectedAudioAssetId|aspectRatio\s*=/);
    }
  });

  it("the Create step still summarises the saved platform, format, duration and music", () => {
    const src = read("desktop/customer-platform/workspace/pmv/PmvCreateStep.tsx");
    expect(src).toContain("resolvePmvDestination(snap.videoSettings.platform, snap.videoSettings.aspectRatio)");
    expect(src).toContain("durationLabel(null, snap.videoSettings.durationSeconds)");
    expect(src).toContain("snap.selectedAudioTitle");
  });

  it("the Create summary shows a friendly music name, never a raw file name", () => {
    const src = read("desktop/customer-platform/workspace/pmv/PmvCreateStep.tsx");
    expect(src).toContain('audioDisplayTitle({ title: snap.selectedAudioTitle, sourceType: "UPLOADED_AUDIO" })');
    expect(src).not.toMatch(/<dd>\{snap\.selectedAudioTitle\}<\/dd>/);
  });
});

describe("Step 4 — 12. customer-safe progress", () => {
  it("the summary carries no step ids, capabilities, job ids, providers or models", () => {
    const summary = toCustomerSummary(
      makeRecord("CINEMATIC", { ...BEFORE_RENDER, MEDIA_PREPARATION: "COMPLETED", VIDEO_GENERATION: "RUNNING" }),
      { progress: 42, startedAt: T0 },
      at(60),
    );
    const text = JSON.stringify(summary);
    expect(text).not.toMatch(/VIDEO_GENERATION|VIDEO_IMAGE_TO_VIDEO|PRODUCT_INTELLIGENCE|RENDER"|job-|providerId|modelId|ffmpeg|capability|cost/i);
  });

  it("progress UI text stays free of internal wording", () => {
    const src = read("desktop/customer-platform/workspace/pmv/progress-model.ts") + read("desktop/customer-platform/workspace/pmv/PmvCreateStep.tsx");
    expect(src).not.toMatch(/Ollama|OpenAI|FFmpeg|providerId|modelId|CapabilityRuntime|api[_ -]?key|secret|jobId/i);
  });

  it("progress styles stay compact and never overflow", () => {
    const css = read("desktop/customer-platform/workspace/product-marketing-video.css");
    expect(css).toMatch(/\.pmv-run \{[^}]*max-width: 560px;[^}]*min-width: 0;/);
    expect(css).toMatch(/\.pmv-run__status \{[^}]*text-overflow: ellipsis;/);
  });
});
