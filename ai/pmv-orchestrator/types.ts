/**
 * Phase 8 — PMV production workflow contract.
 * The orchestrator coordinates existing systems; it never performs inference/rendering
 * and never stores credentials, provider responses, or costs in workflow state.
 */

import type { PmvVideoMode } from "../pmv-shared/modes.js";
import type { VideoModeExecutionPlan } from "../pmv-shared/video-mode-resolver.js";

export const PMV_WORKFLOW_VERSION = 1;
/** Top-level workspaceSettings key for the customer-safe workflow summary (never clobbered by Studio saves). */
export const PMV_WORKFLOW_SETTINGS_KEY = "pmvWorkflow";

export type WorkflowMode = "EXACT" | "CINEMATIC" | "FULL_CREATIVE" | "THREE_D";

export type WorkflowStepId =
  | "PRODUCT_INTELLIGENCE"
  | "PRODUCT_LOCK"
  | "CREATIVE_PLANNING"
  | "MEDIA_PREPARATION"
  | "VIDEO_GENERATION"
  | "PRODUCT_3D_GENERATION"
  | "AUDIO"
  | "TIMELINE"
  | "RENDER"
  | "QA"
  | "REPAIR"
  | "DELIVERY";

export type WorkflowStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING_FOR_USER"
  | "FAILED"
  | "CANCELLED"
  | "COMPLETED";

export type StepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "REUSED"
  | "SKIPPED"
  | "FAILED"
  | "WAITING_FOR_USER"
  | "CANCELLED";

export type FailureClass =
  | "CONFIGURATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "PROVIDER_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "INVALID_OUTPUT"
  | "MEDIA_ERROR"
  | "QA_FAILURE"
  | "USER_INPUT_ERROR"
  | "SYSTEM_ERROR"
  | "STORAGE_ERROR";

/** Subsystem a failure is routed to (smallest responsible scope). */
export type FailureRoute =
  | "product_intelligence"
  | "identity_lock"
  | "creative_planning"
  | "media_preparation"
  | "video_generation"
  | "audio"
  | "timeline"
  | "render"
  | "qa"
  | "delivery"
  | "admin_configuration"
  | "customer_input";

/** Admin capability keys the workflow may request — never models or providers. */
export type WorkflowCapability =
  | "VISION_ANALYSIS"
  | "IMAGE_SEGMENTATION"
  | "IMAGE_EDITING"
  | "IMAGE_UPSCALE"
  | "VIDEO_IMAGE_TO_VIDEO"
  | "PRODUCT_3D_GENERATION"
  | "MUSIC_GENERATION";

export interface ClassifiedFailure {
  failureClass: FailureClass;
  code: string;
  retryable: boolean;
  /** Blocks on a customer action rather than failing the workflow. */
  waitingForUser: boolean;
  route: FailureRoute;
  /** Customer-safe explanation (no providers, models, keys, raw errors). */
  customerMessage: string;
}

export interface StepAttempt {
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  result: "SUCCEEDED" | "FAILED" | "REUSED" | "WAITING_FOR_USER" | "CANCELLED";
  failureClass?: FailureClass;
  code?: string;
  retryable?: boolean;
}

