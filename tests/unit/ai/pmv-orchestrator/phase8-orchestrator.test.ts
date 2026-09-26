import fs from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PmvWorkflowOrchestrator,
  type OrchestratorDeps,
  type StepExecutor,
  type StepOutcome,
  type WorkflowSnapshot,
} from "../../../../ai/pmv-orchestrator/engine.js";
import { WorkflowStepError, classifyRenderJobFailure, classifyWorkflowError } from "../../../../ai/pmv-orchestrator/failure.js";
import { computeStepFingerprints, type FingerprintInputs } from "../../../../ai/pmv-orchestrator/fingerprints.js";
import { buildExecutionPlan, orderedStepIds, type PlanInput } from "../../../../ai/pmv-orchestrator/plan.js";
import { CUSTOMER_STEP_LABELS, MODE_STEP_LABELS, type WorkflowRecord, type WorkflowStepId } from "../../../../ai/pmv-orchestrator/types.js";
import { videoModeFromGenerationMode, type PmvGenerationMode } from "../../../../ai/pmv-shared/modes.js";
import { toAdminView, toCustomerSummary, type CustomerWorkflowSummary } from "../../../../ai/pmv-orchestrator/views.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-p8-"));
  roots.push(dir);
  return dir;
}

interface FakeState {
  assets: string;
  lockStatus: "LOCKED" | "PENDING_CONFIRMATION";
  /** Legacy mode value — it is what fingerprints key on, so existing projects are not re-planned. */
  mode: PmvGenerationMode;
  creativeRequest: string;
  cta: string;
  brand: string;
  audio: string | null;
  qaStatus: string;
  heroWidth: number;
}

function baseState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    assets: "img-1,img-2",
    lockStatus: "LOCKED",
    mode: "EXACT_PRODUCT",
    creativeRequest: "",
    cta: "Shop now",
    brand: "Kwizera",
    audio: "song-1",
    qaStatus: "QA_PASSED",
    heroWidth: 1600,
    ...overrides,
  };
}

function fingerprintsFor(state: FakeState): Record<WorkflowStepId, string> {
  const input: FingerprintInputs = {
    assetFingerprint: state.assets,
    lockVersion: "pil-v1",
    lockStatus: state.lockStatus,
    mode: state.mode,
    creativeTone: "Modern",
    durationSeconds: 15,
    aspectRatio: "9:16",
    creativeRequest: state.creativeRequest,
    text: { brandName: state.brand, cta: state.cta, website: "", phone: "", logoAssetId: null, language: "en" },
    audio: { selectedAudioAssetId: state.audio, beatSyncMode: "SMART", audioVolume: 0.8 },
    planId: "plan-1",
    planVersion: 1,
  };
  return computeStepFingerprints(input);
}

interface Harness {
  orchestrator: PmvWorkflowOrchestrator;
  state: FakeState;
  /** Every executor invocation, in order. */
  calls: WorkflowStepId[];
  /** Invocations that did real (non-reused) work. */
  work: WorkflowStepId[];
  sleeps: number[];
  summaries: CustomerWorkflowSummary[];
  logs: Array<{ event: string; data: Record<string, unknown> }>;
  root: string;
  overrides: Partial<Record<WorkflowStepId, StepExecutor>>;
  ctxSeen: Array<{ step: WorkflowStepId; regenerate: string[]; forced: boolean }>;
}

