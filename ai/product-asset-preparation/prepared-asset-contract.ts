/**
 * STEP 6 — validated prepared asset decision contract.
 * Extends existing product-asset-preparation; does not invent a second asset system.
 */
import type { PreparationDecision } from "../media-intelligence/isolation-policy.js";
import type { BackgroundDecisionResult } from "./background-decision.js";
import type { FramingInspection } from "./framing.js";
import type { ProductionRoleDecision } from "./production-roles.js";
import type { ImageQualityInspection } from "./quality-inspection.js";
import type { BoundingBox } from "./types.js";

export const PREPARED_ASSET_CONTRACT_VERSION = "step6-asset-prep-v1";

export type PreparedAssetValidity =
  | "valid"
  | "invalid"
  | "missing_source"
  | "decode_failed"
  | "project_mismatch"
  | "unsafe_crop"
  | "analysis_failed";

export interface PreparedAssetDecision {
  contractVersion: typeof PREPARED_ASSET_CONTRACT_VERSION;
  projectId: string;
  assetId: string;
  sourceImageId: string;
  sourceFileName: string;
  /** Existing workspace production resolver uses original assetId. */
  productionResolverAssetId: string;
  validity: PreparedAssetValidity;
  valid: boolean;
  originalPreserved: true;
  quality: ImageQualityInspection;
  role: ProductionRoleDecision;
  framing: FramingInspection;
  background: BackgroundDecisionResult;
  preparationDecision: PreparationDecision;
  /** Set when a derived cutout was registered in the workspace. */
  derivedForegroundId?: string;
  derivedMaskId?: string;
  /** Pixel bbox on prepared canvas when cutout exists; else undefined. */
  protectedProductBox?: BoundingBox;
  /** Continuity hints for later motion stages. */
  continuity: {
    recommendedScale: number;
    orderHint: number;
    preferStableTransitions: boolean;
  };
  warnings: string[];
  readyForLaterMotionStages: boolean;
  scenePlanningDeferred: true;
  videoGenerationDeferred: true;
  createdAt: string;
}

export interface PreparedAssetValidationResult {
  ok: boolean;
  errors: string[];
  decision: PreparedAssetDecision | null;
}

export function validatePreparedAssetDecision(
  decision: PreparedAssetDecision,
  expectedProjectId?: string,
): PreparedAssetValidationResult {
  const errors: string[] = [];
  if (!decision) {
    return { ok: false, errors: ["Decision missing"], decision: null };
  }
  if (decision.contractVersion !== PREPARED_ASSET_CONTRACT_VERSION) {
    errors.push(`Unexpected contract version: ${decision.contractVersion}`);
  }
  if (!decision.projectId) errors.push("projectId required");
  if (!decision.assetId) errors.push("assetId required");
  if (!decision.sourceImageId) errors.push("sourceImageId required");
  if (decision.assetId !== decision.sourceImageId) {
    errors.push("assetId must equal sourceImageId for original product assets");
  }
  if (expectedProjectId && decision.projectId !== expectedProjectId) {
    errors.push(`project mismatch: decision=${decision.projectId} expected=${expectedProjectId}`);
  }
  if (decision.quality.projectId !== decision.projectId) {
    errors.push("quality.projectId must match decision.projectId");
  }
  if (decision.quality.assetId !== decision.assetId) {
    errors.push("quality.assetId must match decision.assetId");
  }
  if (decision.originalPreserved !== true) {
    errors.push("originalPreserved must be true");
  }
  if (decision.valid && decision.validity !== "valid") {
    errors.push("valid=true requires validity=valid");
  }
  if (!decision.valid && decision.readyForLaterMotionStages) {
    errors.push("invalid decisions must not be readyForLaterMotionStages");
  }
  if (decision.role.role === "UNSUITABLE" && decision.readyForLaterMotionStages) {
    errors.push("UNSUITABLE assets must not be ready for motion stages");
  }
  if (decision.framing.unsafeDestructiveCropRejected) {
    const anyPrefer = Object.values(decision.framing.formats).some((f) => f.preferSafeComposition);
    if (!anyPrefer) {
      errors.push("destructive crop rejection must prefer safe composition on at least one format");
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    decision: errors.length === 0 ? decision : null,
  };
}

export function assertPreparedAssetsIsolated(
  decisions: PreparedAssetDecision[],
  projectId: string,
): string[] {
  const errors: string[] = [];
  for (const d of decisions) {
    if (d.projectId !== projectId) {
      errors.push(`Asset ${d.assetId} belongs to project ${d.projectId}, not ${projectId}`);
    }
    const check = validatePreparedAssetDecision(d, projectId);
    if (!check.ok) errors.push(...check.errors.map((e) => `${d.assetId}: ${e}`));
  }
  return errors;
}
