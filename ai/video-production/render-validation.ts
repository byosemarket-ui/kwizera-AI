import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { buildConfirmedCommercial } from "../creative-planning/commercial.js";
import type { VideoPlatformProfile } from "./platform-profiles.js";
import type { ProbedVideo } from "./ffmpeg-renderer.js";
import type { VideoProject, VideoRenderValidation, VideoTimelineClip } from "./types.js";
import { timelineDurationMs } from "./plan-to-timeline.js";
import { uniqueAssetIds } from "./output-stale.js";

export function buildCommercialFromProject(project: CreativeProject) {
  const info = project.productInformation ?? {};
  return buildConfirmedCommercial({
    productName: info.name ?? info.title ?? project.name,
    currentPrice: info.price ?? info.currentPrice,
    originalPrice: info.originalPrice ?? info.oldPrice,
    currency: info.currency,
    website: info.website,
    phone: info.phone ?? info.contact,
    email: info.email,
    cta: info.callToAction ?? info.cta,
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
  return { valid: issues.length === 0, issues, checks };
}