async function harness(state = baseState(), root?: string): Promise<Harness> {
  const h: Harness = {
    orchestrator: new PmvWorkflowOrchestrator(),
    state,
    calls: [],
    work: [],
    sleeps: [],
    summaries: [],
    logs: [],
    root: root ?? await tempRoot(),
    overrides: {},
    ctxSeen: [],
  };
  const standard = (id: WorkflowStepId): StepExecutor => async (ctx) => {
    h.calls.push(id);
    h.ctxSeen.push({ step: id, regenerate: [...ctx.workflow.pendingRegenerateSceneIds], forced: ctx.forced });
    const override = h.overrides[id];
    if (override) {
      const outcome = await override(ctx);
      if (outcome.kind === "COMPLETED") h.work.push(id);
      return outcome;
    }
    if (id === "PRODUCT_LOCK" && h.state.lockStatus !== "LOCKED") {
      return { kind: "WAITING_FOR_USER", code: "LOCK_CONFIRMATION_REQUIRED", message: "Confirm your product identity to continue." };
    }
    if (id === "AUDIO" && !h.state.audio) return { kind: "SKIPPED", reason: "NO_AUDIO_SELECTED" };
    if (id === "REPAIR") return { kind: "SKIPPED", reason: "QA_PASSED" };
    const reusable = !ctx.forced && ctx.priorFingerprint !== null && ctx.priorFingerprint === ctx.fingerprint;
    const kind = reusable ? "REUSED" : "COMPLETED";
    if (kind === "COMPLETED") h.work.push(id);
    if (id === "QA") {
      return { kind, qa: { overallStatus: h.state.qaStatus, renderJobId: "job-1", videoAssetId: "vid-1", failures: [], checkedAt: new Date().toISOString() } };
    }
    if (id === "DELIVERY") {
      return {
        kind,
        delivery: {
          outputAssetId: "vid-1", renderJobId: "job-1", creativePlanId: "plan-1", creativePlanVersion: 1,
          identityLockVersion: "pil-v1", sourceAssetIds: ["img-1"], qaCheckedAt: new Date().toISOString(), deliveredAt: new Date().toISOString(),
        },
      };
    }
    return { kind, refs: { artifact: `${id}-artifact` } };
  };
  const ids: WorkflowStepId[] = [
    "PRODUCT_INTELLIGENCE", "PRODUCT_LOCK", "CREATIVE_PLANNING", "MEDIA_PREPARATION", "VIDEO_GENERATION",
    "AUDIO", "TIMELINE", "RENDER", "QA", "REPAIR", "DELIVERY",
  ];
  const deps: OrchestratorDeps = {
    loadSnapshot: async (projectId): Promise<WorkflowSnapshot> => ({
      fingerprints: fingerprintsFor(h.state),
      planInput: {
        projectId,
        videoMode: videoModeFromGenerationMode(h.state.mode),
        creativeRequest: h.state.creativeRequest,
        heroWidth: h.state.heroWidth,
        heroHeight: h.state.heroWidth,
        editorAcceptsMask: false,
        musicGenerationRequested: false,
        estimatedSceneCount: 4,
        visionQaAvailable: true,
      },
    }),
    executors: Object.fromEntries(ids.map((id) => [id, standard(id)])),
    writeProjectSummary: async (_projectId, summary) => { h.summaries.push(summary); },
    sleep: async (ms) => { h.sleeps.push(ms); },
    log: (event, data) => { h.logs.push({ event, data }); },
  };
  await h.orchestrator.initialize(h.root, deps);
  return h;
}

async function runToIdle(h: Harness, action: () => Promise<WorkflowRecord | null>): Promise<WorkflowRecord> {
  const record = await action();
  await h.orchestrator.whenIdle();
  return h.orchestrator.get(record!.id)!;
}

function stepStatus(record: WorkflowRecord, id: WorkflowStepId): string | undefined {
  return record.steps.find((s) => s.id === id)?.status;
}

function planInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    projectId: "p1",
    videoMode: "PRODUCT_SLIDESHOW",
    creativeRequest: "",
    heroWidth: 1600,
    heroHeight: 1600,
    editorAcceptsMask: false,
    musicGenerationRequested: false,
    estimatedSceneCount: 4,
    visionQaAvailable: true,
    ...overrides,
  };
}

describe("Phase 8 — A. workflow creation", () => {
  it("creates a versioned, persisted workflow with a machine-readable plan and completes it", async () => {
    const h = await harness();
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(record.status).toBe("COMPLETED");
    expect(record.workflowVersion).toBe(1);
    expect(record.plan).toMatchObject({ projectId: "p1", mode: "EXACT", status: "READY" });
    expect(Array.isArray(record.plan.requiredCapabilities)).toBe(true);
    expect(record.plan.steps.length).toBeGreaterThan(0);
    expect(record.plan.dependencies.RENDER).toEqual(["TIMELINE"]);
    expect(typeof record.plan.estimatedOperations).toBe("number");
    const file = JSON.parse(await fs.readFile(path.join(h.root, "pmv-orchestrator", "workflows", `${record.id}.json`), "utf8")) as WorkflowRecord;
    expect(file.status).toBe("COMPLETED");
    expect(h.summaries.at(-1)?.delivered).toBe(true);
  });

  it("returns immediately (queued) instead of blocking on long work", async () => {
    const h = await harness();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    h.overrides.RENDER = async () => { await gate; return { kind: "COMPLETED" }; };
    const record = await h.orchestrator.start("p1");
    expect(["QUEUED", "RUNNING"]).toContain(record.status);
    release();
    await h.orchestrator.whenIdle();
    expect(h.orchestrator.get(record.id)!.status).toBe("COMPLETED");
  });
});

