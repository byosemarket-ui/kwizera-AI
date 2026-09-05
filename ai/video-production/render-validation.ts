import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { extractBrandIdentity } from "../creative-workspace/brand-identity.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { buildConfirmedCommercial } from "../creative-planning/commercial.js";
import type { VideoPlatformProfile } from "./platform-profiles.js";
import type { ProbedVideo } from "./ffmpeg-renderer.js";
import type { VideoProject, VideoRenderValidation, VideoTimelineClip } from "./types.js";
import { timelineDurationMs } from "./plan-to-timeline.js";
import { uniqueAssetIds } from "./output-stale.js";

export function buildCommercialFromProject(project: CreativeProject) {
  const info = project.productInformation ?? {};
  const brand = extractBrandIdentity(project);
  return buildConfirmedCommercial({
    productName: info.name ?? info.title ?? project.name,
    currentPrice: info.price ?? info.currentPrice,
    originalPrice: info.originalPrice ?? info.oldPrice,
    currency: info.currency,
    website: brand.websiteUrl || info.website,
    phone: brand.phone || info.phone || info.contact,
    email: brand.email || info.email,
    cta: brand.cta || info.callToAction || info.cta,
    promotionMessage: info.promotionMessage ?? info.promotion,
  });
}

export function validateBeforeRender(input: {
  video: VideoProject;
  project: CreativeProject;
  profile: VideoPlatformProfile;
  preset: "preview" | "standard";
  renderClips: VideoTimelineClip[];
  assetsAvailable: (assetId: string) => boolean;
}): VideoRenderValidation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info = buildCommercialFromProject(input.project);
  const originals = input.project.productImages.filter(isOriginalProductImage);
  const durationMs = timelineDurationMs(input.renderClips);
  const assetIds = uniqueAssetIds(input.renderClips);

  if (!input.project.productInformation?.name?.trim() && !info.productName?.trim()) {
    issues.push("Product name is required before video production.");
  }
  if (!input.video.creativePlanId) issues.push("Creative plan is missing from the video project.");
  if (!originals.length) issues.push("At least one original product image is required.");
  if (!input.renderClips.length) issues.push("Timeline has no scenes to render.");
  if (input.preset === "standard" && input.renderClips.length < 1) {
    issues.push("Final export requires at least one approved scene.");
  }
  for (const clip of input.renderClips) {
    if (!input.assetsAvailable(clip.assetId)) {
      issues.push(`Scene ${clip.order} is missing original asset ${clip.assetId}.`);
    }
  }
  if (durationMs > input.profile.maxDurationMs) {
    issues.push(`Timeline duration ${Math.round(durationMs / 1000)}s exceeds ${input.profile.label} limit of ${Math.round(input.profile.maxDurationMs / 1000)}s.`);
  }
  if (input.video.outputStatus === "OUTDATED" && input.preset === "standard") {
    warnings.push("Project changed since the last render. Export will create a new output asset.");
  }
  if (assetIds.length < 2 && originals.length > 1) {
    warnings.push("Timeline uses fewer product views than are available. Consider refreshing from the Creative Plan.");
  }
  if (info.pricing.currentPrice == null) warnings.push("No price provided — price scenes will be omitted.");
  if (!info.destination.website) warnings.push("No website provided — website overlay will be omitted.");
  if (info.issues.length) warnings.push(...info.issues);

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    platform: input.profile.id,
    platformLabel: input.profile.label,
    aspectRatio: input.profile.aspectRatio,
    dimensions: `${input.profile.width}x${input.profile.height}`,
    sceneCount: input.renderClips.length,
    uniqueAssetCount: assetIds.length,
    durationMs,
    commercial: {
      productName: info.productName || null,
      hasPrice: info.pricing.currentPrice != null,
      hasDiscount: info.pricing.discountPercentage != null,
      hasWebsite: Boolean(info.destination.website),
      hasCta: Boolean(input.project.productInformation?.callToAction ?? input.project.productInformation?.cta),
    },
    outputStatus: input.video.outputStatus ?? "NONE",
  };
}

