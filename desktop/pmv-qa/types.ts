/**
 * Product Marketing Video Step 5 — Product Identity QA + targeted regeneration + delivery.
 * Reuses QualityReviewResult, validateIdentityLock, VideoProductionManager (no second QA/renderer).
 */

import type { QualityReviewResult } from "../../ai/ai-director/ai-director-types";
import type { ProductIdentityLock } from "../product-identity-lock/types";
import { validateIdentityLock } from "../product-identity-lock/validate-lock";
import type { PmvStoryboardSceneView } from "../pmv-creative/types";

export type PmvQaGateStatus = "PASS" | "FAIL" | "UNCERTAIN" | "UNAVAILABLE" | "SKIPPED";

export type PmvQaOverallStatus =
  | "NOT_STARTED"
  | "QA_IN_PROGRESS"
  | "QA_PASSED"
  | "QA_FAILED"
  | "NEEDS_REVIEW";

export type PmvDeliveryStatus =
  | "NOT_DELIVERED"
  | "DELIVERED"
  | "STALE";

export interface PmvSceneQaResult {
  sceneId: string;
  order: number;
  purpose: string;
  status: "PASS" | "FAIL" | "UNCERTAIN" | "SKIPPED";
  productIdentityStatus: PmvQaGateStatus;
  textStatus: PmvQaGateStatus;
  brandingStatus: PmvQaGateStatus;
  compositionStatus: PmvQaGateStatus;
  motionStatus: PmvQaGateStatus;
  timingStatus: PmvQaGateStatus;
  failures: string[];
  warnings: string[];
  confidence: number;
  evidence: string[];
}

export interface PmvTargetedRegeneration {
  projectId: string;
  sceneId: string;
  reason: string;
  failedChecks: string[];
  productIdentityLockVersion: string;
  sourceAssetIds: string[];
  creativePlanVersion: number | null;
  generationMode: string | null;
  preserveSuccessfulScenes: true;
  status: "REQUESTED" | "REGENERATING" | "REPLACED" | "FAILED" | "NEEDS_REVIEW";
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface PmvVideoQaResult {
  projectId: string;
  renderJobId: string | null;
  videoAssetId: string | null;
  qaVersion: string;
  overallStatus: PmvQaOverallStatus;
  productIdentityStatus: PmvQaGateStatus;
  textStatus: PmvQaGateStatus;
  brandingStatus: PmvQaGateStatus;
  compositionStatus: PmvQaGateStatus;
  motionStatus: PmvQaGateStatus;
  timingStatus: PmvQaGateStatus;
  marketingQualityStatus: PmvQaGateStatus;
  technicalStatus: PmvQaGateStatus;
  visionQaAvailable: boolean;
  visionQaStatus: PmvQaGateStatus;
  scenes: PmvSceneQaResult[];
  failures: string[];
  warnings: string[];
  confidence: number;
  evidence: string[];
  recommendedActions: string[];
  qualityReview: QualityReviewResult | null;
  checkedAt: string;
}

export const PMV_QA_VERSION = "pmv-qa-v1";
export const PMV_SCENE_REGEN_MAX_ATTEMPTS = 2;

export function emptyQaResult(projectId: string): PmvVideoQaResult {
  return {
    projectId,
    renderJobId: null,
    videoAssetId: null,
    qaVersion: PMV_QA_VERSION,
    overallStatus: "NOT_STARTED",
    productIdentityStatus: "SKIPPED",
    textStatus: "SKIPPED",
    brandingStatus: "SKIPPED",
    compositionStatus: "SKIPPED",
    motionStatus: "SKIPPED",
    timingStatus: "SKIPPED",
    marketingQualityStatus: "SKIPPED",
    technicalStatus: "SKIPPED",
    visionQaAvailable: false,
    visionQaStatus: "UNAVAILABLE",
    scenes: [],
    failures: [],
    warnings: [],
    confidence: 0,
    evidence: [],
    recommendedActions: [],
    qualityReview: null,
    checkedAt: new Date().toISOString(),
  };
}

function gateFromBool(ok: boolean, uncertain = false): PmvQaGateStatus {
  if (uncertain) return "UNCERTAIN";
  return ok ? "PASS" : "FAIL";
}

function worst(...statuses: PmvQaGateStatus[]): PmvQaGateStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("UNCERTAIN")) return "UNCERTAIN";
  if (statuses.includes("UNAVAILABLE")) return "UNAVAILABLE";
  if (statuses.every((s) => s === "SKIPPED" || s === "PASS")) {
    return statuses.some((s) => s === "PASS") ? "PASS" : "SKIPPED";
  }
  return "UNCERTAIN";
}