describe("Phase 8 — B. dependency ordering", () => {
  it("executes lock → plan → timeline → I2V → render → QA → delivery for cinematic", async () => {
    const h = await harness(baseState({ mode: "CINEMATIC" }));
    await runToIdle(h, () => h.orchestrator.start("p1"));
    const at = (id: WorkflowStepId) => h.calls.indexOf(id);
    expect(at("PRODUCT_LOCK")).toBeLessThan(at("CREATIVE_PLANNING"));
    expect(at("CREATIVE_PLANNING")).toBeLessThan(at("VIDEO_GENERATION"));
    expect(at("AUDIO")).toBeLessThan(at("TIMELINE"));
    expect(at("TIMELINE")).toBeLessThan(at("VIDEO_GENERATION"));
    expect(at("VIDEO_GENERATION")).toBeLessThan(at("RENDER"));
    expect(at("RENDER")).toBeLessThan(at("QA"));
    expect(at("QA")).toBeLessThan(at("DELIVERY"));
  });

  it("orders every plan topologically and declares the required gates", () => {
    const plan = buildExecutionPlan(planInput({ videoMode: "CINEMATIC_AI", creativeRequest: "on a marble table" }));
    const order = orderedStepIds(plan);
    for (const step of plan.steps) {
      for (const dep of step.dependsOn) expect(order.indexOf(dep)).toBeLessThan(order.indexOf(step.id));
    }
    expect(plan.dependencies.VIDEO_GENERATION).toEqual(expect.arrayContaining(["PRODUCT_LOCK", "CREATIVE_PLANNING", "MEDIA_PREPARATION"]));
    expect(plan.dependencies.TIMELINE).toEqual(expect.arrayContaining(["CREATIVE_PLANNING", "AUDIO"]));
    expect(plan.dependencies.RENDER).toEqual(expect.arrayContaining(["TIMELINE", "VIDEO_GENERATION"]));
    expect(plan.dependencies.DELIVERY).toEqual(["QA"]);
  });
});

describe("Phase 8 — C. capability routing", () => {
  it("requests Admin capabilities by requirement, never models or providers", () => {
    const exact = buildExecutionPlan(planInput());
    expect(exact.requiredCapabilities).toEqual([]);
    const cinematic = buildExecutionPlan(planInput({ videoMode: "CINEMATIC_AI" }));
    expect(cinematic.mode).toBe("CINEMATIC");
    expect(cinematic.requiredCapabilities).toEqual(expect.arrayContaining(["VIDEO_IMAGE_TO_VIDEO", "VISION_ANALYSIS"]));
    expect(cinematic.requiredCapabilities).not.toContain("IMAGE_EDITING");
    const full = buildExecutionPlan(planInput({ videoMode: "CINEMATIC_AI", creativeRequest: "on a marble table with soft lighting", editorAcceptsMask: true, heroWidth: 500, heroHeight: 500 }));
    expect(full.mode).toBe("FULL_CREATIVE");
    expect(full.requiredCapabilities).toEqual(expect.arrayContaining(["IMAGE_SEGMENTATION", "IMAGE_EDITING", "IMAGE_UPSCALE", "VIDEO_IMAGE_TO_VIDEO"]));
    for (const plan of [exact, cinematic, full]) {
      expect(JSON.stringify(plan)).not.toMatch(/fal-ai|providerId|modelId|kling|flux|sam2/i);
    }
  });

  it("resolves routing for Admin observability through CapabilityRuntime.describe only", async () => {
    const h = await harness(baseState({ mode: "CINEMATIC" }));
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    const asked: string[] = [];
    const view = toAdminView(record, (capability) => {
      asked.push(capability);
      return { capability, status: "READY", source: "ONLINE", providerId: "admin-provider", modelId: "admin-model" };
    });
    expect(asked).toEqual(record.plan.requiredCapabilities);
    expect(view.capabilityRouting.map((r) => r.capability)).toEqual(record.plan.requiredCapabilities);
  });

  it("keeps credential resolution inside CapabilityRuntime (no vault or provider access in the orchestrator)", () => {
    const dir = path.resolve("ai/pmv-orchestrator");
    for (const name of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, name), "utf8");
      expect(src, name).not.toMatch(/credential-vault|secrets-manager|getSecret|resolveCredential|apiKey|process\.env\.[A-Z_]*KEY/i);
      expect(src, name).not.toMatch(/fal-video-provider|fal-image-adapter/);
    }
  });
});