export interface WorkflowStepRecord {
  id: WorkflowStepId;
  status: StepStatus;
  dependsOn: WorkflowStepId[];
  capabilities: WorkflowCapability[];
  /** Why a conditional step is included or skipped (machine-readable). */
  reason: string;
  inputFingerprint: string | null;
  attempts: number;
  maxAttempts: number;
  history: StepAttempt[];
  failure: ClassifiedFailure | null;
  /** Lineage references (ids only — never file contents or URLs with secrets). */
  artifactRefs: Record<string, string | number | boolean | null>;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ExecutionPlanStep {
  id: WorkflowStepId;
  dependsOn: WorkflowStepId[];
  capabilities: WorkflowCapability[];
  required: boolean;
  reason: string;
}

export interface ExecutionPlan {
  projectId: string;
  mode: WorkflowMode;
  requiredCapabilities: WorkflowCapability[];
  steps: ExecutionPlanStep[];
  dependencies: Record<string, WorkflowStepId[]>;
  /** Count of external/paid-style operations the plan may execute (internal; never shown to customers). */
  estimatedOperations: number;
  status: "READY" | "BLOCKED";
  blockedReason: string | null;
}

export interface WorkflowQaSummary {
  /** Mode the output is validated against (absent on QA results before Phase 10). */
  expectedMode?: PmvVideoMode;
  overallStatus: string;
  renderJobId: string | null;
  videoAssetId: string | null;
  failures: string[];
  checkedAt: string;
}

export interface WorkflowDelivery {
  outputAssetId: string | null;
  renderJobId: string | null;
  creativePlanId: string | null;
  creativePlanVersion: number | null;
  identityLockVersion: string | null;
  sourceAssetIds: string[];
  qaCheckedAt: string | null;
  deliveredAt: string;
  /** Production configuration this output was made with (absent on deliveries before Phase 10). */
  videoMode?: PmvVideoMode;
  platform?: string | null;
  aspectRatio?: string | null;
  durationSeconds?: number | null;
  audioAssetId?: string | null;
  beatSyncMode?: string | null;
  qaStatus?: string | null;
}

export interface WorkflowRecord {
  workflowVersion: number;
  id: string;
  projectId: string;
  mode: WorkflowMode;
  /** Canonical customer-selected video mode at plan time (authoritative). */
  videoMode: PmvVideoMode;
  /** Legacy generation-mode value kept for records and readers that predate `videoMode`. */
  generationMode: string;
  /** Route decided for this run: strategies and capability readiness (internal; never shown to customers). */
  modePlan?: VideoModeExecutionPlan | null;
  /** The run this one regenerates (lineage); null for a project's first run. */
  previousWorkflowId?: string | null;
  /** Scenes a repair asked the next render to regenerate (all other accepted scenes are reused). */
  pendingRegenerateSceneIds: string[];
  /** Steps reset by a repair that must execute again even if their inputs look unchanged. */
  forcedSteps: WorkflowStepId[];
  status: WorkflowStatus;
  currentStep: WorkflowStepId | null;
  plan: ExecutionPlan;
  steps: WorkflowStepRecord[];
  cancelRequested: boolean;
  /** Customer-safe reason when WAITING_FOR_USER / FAILED. */
  customerMessage: string | null;
  lastFailure: ClassifiedFailure | null;
  qa: WorkflowQaSummary | null;
  delivery: WorkflowDelivery | null;
  repairAttempts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** When the customer last started/resumed this run (null on records written before it existed). */
  runStartedAt?: string | null;
}

/** Customer-safe progress labels (no providers/models/capabilities/costs). */
export const CUSTOMER_STEP_LABELS: Record<WorkflowStepId, string> = {
  PRODUCT_INTELLIGENCE: "Preparing product",
  PRODUCT_LOCK: "Preparing product",
  CREATIVE_PLANNING: "Planning the video",
  MEDIA_PREPARATION: "Preparing source assets",
  VIDEO_GENERATION: "Generating scenes",
  PRODUCT_3D_GENERATION: "3D generation",
  AUDIO: "Adding music",
  TIMELINE: "Building timeline",
  RENDER: "Rendering",
  QA: "Checking",
  REPAIR: "Checking",
  DELIVERY: "Finalizing",
};

export const MODE_STEP_LABELS: Record<PmvVideoMode, Partial<Record<WorkflowStepId, string>>> = {
  PRODUCT_SLIDESHOW: { CREATIVE_PLANNING: "Planning slideshow" },
  CINEMATIC_AI: { CREATIVE_PLANNING: "Planning cinematic scenes" },
  PRODUCT_3D_SHOWCASE: { CREATIVE_PLANNING: "Preparing 3D production", TIMELINE: "Building scene" },
};

/** Customer label for a step as it runs in the selected mode. */
export function customerStepLabel(step: WorkflowStepId, mode: PmvVideoMode | null | undefined): string {
  return (mode ? MODE_STEP_LABELS[mode]?.[step] : undefined) ?? CUSTOMER_STEP_LABELS[step];
}
