/**
 * Phase 8 — machine-readable execution plan.
 * Capabilities are selected by requirement (mode, creative request, source quality),
 * never by what happens to be configured in Admin.
 */
import { decideImagePreparation } from "../image-preparation/decision.js";
import type { PmvVideoMode } from "../pmv-shared/modes.js";
import type {
  ExecutionPlan,
  ExecutionPlanStep,
  WorkflowCapability,
  WorkflowMode,
  WorkflowStepId,
} from "./types.js";

export interface PlanInput {
  projectId: string;
  /** Canonical customer-selected video mode. */
  videoMode: PmvVideoMode;
  creativeRequest: string;
  heroWidth: number | null;
  heroHeight: number | null;
  /** Mask-guided editing is an Admin model trait; it only changes the operation count, not the mode. */
  editorAcceptsMask: boolean;
  /** Customer explicitly asked for generated music (existing AI sound flow); default false. */
  musicGenerationRequested: boolean;
  estimatedSceneCount: number;
  visionQaAvailable: boolean;
}

export function isGenerativeMode(mode: PmvVideoMode): boolean {
  return mode === "CINEMATIC_AI";
}

export function buildExecutionPlan(input: PlanInput): ExecutionPlan {
  const generative = isGenerativeMode(input.videoMode);
  const threeD = input.videoMode === "PRODUCT_3D_SHOWCASE";
  const decision = decideImagePreparation({
    generativeVideo: generative,
    creativeRequest: input.creativeRequest,
    sourceWidth: input.heroWidth,
    sourceHeight: input.heroHeight,
    editorAcceptsMask: input.editorAcceptsMask,
  });
  const mediaCaps: WorkflowCapability[] = [];
  if (decision.segmentationRequired) mediaCaps.push("IMAGE_SEGMENTATION");
  if (decision.imageEditingRequired) mediaCaps.push("IMAGE_EDITING");
  if (decision.enhancementRequired) mediaCaps.push("IMAGE_UPSCALE");
  const needsMedia = mediaCaps.length > 0;

  const mode: WorkflowMode = threeD ? "THREE_D" : !generative ? "EXACT" : needsMedia ? "FULL_CREATIVE" : "CINEMATIC";
  const scenes = Math.max(1, input.estimatedSceneCount);

  const steps: ExecutionPlanStep[] = [
    { id: "PRODUCT_INTELLIGENCE", dependsOn: [], capabilities: [], required: true, reason: "PRODUCT_UNDERSTANDING" },
    { id: "PRODUCT_LOCK", dependsOn: ["PRODUCT_INTELLIGENCE"], capabilities: [], required: true, reason: "IDENTITY_LOCK_BEFORE_GENERATION" },
    { id: "CREATIVE_PLANNING", dependsOn: ["PRODUCT_LOCK"], capabilities: [], required: true, reason: "STORYBOARD_REQUIRED" },
    {
      id: "AUDIO",
      dependsOn: ["CREATIVE_PLANNING"],
      capabilities: input.musicGenerationRequested ? ["MUSIC_GENERATION"] : [],
      required: true,
      reason: input.musicGenerationRequested ? "MUSIC_GENERATION_REQUESTED" : "USE_SELECTED_AUDIO",
    },
    { id: "TIMELINE", dependsOn: ["CREATIVE_PLANNING", "AUDIO"], capabilities: [], required: true, reason: "TIMELINE_REQUIRED" },
  ];
  if (needsMedia) {
    steps.push({
      id: "MEDIA_PREPARATION",
      dependsOn: ["PRODUCT_LOCK", "TIMELINE"],
      capabilities: mediaCaps,
      required: true,
      reason: decision.reasonCodes.join(",") || "MEDIA_PREPARATION_REQUIRED",
    });
  }
  if (generative) {
    steps.push({
      id: "VIDEO_GENERATION",
      dependsOn: needsMedia
        ? ["PRODUCT_LOCK", "CREATIVE_PLANNING", "TIMELINE", "MEDIA_PREPARATION"]
        : ["PRODUCT_LOCK", "CREATIVE_PLANNING", "TIMELINE"],
      capabilities: ["VIDEO_IMAGE_TO_VIDEO"],
      required: true,
      reason: "CINEMATIC_MODE_SELECTED",
    });
  }
  if (threeD) {
    steps.push({
      id: "PRODUCT_3D_GENERATION",
      dependsOn: ["PRODUCT_LOCK", "CREATIVE_PLANNING", "TIMELINE"],
      capabilities: ["PRODUCT_3D_GENERATION"],
      required: true,
      reason: "THREE_D_MODE_SELECTED",
    });
  }
  const sceneStep: WorkflowStepId | null = generative ? "VIDEO_GENERATION" : threeD ? "PRODUCT_3D_GENERATION" : null;
  steps.push(
    {
      id: "RENDER",
      dependsOn: sceneStep ? ["TIMELINE", sceneStep] : ["TIMELINE"],
      capabilities: [],
      required: true,
      reason: "FINAL_MP4_REQUIRED",
    },
    {
      id: "QA",
      dependsOn: ["RENDER"],
      capabilities: generative && input.visionQaAvailable ? ["VISION_ANALYSIS"] : [],
      required: true,
      reason: generative ? "IDENTITY_QA_GENERATIVE" : "IDENTITY_QA_ASSET_LOCK",
    },
    { id: "REPAIR", dependsOn: ["QA"], capabilities: [], required: false, reason: "ONLY_IF_QA_FAILS" },
    { id: "DELIVERY", dependsOn: ["QA"], capabilities: [], required: true, reason: "QA_PASS_REQUIRED" },
  );

  const requiredCapabilities = [...new Set(steps.filter((s) => s.required).flatMap((s) => s.capabilities))];
  const perSceneMediaOps = mediaCaps.length;
  const estimatedOperations =
    (needsMedia ? perSceneMediaOps * scenes : 0)
    + (generative ? scenes : 0)
    + (threeD ? 1 : 0)
    + (input.musicGenerationRequested ? 1 : 0)
    + (generative && input.visionQaAvailable ? 1 : 0);

  const dependencies: Record<string, WorkflowStepId[]> = {};
  for (const step of steps) dependencies[step.id] = step.dependsOn;

  return {
    projectId: input.projectId,
    mode,
    requiredCapabilities,
    steps,
    dependencies,
    estimatedOperations,
    status: "READY",
    blockedReason: null,
  };
}

/** Steps in dependency-respecting execution order. */
export function orderedStepIds(plan: ExecutionPlan): WorkflowStepId[] {
  const order: WorkflowStepId[] = [];
  const placed = new Set<WorkflowStepId>();
  const pending = [...plan.steps];
  while (pending.length) {
    const index = pending.findIndex((s) => s.dependsOn.every((d) => placed.has(d)));
    if (index < 0) throw new Error("Execution plan has a dependency cycle");
    const [step] = pending.splice(index, 1);
    order.push(step!.id);
    placed.add(step!.id);
  }
  return order;
}