export function validateRenderedOutput(input: {
  probed: ProbedVideo;
  plannedDurationMs: number;
  plannedWidth: number;
  plannedHeight: number;
  sceneCount: number;
  preset: "preview" | "standard";
  /** STEP 11 — when set, output must accommodate the professional end card. */
  endCardDurationMs?: number;
  endCardRequired?: boolean;
  endCardRendered?: boolean;
  selectedEngine?: string;
  projectId?: string;
  jobProjectId?: string;
}): { valid: boolean; issues: string[]; checks: Record<string, boolean> } {
  const issues: string[] = [];
  const toleranceMs = Math.max(2500, Math.round(input.plannedDurationMs * 0.15));
  const checks = {
    fileNonEmpty: input.probed.sizeBytes > 1000,
    hasVideoStream: input.probed.width > 0 && input.probed.height > 0,
    dimensionsMatch: input.probed.width === input.plannedWidth && input.probed.height === input.plannedHeight,
    durationValid: input.probed.durationMs > 200,
    durationConsistent: Math.abs(input.probed.durationMs - input.plannedDurationMs) <= toleranceMs,
    codecPresent: Boolean(input.probed.codec),
    endCardPresent: input.endCardRequired !== true || input.endCardRendered === true,
    endCardDurationPlausible: input.endCardRequired !== true
      || ((input.endCardDurationMs ?? 0) >= 1500
        && input.probed.durationMs + 500 >= (input.plannedDurationMs)),
    projectIdentityConsistent: !input.projectId
      || !input.jobProjectId
      || input.projectId === input.jobProjectId,
  };
  if (!checks.fileNonEmpty) issues.push("Output file is empty or too small.");
  if (!checks.hasVideoStream) issues.push("Output does not contain a readable video stream.");
  if (!checks.dimensionsMatch) {
    issues.push(`Output dimensions ${input.probed.width}x${input.probed.height} do not match plan ${input.plannedWidth}x${input.plannedHeight}.`);
  }
  if (!checks.durationValid) issues.push("Output duration is too short.");
  if (!checks.durationConsistent) {
    issues.push(`Output duration ${input.probed.durationMs}ms differs from planned ${input.plannedDurationMs}ms.`);
  }
  if (input.preset === "standard" && input.sceneCount < 1) issues.push("Final export reported zero rendered scenes.");
  if (!checks.endCardPresent) {
    issues.push("Required professional end card was not rendered into the final video.");
  }
  if (!checks.endCardDurationPlausible) {
    issues.push("Final output duration does not include the planned end card.");
  }
  if (!checks.projectIdentityConsistent) {
    issues.push("Render job projectId does not match video project identity.");
  }
  return { valid: issues.length === 0, issues, checks };
}

/** Pre-flight ENGINE 1 final plan checks before FFmpeg starts (extends validateBeforeRender). */
export function validateEngine1FinalPlan(input: {
  projectId: string;
  selectedEngine: string;
  format: string;
  width: number;
  height: number;
  sceneIds: string[];
  assetIds: string[];
  assetsBelongToProject: boolean;
  pathsResolved: boolean;
  durationMs: number;
}): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!input.projectId.trim()) issues.push("ENGINE 1 plan missing projectId.");
  if (input.selectedEngine !== "AI_PRODUCT_MOTION") {
    issues.push(`ENGINE 1 finalization expected AI_PRODUCT_MOTION, got ${input.selectedEngine}.`);
  }
  if (!["9:16", "16:9", "1:1", "4:5"].includes(input.format)) {
    issues.push(`Invalid output format ${input.format}.`);
  }
  if (input.width < 64 || input.height < 64) issues.push("Invalid output dimensions.");
  if (!input.sceneIds.length) issues.push("ENGINE 1 plan has no scenes.");
  if (!input.assetIds.length) issues.push("ENGINE 1 plan has no product assets.");
  if (!input.assetsBelongToProject) issues.push("One or more assets do not belong to this project.");
  if (!input.pathsResolved) issues.push("One or more production asset paths failed to resolve.");
  if (input.durationMs < 500) issues.push("ENGINE 1 planned duration is too short.");
  return { valid: issues.length === 0, issues };
}