describe("Phase 8 — D. conditional skip", () => {
  it("a simple Exact ad runs no media preparation, no I2V and skips audio when none is selected", async () => {
    const h = await harness(baseState({ audio: null }));
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(record.status).toBe("COMPLETED");
    expect(record.steps.map((s) => s.id)).not.toContain("MEDIA_PREPARATION");
    expect(record.steps.map((s) => s.id)).not.toContain("VIDEO_GENERATION");
    expect(h.calls).not.toContain("VIDEO_GENERATION");
    expect(stepStatus(record, "AUDIO")).toBe("SKIPPED");
    expect(stepStatus(record, "REPAIR")).toBe("SKIPPED");
    expect(record.plan.estimatedOperations).toBe(0);
  });

  it("cinematic without an environment request skips media preparation", () => {
    const plan = buildExecutionPlan(planInput({ videoMode: "CINEMATIC_AI", creativeRequest: "" }));
    expect(plan.steps.map((s) => s.id)).not.toContain("MEDIA_PREPARATION");
    expect(plan.estimatedOperations).toBe(4 + 1);
  });
});

describe("Phase 8 — E. idempotency", () => {
  it("running again with unchanged inputs reuses every artifact", async () => {
    const h = await harness();
    await runToIdle(h, () => h.orchestrator.start("p1"));
    h.work.length = 0;
    const second = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(second.status).toBe("COMPLETED");
    expect(h.work).toEqual([]);
    expect(stepStatus(second, "RENDER")).toBe("REUSED");
    expect(stepStatus(second, "DELIVERY")).toBe("REUSED");
  });

  it("starting while a workflow is active returns the same workflow", async () => {
    const h = await harness();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    h.overrides.TIMELINE = async () => { await gate; return { kind: "COMPLETED" }; };
    const first = await h.orchestrator.start("p1");
    const again = await h.orchestrator.start("p1");
    expect(again.id).toBe(first.id);
    release();
    await h.orchestrator.whenIdle();
    expect(h.calls.filter((id) => id === "TIMELINE")).toHaveLength(1);
  });
});

describe("Phase 8 — F. resume", () => {
  it("resumes from the failed step without redoing completed steps", async () => {
    const h = await harness();
    h.overrides.RENDER = async () => { throw new WorkflowStepError("CONFIGURATION_ERROR", "FFMPEG_UNAVAILABLE", "Rendering is unavailable right now."); };
    const failed = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(failed.status).toBe("FAILED");
    expect(stepStatus(failed, "TIMELINE")).toBe("COMPLETED");
    delete h.overrides.RENDER;
    h.calls.length = 0;
    const resumed = await runToIdle(h, () => h.orchestrator.resume("p1"));
    expect(resumed.id).toBe(failed.id);
    expect(resumed.status).toBe("COMPLETED");
    expect(h.calls[0]).toBe("RENDER");
    expect(h.calls).not.toContain("PRODUCT_INTELLIGENCE");
    expect(h.calls).not.toContain("TIMELINE");
  });
});

