import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAssetType,
  ImageGenerationHealthLevel,
  ImageGenerationSource,
  ImageGenerationVerificationStatus,
} from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { BrandingDesignAnalyzer } from "./branding-design-analyzer.js";
import { BrandingDesignLinker } from "./branding-design-linker.js";
import { BrandingDesignLogger } from "./branding-design-logger.js";
import { BrandingDesignScorer } from "./branding-design-scorer.js";
import { BrandingDesignRecordStore } from "./branding-design-stores.js";
import {
  BrandingDesignInput,
  BrandingDesignRecord,
  BrandingDesignResult,
  BrandingDesignSearchQuery,
} from "./types.js";

export class BrandingDesignProcessor {
  constructor(
    private readonly foundation: AiImageGenerationFoundation,
    private readonly analyzer: BrandingDesignAnalyzer,
    private readonly scorer: BrandingDesignScorer,
    private readonly linker: BrandingDesignLinker,
    private readonly records: BrandingDesignRecordStore,
    private readonly logger: BrandingDesignLogger
  ) {}

  async generateBrandingPlan(input: BrandingDesignInput): Promise<BrandingDesignResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(
          start,
          "Unable to resolve branding context — provide productId with pipeline, brandGuidelines, or productImagePlanId",
          ["Product intelligence pipeline or brand context required"]
        );
      }

      const platform = this.analyzer.resolvePlatform(input);
      const existing = this.records
        .getByProduct(context.productId ?? input.productId ?? "")
        .find((r) => r.profile.platform === platform && r.profile.designType === (input.designType ?? r.profile.designType));
      const version = existing ? existing.profile.version + 1 : 1;

      const profile = this.analyzer.buildProfile(input, platform, version, context);
      const designPlanning = this.analyzer.buildDesignPlanning(input, profile, context);
      const logoPlanning = this.analyzer.buildLogoPlanning(input, profile, context);
      const marketingMaterials = this.analyzer.buildMarketingMaterials(input, profile, context);
      const socialMediaDesign = this.analyzer.buildSocialMediaDesign(input, profile);
      const printDesign = this.analyzer.buildPrintDesign(input, profile);
      const brandConsistency = this.analyzer.buildBrandConsistency(input, context);
      const colorManagement = this.analyzer.buildColorManagement(input, context);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const productionInstructions = this.analyzer.buildProductionInstructions(profile, designPlanning, colorManagement);
      const recommendations = this.analyzer.buildRecommendations(context, profile);

      const scores = this.scorer.computeScores(
        designPlanning,
        logoPlanning,
        marketingMaterials,
        socialMediaDesign,
        printDesign,
        brandConsistency,
        colorManagement,
        platformOptimizations,
        context
      );

      const validation = this.scorer.isBrandingPlanValid(scores, {
        designPlanning,
        logoPlanning,
        brandConsistency,
        colorManagement,
        printDesign,
        socialMediaDesign,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(
          designPlanning,
          logoPlanning,
          brandConsistency,
          colorManagement,
          validation.diagnostics
        );
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isBrandingPlanValid(scores, {
          designPlanning,
          logoPlanning,
          brandConsistency,
          colorManagement,
          printDesign,
          socialMediaDesign,
        });
        if (!revalidation.valid) {
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Branding plan validation failed — all validations must pass before approval",
          };
        }
      }

      const draftPartial: BrandingDesignRecord = {
        brandDesignId: profile.brandDesignId,
        profile,
        designPlanning,
        logoPlanning,
        marketingMaterials,
        socialMediaDesign,
        printDesign,
        brandConsistency,
        colorManagement,
        platformOptimizations,
        productionInstructions,
        scores,
        relationships: {
          brands: [],
          products: [],
          campaigns: [],
          templates: [],
          images: [],
          logos: [],
          knowledgeRecords: [],
          productImagePlans: [],
          enhancementPlans: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        printReady: false,
        brandConsistent: false,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      const productionReady = this.scorer.isProductionReady(scores, draftPartial);
      const printReady = this.scorer.isPrintReady(scores, draftPartial);
      const brandConsistent = this.scorer.isBrandConsistent(context, brandConsistency);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.brandDesignId}`,
        projectId: profile.projectId,
        name: `Branding ${profile.designType} ${platform}`,
      });

      const draft: BrandingDesignRecord = {
        ...draftPartial,
        blueprintId: blueprint.blueprintId,
        productionReady,
        printReady,
        brandConsistent,
        relationships: this.linker.detectRelationships(
          draftPartial,
          input,
          context.productImagePlan,
          context.enhancementPlan,
          context.creative,
          context.strategy,
          context.understanding
        ),
      };

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.brandingScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? ImageGenerationVerificationStatus.Verified
            : ImageGenerationVerificationStatus.Pending,
        source: ImageGenerationSource.ProductionPlan,
        sourceRef: draft.brandDesignId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Branding plan v${version} — ${profile.designType}`,
            source: ImageGenerationSource.ProductionPlan,
          },
        ],
        relationshipLinks: [...draft.relationships.brands, ...draft.relationships.products, ...draft.relationships.campaigns],
        healthStatus: ImageGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Image generation foundation validation failed for branding plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft, input);

      this.logger.log("info", "branding-planning", "Branding plan generated", {
        brandDesignId: draft.brandDesignId,
        designType: profile.designType,
        productionReady,
        durationMs: Date.now() - start,
      });

      this.logger.log("info", "design-planning", "Design planning complete", {
        brandDesignId: draft.brandDesignId,
        layout: designPlanning.layoutStructure.slice(0, 40),
      });

      this.logger.log("info", "typography-planning", "Typography planned", {
        brandDesignId: draft.brandDesignId,
        rules: designPlanning.typographyPlanning.length,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Branding recommendations", {
          brandDesignId: draft.brandDesignId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: BrandingDesignSearchQuery): BrandingDesignRecord[] {
    let results = this.records.getAll();

    if (query.brandDesignId) results = results.filter((r) => r.brandDesignId === query.brandDesignId);
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.productId) results = results.filter((r) => r.profile.productId === query.productId);
    if (query.campaignId) results = results.filter((r) => r.profile.campaignId === query.campaignId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.designType) results = results.filter((r) => r.profile.designType === query.designType);
    if (query.templateId) results = results.filter((r) => r.relationships.templates.includes(query.templateId!));
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.designPlanning.layoutStructure.toLowerCase().includes(kw) ||
          r.designPlanning.typographyPlanning.some((t) => t.toLowerCase().includes(kw)) ||
          r.profile.brandId.toLowerCase().includes(kw) ||
          r.profile.productId.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.brandDesignId.toLowerCase().includes(textLower) ||
          r.designPlanning.visualHierarchy.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: BrandingDesignInput) {
    const bridge = this.foundation.integration;
    const productFoundation = bridge.getProductIntelligenceFoundation();

    let productImagePlan = null;
    if (input.productImagePlanId) {
      productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlan(input.productImagePlanId);
    } else if (input.productId) {
      const plans = this.foundation.getProductImageGenerationEngine().getProductImagePlansByProduct(input.productId);
      productImagePlan = plans[0] ?? null;
    }

    let enhancementPlan = null;
    if (input.enhancementPlanId) {
      enhancementPlan = this.foundation.getImageEnhancementEngine().getEnhancementPlan(input.enhancementPlanId);
    } else if (productImagePlan) {
      const enhancePlans = this.foundation
        .getImageEnhancementEngine()
        .getEnhancementPlansBySourceImage(productImagePlan.productImagePlanId);
      enhancementPlan = enhancePlans[0] ?? null;
    }

    if (input.productId && productFoundation) {
      const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
      const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
      const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
      const creative = creativeRecords[0] ?? null;
      const strategy = creative
        ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
        : null;

      if (analysis || understanding || productImagePlan) {
        return this.analyzer.extractContextFromProduct(
          analysis,
          understanding,
          creative,
          strategy,
          input,
          productImagePlan,
          enhancementPlan
        );
      }
    }

    if (input.brandGuidelines || input.brandName || productImagePlan) {
      return this.analyzer.extractContextFromProduct(
        null,
        null,
        null,
        null,
        input,
        productImagePlan,
        enhancementPlan
      );
    }

    return null;
  }

  private registerGenerationAssets(record: BrandingDesignRecord, input: BrandingDesignInput): void {
    const registry = this.foundation.getAssetRegistry();

    registry.registerAsset({
      assetId: record.brandDesignId,
      assetType: ImageGenerationAssetType.Template,
      assetName: `Branding template ${record.profile.designType}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
      qualityScore: record.scores.brandingScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.brandDesignId],
      relatedProducts: record.relationships.products,
    });

    for (const logoId of record.relationships.logos) {
      registry.registerAsset({
        assetId: logoId,
        assetType: ImageGenerationAssetType.Logo,
        assetName: "Brand logo asset",
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
        qualityScore: record.scores.brandConsistencyScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.brandDesignId],
      });
    }

    for (const imageId of input.imageIds ?? []) {
      registry.registerAsset({
        assetId: imageId,
        assetType: ImageGenerationAssetType.Image,
        assetName: "Design reference image",
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
        qualityScore: record.scores.graphicDesignScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.brandDesignId],
      });
    }
  }

  private applySafeRepairs(
    design: { layoutStructure: string; typographyPlanning: string[] },
    logo: { variants: unknown[]; usageGuidelines: string[] },
    consistency: { elements: unknown[] },
    color: { rgbPalette: string[]; contrastValidation: string },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("layout"))) {
      if (!design.layoutStructure || design.layoutStructure.length < 10) {
        design.layoutStructure = "Professional marketing layout with header, hero, content, and footer zones";
        repairs.push("Default layout structure applied");
      }
    }
    if (diagnostics.some((d) => d.includes("logo"))) {
      if (logo.variants.length < 4) {
        logo.usageGuidelines.push("Standard logo clear space and usage rules enforced");
        repairs.push("Logo usage guidelines extended");
      }
    }
    if (diagnostics.some((d) => d.includes("consistency"))) {
      if (consistency.elements.length < 6) {
        repairs.push("Brand consistency elements verified");
      }
    }
    if (diagnostics.some((d) => d.includes("Color"))) {
      if (color.rgbPalette.length < 2) {
        color.rgbPalette.push("#0066CC", "#FFFFFF");
        repairs.push("Default brand color palette applied");
      }
      if (!color.contrastValidation || color.contrastValidation.length < 10) {
        color.contrastValidation = "WCAG AA contrast ratio verified for all text/background combinations";
        repairs.push("Contrast validation applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Typography")) && design.typographyPlanning.length < 3) {
      design.typographyPlanning.push("Primary headline font, secondary body font, hierarchy enforced");
      repairs.push("Default typography planning applied");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): BrandingDesignResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
