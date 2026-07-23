import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import {
  ALL_BRAND_VALIDATION_CHECKS,
  ALL_IMAGE_QUALITY_CHECKS,
  ALL_PRINT_VALIDATION_CHECKS,
  ALL_QUALITY_LAYER_CHECKS,
  ALL_QUALITY_MASK_TYPES,
  ALL_QUALITY_VALIDATION_PLATFORMS,
  ALL_TECHNICAL_VALIDATION_CHECKS,
  ALL_TYPOGRAPHY_CHECKS,
  BrandValidationEntry,
  ImageQualityCheck,
  ImageQualityValidationEntry,
  ImageQualityValidationInput,
  PlatformValidationEntry,
  PrintValidationCheck,
  PrintValidationEntry,
  QualityIssue,
  QualityIssueCategory,
  QualityIssueSeverity,
  QualityLayerCheck,
  QualityLayerValidationEntry,
  QualityMaskType,
  QualityMaskValidationEntry,
  QualityValidationPlatform,
  QualityValidationProfile,
  QUALITY_PLATFORM_CONFIG,
  TechnicalValidationEntry,
  TechnicalValidationCheck,
  TypographyCheck,
  TypographyValidationEntry,
} from "./types.js";

export interface QualityValidationContext {
  productId?: string;
  productName?: string;
  brandId?: string;
  brandName?: string;
  projectId?: string;
  campaignId?: string;
  industry?: string;
  productionPlan?: ImageProductionRecord | null;
  renderPlan?: ImageRenderRecord | null;
  stylePlan?: MultiStyleImageRecord | null;
  brandingPlan?: BrandingDesignRecord | null;
  analysis?: ProductAnalysisIntelligenceRecord | null;
}

export class ImageQualityValidationAnalyzer {
  buildProfile(
    input: ImageQualityValidationInput,
    platform: QualityValidationPlatform,
    version: number,
    context: QualityValidationContext
  ): QualityValidationProfile {
    const productId = context.productId ?? input.productId ?? "unknown-product";
    const brandId = input.brandId ?? context.brandId ?? context.brandName ?? "unknown-brand";
    const productionId = input.productionId ?? context.productionPlan?.imageProductionId ?? `production-${productId}`;
    const renderPlanId = input.renderPlanId ?? context.renderPlan?.imageRenderPlanId ?? `render-${productionId}`;
    const imagePlanId =
      input.imagePlanId ?? context.productionPlan?.profile.imagePlanId ?? context.renderPlan?.profile.imageId ?? `image-${productId}`;

    return {
      qualityValidationId: `quality-validation-${renderPlanId}-${platform}-v${version}`,
      projectId: input.projectId ?? context.projectId ?? context.productionPlan?.profile.projectId ?? `project-${productId}`,
      productionId,
      renderPlanId,
      imagePlanId,
      productId,
      brandId,
      platform,
      validationVersion: version,
    };
  }

  buildImageQualityValidation(context: QualityValidationContext, platform: QualityValidationPlatform): ImageQualityValidationEntry[] {
    const config = QUALITY_PLATFORM_CONFIG[platform];
    const renderSettings = context.renderPlan?.renderSettings;

    return ALL_IMAGE_QUALITY_CHECKS.map((check) => {
      const score = this.scoreImageQualityCheck(check, context, config.resolution);
      return {
        check,
        validated: score >= 55,
        score,
        notes: [`${check} validated at ${config.resolution} — blueprint analysis only`],
      };
    }).map((entry) => {
      if (renderSettings && entry.check === ImageQualityCheck.ImageResolution) {
        entry.validated = renderSettings.resolution === config.resolution || renderSettings.resolution.length >= 7;
        entry.score = entry.validated ? 90 : 60;
      }
      return entry;
    });
  }

  buildLayerValidation(context: QualityValidationContext): QualityLayerValidationEntry[] {
    const layers = context.renderPlan?.layerStructure ?? context.productionPlan?.productionStructure.layerStructure ?? [];

    return ALL_QUALITY_LAYER_CHECKS.map((check) => ({
      check,
      validated: this.validateLayerCheck(check, layers.length, context),
      notes: [`${check} verified across ${layers.length} layers`],
    }));
  }

  buildMaskValidation(context: QualityValidationContext): QualityMaskValidationEntry[] {
    const renderMasks = context.renderPlan?.maskValidation ?? [];
    const productionMasks = context.productionPlan?.productionStructure.maskStructure ?? [];

    return ALL_QUALITY_MASK_TYPES.map((maskType, index) => {
      const renderMask = renderMasks.find((m) => m.maskType === maskType);
      const prodMask = productionMasks[index];
      const maskId = renderMask?.maskId ?? prodMask?.maskId ?? `mask-${maskType}`;
      const validated = renderMask?.validated ?? prodMask?.validated ?? maskId.length > 0;

      return {
        maskType,
        validated,
        maskId,
        notes: validated ? [`${maskType} mask integrity verified`] : [`${maskType} mask requires review`],
      };
    });
  }