describe("Phase 8 — G. smallest-scope invalidation", () => {
  async function completedThenChange(change: Partial<FakeState>): Promise<Harness> {
    const h = await harness();
    await runToIdle(h, () => h.orchestrator.start("p1"));
    Object.assign(h.state, change);
    h.work.length = 0;
    await runToIdle(h, () => h.orchestrator.start("p1"));
    return h;
  }

  it("CTA change reruns only timeline, render, QA and delivery", async () => {
    const h = await completedThenChange({ cta: "Order today" });
    expect(h.work).toEqual(["TIMELINE", "RENDER", "QA", "DELIVERY"]);
  });

  it("music change reruns audio, timeline, render, QA and delivery", async () => {
    const h = await completedThenChange({ audio: "song-2" });
    expect(h.work).toEqual(["AUDIO", "TIMELINE", "RENDER", "QA", "DELIVERY"]);
  });

  it("product image change reruns intelligence, lock, plan, timeline and everything downstream (not audio)", async () => {
    const h = await completedThenChange({ assets: "img-1,img-3" });
    expect(h.work).toEqual(["PRODUCT_INTELLIGENCE", "PRODUCT_LOCK", "CREATIVE_PLANNING", "TIMELINE", "RENDER", "QA", "DELIVERY"]);
    expect(h.work).not.toContain("AUDIO");
  });

  it("invalidates completed steps when inputs change while a workflow is paused", async () => {
    const h = await harness();
    h.overrides.RENDER = async () => { throw new WorkflowStepError("USER_INPUT_ERROR", "VALIDATION_FAILED", "Check your project details."); };
    await runToIdle(h, () => h.orchestrator.start("p1"));
    delete h.overrides.RENDER;
    h.state.cta = "New CTA";
    h.work.length = 0;
    await runToIdle(h, () => h.orchestrator.resume("p1"));
    expect(h.work).toEqual(["TIMELINE", "RENDER", "QA", "DELIVERY"]);
  });
});

describe("Phase 8 — H. bounded retry", () => {
  it("retries a transient provider error and records every attempt", async () => {
    const h = await harness();
    let n = 0;
    h.overrides.RENDER = async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("upstream 503"), { name: "ProviderRuntimeError", code: "PROVIDER_UNAVAILABLE" });
      return { kind: "COMPLETED" };
    };
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(record.status).toBe("COMPLETED");
    const render = record.steps.find((s) => s.id === "RENDER")!;
    expect(render.history).toHaveLength(2);
    expect(render.history[0]).toMatchObject({ attempt: 1, result: "FAILED", failureClass: "PROVIDER_ERROR", code: "PROVIDER_UNAVAILABLE", retryable: true });
    expect(render.history[0]!.startedAt).toBeTruthy();
    expect(render.history[0]!.finishedAt).toBeTruthy();
    expect(render.history[1]).toMatchObject({ attempt: 2, result: "SUCCEEDED" });
    expect(h.sleeps).toEqual([2_000]);
  });

  it("backs off harder on rate limits and stops at the step's attempt budget", async () => {
    const h = await harness();
    h.overrides.RENDER = async () => { throw Object.assign(new Error("429"), { name: "ProviderRuntimeError", code: "RATE_LIMITED" }); };
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    const render = record.steps.find((s) => s.id === "RENDER")!;
    expect(record.status).toBe("FAILED");
    expect(render.attempts).toBe(render.maxAttempts);
    expect(render.maxAttempts).toBe(2);
    expect(h.sleeps).toEqual([10_000]);
    expect(record.lastFailure?.failureClass).toBe("RATE_LIMIT");
  });
});

describe("Phase 8 — I. permanent failure", () => {
  it("never retries credential failures and never silently falls back from Cinematic to Exact", async () => {
    const h = await harness(baseState({ mode: "CINEMATIC" }));
    h.overrides.VIDEO_GENERATION = async () => {
      throw Object.assign(new Error("I2V failed: AUTHENTICATION_FAILED 401"), { name: "VideoProductionError", code: "I2V_SCENE_FAILED" });
    };
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(record.status).toBe("FAILED");
    expect(record.lastFailure).toMatchObject({ failureClass: "AUTHENTICATION_ERROR", retryable: false, route: "admin_configuration" });
    expect(record.steps.find((s) => s.id === "VIDEO_GENERATION")!.attempts).toBe(1);
    expect(h.sleeps).toEqual([]);
    expect(record.mode).toBe("CINEMATIC");
    expect(record.generationMode).toBe("CINEMATIC");
    expect(h.calls).not.toContain("RENDER");
    expect(record.customerMessage).not.toMatch(/401|AUTHENTICATION|fal|key/i);
  });

  it("never retries user-input or schema errors", () => {
    expect(classifyWorkflowError(new WorkflowStepError("USER_INPUT_ERROR", "PRODUCT_NAME_REQUIRED", "Add the product name."), "PRODUCT_INTELLIGENCE").retryable).toBe(false);
    expect(classifyWorkflowError(Object.assign(new Error("bad"), { name: "ProviderRuntimeError", code: "INVALID_REQUEST" }), "VIDEO_GENERATION")).toMatchObject({ failureClass: "CONFIGURATION_ERROR", retryable: false });
    expect(classifyRenderJobFailure("I2V_UNAVAILABLE", "", "VIDEO_GENERATION")).toMatchObject({ failureClass: "CONFIGURATION_ERROR", retryable: false });
    expect(classifyRenderJobFailure("I2V_SCENE_FAILED", "Request timed out", "VIDEO_GENERATION")).toMatchObject({ failureClass: "TIMEOUT", retryable: true });
    expect(classifyWorkflowError(Object.assign(new Error("disk"), { code: "ENOSPC" }), "RENDER")).toMatchObject({ failureClass: "STORAGE_ERROR", retryable: false });
    expect(classifyRenderJobFailure("RESTART_INTERRUPTED", "", "RENDER").retryable).toBe(true);
  });
});

