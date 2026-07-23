import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import {
  ProductionExportPreparation,
  ProductionPlatformRules,
  ProductionAssetInventory,
  ProductionAssetItem,
  ProductionDependencyCheck,
  ProductionDependencyValidation,
  ProductionImagePlatform,
  ProductionImagePlanningRecommendation,
  ProductionImageProfile,
  ProductionRecoveryPlan,
  ProductionWorkflowPlanning,
  ProductionRenderPreparation,
} from "./types.js";

export interface UpstreamProductionContext {
  analysis: ImageAnalysisIntelligenceRecord;
  understanding: ImageUnderstandingRecord;
  detection: ObjectDetectionRecord;
  background: BackgroundIntelligenceRecord;
  composition: CompositionIntelligenceRecord;
  lightingColor: LightingColorIntelligenceRecord;
  brandVisual: BrandVisualIntelligenceRecord;
  enhancementPlan: ImageEnhancementPlanningRecord;
  creativePlan: CreativeImageIntelligenceRecord;
  knowledgeConnected: boolean;
  memoryConnected: boolean;
  productIntelligenceConnected: boolean;
}

export class ProductionPlanningAnalyzer {
  buildFromIntelligence(
    ctx: UpstreamProductionContext,
    projectId?: string,
    campaign?: string,
    platform?: ProductionImagePlatform
  ): {
    profile: ProductionImageProfile;
    workflow: ProductionWorkflowPlanning;
    assets: ProductionAssetInventory;
    dependencies: ProductionDependencyValidation;
    renderPreparation: ProductionRenderPreparation;
    exportPreparation: ProductionExportPreparation;
    platformRules: ProductionPlatformRules;
    recoveryPlan: ProductionRecoveryPlan;
    recommendations: ProductionImagePlanningRecommendation[];
    keywords: string[];
  } {
    const { analysis, understanding, creativePlan, enhancementPlan, brandVisual } = ctx;
    const product = analysis.content.products[0] ?? creativePlan.profile.product;
    const brand = brandVisual.profile.brandName ?? creativePlan.profile.brand;
    const campaignName =
      campaign ??
      creativePlan.profile.campaign ??
      understanding.relationships.relatedMarketingCampaigns[0] ??
      String(understanding.marketingGoal);
    const targetPlatform = platform ?? this.inferPlatform(creativePlan.profile.platform);

    const dependencies = this.validateDependencies(ctx);
    const assets = this.buildAssetInventory(ctx);
    const workflow = this.buildWorkflow(ctx, dependencies);
    const renderPreparation = this.buildRenderPreparation(analysis, enhancementPlan, targetPlatform);
    const exportPreparation = this.buildExportPreparation(targetPlatform);
    const platformRules = this.buildPlatformRules(targetPlatform, renderPreparation);
    const recoveryPlan = this.buildRecoveryPlan(dependencies, assets);

    const profile: ProductionImageProfile = {
      productionImagePlanId: `production-plan-${analysis.imageId}`,
      projectId: projectId ?? creativePlan.profile.projectId,
      imageId: analysis.imageId,
      product,
      brand,
      campaign: campaignName,
      platform: targetPlatform,
      productionVersion: "1.0",
    };

    const recommendations = this.buildRecommendations(dependencies, assets, workflow, targetPlatform);

    const keywords = [
      ...analysis.keywords,
      ...creativePlan.keywords,
      product,
      brand,
      campaignName,
      targetPlatform,
      "production-planning",
      ...recommendations.map((r) => r.category),
    ].filter(Boolean);

    return {
      profile,
      workflow,
      assets,
      dependencies,
      renderPreparation,
      exportPreparation,
      platformRules,
      recoveryPlan,
      recommendations,
      keywords,
    };
  }