/**
 * Deterministic PMV QA.
 * Exact Product Mode: identity PASS when lock is valid and timeline assets ⊆ locked product assets.
 * Vision frame QA is optional; when unavailable, mark vision UNAVAILABLE (never fake visual PASS).
 */
export function runDeterministicPmvQa(input: {
  projectId: string;
  lock: ProductIdentityLock | null;
  productAssetIds: string[];
  heroAssetId: string | null;
  brandName: string;
  website: string;
  phone: string;
  cta: string;
  logoAssetId: string | null;
  audioSelected: boolean;
  productionMode: string | null;
  scenes: PmvStoryboardSceneView[];
  timelineAssetIds: string[];
  output: {
    assetId?: string | null;
    url?: string | null;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
    sizeBytes?: number | null;
    validationStatus?: string | null;
    validationChecks?: Record<string, boolean> | null;
    qualityReview?: QualityReviewResult | null;
    renderJobId?: string | null;
    textOverlay?: string | null;
    sceneCount?: number | null;
    endCardPresent?: boolean | null;
  } | null;
  visionQaAvailable: boolean;
}): PmvVideoQaResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];
  const recommendedActions: string[] = [];
  const review = input.output?.qualityReview ?? null;
  const checks = {
    ...(input.output?.validationChecks ?? {}),
    ...(review?.checks ?? {}),
  } as Record<string, boolean>;

  const technicalOk = Boolean(
    input.output?.url
    && (input.output.sizeBytes ?? 0) > 0
    && (
      input.output.validationStatus === "TECHNICALLY_VALIDATED"
      || checks.fileNonEmpty === true
      || checks.hasVideoStream === true
    ),
  );
  if (!technicalOk) failures.push("Final MP4 failed technical validation.");
  else evidence.push("Technical MP4 validation present.");

  if (input.audioSelected && checks.audioPresentWhenRequired === false) {
    failures.push("Audio was selected but the final MP4 did not include a required audio stream.");
  }

  const lockValidation = validateIdentityLock({
    lock: input.lock,
    projectId: input.projectId,
    productAssetIds: input.productAssetIds,
    heroAssetId: input.heroAssetId,
  });
  const lockOk = Boolean(input.lock && input.lock.status === "LOCKED" && lockValidation.ok);
  if (!lockOk) {
    failures.push(lockValidation.issues[0] ?? "Product Identity Lock is not valid for QA.");
  } else {
    evidence.push("Product Identity Lock is LOCKED and valid.");
  }

  const lockedAssetSet = new Set(input.lock?.productAssetIds ?? []);
  const timelineUsesLockedAssets = input.timelineAssetIds.length > 0
    && input.timelineAssetIds.every((id) => lockedAssetSet.has(id) || id === input.lock?.heroAssetId);
  const exactProductMode = !input.productionMode || input.productionMode === "AI_PRODUCT_MOTION";

  let productIdentityStatus: PmvQaGateStatus = "FAIL";
  if (!lockOk) {
    productIdentityStatus = "FAIL";
  } else if (exactProductMode && timelineUsesLockedAssets) {
    productIdentityStatus = "PASS";
    evidence.push("Exact Product Mode timeline uses locked product assets only.");
  } else if (exactProductMode && input.timelineAssetIds.length === 0) {
    productIdentityStatus = "UNCERTAIN";
    warnings.push("Timeline asset list unavailable; product identity marked UNCERTAIN.");
  } else if (!input.visionQaAvailable) {
    productIdentityStatus = "UNCERTAIN";
    warnings.push("Vision QA is unavailable; generative product identity cannot be fully confirmed.");
    recommendedActions.push("Configure vision QA in Admin, or use Exact Product Mode.");
  } else {
    productIdentityStatus = "UNCERTAIN";
    warnings.push("Vision QA available but frame inspection is not yet attached to this path.");
  }

  const visionQaStatus: PmvQaGateStatus = input.visionQaAvailable ? "UNCERTAIN" : "UNAVAILABLE";

  const hasCta = Boolean(input.cta.trim())
    || checks.hasCtaScene === true
    || checks.ctaPresent === true;
  const textStatus = gateFromBool(
    Boolean(input.output?.textOverlay === "applied" || review?.checks?.ctaPresent || hasCta || input.brandName.trim()),
  );
  if (textStatus === "FAIL") failures.push("Required marketing text / CTA evidence missing.");
  else evidence.push("Text/typography evidence present on render output.");

  const brandingStatus = gateFromBool(
    Boolean(input.brandName.trim())
    && (checks.endCardPresent !== false),
  );
  if (!input.brandName.trim()) failures.push("Brand name is missing.");
  if (input.logoAssetId) evidence.push("Logo asset is configured.");
  else warnings.push("No logo asset configured.");

  const compositionStatus = gateFromBool(
    checks.productClear !== false && checks.productShownEarly !== false,
    checks.productClear == null && checks.productShownEarly == null,
  );
  const motionStatus = gateFromBool(checks.pacingOk !== false, checks.pacingOk == null);
  const timingStatus = gateFromBool(
    checks.durationValid !== false && checks.durationConsistent !== false,
    checks.durationAligned === false,
  );
  if (checks.durationAligned === false) {
    warnings.push("Rendered duration differs from the planned timeline.");
  }

  const marketingQualityStatus = gateFromBool(
    (review?.score ?? 0) >= 60 || (hasCta && technicalOk && lockOk),
    !review && !hasCta,
  );

  const sceneResults: PmvSceneQaResult[] = input.scenes.map((scene) => {
    const sceneFailures: string[] = [];
    const sceneWarnings: string[] = [];
    const usesLocked = !scene.assetId || lockedAssetSet.has(scene.assetId) || scene.assetId === input.lock?.heroAssetId;
    let identity: PmvQaGateStatus = "PASS";
    if (!lockOk) identity = "FAIL";
    else if (!usesLocked && exactProductMode) {
      identity = "FAIL";
      sceneFailures.push("Scene asset is outside the Product Identity Lock.");
    } else if (!usesLocked && !input.visionQaAvailable) {
      identity = "UNCERTAIN";
      sceneWarnings.push("Scene asset identity not confirmed without vision QA.");
    }
    if (scene.status === "FAILED") {
      identity = "FAIL";
      sceneFailures.push("Scene marked FAILED.");
    }
    const status = sceneFailures.length ? "FAIL" : identity === "UNCERTAIN" ? "UNCERTAIN" : "PASS";
    return {
      sceneId: scene.sceneId,
      order: scene.order,
      purpose: scene.purpose,
      status,
      productIdentityStatus: identity,
      textStatus: /cta|end/i.test(scene.purpose) ? textStatus : "PASS",
      brandingStatus: /cta|end|brand/i.test(scene.purpose) ? brandingStatus : "PASS",
      compositionStatus,
      motionStatus,
      timingStatus: scene.durationSeconds > 0 ? "PASS" : "UNCERTAIN",
      failures: sceneFailures,
      warnings: sceneWarnings,
      confidence: status === "PASS" ? 0.85 : status === "UNCERTAIN" ? 0.45 : 0.2,
      evidence: scene.assetId ? [`asset:${scene.assetId}`] : [],
    };
  });

  for (const scene of sceneResults) {
    if (scene.status === "FAIL") {
      failures.push(`Scene ${scene.order} (${scene.purpose}): ${scene.failures[0] ?? "failed QA"}`);
      recommendedActions.push(`Regenerate only scene ${scene.order} (${scene.sceneId}).`);
    }
  }

  const technicalStatus = gateFromBool(technicalOk);
  const hardFail = technicalStatus === "FAIL"
    || productIdentityStatus === "FAIL"
    || textStatus === "FAIL"
    || brandingStatus === "FAIL"
    || sceneResults.some((s) => s.status === "FAIL");
  const needsReview = !hardFail && (
    productIdentityStatus === "UNCERTAIN"
    || visionQaStatus === "UNAVAILABLE" && !exactProductMode
    || compositionStatus === "UNCERTAIN"
    || marketingQualityStatus === "UNCERTAIN"
    || sceneResults.some((s) => s.status === "UNCERTAIN")
  );

  let overallStatus: PmvQaOverallStatus = "QA_PASSED";
  if (hardFail) overallStatus = "QA_FAILED";
  else if (needsReview) {
    // Exact Product + valid lock + technical OK may still deliver with vision unavailable.
    if (exactProductMode && lockOk && technicalOk && productIdentityStatus === "PASS") {
      overallStatus = "QA_PASSED";
      warnings.push("Vision frame QA unavailable; Exact Product asset-lock QA was used instead.");
    } else {
      overallStatus = "NEEDS_REVIEW";
      recommendedActions.push("Review uncertain checks before delivery.");
    }
  }

  if (review?.suggestions?.length) {
    recommendedActions.push(...review.suggestions.slice(0, 4));
  }

  const confidence = overallStatus === "QA_PASSED"
    ? (exactProductMode ? 0.88 : 0.7)
    : overallStatus === "NEEDS_REVIEW" ? 0.5 : 0.25;

  return {
    projectId: input.projectId,
    renderJobId: input.output?.renderJobId ?? null,
    videoAssetId: input.output?.assetId ?? null,
    qaVersion: PMV_QA_VERSION,
    overallStatus,
    productIdentityStatus,
    textStatus,
    brandingStatus,
    compositionStatus: worst(compositionStatus),
    motionStatus,
    timingStatus,
    marketingQualityStatus,
    technicalStatus,
    visionQaAvailable: input.visionQaAvailable,
    visionQaStatus,
    scenes: sceneResults,
    failures: [...new Set(failures)],
    warnings: [...new Set(warnings)],
    confidence,
    evidence,
    recommendedActions: [...new Set(recommendedActions)].slice(0, 8),
    qualityReview: review,
    checkedAt: new Date().toISOString(),
  };
}