describe("Phase 8 — J. WAITING_FOR_USER", () => {
  it("pauses for lock confirmation (distinct from FAILED) and continues once the customer confirms", async () => {
    const h = await harness(baseState({ lockStatus: "PENDING_CONFIRMATION" }));
    const waiting = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(waiting.status).toBe("WAITING_FOR_USER");
    expect(waiting.lastFailure).toBeNull();
    expect(stepStatus(waiting, "PRODUCT_LOCK")).toBe("WAITING_FOR_USER");
    expect(h.calls).not.toContain("CREATIVE_PLANNING");
    const summary = toCustomerSummary(waiting);
    expect(summary.canResume).toBe(true);
    expect(summary.canRetry).toBe(false);
    expect(summary.message).toMatch(/confirm/i);
    h.state.lockStatus = "LOCKED";
    const done = await runToIdle(h, () => h.orchestrator.resume("p1"));
    expect(done.status).toBe("COMPLETED");
    expect(h.calls.filter((id) => id === "PRODUCT_INTELLIGENCE")).toHaveLength(1);
  });
});

describe("Phase 8 — K. cancellation", () => {
  it("cancels a running workflow and preserves completed artifacts", async () => {
    const h = await harness();
    let entered!: () => void;
    const inRender = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    h.overrides.RENDER = async (ctx) => {
      entered();
      await gate;
      if (ctx.isCancelled()) throw new WorkflowStepError("SYSTEM_ERROR", "CANCELLED", "Production was cancelled.", { retryable: false });
      return { kind: "COMPLETED" };
    };
    const started = await h.orchestrator.start("p1");
    await inRender;
    await h.orchestrator.cancel("p1");
    release();
    await h.orchestrator.whenIdle();
    const record = h.orchestrator.get(started.id)!;
    expect(record.status).toBe("CANCELLED");
    expect(stepStatus(record, "TIMELINE")).toBe("COMPLETED");
    expect(record.steps.find((s) => s.id === "TIMELINE")!.artifactRefs.artifact).toBe("TIMELINE-artifact");
    expect(h.calls).not.toContain("QA");
    expect(toCustomerSummary(record).canResume).toBe(true);
  });

  it("cancels a waiting workflow immediately", async () => {
    const h = await harness(baseState({ lockStatus: "PENDING_CONFIRMATION" }));
    await runToIdle(h, () => h.orchestrator.start("p1"));
    const cancelled = await h.orchestrator.cancel("p1");
    expect(cancelled?.status).toBe("CANCELLED");
    expect(stepStatus(cancelled!, "PRODUCT_INTELLIGENCE")).toBe("COMPLETED");
  });
});