  validateDependencies(ctx: UpstreamProductionContext): ProductionDependencyValidation {
    const checks: ProductionDependencyCheck[] = [
      this.check("image-analysis-engine", "Image Analysis", ctx.analysis, ctx.analysis?.validated),
      this.check("image-understanding-engine", "Image Understanding", ctx.understanding, ctx.understanding?.validated),
      this.check("object-detection-intelligence", "Object Detection", ctx.detection, ctx.detection?.validated),
      this.check("background-intelligence", "Background Intelligence", ctx.background, ctx.background?.validated),
      this.check("composition-intelligence", "Composition Intelligence", ctx.composition, ctx.composition?.validated),
      this.check("lighting-color-intelligence", "Lighting & Color Intelligence", ctx.lightingColor, ctx.lightingColor?.validated),
      this.check("brand-visual-intelligence", "Brand Visual Intelligence", ctx.brandVisual, ctx.brandVisual?.validated),
      this.check("image-enhancement-planning", "Image Enhancement Planning", ctx.enhancementPlan, ctx.enhancementPlan?.validated),
      this.check("creative-image-intelligence", "Creative Image Intelligence", ctx.creativePlan, ctx.creativePlan?.validated),
      {
        moduleId: "product-intelligence",
        moduleName: "Product Intelligence",
        required: true,
        present: ctx.productIntelligenceConnected,
        validated: ctx.productIntelligenceConnected,
        status: ctx.productIntelligenceConnected ? "passed" : "missing",
        detail: ctx.productIntelligenceConnected ? "Product intelligence bridge connected" : "Product intelligence bridge unavailable",
      },
      {
        moduleId: "knowledge-engine",
        moduleName: "Knowledge Engine",
        required: true,
        present: ctx.knowledgeConnected,
        validated: ctx.knowledgeConnected,
        status: ctx.knowledgeConnected ? "passed" : "missing",
        detail: ctx.knowledgeConnected ? "Knowledge bridge connected" : "Knowledge bridge unavailable",
      },
      {
        moduleId: "memory-engine",
        moduleName: "Memory Engine",
        required: true,
        present: ctx.memoryConnected,
        validated: ctx.memoryConnected,
        status: ctx.memoryConnected ? "passed" : "missing",
        detail: ctx.memoryConnected ? "Memory bridge connected" : "Memory bridge unavailable",
      },
    ];

    const required = checks.filter((c) => c.required);
    const passedCount = required.filter((c) => c.status === "passed").length;

    return {
      checks,
      allRequiredPassed: passedCount === required.length,
      passedCount,
      totalRequired: required.length,
    };
  }

  private check(
    moduleId: string,
    moduleName: string,
    record: unknown,
    validated?: boolean
  ): ProductionDependencyCheck {
    const present = Boolean(record);
    const isValid = present && validated === true;
    return {
      moduleId,
      moduleName,
      required: true,
      present,
      validated: isValid,
      status: isValid ? "passed" : present ? "invalid" : "missing",
      detail: isValid ? `${moduleName} validated` : present ? `${moduleName} not validated` : `${moduleName} missing`,
    };
  }

  private inferPlatform(creativePlatform: string): ProductionImagePlatform {
    if (creativePlatform.includes("instagram")) return ProductionImagePlatform.Instagram;
    if (creativePlatform.includes("facebook")) return ProductionImagePlatform.Facebook;
    if (creativePlatform.includes("tiktok")) return ProductionImagePlatform.TikTok;
    if (creativePlatform.includes("youtube")) return ProductionImagePlatform.YouTube;
    if (creativePlatform.includes("whatsapp")) return ProductionImagePlatform.WhatsApp;
    return ProductionImagePlatform.Website;
  }

  private buildWorkflow(
    ctx: UpstreamProductionContext,
    deps: ProductionDependencyValidation
  ): ProductionWorkflowPlanning {
    const ready = deps.allRequiredPassed;
    return {
      imageAnalysis: ready ? `Analysis ${ctx.analysis.analysisId} validated — proceed` : "Blocked — image analysis required",
      enhancementValidation: ctx.enhancementPlan.validated
        ? `Enhancement plan ${ctx.enhancementPlan.profile.enhancementPlanId} approved (non-destructive)`
        : "Enhancement validation pending",
      assetValidation: "Asset inventory prepared — validate before render",
      compositionValidation: ctx.composition.validated
        ? `Composition ${ctx.composition.compositionId} validated`
        : "Composition validation required",
      backgroundValidation: ctx.background.validated
        ? `Background ${ctx.background.backgroundId} validated`
        : "Background validation required",
      brandValidation: ctx.brandVisual.validated
        ? `Brand visual ${ctx.brandVisual.brandVisualId} validated`
        : "Brand validation required",
      creativeValidation: ctx.creativePlan.validated
        ? `Creative plan ${ctx.creativePlan.profile.creativeImageId} production-ready`
        : "Creative validation required",
      renderingPreparation: "Render instructions prepared — no rendering performed",
      exportPreparation: "Export formats planned — PNG, JPG, WEBP primary",
      deliveryPreparation: `Delivery workflow for ${ctx.creativePlan.profile.platform} prepared`,
    };
  }

