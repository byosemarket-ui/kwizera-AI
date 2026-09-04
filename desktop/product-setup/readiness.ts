import type { IntakeSnapshot } from "../product-intake/types";
import type { OrganizationSnapshot, OrganizedImage } from "../image-organization/types";
import type {
  AiProductSummary,
  AnalysisUiStatus,
  ImageCardModel,
  ProductEssentials,
  ReadinessResult,
} from "./types";
import { viewDisplayLabel } from "./view-labels";

function validImageCount(intake: IntakeSnapshot): number {
  return intake.assets.filter((a) => {
    if (a.processingStatus !== "saved") return false;
    if (a.validationStatus === "invalid") return false;
    if (a.validationStatus === "duplicate" && !a.keepDespiteDuplicate) return false;
    return true;
  }).length;
}

export function deriveAnalysisStatus(
  intake: IntakeSnapshot,
  org: OrganizationSnapshot,
  analysisFailed: boolean,
): AnalysisUiStatus {
  if (analysisFailed) return "FAILED";
  if (intake.progress.running) return "UPLOADING";
  if (org.progress.running) return "ANALYZING";
  const valid = validImageCount(intake);
  if (valid === 0 && intake.assets.length === 0) return "NOT_STARTED";
  if (valid === 0) return "FAILED";
  if (!org.productImageSet && valid > 0) return "NOT_STARTED";
  if (!org.productImageSet) return "PARTIAL";
  const needsReview = org.productImageSet.images.some((i) => i.needsReview);
  if (needsReview) return "REVIEW_REQUIRED";
  return "COMPLETE";
}

export function buildImageCards(
  intake: IntakeSnapshot,
  org: OrganizationSnapshot,
): ImageCardModel[] {
  const set = org.productImageSet;
  /** Show saved, in-flight, and failed imports — not an empty UI during upload */
  const visible = intake.assets.filter((a) =>
    a.processingStatus === "saved"
    || a.processingStatus === "queued"
    || a.processingStatus === "uploading"
    || a.processingStatus === "failed",
  );
  return visible.map((asset) => {
    const organized = set?.images.find((i) => i.assetId === asset.assetId);
    const finalView = organized?.viewType ?? "UNKNOWN";
    const confidence = organized?.confidence ?? 0;
    const needsReview = organized?.needsReview ?? (asset.processingStatus === "saved");
    const userCorrected = organized?.userCorrected ?? false;
    const aiView = userCorrected && organized
      ? organized.viewType
      : finalView;

    const uploadStatus: ImageCardModel["uploadStatus"] =
      asset.processingStatus === "uploading" || asset.processingStatus === "queued"
        ? "uploading"
        : asset.processingStatus === "failed"
          ? "failed"
          : "saved";

    let severity: ImageCardModel["severity"] = "ok";
    let issueMessage: string | null = null;
    if (uploadStatus === "uploading") {
      severity = "info";
      issueMessage = asset.processingStatus === "queued" ? "Queued…" : "Uploading…";
    } else if (asset.validationStatus === "invalid" || asset.processingStatus === "failed") {
      severity = "critical";
      issueMessage = asset.error ?? "This image cannot be used.";
    } else if (organized?.visibilityStatus && organized.visibilityStatus !== "clear") {
      severity = "warning";
      issueMessage = "Product may not be clearly visible.";
    } else if (organized?.duplicateOfAssetId || asset.validationStatus === "duplicate") {
      severity = "info";
      issueMessage = "Similar to another image.";
    } else if (needsReview) {
      severity = "warning";
      issueMessage = "Classification needs review.";
    } else if (asset.warnings.length) {
      severity = "warning";
      issueMessage = asset.warnings[0]?.message ?? null;
    }

    return {
      assetId: asset.assetId,
      url: asset.thumbnailUrl || asset.remoteUrl || asset.localPreviewUrl,
      fileName: asset.originalFilename,
      aiViewType: aiView,
      finalViewType: finalView,
      displayLabel: viewDisplayLabel(finalView),
      confidence,
      needsReview,
      userCorrected,
      severity,
      issueMessage,
      isDuplicate: Boolean(organized?.duplicateOfAssetId || asset.validationStatus === "duplicate"),
      uploadStatus,
    };
  });
}