describe("Phase 8 — L. recovery after restart", () => {
  it("re-queues interrupted workflows and re-checks the interrupted step instead of assuming it finished", async () => {
    const root = await tempRoot();
    const first = await harness(baseState(), root);
    let entered!: () => void;
    const inRender = new Promise<void>((resolve) => { entered = resolve; });
    first.overrides.RENDER = async () => { entered(); return new Promise<StepOutcome>(() => undefined); };
    const started = await first.orchestrator.start("p1");
    await inRender;

    const second = await harness(baseState(), root);
    await second.orchestrator.whenIdle();
    const recovered = second.orchestrator.get(started.id)!;
    expect(recovered.status).toBe("COMPLETED");
    expect(second.calls[0]).toBe("RENDER");
    expect(second.calls).not.toContain("TIMELINE");
    const render = recovered.steps.find((s) => s.id === "RENDER")!;
    expect(render.history[0]).toMatchObject({ result: "FAILED", code: "RESTART_INTERRUPTED", failureClass: "SYSTEM_ERROR" });
    expect(second.logs.some((l) => l.event === "pmv_workflow_recovered")).toBe(true);
  });

  it("migrates records written without newer fields (additive, non-destructive)", async () => {
    const root = await tempRoot();
    const h = await harness(baseState(), root);
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    const file = path.join(root, "pmv-orchestrator", "workflows", `${record.id}.json`);
    const legacy = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    delete legacy.workflowVersion;
    delete legacy.forcedSteps;
    delete legacy.pendingRegenerateSceneIds;
    delete legacy.repairAttempts;
    await fs.writeFile(file, JSON.stringify(legacy));
    const reloaded = await harness(baseState(), root);
    const migrated = reloaded.orchestrator.get(record.id)!;
    expect(migrated.workflowVersion).toBe(1);
    expect(migrated.forcedSteps).toEqual([]);
    expect(migrated.pendingRegenerateSceneIds).toEqual([]);
    expect(migrated.repairAttempts).toEqual({});
    expect(migrated.status).toBe("COMPLETED");
    expect(migrated.delivery).toEqual(record.delivery);
  });
});

describe("Phase 8 — M. no secrets", () => {
  it("never persists raw error text, credentials or provider responses", async () => {
    const h = await harness();
    h.overrides.RENDER = async () => { throw new Error("upstream said: Authorization: Bearer sk-live-SECRET123 invalid key fal_key=abc"); };
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    const raw = await fs.readFile(path.join(h.root, "pmv-orchestrator", "workflows", `${record.id}.json`), "utf8");
    expect(raw).not.toMatch(/SECRET123|Bearer|fal_key|upstream said/);
    expect(JSON.stringify(h.summaries)).not.toMatch(/SECRET123|Bearer|fal_key/);
    expect(JSON.stringify(h.logs)).not.toMatch(/SECRET123|Bearer|fal_key/);
  });

  it("customer summary exposes only safe labels (no step ids, capabilities, providers, models or costs)", async () => {
    const h = await harness(baseState({ mode: "CINEMATIC", creativeRequest: "on a marble table" }));
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    const summary = toCustomerSummary(record);
    expect(Object.keys(summary).sort()).toEqual(
      ["activeStagePercent", "canCancel", "canResume", "canRetry", "completedAt", "delivered", "etaSeconds", "label", "message", "observedAt", "progress", "stages", "startedAt", "status", "updatedAt", "videoMode", "workflowId"].sort(),
    );
    const allowed = new Set([
      ...Object.values(CUSTOMER_STEP_LABELS),
      ...Object.values(MODE_STEP_LABELS).flatMap((labels) => Object.values(labels)),
    ]);
    for (const stage of summary.stages) expect(allowed.has(stage.label)).toBe(true);
    const text = JSON.stringify(summary);
    expect(text).not.toMatch(/VIDEO_IMAGE_TO_VIDEO|IMAGE_EDITING|VISION_ANALYSIS|PRODUCT_INTELLIGENCE|providerId|modelId|estimatedOperations|cost/i);
  });

  it("admin view never includes credential-shaped fields", async () => {
    const h = await harness();
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    const view = JSON.stringify(toAdminView(record, (c) => ({ capability: c, status: "READY", source: "ONLINE", providerId: "p", modelId: "m" })));
    expect(view).not.toMatch(/secret|apiKey|token|password|credential/i);
  });
});

describe("Phase 8 — N. QA gate", () => {
  it("never delivers when QA did not pass", async () => {
    const h = await harness(baseState({ qaStatus: "QA_FAILED" }));
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(h.calls).not.toContain("DELIVERY");
    expect(record.status).toBe("WAITING_FOR_USER");
    expect(record.delivery).toBeNull();
    expect(toCustomerSummary(record).delivered).toBe(false);
  });

  it("targeted repair re-renders only the failed scene, re-runs QA, then delivers", async () => {
    const h = await harness(baseState({ qaStatus: "QA_FAILED" }));
    let repaired = false;
    h.overrides.REPAIR = async (ctx) => {
      if (ctx.workflow.qa?.overallStatus === "QA_PASSED" || repaired) return { kind: "SKIPPED", reason: "QA_PASSED" };
      repaired = true;
      h.state.qaStatus = "QA_PASSED";
      return { kind: "REPAIR", rerunFrom: "RENDER", regenerateSceneIds: ["scene-2"], repairKey: "scene:scene-2" };
    };
    const record = await runToIdle(h, () => h.orchestrator.start("p1"));
    expect(record.status).toBe("COMPLETED");
    expect(h.calls.filter((id) => id === "RENDER")).toHaveLength(2);
    expect(h.calls.filter((id) => id === "QA")).toHaveLength(2);
    expect(h.calls.filter((id) => id === "TIMELINE")).toHaveLength(1);
    const secondRender = h.ctxSeen.filter((c) => c.step === "RENDER")[1]!;
    expect(secondRender).toMatchObject({ regenerate: ["scene-2"], forced: true });
    expect(record.pendingRegenerateSceneIds).toEqual([]);
    expect(record.repairAttempts["scene:scene-2"]).toBe(1);
    expect(record.delivery).toMatchObject({ renderJobId: "job-1", creativePlanId: "plan-1", identityLockVersion: "pil-v1" });
    expect(record.delivery?.sourceAssetIds.length).toBeGreaterThan(0);
  });
});

