/**
 * Assemble one STEP 6 PreparedAssetDecision from existing analysis + prep outputs.
 */
import type { ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import { decideIsolation } from "../media-intelligence/isolation-policy.js";
import { decideBackgroundPreparation } from "./background-decision.js";
import { buildFramingInspection } from "./framing.js";
import {
  PREPARED_ASSET_CONTRACT_VERSION,
  type PreparedAssetDecision,
  type PreparedAssetValidity,
  validatePreparedAssetDecision,
} from "./prepared-asset-contract.js";
import { classifyProductionRole } from "./production-roles.js";
import { inspectImageQuality } from "./quality-inspection.js";
import type { BoundingBox, ProductAssetRecord } from "./types.js";

export function buildPreparedAssetDecision(input: {
  projectId: string;
  image: ProductImage;
  profile?: ImageIntelligenceProfile | null;
  orderHint: number;
  fileMissing?: boolean;
  decodeFailed?: boolean;
  /** Existing cutout record when isolation produced one. */
  preparedRecord?: ProductAssetRecord | null;
  derivedForegroundId?: string;
  derivedMaskId?: string;
}): PreparedAssetDecision {
  const isolation = decideIsolation(input.profile);
  const quality = inspectImageQuality({
    projectId: input.projectId,
    image: input.image,
    profile: input.profile,
    fileMissing: input.fileMissing,
    decodeFailed: input.decodeFailed,
  });

  const productBox: BoundingBox | null = input.preparedRecord?.boundingBox
    ?? (input.profile?.visualMetrics?.width && input.profile.visualMetrics.height
      ? estimateBoxFromVisibility(input.profile)
      : null);

  const framingWidth = input.preparedRecord?.resolution.width
    ?? quality.width
    ?? undefined;
  const framingHeight = input.preparedRecord?.resolution.height
    ?? quality.height
    ?? undefined;

  const framing = buildFramingInspection({
    width: framingWidth,
    height: framingHeight,
    productBox,
    visibilityCutoff: input.profile?.visibility?.cutoff,
    framingNote: input.profile?.visibility?.framing,
  });

  const role = classifyProductionRole({
    image: input.image,
    profile: input.profile,
    suitabilityScore: quality.suitabilityScore,
    suitableForProduction: !quality.avoidForProduction && quality.valid,
  });

  const background = decideBackgroundPreparation({
    isolation,
    profile: input.profile,
  });

  let validity: PreparedAssetValidity = "valid";
  if (input.fileMissing) validity = "missing_source";
  else if (input.decodeFailed) validity = "decode_failed";
  else if (!quality.valid) validity = "invalid";
  else if (input.projectId !== quality.projectId) validity = "project_mismatch";
  else if (framing.unsafeDestructiveCropRejected && role.role === "UNSUITABLE") validity = "unsafe_crop";

  const warnings = [
    ...quality.warnings,
    ...role.safeToUse ? [] : [role.reason],
    ...background.notes.filter((n) => /not claimed|attention/i.test(n)),
    ...Object.values(framing.formats).flatMap((f) => f.warnings).slice(0, 4),
  ];

  const readyForLaterMotionStages = validity === "valid"
    && role.safeToUse
    && role.role !== "UNSUITABLE"
    && quality.suitability !== "invalid"
    && quality.suitability !== "avoid";

  const decision: PreparedAssetDecision = {
    contractVersion: PREPARED_ASSET_CONTRACT_VERSION,
    projectId: input.projectId,
    assetId: input.image.id,
    sourceImageId: input.image.id,
    sourceFileName: input.image.fileName,
    productionResolverAssetId: input.image.id,
    validity,
    valid: validity === "valid",
    originalPreserved: true,
    quality,
    role,
    framing,
    background,
    preparationDecision: isolation.decision,
    derivedForegroundId: input.derivedForegroundId ?? (typeof input.preparedRecord?.metadata.workspaceDerivedAssetId === "string"
      ? input.preparedRecord.metadata.workspaceDerivedAssetId || undefined
      : undefined),
    derivedMaskId: input.derivedMaskId ?? (typeof input.preparedRecord?.metadata.workspaceMaskAssetId === "string"
      ? input.preparedRecord.metadata.workspaceMaskAssetId || undefined
      : undefined),
    protectedProductBox: input.preparedRecord?.boundingBox,
    continuity: {
      recommendedScale: framing.formats["9:16"]?.maxSafeEnlargement ?? 1.1,
      orderHint: input.orderHint,
      preferStableTransitions: framing.nearEdge || quality.suitability === "usable_with_caution",
    },
    warnings: [...new Set(warnings)].slice(0, 12),
    readyForLaterMotionStages,
    scenePlanningDeferred: true,
    videoGenerationDeferred: true,
    createdAt: new Date().toISOString(),
  };

  const validated = validatePreparedAssetDecision(decision, input.projectId);
  if (!validated.ok) {
    return {
      ...decision,
      validity: decision.validity === "valid" ? "analysis_failed" : decision.validity,
      valid: false,
      readyForLaterMotionStages: false,
      warnings: [...decision.warnings, ...validated.errors],
    };
  }
  return decision;
}

function estimateBoxFromVisibility(profile: ImageIntelligenceProfile): BoundingBox | null {
  const w = profile.visualMetrics?.width;
  const h = profile.visualMetrics?.height;
  if (!w || !h) return null;
  // Heuristic center product region — marked as estimated via framing analysisBasis.
  return {
    x: Math.round(w * 0.22),
    y: Math.round(h * 0.22),
    width: Math.round(w * 0.56),
    height: Math.round(h * 0.56),
  };
}