export function buildAiSummary(org: OrganizationSnapshot, essentials: ProductEssentials): AiProductSummary | null {
  const set = org.productImageSet;
  if (!set) return null;
  const useful = [...new Set(
    set.images
      .filter((i) => !i.duplicateOfAssetId && i.viewType !== "UNKNOWN")
      .map((i) => viewDisplayLabel(i.viewType)),
  )];
  const hero = set.images.find((i) => i.roleInGroup === "primary") ?? set.images[0] ?? null;
  const count = set.images.length;
  let coverageLabel: AiProductSummary["coverageLabel"] = "INSUFFICIENT COVERAGE";
  let coverageMessage = "Add clearer product photos to continue.";
  if (count >= 3 && set.coverageScore >= 50) {
    coverageLabel = "GOOD PRODUCT COVERAGE";
    coverageMessage = "Your product has enough useful image views to continue.";
  } else if (count >= 1) {
    coverageLabel = "LIMITED PRODUCT COVERAGE";
    coverageMessage = "The video can be created, but additional angles may improve the result.";
  }
  return {
    productLabel: essentials.productName.trim() || set.categoryEstimate || null,
    category: set.categoryEstimate || null,
    imageCount: count,
    usefulViews: useful,
    heroAssetId: hero?.assetId ?? null,
    coverageLabel,
    coverageMessage,
  };
}

export function computeReadiness(
  intake: IntakeSnapshot,
  org: OrganizationSnapshot,
  essentials: ProductEssentials,
  analysisStatus: AnalysisUiStatus,
): ReadinessResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const validImages = validImageCount(intake);

  if (!intake.projectName.trim()) blockingIssues.push("Project name is required.");
  if (validImages < 1) blockingIssues.push("At least one valid product image is required.");
  if (!essentials.productName.trim()) blockingIssues.push("Product name is required.");

  if (analysisStatus === "ANALYZING" || analysisStatus === "UPLOADING") {
    blockingIssues.push("Wait for upload and analysis to finish.");
  }

  if (org.productImageSet?.missingViews.length) {
    for (const view of org.productImageSet.missingViews.slice(0, 3)) {
      warnings.push(`${viewDisplayLabel(view)} view was not detected.`);
    }
    recommendations.push("Adding another product angle may improve the final video.");
  }

  if (analysisStatus === "REVIEW_REQUIRED") {
    warnings.push("Some image classifications need review.");
  }

  if (essentials.currentPrice === null) {
    recommendations.push("Price is optional — add it if you want pricing in the video.");
  }

  if (essentials.previousPrice != null && essentials.currentPrice != null
    && essentials.previousPrice <= essentials.currentPrice) {
    warnings.push("Previous price must be higher than current price to create a discount.");
  }

  const ready = blockingIssues.length === 0;
  let statusLabel: ReadinessResult["statusLabel"] = "NOT READY";
  if (ready && (warnings.length || recommendations.length)) statusLabel = "READY WITH RECOMMENDATIONS";
  else if (ready) statusLabel = "READY TO CONTINUE";

  return {
    ready,
    blockingIssues,
    warnings,
    recommendations,
    summary: {
      projectName: Boolean(intake.projectName.trim()),
      validImages,
      productName: Boolean(essentials.productName.trim()),
      analysisStatus,
    },
    statusLabel,
  };
}

export function suggestProductName(projectName: string): string {
  return projectName
    .replace(/\b(campaign|project|video|promo|ad|marketing)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function heroImage(set: { images: OrganizedImage[] } | null | undefined): OrganizedImage | null {
  if (!set) return null;
  return set.images.find((i) => i.roleInGroup === "primary") ?? set.images[0] ?? null;
}
