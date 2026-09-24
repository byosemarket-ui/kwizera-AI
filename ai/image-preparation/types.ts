/**
 * Phase 7 — conditional image preparation before cinematic I2V.
 * Records are stored on the video project; they hold lineage and status only —
 * no prompts, provider names, model ids, or raw provider responses.
 */

export type ImagePrepOperation = "SEGMENTATION" | "EDITING" | "ENHANCEMENT";

export type ImagePrepCapability = "IMAGE_SEGMENTATION" | "IMAGE_EDITING" | "IMAGE_UPSCALE";

export const IMAGE_PREP_CAPABILITY: Record<ImagePrepOperation, ImagePrepCapability> = {
  SEGMENTATION: "IMAGE_SEGMENTATION",
  EDITING: "IMAGE_EDITING",
  ENHANCEMENT: "IMAGE_UPSCALE",
};

export type ImagePrepReasonCode =
  | "NOT_GENERATIVE_MODE"
  | "NO_CREATIVE_REQUEST"
  | "ENVIRONMENT_EDIT_REQUESTED"
  | "MASK_GUIDED_EDITOR"
  | "LOW_SOURCE_RESOLUTION"
  | "QUALITY_ENHANCEMENT_REQUESTED"
  | "PRODUCT_CHANGE_INSTRUCTION_REJECTED";

export interface ImagePrepDecision {
  segmentationRequired: boolean;
  imageEditingRequired: boolean;
  enhancementRequired: boolean;
  upscaleFactor: 2 | 4 | null;
  reasonCodes: ImagePrepReasonCode[];
  /** Customer request with product-changing clauses removed (internal only). */
  editRequest: string;
  rejectedInstructionCount: number;
}

export type ImagePrepStageStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "SKIPPED_UNAVAILABLE"
  | "BLOCKED";

export type ImagePrepIdentityStatus =
  | "ONLINE_PASS"
  | "DETERMINISTIC_PASS"
  | "UNCERTAIN"
  | "NOT_VERIFIED";

export interface ImagePrepAttempt {
  attempt: number;
  result: "ACCEPTED" | "FAILED";
  reason: string;
  at: string;
}

export interface ImagePrepStageRecord {
  operation: ImagePrepOperation;
  capability: ImagePrepCapability;
  status: ImagePrepStageStatus;
  attempts: number;
  maxAttempts: number;
  /** Lineage: "original:<assetId>" or the derived file this stage consumed. */
  inputRef: string;
  outputFileName: string | null;
  onlineExecuted: boolean;
  identityStatus: ImagePrepIdentityStatus | null;
  /** Segmentation only: provider returned a background-white mask that was normalized. */
  maskInverted?: boolean;
  width: number | null;
  height: number | null;
  issues: string[];
  history: ImagePrepAttempt[];
  updatedAt: string;
}

export interface ImagePreparationRecord {
  key: string;
  projectId: string;
  sourceAssetId: string;
  fingerprint: string;
  decision: Omit<ImagePrepDecision, "editRequest">;
  stages: Partial<Record<ImagePrepOperation, ImagePrepStageRecord>>;
  /** Derived file handed to I2V; null when the original photo was used. */
  finalFileName: string | null;
  finalSource: "ORIGINAL" | "PREPARED";
  /** An operation was required but did not produce an accepted output. */
  fallbackUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImagePrepAvailability {
  segmentation: boolean;
  editing: boolean;
  enhancement: boolean;
  editorAcceptsMask: boolean;
}

export const DEFAULT_IMAGE_PREP_MAX_ATTEMPTS = 2;

export function imagePrepMaxAttempts(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.KWIZERA_IMAGE_PREP_MAX_ATTEMPTS);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_IMAGE_PREP_MAX_ATTEMPTS;
  return Math.min(4, Math.floor(raw));
}