export function buildTargetedRegeneration(input: {
  projectId: string;
  scene: PmvStoryboardSceneView;
  qa: PmvVideoQaResult;
  lock: ProductIdentityLock | null;
  productionMode: string | null;
  creativePlanVersion: number | null;
  previousAttempt?: number;
}): PmvTargetedRegeneration {
  const sceneQa = input.qa.scenes.find((s) => s.sceneId === input.scene.sceneId);
  const now = new Date().toISOString();
  return {
    projectId: input.projectId,
    sceneId: input.scene.sceneId,
    reason: sceneQa?.failures[0] ?? input.qa.failures[0] ?? "Scene failed QA",
    failedChecks: sceneQa?.failures ?? input.qa.failures.slice(0, 5),
    productIdentityLockVersion: input.lock?.identityVersion ?? input.lock?.version ?? "unknown",
    sourceAssetIds: input.lock?.productAssetIds ?? [],
    creativePlanVersion: input.creativePlanVersion,
    generationMode: input.productionMode,
    preserveSuccessfulScenes: true,
    status: "REQUESTED",
    attempt: (input.previousAttempt ?? 0) + 1,
    maxAttempts: PMV_SCENE_REGEN_MAX_ATTEMPTS,
    createdAt: now,
    updatedAt: now,
  };
}

export function qaCustomerLabel(status: PmvQaOverallStatus | PmvDeliveryStatus | string): string {
  if (status === "QA_PASSED") return "QA passed";
  if (status === "QA_FAILED") return "QA failed";
  if (status === "NEEDS_REVIEW") return "Needs review";
  if (status === "QA_IN_PROGRESS") return "Checking video";
  if (status === "DELIVERED") return "Delivered";
  if (status === "STALE") return "Stale";
  return "Not started";
}
