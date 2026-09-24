import { describe, expect, it } from "vitest";
import type { StepExecutionContext } from "../../../../ai/pmv-orchestrator/engine.js";
import { classifyWorkflowError } from "../../../../ai/pmv-orchestrator/failure.js";
import { createStepExecutors, loadWorkflowSnapshot, type ExecutorManagers } from "../../../../ai/pmv-orchestrator/executors.js";
import type { WorkflowRecord, WorkflowStepId, WorkflowStepRecord } from "../../../../ai/pmv-orchestrator/types.js";
import { computeAssetFingerprint } from "../../../../ai/pmv-shared/build-lock.js";

type AnyRecord = Record<string, unknown>;

function lockFor(status: "LOCKED" | "PENDING_CONFIRMATION", assets = ["img-1", "img-2"]) {
  return {
    version: "pil-v1",
    identityVersion: "id-1",
    projectId: "p1",
    status,
    heroAssetId: "img-1",
    productAssetIds: assets,
    assetFingerprint: computeAssetFingerprint(assets, "img-1"),
    protectedAttributes: ["shape"],
    allowedCreativeChanges: ["background"],
    lockedAt: status === "LOCKED" ? "2026-01-01T00:00:00.000Z" : null,
  };
}

function fakeManagers(opts: {
  lock?: AnyRecord | null;
  pmv?: AnyRecord;
  output?: AnyRecord | null;
  renderError?: { code: string; message: string };
} = {}) {
  const project: AnyRecord = {
    id: "p1",
    name: "Shoe",
    language: "en",
    productImages: [
      { id: "img-1", mimeType: "image/jpeg", fileName: "a.jpg", width: 1600, height: 1600 },
      { id: "img-2", mimeType: "image/jpeg", fileName: "b.jpg" },
    ],
    productInformation: { name: "Shoe" },
    brandInformation: { name: "Kwizera" },
    campaignInformation: { callToAction: "Shop now" },
    workspaceSettings: {
      productMarketingVideo: { heroAssetId: "img-1", ...(opts.pmv ?? {}) },
      ...(opts.lock === null ? {} : { productIdentityLock: opts.lock ?? lockFor("LOCKED") }),
    },
    selectedAudioAssetId: null,
  };
  const updates: AnyRecord[] = [];
  const confirmCalls: string[] = [];
  const m: ExecutorManagers = {
    workspace: {
      getProject: async () => project as never,
      updateProject: async (_id: string, changes: AnyRecord) => {
        updates.push(changes);
        project.workspaceSettings = { ...(project.workspaceSettings as AnyRecord), ...(changes.workspaceSettings as AnyRecord) };
        return project as never;
      },
      getOriginalImagePath: async () => null as never,
      getAssetImagePath: async () => null as never,
    } as never,
    planning: {
      getPlan: async () => null,
      createPlan: async () => { throw new Error("not used"); },
      validateForPlan: () => ({ valid: true, errors: [] }) as never,
      finalize: async () => { confirmCalls.push("finalize"); return null as never; },
      updatePlan: async () => null as never,
    } as never,
    production: {
      getVideoProject: async () => null,
      createOrRefresh: async () => { throw new Error("not used"); },
      startRender: async () => {
        if (opts.renderError) throw Object.assign(new Error(opts.renderError.message), { name: "VideoProductionError", code: opts.renderError.code });
        throw new Error("not used");
      },
      getJob: async () => null,
      getOutputDetails: async () => (opts.output ?? null) as never,
    } as never,
    intelligence: null,
    canonical: null,
    runtime: () => null,
    i2vAvailable: async () => false,
  };
  return { m, project, updates, confirmCalls };
}

function ctxFor(stepId: WorkflowStepId, overrides: Partial<StepExecutionContext> = {}): StepExecutionContext {
  const step: WorkflowStepRecord = {
    id: stepId, status: "RUNNING", dependsOn: [], capabilities: [], reason: "", inputFingerprint: null,
    attempts: 1, maxAttempts: 3, history: [], failure: null, artifactRefs: {}, startedAt: null, completedAt: null,
  };
  const workflow = {
    id: "wf", projectId: "p1", pendingRegenerateSceneIds: [], repairAttempts: {}, steps: [step],
  } as unknown as WorkflowRecord;
  return { workflow, step, fingerprint: "fp", priorFingerprint: null, priorRefs: {}, forced: false, isCancelled: () => false, ...overrides };
}