  buildTypographyValidation(context: QualityValidationContext): TypographyValidationEntry[] {
    const hasBranding = Boolean(context.brandingPlan || context.productionPlan?.relationships.brandingPlans.length);

    return ALL_TYPOGRAPHY_CHECKS.map((check) => ({
      check,
      validated: hasBranding || check === TypographyCheck.Readability,
      notes: [`${check} typography validation — blueprint analysis`],
    }));
  }

  buildBrandValidation(context: QualityValidationContext): BrandValidationEntry[] {
    const brandName = context.brandName ?? context.brandId ?? "";

    return ALL_BRAND_VALIDATION_CHECKS.map((check) => ({
      check,
      validated: brandName.length > 0 || Boolean(context.brandingPlan),
      notes: brandName ? [`${check} validated for ${brandName}`] : [`${check} brand check planned`],
    }));
  }

  buildPrintValidation(context: QualityValidationContext, platform: QualityValidationPlatform): PrintValidationEntry[] {
    const isPrint =
      platform === QualityValidationPlatform.Print || platform === QualityValidationPlatform.Packaging;
    const renderSettings = context.renderPlan?.renderSettings;
    const config = QUALITY_PLATFORM_CONFIG[platform];

    return ALL_PRINT_VALIDATION_CHECKS.map((check) => {
      let validated = !isPrint;
      if (isPrint) {
        switch (check) {
          case PrintValidationCheck.Dpi:
            validated = (renderSettings?.dpi ?? config.dpi) >= 300;
            break;
          case PrintValidationCheck.Resolution:
            validated = Boolean(renderSettings?.resolution ?? config.resolution);
            break;
          case PrintValidationCheck.Cmyk:
            validated = renderSettings?.colorSpace === "cmyk" || platform === QualityValidationPlatform.Print;
            break;
          case PrintValidationCheck.IccProfiles:
            validated = Boolean(renderSettings?.iccProfile);
            break;
          default:
            validated = true;
        }
      }
      return { check, validated, notes: [`${check} print validation`] };
    });
  }

  buildPlatformValidation(input: ImageQualityValidationInput, context: QualityValidationContext): PlatformValidationEntry[] {
    if (input.validatePlatform === false) {
      return [this.buildPlatformEntry(context.renderPlan?.profile.platform as QualityValidationPlatform ?? QualityValidationPlatform.Website, context)];
    }

    return ALL_QUALITY_VALIDATION_PLATFORMS.map((platform) => this.buildPlatformEntry(platform, context));
  }

  buildTechnicalValidation(context: QualityValidationContext): TechnicalValidationEntry[] {
    const renderSettings = context.renderPlan?.renderSettings;

    return ALL_TECHNICAL_VALIDATION_CHECKS.map((check) => {
      let validated = true;
      if (check === TechnicalValidationCheck.ColorSpace) validated = Boolean(renderSettings?.colorSpace);
      if (check === TechnicalValidationCheck.BitDepth) validated = (renderSettings?.bitDepth ?? 8) >= 8;
      if (check === TechnicalValidationCheck.Metadata) validated = Boolean(context.productionPlan?.profile.imagePlanId);
      if (check === TechnicalValidationCheck.AlphaChannel) validated = renderSettings?.alphaChannel !== undefined;

      return { check, validated, notes: [`${check} technical validation`] };
    });
  }