describe("Phase 8 — O. regression and wiring", () => {
  it("desktop modules still re-export the shared lock / QA / scene logic", async () => {
    const lock = await import("../../../../desktop/product-identity-lock/build-lock.js");
    const validate = await import("../../../../desktop/product-identity-lock/validate-lock.js");
    const qa = await import("../../../../desktop/pmv-qa/types.js");
    const classify = await import("../../../../desktop/pmv-qa/classify-failure.js");
    const creative = await import("../../../../desktop/pmv-creative/types.js");
    expect(typeof lock.buildProductIdentityLock).toBe("function");
    expect(typeof validate.validateIdentityLock).toBe("function");
    expect(typeof qa.runDeterministicPmvQa).toBe("function");
    expect(typeof classify.classifyPmvQaFailure).toBe("function");
    expect(typeof creative.scenesFromPlan).toBe("function");
    expect(creative.mapPmvModeToProduction("CINEMATIC")).not.toBe(creative.mapPmvModeToProduction("EXACT_PRODUCT"));
  });

  it("server code imports no runtime desktop modules", () => {
    const serverFiles = [
      "dev/server/index.ts",
      "dev/server/admin-control-center-api.ts",
      "dev/persistent/runtime.ts",
      ...readdirSync(path.resolve("ai/pmv-orchestrator")).map((f) => `ai/pmv-orchestrator/${f}`),
      ...readdirSync(path.resolve("ai/pmv-shared")).map((f) => `ai/pmv-shared/${f}`),
      "ai/pmv-qa/vision-identity-check.ts",
    ];
    for (const file of serverFiles) {
      const src = readFileSync(path.resolve(file), "utf8");
      const runtimeDesktop = [...src.matchAll(/^import\s+(?!type\b)[^;]*from\s+["'][^"']*desktop\//gm)];
      const dynamicDesktop = [...src.matchAll(/import\(\s*["'][^"']*desktop\//g)];
      expect(runtimeDesktop, file).toEqual([]);
      expect(dynamicDesktop, file).toEqual([]);
    }
  });

  it("wires the orchestrator, APIs and the existing PMV / Admin UIs", () => {
    const runtime = readFileSync(path.resolve("dev/persistent/runtime.ts"), "utf8");
    expect(runtime).toContain("bootstrapPmvOrchestrator");
    const server = readFileSync(path.resolve("dev/server/index.ts"), "utf8");
    expect(server).toContain("/workflow$/");
    expect(server).toMatch(/action === "start"[\s\S]*action === "resume"[\s\S]*action === "retry"[\s\S]*action === "cancel"/);
    const admin = readFileSync(path.resolve("dev/server/admin-control-center-api.ts"), "utf8");
    expect(admin).toContain("/api\\/admin\\/workflows");
    const pmv = readFileSync(path.resolve("desktop/customer-platform/workspace/ProductMarketingVideoWorkspace.tsx"), "utf8");
    expect(pmv).toContain("usePmvWorkflow");
    const hook = readFileSync(path.resolve("desktop/pmv-workflow/usePmvWorkflow.ts"), "utf8");
    expect(hook).not.toMatch(/admin|providerId|modelId|toAdminView/i);
    const nav = readFileSync(path.resolve("desktop/admin-control-center/admin-routes.ts"), "utf8");
    expect(nav).toMatch(/id: "workflows"[^\n]*implemented: true/);
  });
});