describe("Phase 8 executors over existing managers", () => {
  it("never auto-confirms the Product Identity Lock (WAITING_FOR_USER instead)", async () => {
    const { m, updates } = fakeManagers({ lock: lockFor("PENDING_CONFIRMATION") });
    const outcome = await createStepExecutors(m).PRODUCT_LOCK!(ctxFor("PRODUCT_LOCK"));
    expect(outcome).toMatchObject({ kind: "WAITING_FOR_USER", code: "LOCK_CONFIRMATION_REQUIRED" });
    expect(updates).toEqual([]);
  });

  it("reuses a valid confirmed lock and reports stale locks as waiting for the customer", async () => {
    const ok = fakeManagers();
    expect((await createStepExecutors(ok.m).PRODUCT_LOCK!(ctxFor("PRODUCT_LOCK"))).kind).toBe("REUSED");
    const stale = fakeManagers({ lock: lockFor("LOCKED", ["img-1", "img-9"]) });
    expect(await createStepExecutors(stale.m).PRODUCT_LOCK!(ctxFor("PRODUCT_LOCK"))).toMatchObject({ kind: "WAITING_FOR_USER", code: "LOCK_STALE" });
  });

  it("skips audio when no track is selected", async () => {
    const { m } = fakeManagers();
    expect(await createStepExecutors(m).AUDIO!(ctxFor("AUDIO"))).toEqual({ kind: "SKIPPED", reason: "NO_AUDIO_SELECTED" });
  });

  it("refuses delivery unless QA passed for the current render", async () => {
    const output = {
      url: "/media/final.mp4", outputStatus: "CURRENT", preset: "standard", validationStatus: "TECHNICALLY_VALIDATED",
      sizeBytes: 1000, renderJobId: "job-2", assetId: "vid-2", sourceAssetIds: ["img-1"],
    };
    const stale = fakeManagers({ output, pmv: { qaResult: { overallStatus: "QA_PASSED", renderJobId: "job-1", checkedAt: "t" } } });
    expect(await createStepExecutors(stale.m).DELIVERY!(ctxFor("DELIVERY"))).toMatchObject({ kind: "WAITING_FOR_USER", code: "QA_GATE" });
    expect(stale.updates).toEqual([]);

    const passed = fakeManagers({ output, pmv: { qaResult: { overallStatus: "QA_PASSED", renderJobId: "job-2", checkedAt: "t" } } });
    const outcome = await createStepExecutors(passed.m).DELIVERY!(ctxFor("DELIVERY"));
    expect(outcome.kind).toBe("COMPLETED");
    expect(outcome).toMatchObject({
      delivery: { outputAssetId: "vid-2", renderJobId: "job-2", identityLockVersion: "id-1", sourceAssetIds: ["img-1"] },
    });
    const written = (passed.project.workspaceSettings as AnyRecord).productMarketingVideo as AnyRecord;
    expect(written).toMatchObject({ deliveryStatus: "DELIVERED", approvedRenderJobId: "job-2", heroAssetId: "img-1" });
  });

  it("fails cinematic generation with a configuration error when I2V is not routed (no silent Exact fallback)", async () => {
    const { m } = fakeManagers();
    const error = await createStepExecutors(m).VIDEO_GENERATION!(ctxFor("VIDEO_GENERATION")).catch((e: unknown) => e);
    expect(classifyWorkflowError(error, "VIDEO_GENERATION")).toMatchObject({ failureClass: "CONFIGURATION_ERROR", code: "I2V_UNAVAILABLE", retryable: false });
  });

  it("classifies render failures from the existing Video Production errors", async () => {
    const { m } = fakeManagers({ renderError: { code: "FFMPEG_UNAVAILABLE", message: "ffmpeg missing" } });
    const error = await createStepExecutors(m).RENDER!(ctxFor("RENDER")).catch((e: unknown) => e);
    expect(classifyWorkflowError(error, "RENDER")).toMatchObject({ failureClass: "CONFIGURATION_ERROR", retryable: false });
  });

  it("builds a snapshot from project state without contacting providers", async () => {
    const { m } = fakeManagers();
    const snapshot = await loadWorkflowSnapshot(m, "p1");
    expect(snapshot.planInput).toMatchObject({ projectId: "p1", generationMode: "EXACT_PRODUCT", heroWidth: 1600, visionQaAvailable: false });
    expect(Object.keys(snapshot.fingerprints)).toHaveLength(11);
  });
});