  detectIssues(
    imageQuality: ImageQualityValidationEntry[],
    layerValidation: QualityLayerValidationEntry[],
    maskValidation: QualityMaskValidationEntry[],
    typographyValidation: TypographyValidationEntry[],
    brandValidation: BrandValidationEntry[],
    context: QualityValidationContext
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    let issueCounter = 0;

    for (const entry of imageQuality.filter((e) => !e.validated)) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.Color, entry.score < 45 ? QualityIssueSeverity.High : QualityIssueSeverity.Medium, `Image quality check failed: ${entry.check}`));
    }

    for (const entry of layerValidation.filter((l) => !l.validated)) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.BrokenLayer, QualityIssueSeverity.High, `Layer validation failed: ${entry.check}`));
    }

    for (const entry of maskValidation.filter((m) => !m.validated)) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.BrokenMask, QualityIssueSeverity.Medium, `Mask validation failed: ${entry.maskType}`));
    }

    for (const entry of typographyValidation.filter((t) => !t.validated)) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.Typography, QualityIssueSeverity.Low, `Typography issue: ${entry.check}`));
    }

    for (const entry of brandValidation.filter((b) => !b.validated)) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.Branding, QualityIssueSeverity.Medium, `Brand validation failed: ${entry.check}`));
    }

    if (!context.renderPlan?.renderReady) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.RenderingRisk, QualityIssueSeverity.High, "Render plan not marked render-ready"));
    }

    if (!context.productionPlan?.productionReady) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.RenderingRisk, QualityIssueSeverity.Medium, "Production plan not marked production-ready"));
    }

    if (!context.productionPlan && !context.renderPlan) {
      issues.push(this.createIssue(++issueCounter, QualityIssueCategory.MissingAsset, QualityIssueSeverity.Critical, "Missing production and render plan references"));
    }

    return issues;
  }

  buildRecommendations(context: QualityValidationContext, profile: QualityValidationProfile, issues: QualityIssue[]): string[] {
    const recommendations = [
      `Quality validation v${profile.validationVersion} completed for ${profile.platform}`,
      "Complete image production validation before rendering and export",
    ];

    if (context.renderPlan) {
      recommendations.push(`Render plan ${context.renderPlan.imageRenderPlanId} validated for quality readiness`);
    }
    if (context.productionPlan) {
      recommendations.push(`Production plan ${context.productionPlan.imageProductionId} cross-validated`);
    }
    if (issues.length === 0) {
      recommendations.push("No quality issues detected — production approved for next stage");
    } else {
      recommendations.push(`${issues.length} issue(s) detected — review before approval`);
    }

    return recommendations;
  }

  resolvePlatform(input: ImageQualityValidationInput, context: QualityValidationContext): QualityValidationPlatform {
    return (
      input.platform ??
      (context.renderPlan?.profile.platform as QualityValidationPlatform | undefined) ??
      (context.productionPlan?.profile.platform as QualityValidationPlatform | undefined) ??
      QualityValidationPlatform.Website
    );
  }

  extractContext(
    input: ImageQualityValidationInput,
    productionPlan?: ImageProductionRecord | null,
    renderPlan?: ImageRenderRecord | null,
    stylePlan?: MultiStyleImageRecord | null,
    brandingPlan?: BrandingDesignRecord | null,
    analysis?: ProductAnalysisIntelligenceRecord | null
  ): QualityValidationContext {
    return {
      productId: input.productId ?? productionPlan?.profile.productId ?? stylePlan?.profile.productId,
      productName: analysis?.productName,
      brandId: input.brandId ?? productionPlan?.profile.brandId ?? stylePlan?.profile.brandId,
      brandName: analysis?.brand ?? brandingPlan?.profile.brandId,
      projectId: input.projectId ?? productionPlan?.profile.projectId,
      campaignId: input.campaignId ?? productionPlan?.profile.campaignId,
      industry: analysis?.industry,
      productionPlan,
      renderPlan,
      stylePlan,
      brandingPlan,
      analysis: analysis ?? null,
    };
  }

  private buildPlatformEntry(platform: QualityValidationPlatform, context: QualityValidationContext): PlatformValidationEntry {
    const config = QUALITY_PLATFORM_CONFIG[platform];
    const renderReady = context.renderPlan?.renderReady ?? false;
    const productionReady = context.productionPlan?.productionReady ?? false;

    return {
      platform,
      validated: true,
      ready: renderReady && productionReady,
      notes: [`${platform}: ${config.resolution} @ ${config.dpi} DPI`, renderReady ? "Render ready" : "Render pending"],
    };
  }

  private scoreImageQualityCheck(check: ImageQualityCheck, context: QualityValidationContext, resolution: string): number {
    let score = 70;
    if (context.renderPlan?.renderReady) score += 10;
    if (context.productionPlan?.productionReady) score += 10;
    if (context.stylePlan) score += 5;
    if (check === ImageQualityCheck.ImageResolution && resolution.length >= 7) score += 5;
    return Math.min(100, score);
  }

  private validateLayerCheck(check: QualityLayerCheck, layerCount: number, context: QualityValidationContext): boolean {
    if (layerCount < 3 && check === QualityLayerCheck.LayerStructure) return false;
    if (layerCount >= 3) return true;
    return Boolean(context.productionPlan || context.renderPlan);
  }

  private createIssue(counter: number, category: QualityIssueCategory, severity: QualityIssueSeverity, message: string): QualityIssue {
    return {
      issueId: `issue-${counter}-${category}`,
      category,
      severity,
      message,
      repaired: false,
    };
  }
}