  private assetItem(
    assetType: string,
    assetId: string,
    source: string,
    ready: boolean,
    note: string
  ): ProductionAssetItem {
    return {
      assetType,
      assetId,
      source,
      status: ready ? "ready" : "planned",
      validationNote: note,
    };
  }

  private buildAssetInventory(ctx: UpstreamProductionContext): ProductionAssetInventory {
    const { analysis, brandVisual, creativePlan, enhancementPlan } = ctx;
    const hasOriginal = Boolean(analysis.technical.filePath);
    const hasLogo = analysis.content.logos.length > 0 || brandVisual.logoAnalysis.logoVisibility > 0;
    const hasProduct = analysis.content.products.length > 0;

    return {
      originalImages: [
        this.assetItem(
          "original",
          analysis.imageId,
          analysis.technical.filePath,
          hasOriginal,
          hasOriginal ? "Original image source validated" : "Original image path missing"
        ),
      ],
      enhancedImages: [
        this.assetItem(
          "enhanced",
          enhancementPlan.profile.enhancementPlanId,
          "enhancement-plan",
          enhancementPlan.validated,
          "Enhanced variant planned — source preserved"
        ),
      ],
      logos: analysis.content.logos.map((logo, i) =>
        this.assetItem("logo", `logo-${i}`, logo, true, brandVisual.logoAnalysis.logoPosition)
      ),
      fonts: [
        this.assetItem(
          "font-primary",
          brandVisual.typography.primaryFont,
          "brand-visual",
          Boolean(brandVisual.typography.primaryFont),
          brandVisual.typography.headingStyle
        ),
        this.assetItem(
          "font-secondary",
          brandVisual.typography.secondaryFont,
          "brand-visual",
          Boolean(brandVisual.typography.secondaryFont),
          brandVisual.typography.bodyStyle
        ),
      ],
      icons: [
        this.assetItem("icon-style", brandVisual.profile.iconStyle, "brand-profile", true, "Brand icon style defined"),
      ],
      backgrounds: [
        this.assetItem(
          "background",
          ctx.background.backgroundId,
          analysis.content.background ?? "detected",
          ctx.background.validated,
          ctx.background.replacementPlan.replacementStrategy
        ),
      ],
      templates: [
        this.assetItem(
          "template",
          creativePlan.profile.creativeImageId,
          "creative-plan",
          creativePlan.productionReady,
          creativePlan.layoutPlanning.layoutType
        ),
      ],
      graphicElements: [
        this.assetItem(
          "graphic",
          brandVisual.profile.graphicStyle,
          "brand-visual",
          true,
          brandVisual.planning.visualStylePlan
        ),
      ],
      qrCodes: [
        this.assetItem(
          "qr",
          `qr-${analysis.imageId}`,
          "planned",
          false,
          creativePlan.layoutPlanning.qrCodePlacement
        ),
      ],
      ctaAssets: [
        this.assetItem(
          "cta",
          `cta-${analysis.imageId}`,
          "creative-plan",
          creativePlan.layoutPlanning.ctaPlacement.length > 0,
          creativePlan.productionInstructions.ctaGuidance
        ),
      ],
      brandAssets: [
        this.assetItem("brand", brandVisual.profile.brandId, brandVisual.profile.brandName, hasLogo || hasProduct, "Brand assets aligned"),
      ],
    };
  }

  private buildRenderPreparation(
    analysis: ImageAnalysisIntelligenceRecord,
    enhancementPlan: ImageEnhancementPlanningRecord,
    platform: ProductionImagePlatform
  ): ProductionRenderPreparation {
    const width = analysis.technical.width;
    const height = analysis.technical.height;
    const aspect = width && height ? `${width}:${height}` : "16:9";

    return {
      outputResolution: platform === ProductionImagePlatform.Print ? `${width}px min at 300dpi` : `${width}x${height}px target`,
      aspectRatio: aspect,
      imageFormat: analysis.technical.fileFormat ?? "png",
      colorProfile: "sRGB",
      compressionStrategy: enhancementPlan.enhancementPlan.noiseReduction.includes("Plan")
        ? "Lossless primary, optimized derivative for social"
        : "Balanced compression for platform delivery",
      exportQuality: enhancementPlan.scores.enhancementReadinessScore >= 80 ? "high" : "standard",
      renderingPriority: platform === ProductionImagePlatform.Website ? "hero-quality" : "platform-optimized",
    };
  }

