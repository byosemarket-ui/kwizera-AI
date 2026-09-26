/**
 * Phase 8 — step executors over the existing PMV subsystems.
 * Each executor calls an existing manager (Product Intelligence, Creative Planning, Video Production,
 * QA) with the minimum data it needs. Provider credentials stay inside CapabilityRuntime.
 */
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import type { CreativePlan, CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import { listOriginalProductImages } from "../creative-workspace/project-asset.js";
import { describeImagePrepAvailability } from "../image-preparation/pipeline.js";
import { PMV_SETTINGS_KEY, readCreativeRequest } from "../image-preparation/scene-preparation.js";
import { checkProjectHeroVisionIdentity, probeVisionQaAvailable } from "../pmv-qa/vision-identity-check.js";
import { buildProductIdentityLock, buildProductIntelligenceReview, computeAssetFingerprint } from "../pmv-shared/build-lock.js";
import { classifyPmvQaFailure } from "../pmv-shared/classify-failure.js";
import { PMV_IDENTITY_LOCK_KEY, type ProductIdentityLock } from "../pmv-shared/identity-lock-types.js";
import { isPmvPlatform, resolvePmvDestination, sceneBudgetSeconds, validateDuration } from "../pmv-shared/destination.js";
import {
  legacyGenerationMode,
  PMV_VIDEO_MODE_COPY,
  productionModeForVideoMode,
  resolveStoredVideoMode,
  type PmvVideoMode,
} from "../pmv-shared/modes.js";
import { buildVideoModeExecutionPlan, type VideoModeExecutionPlan } from "../pmv-shared/video-mode-resolver.js";
import type { ModeReadinessProbe } from "./mode-readiness.js";
import {
  buildTargetedRegeneration,
  PMV_SCENE_REGEN_MAX_ATTEMPTS,
  runDeterministicPmvQa,
  type PmvVideoQaResult,
  type PmvVisionIdentityEvidence,
} from "../pmv-shared/qa.js";
import { scenesFromPlan } from "../pmv-shared/scenes.js";
import { validateIdentityLock } from "../pmv-shared/validate-lock.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { CreativeToneId, ProductionModeId } from "../video-production/production-mode-types.js";
import {
  VIDEO_CAMERA_OPTIONS,
  VIDEO_MOTION_OPTIONS,
  VideoProductionError,
  type VideoOutputDetails,
  type VideoProject,
  type VideoRenderJob,
} from "../video-production/types.js";
import type { VideoProductionManager } from "../video-production/video-production-manager.js";
import type { StepExecutionContext, StepExecutor, StepOutcome, WorkflowSnapshot } from "./engine.js";
import { WorkflowStepError } from "./failure.js";
import { computeStepFingerprints } from "./fingerprints.js";
import type { WorkflowQaSummary, WorkflowStepId } from "./types.js";

export interface ExecutorManagers {
  workspace: Pick<CreativeWorkspaceManager, "getProject" | "updateProject" | "getOriginalImagePath" | "getAssetImagePath">;
  planning: Pick<CreativePlanningManager, "getPlan" | "createPlan" | "validateForPlan" | "finalize" | "updatePlan">;
  production: Pick<VideoProductionManager, "getVideoProject" | "createOrRefresh" | "startRender" | "getJob" | "getOutputDetails">;
  intelligence: { analyze(projectId: string): Promise<ProductIntelligenceProfile>; getProfile(projectId: string): Promise<ProductIntelligenceProfile | null> } | null;
  canonical: { sync(projectId: string): Promise<unknown> } | null;
  runtime: () => CapabilityRuntime | null;
  /** Whether cinematic image-to-video can execute (Admin VIDEO_IMAGE_TO_VIDEO routing). */
  i2vAvailable: () => Promise<boolean>;
  /** Executable readiness of every mode capability; without it no mode route is attached to the snapshot. */
  modeReadiness?: ModeReadinessProbe;
  pollIntervalMs?: number;
  renderTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

type Pmv = Record<string, unknown>;

interface ProjectState {
  project: CreativeProject;
  pmv: Pmv;
  lock: ProductIdentityLock | null;
  productAssetIds: string[];
  heroAssetId: string | null;
  videoMode: PmvVideoMode;
  narrationRequested: boolean;
  creativeTone: CreativeToneId;
  durationSeconds: number;
  aspectRatio: string;
  platform: string | null;
  creativeRequest: string;
  brandName: string;
  website: string;
  phone: string;
  cta: string;
  logoAssetId: string | null;
  selectedAudioAssetId: string | null;
  plan: CreativePlan | null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPmv(project: CreativeProject): Pmv {
  const raw = project.workspaceSettings?.[PMV_SETTINGS_KEY];
  return raw && typeof raw === "object" ? { ...(raw as Pmv) } : {};
}

async function loadProjectState(m: ExecutorManagers, projectId: string): Promise<ProjectState> {
  const project = await m.workspace.getProject(projectId);
  if (!project) throw new WorkflowStepError("USER_INPUT_ERROR", "PROJECT_NOT_FOUND", "Open an existing project to start production.", { waitingForUser: false });
  return { ...readProjectState(project), plan: await m.planning.getPlan(projectId) };
}

/** The saved PMV production configuration of a project (pure; no plan lookup). */
export function readProjectState(project: CreativeProject): Omit<ProjectState, "plan"> {
  const pmv = readPmv(project);
  const rawLock = project.workspaceSettings?.[PMV_IDENTITY_LOCK_KEY];
  const lock = rawLock && typeof rawLock === "object" ? rawLock as ProductIdentityLock : null;
  const productAssetIds = listOriginalProductImages(project.productImages).map((img) => img.id);
  const storedHero = str(pmv.heroAssetId);
  const heroAssetId = storedHero && productAssetIds.includes(storedHero) ? storedHero : productAssetIds[0] ?? null;
  const direction = (pmv.creativeDirection && typeof pmv.creativeDirection === "object" ? pmv.creativeDirection : {}) as Record<string, unknown>;
  const videoMode = resolveStoredVideoMode(direction);
  const info = project.productInformation as unknown as Record<string, unknown>;
  const campaign = project.campaignInformation as unknown as Record<string, unknown>;
  const duration = Number(pmv.durationSeconds) || Number(campaign?.customDurationSeconds) || 15;
  return {
    project,
    pmv,
    lock,
    productAssetIds,
    heroAssetId,
    videoMode,
    narrationRequested: /narrat|voice|speak/i.test(str(direction.voicePreference)) && !/optional/i.test(str(direction.voicePreference)),
    creativeTone: (str(direction.creativeTone) || "Modern") as CreativeToneId,
    durationSeconds: duration > 0 ? duration : 15,
    aspectRatio: str(pmv.aspectRatio) || "9:16",
    platform: str(pmv.platform) || null,
    creativeRequest: readCreativeRequest(project.workspaceSettings),
    brandName: str(project.brandInformation?.name) || str(info?.brand) || str(info?.name),
    website: str(project.brandInformation?.website) || str(info?.website),
    phone: str(project.brandInformation?.phone) || str(info?.phone),
    cta: str(campaign?.callToAction) || str(info?.callToAction) || str(info?.cta),
    logoAssetId: str(project.brandInformation?.logoAssetId) || null,
    selectedAudioAssetId: str(project.selectedAudioAssetId) || null,
  };
}

function productionConfiguration(s: Omit<ProjectState, "plan"> & { plan?: CreativePlan | null }) {
  return {
    projectId: s.project.id,
    mode: s.videoMode,
    sourceAssetIds: s.productAssetIds,
    heroAssetId: s.heroAssetId,
    identityLock: { version: s.lock?.identityVersion ?? null, status: s.lock?.status ?? null },
    platform: isPmvPlatform(s.platform) ? s.platform : null,
    aspectRatio: s.aspectRatio,
    projectPlatform: s.project.platform ?? null,
    durationSeconds: s.durationSeconds,
    audio: {
      selectedAudioAssetId: s.selectedAudioAssetId,
      beatSyncMode: String(s.project.beatSyncMode ?? "SMART"),
      volume: typeof s.project.audioVolume === "number" ? s.project.audioVolume : null,
    },
    voice: { narrationRequested: s.narrationRequested },
    creativePlan: { id: s.plan?.id ?? null, version: s.plan?.version ?? null },
    creativeRequest: s.creativeRequest,
  };
}

/** Mode route + production configuration for a saved project — what the backend would execute. */
export function modePlanForProject(
  project: CreativeProject,
  plan: { id: string; version: number } | null,
  readiness: Awaited<ReturnType<ModeReadinessProbe>>,
): VideoModeExecutionPlan {
  const s = readProjectState(project);
  return buildVideoModeExecutionPlan(productionConfiguration({ ...s, plan: plan as CreativePlan | null }), readiness);
}

/** Merge into the project's PMV settings through existing project persistence (other keys untouched). */
async function patchPmv(m: ExecutorManagers, projectId: string, patch: Pmv, lock?: ProductIdentityLock): Promise<void> {
  const project = await m.workspace.getProject(projectId);
  if (!project) return;
  const current = readPmv(project);
  await m.workspace.updateProject(projectId, {
    workspaceSettings: {
      [PMV_SETTINGS_KEY]: { ...current, ...patch },
      ...(lock ? { [PMV_IDENTITY_LOCK_KEY]: lock } : {}),
    },
  });
}

export async function loadWorkflowSnapshot(m: ExecutorManagers, projectId: string): Promise<WorkflowSnapshot> {
  const s = await loadProjectState(m, projectId);
  const runtime = m.runtime();
  const hero = s.project.productImages.find((img) => img.id === s.heroAssetId);
  const fingerprints = computeStepFingerprints({
    assetFingerprint: computeAssetFingerprint(s.productAssetIds, s.heroAssetId),
    lockVersion: s.lock?.identityVersion ?? null,
    lockStatus: s.lock?.status ?? null,
    // Legacy value where one exists so pre-Phase-10 fingerprints stay valid (no needless re-planning).
    mode: legacyGenerationMode(s.videoMode) ?? s.videoMode,
    creativeTone: s.creativeTone,
    durationSeconds: s.durationSeconds,
    aspectRatio: s.aspectRatio,
    platform: s.platform ? `${s.platform}:${s.project.platform ?? ""}` : null,
    creativeRequest: s.creativeRequest,
    text: { brandName: s.brandName, cta: s.cta, website: s.website, phone: s.phone, logoAssetId: s.logoAssetId, language: s.project.language ?? "" },
    audio: {
      selectedAudioAssetId: s.selectedAudioAssetId,
      beatSyncMode: String(s.project.beatSyncMode ?? "SMART"),
      audioVolume: typeof s.project.audioVolume === "number" ? s.project.audioVolume : null,
    },
    planId: s.plan?.id ?? null,
    planVersion: s.plan?.version ?? null,
  });
  return {
    fingerprints,
    modePlan: m.modeReadiness ? buildVideoModeExecutionPlan(productionConfiguration(s), await m.modeReadiness()) : null,
    planInput: {
      projectId,
      videoMode: s.videoMode,
      creativeRequest: s.creativeRequest,
      heroWidth: hero?.width ?? null,
      heroHeight: hero?.height ?? null,
      editorAcceptsMask: describeImagePrepAvailability(runtime).editorAcceptsMask,
      musicGenerationRequested: false,
      estimatedSceneCount: s.plan?.scenes.length || Math.max(1, Math.ceil(s.durationSeconds / 4)),
      visionQaAvailable: await probeVisionQaAvailable(runtime),
    },
  };
}

/** Render engine of the selected mode; a mode without one stops here instead of rendering something else. */
function renderEngineFor(mode: PmvVideoMode): ProductionModeId {
  const engine = productionModeForVideoMode(mode);
  if (!engine) {
    throw new WorkflowStepError(
      "CONFIGURATION_ERROR",
      "MODE_NOT_EXECUTABLE",
      `${PMV_VIDEO_MODE_COPY[mode].label} is not available yet. Choose another video style.`,
      { retryable: false },
    );
  }
  return engine;
}

const PLAN_NOT_REUSABLE = new Set(["STALE", "FAILED", "PLANNING", "NOT_STARTED"]);

function outputIsCurrent(output: VideoOutputDetails | null): output is VideoOutputDetails {
  return Boolean(output?.url && output.outputStatus === "CURRENT" && output.preset === "standard"
    && output.validationStatus === "TECHNICALLY_VALIDATED" && output.sizeBytes > 0);
}

function reusedOrCompleted(ctx: StepExecutionContext): "REUSED" | "COMPLETED" {
  return ctx.priorFingerprint === ctx.fingerprint || !ctx.priorFingerprint ? "REUSED" : "COMPLETED";
}

function qaSummary(qa: PmvVideoQaResult, expectedMode: PmvVideoMode): WorkflowQaSummary {
  return {
    expectedMode,
    overallStatus: qa.overallStatus,
    renderJobId: qa.renderJobId,
    videoAssetId: qa.videoAssetId,
    failures: qa.failures.slice(0, 8),
    checkedAt: qa.checkedAt,
  };
}

export function createStepExecutors(m: ExecutorManagers): Partial<Record<WorkflowStepId, StepExecutor>> {
  const sleep = m.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pollMs = m.pollIntervalMs ?? 2_000;
  const timeoutMs = m.renderTimeoutMs ?? 45 * 60_000;

  /** Start (or attach to) a standard render job and wait for it without blocking any web request. */
  async function runRender(ctx: StepExecutionContext, projectId: string): Promise<{ job: VideoRenderJob; output: VideoOutputDetails; video: VideoProject | null }> {
    const regenerateSceneIds = ctx.workflow.pendingRegenerateSceneIds;
    let job: VideoRenderJob | null = null;
    try {
      job = (await m.production.startRender(projectId, "standard", regenerateSceneIds.length ? { regenerateSceneIds } : undefined)).job;
    } catch (error) {
      if ((error as { code?: string })?.code !== "RENDER_IN_PROGRESS") throw error;
      const video = await m.production.getVideoProject(projectId);
      job = video?.activeJobId ? await m.production.getJob(video.activeJobId, projectId) : null;
      if (!job) throw error;
    }
    await patchPmv(m, projectId, { produceStatus: "RENDERING", finalRenderJobId: job.id, finalVideoReady: false });
    const started = Date.now();
    while (job.status === "queued" || job.status === "processing") {
      if (ctx.isCancelled()) {
        throw new WorkflowStepError("SYSTEM_ERROR", "CANCELLED", "Production was cancelled.", { retryable: false });
      }
      if (Date.now() - started > timeoutMs) {
        throw new WorkflowStepError("TIMEOUT", "RENDER_TIMEOUT", "Rendering is taking longer than expected. Try again.");
      }
      await sleep(pollMs);
      job = (await m.production.getJob(job.id, projectId)) ?? job;
    }
    if (job.status !== "completed") {
      throw new VideoProductionError(job.errorCode ?? "RENDER_FAILED", job.error ?? "Render failed");
    }
    const output = await m.production.getOutputDetails(projectId);
    if (!output?.url) throw new VideoProductionError("MISSING_OUTPUT", "Render completed without a registered output");
    await patchPmv(m, projectId, {
      produceStatus: "FINAL_READY",
      finalRenderJobId: job.id,
      finalVideoReady: true,
      finalOutputAssetId: output.assetId,
      finalOutputUrl: output.url,
      videoReady: true,
      creativeStatus: "VIDEO_READY",
    });
    return { job, output, video: await m.production.getVideoProject(projectId) };
  }

  const PRODUCT_INTELLIGENCE: StepExecutor = async (ctx): Promise<StepOutcome> => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    if (!s.productAssetIds.length || !s.heroAssetId) {
      throw new WorkflowStepError("USER_INPUT_ERROR", "PRODUCT_IMAGES_REQUIRED", "Add product photos and choose a hero image to continue.");
    }
    if (!str(s.project.productInformation?.name)) {
      throw new WorkflowStepError("USER_INPUT_ERROR", "PRODUCT_NAME_REQUIRED", "Add the product name to continue.");
    }
    const fingerprint = computeAssetFingerprint(s.productAssetIds, s.heroAssetId);
    const existing = m.intelligence ? await m.intelligence.getProfile(projectId).catch(() => null) : null;
    const status = str(s.pmv.intelligenceStatus);
    const reusable = Boolean(existing && s.lock && s.lock.status !== "STALE" && s.lock.status !== "INVALID"
      && (s.pmv.intelligenceAssetFingerprint === fingerprint || s.lock.assetFingerprint === fingerprint)
      && !["STALE", "FAILED", "NOT_STARTED", "ANALYZING", "UNAVAILABLE"].includes(status));
    if (reusable) {
      return { kind: reusedOrCompleted(ctx), refs: { profileId: existing!.id ?? null, analysisVersion: existing!.analysisVersion ?? null } };
    }
    if (!m.intelligence) {
      throw new WorkflowStepError("CONFIGURATION_ERROR", "PRODUCT_INTELLIGENCE_UNAVAILABLE", "Product analysis is unavailable right now. Try again later.");
    }
    await patchPmv(m, projectId, { intelligenceStatus: "ANALYZING", intelligenceError: null });
    const profile = await m.intelligence.analyze(projectId);
    await m.canonical?.sync(projectId).catch(() => null);
    const review = buildProductIntelligenceReview(profile, s.heroAssetId);
    const draft = buildProductIdentityLock({
      projectId,
      profile,
      heroAssetId: s.heroAssetId,
      productAssetIds: s.productAssetIds,
      assetFingerprint: fingerprint,
    });
    await patchPmv(m, projectId, {
      intelligenceStatus: "REVIEW",
      intelligenceReview: review,
      intelligenceAssetFingerprint: fingerprint,
      intelligenceProfileId: profile.id ?? null,
      intelligenceAnalysisVersion: profile.analysisVersion ?? null,
      intelligenceError: null,
      foundationStatus: "READY_FOR_INTELLIGENCE",
      heroAssetId: s.heroAssetId,
    }, draft);
    return { kind: "COMPLETED", refs: { profileId: profile.id ?? null, analysisVersion: profile.analysisVersion ?? null, draftLockVersion: draft.identityVersion } };
  };

  const PRODUCT_LOCK: StepExecutor = async (ctx): Promise<StepOutcome> => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    if (!s.lock) {
      throw new WorkflowStepError("SYSTEM_ERROR", "LOCK_MISSING", "Product analysis must run again before locking.", { retryable: false });
    }
    const validation = validateIdentityLock({
      lock: s.lock,
      projectId,
      productAssetIds: s.productAssetIds,
      heroAssetId: s.heroAssetId,
    });
    if (s.lock.status === "LOCKED" && validation.ok) {
      return { kind: reusedOrCompleted(ctx), refs: { identityVersion: s.lock.identityVersion, lockedAt: s.lock.lockedAt } };
    }
    if (s.lock.status === "PENDING_CONFIRMATION" && !validation.stale) {
      const review = s.pmv.intelligenceReview as { readyToConfirm?: boolean } | undefined;
      // The customer confirms identity in the existing Step 2 UI; the workflow never auto-confirms.
      return {
        kind: "WAITING_FOR_USER",
        code: review?.readyToConfirm === false ? "LOCK_REVIEW_REQUIRED" : "LOCK_CONFIRMATION_REQUIRED",
        message: review?.readyToConfirm === false
          ? "Review your product details, then confirm the product identity to continue."
          : "Confirm your product identity to continue. We never change your real product.",
        refs: { draftLockVersion: s.lock.identityVersion },
      };
    }
    return {
      kind: "WAITING_FOR_USER",
      code: "LOCK_STALE",
      message: "Your product photos changed. Re-analyze the product and confirm the identity to continue.",
    };
  };

  const CREATIVE_PLANNING: StepExecutor = async (ctx): Promise<StepOutcome> => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    const productionMode = renderEngineFor(s.videoMode);
    const plan = s.plan;
    const planModeMatches = (plan?.productionMode ?? "AI_PRODUCT_MOTION") === productionMode;
    const planUsable = Boolean(plan?.scenes.length && plan.scenes.every((scene) => scene.assetId));
    const matchesRecord = ctx.priorFingerprint
      ? ctx.priorFingerprint === ctx.fingerprint
      : s.pmv.creativePlanId === plan?.id && !PLAN_NOT_REUSABLE.has(str(s.pmv.creativeStatus));
    if (plan && planUsable && planModeMatches && matchesRecord && !ctx.forced) {
      return { kind: "REUSED", refs: { planId: plan.id, planVersion: plan.version } };
    }
    const project = s.project;
    const destination = resolvePmvDestination(isPmvPlatform(s.platform) ? s.platform : null, s.aspectRatio, project.platform);
    const durationProblem = validateDuration(s.durationSeconds, destination, s.videoMode);
    if (durationProblem) {
      throw new WorkflowStepError("USER_INPUT_ERROR", "DURATION_NOT_SUPPORTED", durationProblem);
    }
    const validation = m.planning.validateForPlan(project);
    if (!validation.valid) {
      throw new WorkflowStepError("USER_INPUT_ERROR", "PLAN_INPUTS_MISSING", validation.errors[0] ?? "Complete your product details before planning.");
    }
    await patchPmv(m, projectId, { creativeStatus: "PLANNING", creativeError: null });
    const result = await m.planning.createPlan(project, validation, {
      productionMode,
      creativeTone: s.creativeTone,
      regenerate: Boolean(plan),
      durationSeconds: sceneBudgetSeconds(s.durationSeconds, s.videoMode),
    });
    if (!result.plan) {
      throw new WorkflowStepError("USER_INPUT_ERROR", "PLAN_INPUTS_MISSING", result.validation.errors[0] ?? "Complete your product details before planning.");
    }
    await patchPmv(m, projectId, {
      creativeStatus: "PLAN_READY",
      creativePlanId: result.plan.id,
      creativePlanVersion: result.plan.version,
      creativePlanStatus: result.plan.planStatus ?? "READY_FOR_REVIEW",
      productionMode: result.plan.productionMode ?? productionMode,
      videoReady: false,
      creativeError: null,
    });
    return { kind: "COMPLETED", refs: { planId: result.plan.id, planVersion: result.plan.version, sceneCount: result.plan.scenes.length } };
  };

  const AUDIO: StepExecutor = async (ctx) => {
    const s = await loadProjectState(m, ctx.workflow.projectId);
    if (!s.selectedAudioAssetId) return { kind: "SKIPPED", reason: "NO_AUDIO_SELECTED" };
    return { kind: "REUSED", refs: { audioAssetId: s.selectedAudioAssetId } };
  };

  const TIMELINE: StepExecutor = async (ctx) => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    if (!s.plan) throw new WorkflowStepError("SYSTEM_ERROR", "MISSING_PLAN", "The video plan is missing. Try again.", { retryable: false, route: "creative_planning" });
    const video = await m.production.getVideoProject(projectId);
    const matchesPlan = Boolean(video?.timeline.length && video.creativePlanId === s.plan.id && video.creativePlanVersion === s.plan.version);
    const output = matchesPlan ? await m.production.getOutputDetails(projectId) : null;
    const inputsUnchanged = ctx.priorFingerprint ? ctx.priorFingerprint === ctx.fingerprint : outputIsCurrent(output);
    if (matchesPlan && inputsUnchanged && !ctx.forced) {
      return { kind: "REUSED", refs: { videoProjectId: video!.id, timelineVersion: video!.version, clipCount: video!.timeline.length } };
    }
    await m.planning.finalize(projectId);
    const rebuilt = await m.production.createOrRefresh(projectId);
    if (!rebuilt.timeline.length) {
      throw new WorkflowStepError("SYSTEM_ERROR", "EMPTY_TIMELINE", "The timeline could not be built. Try again.", { retryable: false });
    }
    await patchPmv(m, projectId, {
      produceStatus: s.selectedAudioAssetId ? "AUDIO_READY" : "TIMELINE_READY",
      finalVideoReady: false,
      deliveryStatus: s.pmv.deliveryStatus === "DELIVERED" ? "STALE" : (s.pmv.deliveryStatus ?? "NOT_DELIVERED"),
    });
    return { kind: "COMPLETED", refs: { videoProjectId: rebuilt.id, timelineVersion: rebuilt.version, clipCount: rebuilt.timeline.length } };
  };

  const MEDIA_PREPARATION: StepExecutor = async (ctx) => {
    const availability = describeImagePrepAvailability(m.runtime());
    const needed = ctx.step.capabilities;
    const unavailable = needed.filter((cap) =>
      (cap === "IMAGE_SEGMENTATION" && !availability.segmentation)
      || (cap === "IMAGE_EDITING" && !availability.editing)
      || (cap === "IMAGE_UPSCALE" && !availability.enhancement));
    // Per-scene preparation executes inside the cinematic render job (Phase 7), which already
    // caches accepted stages and falls back to the original photo when a stage is unavailable.
    return {
      kind: "COMPLETED",
      refs: {
        executesWith: "VIDEO_GENERATION",
        requestedOperations: needed.length,
        unavailableOperations: unavailable.length,
        originalPhotoFallback: unavailable.length > 0,
      },
    };
  };

  const VIDEO_GENERATION: StepExecutor = async (ctx): Promise<StepOutcome> => {
    const projectId = ctx.workflow.projectId;
    if (!(await m.i2vAvailable())) {
      throw new WorkflowStepError(
        "CONFIGURATION_ERROR",
        "I2V_UNAVAILABLE",
        "Cinematic scenes are unavailable right now. Choose Product Slideshow or try again later.",
      );
    }
    const output = await m.production.getOutputDetails(projectId);
    if (outputIsCurrent(output) && !ctx.forced && (!ctx.priorFingerprint || ctx.priorFingerprint === ctx.fingerprint)) {
      const video = await m.production.getVideoProject(projectId);
      const clips = Object.values(video?.i2vSceneClips ?? {});
      if (clips.length && clips.every((clip) => clip.status === "ACCEPTED")) {
        return { kind: "REUSED", refs: { renderJobId: output.renderJobId, acceptedScenes: clips.length } };
      }
    }
    const { job, video } = await runRender(ctx, projectId);
    const clips = Object.values(video?.i2vSceneClips ?? {});
    const preps = Object.values(video?.imagePreparations ?? {});
    return {
      kind: "COMPLETED",
      refs: {
        renderJobId: job.id,
        acceptedScenes: clips.filter((clip) => clip.status === "ACCEPTED").length,
        regeneratedScenes: ctx.workflow.pendingRegenerateSceneIds.length,
        preparedImages: preps.filter((p) => p.finalSource === "PREPARED").length,
        preparationFallbacks: preps.filter((p) => p.fallbackUsed).length,
      },
    };
  };

  // No 3D generation pipeline exists yet: the step exists so the route is real, and it stops truthfully.
  const PRODUCT_3D_GENERATION: StepExecutor = async () => {
    throw new WorkflowStepError(
      "CONFIGURATION_ERROR",
      "THREE_D_UNAVAILABLE",
      "3D Product Showcase is coming soon. Choose another video style.",
      { retryable: false },
    );
  };

  const RENDER: StepExecutor = async (ctx): Promise<StepOutcome> => {
    const projectId = ctx.workflow.projectId;
    const output = await m.production.getOutputDetails(projectId);
    const generated = ctx.workflow.steps.find((step) => step.id === "VIDEO_GENERATION");
    if (outputIsCurrent(output) && generated && generated.artifactRefs.renderJobId === output.renderJobId
      && (generated.status === "COMPLETED" || generated.status === "REUSED")) {
      return { kind: generated.status, refs: { renderJobId: output.renderJobId, outputAssetId: output.assetId } };
    }
    const unchanged = !ctx.priorFingerprint || ctx.priorFingerprint === ctx.fingerprint;
    if (outputIsCurrent(output) && unchanged && !ctx.forced) {
      return { kind: "REUSED", refs: { renderJobId: output.renderJobId, outputAssetId: output.assetId } };
    }
    const { job, output: rendered } = await runRender(ctx, projectId);
    return { kind: "COMPLETED", refs: { renderJobId: job.id, outputAssetId: rendered.assetId } };
  };

  const QA: StepExecutor = async (ctx) => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    const output = await m.production.getOutputDetails(projectId);
    if (!output?.url) throw new WorkflowStepError("SYSTEM_ERROR", "MISSING_OUTPUT", "The final video is missing. Try again.", { route: "render" });
    if (output.outputStatus !== "CURRENT") {
      throw new WorkflowStepError("SYSTEM_ERROR", "OUTPUT_OUTDATED", "The final video is out of date and will be rendered again.", { route: "render" });
    }
    const prior = s.pmv.qaResult as PmvVideoQaResult | undefined;
    if (prior?.overallStatus === "QA_PASSED" && prior.renderJobId === output.renderJobId && !ctx.forced) {
      return { kind: "REUSED", qa: qaSummary(prior, s.videoMode), refs: { renderJobId: output.renderJobId, qaStatus: prior.overallStatus, expectedMode: s.videoMode } };
    }
    await patchPmv(m, projectId, { produceStatus: "QA_IN_PROGRESS" });
    const video = await m.production.getVideoProject(projectId);
    const timelineAssetIds = (video?.timeline ?? []).map((clip) => clip.assetId).filter((id): id is string => Boolean(id));
    const productAssetIds = [...new Set([...s.productAssetIds, ...timelineAssetIds, ...(output.sourceAssetIds ?? [])])];
    const clips = video?.i2vSceneClips ?? {};
    const scenes = scenesFromPlan(s.plan).map((scene) => ({
      ...scene,
      status: clips[scene.sceneId]?.status === "FAILED" ? "FAILED" as const : "GENERATED" as const,
    }));
    const runtime = m.runtime();
    let visionQaAvailable = await probeVisionQaAvailable(runtime);
    let visionIdentity: PmvVisionIdentityEvidence | null = null;
    const productionMode = renderEngineFor(s.videoMode);
    const exactProductMode = productionMode === "AI_PRODUCT_MOTION";
    if (visionQaAvailable && !exactProductMode && s.lock?.status === "LOCKED") {
      try {
        const vision = await checkProjectHeroVisionIdentity({ runtime, workspace: m.workspace, projectId, lockKey: PMV_IDENTITY_LOCK_KEY });
        visionQaAvailable = vision.visionQaAvailable;
        visionIdentity = vision.visionIdentity;
      } catch {
        visionIdentity = {
          status: "UNCERTAIN",
          onlineExecuted: false,
          failures: [],
          warnings: ["Vision identity QA could not be completed for this check."],
          evidence: [],
          confidence: 0.2,
        };
      }
    }
    const qa = runDeterministicPmvQa({
      projectId,
      lock: s.lock,
      productAssetIds,
      heroAssetId: s.heroAssetId ?? s.lock?.heroAssetId ?? null,
      brandName: s.brandName,
      website: s.website,
      phone: s.phone,
      cta: s.cta,
      logoAssetId: s.logoAssetId,
      audioSelected: Boolean(s.selectedAudioAssetId),
      productionMode,
      scenes,
      timelineAssetIds: timelineAssetIds.length ? timelineAssetIds : (output.sourceAssetIds ?? []),
      output: {
        assetId: output.assetId,
        url: output.url,
        width: output.width,
        height: output.height,
        durationMs: output.durationMs,
        sizeBytes: output.sizeBytes,
        validationStatus: output.validationStatus,
        validationChecks: output.validationChecks ?? null,
        qualityReview: output.qualityReview ?? null,
        renderJobId: output.renderJobId,
        textOverlay: output.textOverlay ?? null,
        sceneCount: output.sceneCount,
        endCardPresent: output.qualityReview?.checks?.endCardPresent ?? output.validationChecks?.endCardPresent ?? null,
      },
      visionQaAvailable,
      visionIdentity,
    });
    const route = classifyPmvQaFailure(qa);
    if (route.domain !== "none" && route.recommendedAction) {
      qa.recommendedActions = [...new Set([route.recommendedAction, ...qa.recommendedActions])].slice(0, 8);
    }
    const passed = qa.overallStatus === "QA_PASSED";
    await patchPmv(m, projectId, {
      qaResult: qa,
      produceStatus: passed ? "QA_PASSED" : qa.overallStatus === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "QA_FAILED",
      ...(passed ? { approvedRenderJobId: qa.renderJobId, approvedOutputAssetId: qa.videoAssetId } : {}),
    });
    return { kind: "COMPLETED", qa: qaSummary(qa, s.videoMode), refs: { renderJobId: output.renderJobId, qaStatus: qa.overallStatus, expectedMode: s.videoMode } };
  };

  const REPAIR: StepExecutor = async (ctx): Promise<StepOutcome> => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    const qa = s.pmv.qaResult as PmvVideoQaResult | undefined;
    if (!qa || qa.overallStatus === "QA_PASSED") return { kind: "SKIPPED", reason: "QA_PASSED" };
    if (qa.overallStatus === "NEEDS_REVIEW") {
      return { kind: "WAITING_FOR_USER", code: "QA_NEEDS_REVIEW", message: "Some quality checks need your review before delivery." };
    }
    const route = classifyPmvQaFailure(qa);
    const attemptsFor = (key: string) => ctx.workflow.repairAttempts[key] ?? 0;

    if (route.domain === "scene" && route.sceneId) {
      const sceneId = route.sceneId;
      const key = `scene:${sceneId}`;
      const stored = (s.pmv.sceneRegenAttempts as Record<string, number> | undefined)?.[sceneId] ?? 0;
      const previous = Math.max(attemptsFor(key), stored);
      const scene = scenesFromPlan(s.plan).find((item) => item.sceneId === sceneId);
      if (!scene || !s.plan) {
        return { kind: "WAITING_FOR_USER", code: "SCENE_MISSING", message: "A scene needs your review before delivery." };
      }
      const regen = buildTargetedRegeneration({
        projectId,
        scene,
        qa,
        lock: s.lock,
        productionMode: renderEngineFor(s.videoMode),
        creativePlanVersion: s.plan.version,
        previousAttempt: previous,
      });
      if (previous >= PMV_SCENE_REGEN_MAX_ATTEMPTS) {
        await patchPmv(m, projectId, { produceStatus: "NEEDS_REVIEW", targetedRegeneration: { ...regen, status: "NEEDS_REVIEW", attempt: previous } });
        return { kind: "WAITING_FOR_USER", code: "SCENE_NEEDS_REVIEW", message: `Scene ${scene.order} needs your review after ${PMV_SCENE_REGEN_MAX_ATTEMPTS} improvement attempts.` };
      }
      const motion = VIDEO_MOTION_OPTIONS[(previous + 1) % VIDEO_MOTION_OPTIONS.length] ?? "hold";
      const camera = VIDEO_CAMERA_OPTIONS[(previous + 2) % VIDEO_CAMERA_OPTIONS.length] ?? "hero";
      await m.planning.updatePlan(projectId, {
        scenes: s.plan.scenes.map((planScene) => planScene.id === sceneId
          ? { ...planScene, motion, camera, cameraDirection: camera, animation: motion, userEdited: true }
          : planScene),
      });
      await patchPmv(m, projectId, {
        produceStatus: "REGENERATING",
        targetedRegeneration: { ...regen, status: "REPLACED", updatedAt: new Date().toISOString() },
        sceneRegenAttempts: { ...((s.pmv.sceneRegenAttempts as Record<string, number>) ?? {}), [sceneId]: previous + 1 },
        finalVideoReady: false,
        deliveryStatus: s.pmv.deliveryStatus === "DELIVERED" ? "STALE" : (s.pmv.deliveryStatus ?? "NOT_DELIVERED"),
      });
      return { kind: "REPAIR", rerunFrom: "TIMELINE", regenerateSceneIds: [sceneId], repairKey: key, refs: { sceneId, attempt: previous + 1 } };
    }

    if ((route.domain === "text" || route.domain === "branding") && (!s.brandName || !s.cta)) {
      return { kind: "WAITING_FOR_USER", code: "BRAND_DETAILS_REQUIRED", message: "Add your brand name and call to action, then resume." };
    }
    if (route.domain === "product_identity") {
      return { kind: "WAITING_FOR_USER", code: "IDENTITY_REVIEW_REQUIRED", message: "The product in the video needs your review before delivery." };
    }
    const rerunFrom: WorkflowStepId | null =
      route.domain === "render" || route.domain === "audio" ? "RENDER"
        : route.domain === "timeline" || route.domain === "text" || route.domain === "branding" ? "TIMELINE"
          : null;
    const key = `domain:${route.domain}`;
    if (!rerunFrom || attemptsFor(key) >= 1) {
      return { kind: "WAITING_FOR_USER", code: "QA_REVIEW_REQUIRED", message: route.customerMessage || "Quality checks need your review before delivery." };
    }
    return { kind: "REPAIR", rerunFrom, regenerateSceneIds: [], repairKey: key, refs: { domain: route.domain } };
  };

  const DELIVERY: StepExecutor = async (ctx) => {
    const projectId = ctx.workflow.projectId;
    const s = await loadProjectState(m, projectId);
    const output = await m.production.getOutputDetails(projectId);
    const qa = s.pmv.qaResult as PmvVideoQaResult | undefined;
    if (!outputIsCurrent(output) || qa?.overallStatus !== "QA_PASSED" || qa.renderJobId !== output.renderJobId) {
      return { kind: "WAITING_FOR_USER", code: "QA_GATE", message: "Quality checks must pass before delivery." };
    }
    const already = s.pmv.deliveryStatus === "DELIVERED" && s.pmv.approvedRenderJobId === output.renderJobId;
    const deliveredAt = already && typeof s.pmv.deliveredAt === "string" ? s.pmv.deliveredAt : new Date().toISOString();
    const delivery = {
      outputAssetId: output.assetId,
      renderJobId: output.renderJobId,
      creativePlanId: output.creativePlanId ?? null,
      creativePlanVersion: output.creativePlanVersion ?? null,
      identityLockVersion: s.lock?.identityVersion ?? null,
      sourceAssetIds: [...(output.sourceAssetIds ?? [])],
      qaCheckedAt: qa.checkedAt,
      deliveredAt,
      videoMode: s.videoMode,
      platform: s.platform,
      aspectRatio: s.aspectRatio,
      durationSeconds: s.durationSeconds,
      audioAssetId: s.selectedAudioAssetId,
      beatSyncMode: s.selectedAudioAssetId ? String(s.project.beatSyncMode ?? "SMART") : null,
      qaStatus: qa.overallStatus,
    };
    if (already) return { kind: "REUSED", delivery, refs: { outputAssetId: output.assetId, renderJobId: output.renderJobId } };
    await patchPmv(m, projectId, {
      deliveryStatus: "DELIVERED",
      deliveredAt,
      approvedRenderJobId: output.renderJobId,
      approvedOutputAssetId: output.assetId,
      produceStatus: "DELIVERED",
      finalVideoReady: true,
      finalOutputAssetId: output.assetId,
      finalOutputUrl: output.url,
    });
    return { kind: "COMPLETED", delivery, refs: { outputAssetId: output.assetId, renderJobId: output.renderJobId } };
  };

  return {
    PRODUCT_INTELLIGENCE,
    PRODUCT_LOCK,
    CREATIVE_PLANNING,
    MEDIA_PREPARATION,
    VIDEO_GENERATION,
    PRODUCT_3D_GENERATION,
    AUDIO,
    TIMELINE,
    RENDER,
    QA,
    REPAIR,
    DELIVERY,
  };
}