  private buildExportPreparation(platform: ProductionImagePlatform): ProductionExportPreparation {
    const base = "Planned export — no files generated";
    return {
      png: `${base}; lossless PNG for ${platform}`,
      jpg: `${base}; JPG for social and web delivery`,
      webp: `${base}; WEBP for web optimization`,
      svg: platform === ProductionImagePlatform.Print ? `${base}; SVG for vector elements` : "SVG planned where vector assets apply",
      pdf: platform === ProductionImagePlatform.Print ? `${base}; PDF for print production` : "PDF available for print workflows",
      additionalFormatsSupported: true,
    };
  }

  private buildPlatformRules(platform: ProductionImagePlatform, render: ProductionRenderPreparation): ProductionPlatformRules {
    const base = `Production rules for ${render.outputResolution}`;
    return {
      instagram: platform === ProductionImagePlatform.Instagram ? `${base}; 1:1 and 4:5 variants` : base,
      facebook: platform === ProductionImagePlatform.Facebook ? `${base}; 1.91:1 link preview` : base,
      tiktok: platform === ProductionImagePlatform.TikTok ? `${base}; 9:16 vertical` : base,
      youtube: platform === ProductionImagePlatform.YouTube ? `${base}; 16:9 thumbnail` : base,
      whatsapp: platform === ProductionImagePlatform.WhatsApp ? `${base}; compressed under 5MB` : base,
      website: platform === ProductionImagePlatform.Website ? `${base}; responsive srcset` : base,
      print: platform === ProductionImagePlatform.Print ? `${base}; CMYK conversion planned` : "Print rules prepared",
    };
  }

  private buildRecoveryPlan(
    deps: ProductionDependencyValidation,
    assets: ProductionAssetInventory
  ): ProductionRecoveryPlan {
    const missingAssets = this.countMissingAssets(assets);
    return {
      dependencyRecovery: deps.allRequiredPassed
        ? "All dependencies validated — recovery not required"
        : "Re-run upstream intelligence pipeline for failed modules",
      assetRecovery: missingAssets > 0 ? `Recover ${missingAssets} planned asset(s) before production` : "Asset inventory complete",
      workflowRecovery: "Resume from last validated workflow step on failure",
      renderRecovery: "Preserve original; retry render with fallback resolution",
      exportRecovery: "Re-export from validated master with alternate format",
      rollbackStrategy: "Non-destructive rollback to original image and validated plans",
    };
  }

  private countMissingAssets(assets: ProductionAssetInventory): number {
    const all = [
      ...assets.originalImages,
      ...assets.logos,
      ...assets.fonts,
      ...assets.templates,
      ...assets.brandAssets,
    ];
    return all.filter((a) => a.status === "missing").length;
  }

  private buildRecommendations(
    deps: ProductionDependencyValidation,
    assets: ProductionAssetInventory,
    workflow: ProductionWorkflowPlanning,
    platform: ProductionImagePlatform
  ): ProductionImagePlanningRecommendation[] {
    const recs: ProductionImagePlanningRecommendation[] = [];

    const failed = deps.checks.filter((c) => c.required && c.status !== "passed");
    if (failed.length > 0) {
      recs.push({
        category: "dependency",
        suggestion: `Resolve ${failed.length} dependency issue(s) before production`,
        priority: "high",
        reason: failed.map((f) => f.moduleName).join(", "),
      });
    }

    if (assets.originalImages.some((a) => a.status !== "ready")) {
      recs.push({
        category: "asset",
        suggestion: "Validate original image asset before production",
        priority: "high",
        reason: "Original image required for non-destructive production",
      });
    }

    recs.push({
      category: "workflow",
      suggestion: workflow.renderingPreparation,
      priority: "medium",
      reason: "Production workflow sequencing prepared",
    });
    recs.push({
      category: "export",
      suggestion: "Primary export: PNG master, JPG/WEBP derivatives",
      priority: "medium",
      reason: "Multi-format export architecture ready",
    });
    recs.push({
      category: "platform",
      suggestion: `Platform production rules prepared for ${platform}`,
      priority: "low",
      reason: "Platform optimization planned",
    });
    recs.push({
      category: "recovery",
      suggestion: "Recovery plan prepared — rollback preserves original",
      priority: "low",
      reason: "Non-destructive production planning",
    });

    return recs;
  }
}
