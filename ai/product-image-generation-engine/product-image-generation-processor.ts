import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAssetType,
  ImageGenerationHealthLevel,
  ImageGenerationSource,
  ImageGenerationVerificationStatus,
} from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { ProductImageGenerationAnalyzer } from "./product-image-generation-analyzer.js";
import { ProductImageGenerationLinker } from "./product-image-generation-linker.js";
import { ProductImageGenerationLogger } from "./product-image-generation-logger.js";
import { ProductImageGenerationScorer } from "./product-image-generation-scorer.js";
import { ProductImageGenerationRecordStore } from "./product-image-generation-stores.js";
import {
  ProductImageGenerationInput,
  ProductImageGenerationRecord,
  ProductImageGenerationResult,
  ProductImageGenerationSearchQuery,
} from "./types.js";

export class ProductImageGenerationProcessor {
  constructor(
    private readonly foundation: AiImageGenerationFoundation,
    private readonly analyzer: ProductImageGenerationAnalyzer,
    private readonly scorer: ProductImageGenerationScorer,
    private readonly linker: ProductImageGenerationLinker,
    private readonly records: ProductImageGenerationRecordStore,
    private readonly logger: ProductImageGenerationLogger
  ) {}

  async generateProductImagePlan(input: ProductImageGenerationInput): Promise<ProductImageGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      if (!input.productId) {
        return this.reject(start, "Product ID is required for product image generation", ["productId required"]);
      }

      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(start, "Unable to resolve product context — run product intelligence pipeline first", [
          "Product analysis and understanding required",
        ]);
      }

      const platform = this.analyzer.resolvePlatform(input, context);
      const existing = this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform);
      const version = existing ? existing.profile.version + 1 : 1;

      const profile = this.analyzer.buildProfile(input, platform, version, context);
      const presentationPlan = this.analyzer.buildPresentationPlan(context);
      const photographyPlan = this.analyzer.buildPhotographyPlan(input, context);
      const backgroundPlan = this.analyzer.buildBackgroundPlan(input, context);
      const lightingPlan = this.analyzer.buildLightingPlan(context);
      const consistencyPlan = this.analyzer.buildConsistencyPlan(context);
      const marketingVariations = this.analyzer.buildMarketingVariations(profile, input);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        presentationPlan,
        photographyPlan,
        lightingPlan
      );
      const recommendations = this.analyzer.buildRecommendations(context, consistencyPlan);

      const scores = this.scorer.computeScores(
        presentationPlan,
        photographyPlan,
        backgroundPlan,
        lightingPlan,
        consistencyPlan,
        marketingVariations,
        platformOptimizations,
        context
      );

      const validation = this.scorer.isProductImagePlanValid(scores, {
        presentationPlan,
        photographyPlan,
        lightingPlan,
        backgroundPlan,
        consistencyPlan,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(lightingPlan, backgroundPlan, consistencyPlan, validation.diagnostics);
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isProductImagePlanValid(scores, {
          presentationPlan,
          photographyPlan,
          lightingPlan,
          backgroundPlan,
          consistencyPlan,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Product image plan rejected", {
            diagnostics: revalidation.diagnostics,
          });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Product image plan validation failed — all validations must pass before approval",
          };
        }
      }

      const draftPartial: ProductImageGenerationRecord = {
        productImagePlanId: profile.productImagePlanId,
        profile,
        presentationPlan,
        photographyPlan,
        backgroundPlan,
        lightingPlan,
        consistencyPlan,
        marketingVariations,
        platformOptimizations,
        productionInstructions,
        scores,
        relationships: {
          products: [],
          brands: [],
          campaigns: [],
          sourceImages: [],
          generatedImages: [],
          templates: [],
          knowledgeRecords: [],
          textToImagePlans: [],
          imageToImagePlans: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        marketplaceReady: false,
        brandConsistent: false,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      const productionReady = this.scorer.isProductionReady(scores, draftPartial);
      const marketplaceReady = this.scorer.isMarketplaceReady(scores, draftPartial);
      const brandConsistent = this.scorer.isBrandConsistent(context, consistencyPlan);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.productImagePlanId}`,
        projectId: profile.projectId,
        name: `Product Image ${context.productName} ${platform}`,
      });

      const draft: ProductImageGenerationRecord = {
        ...draftPartial,
        blueprintId: blueprint.blueprintId,
        productionReady,
        marketplaceReady,
        brandConsistent,
        relationships: this.linker.detectRelationships(
          draftPartial,
          input,
          context.creative,
          context.strategy,
          context.understanding
        ),
      };

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.productPresentationScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? ImageGenerationVerificationStatus.Verified
            : ImageGenerationVerificationStatus.Pending,
        source: ImageGenerationSource.ProductIntelligenceEngine,
        sourceRef: draft.productImagePlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Product image plan v${version} — ${platform} ${context.productCategory}`,
            source: ImageGenerationSource.ProductIntelligenceEngine,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.generatedImages,
          ...draft.relationships.brands,
        ],
        healthStatus: ImageGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Image generation foundation validation failed for product image plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "product-planning", "Product image plan generated", {
        productImagePlanId: draft.productImagePlanId,
        views: presentationPlan.views.length,
        productionReady,
        marketplaceReady,
        durationMs: Date.now() - start,
      });

      this.logger.log("info", "photography-planning", "Photography plan created", {
        productImagePlanId: draft.productImagePlanId,
        modes: photographyPlan.modes.length,
      });

      this.logger.log("info", "background-planning", "Background plan created", {
        productImagePlanId: draft.productImagePlanId,
        background: backgroundPlan.primaryBackground,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Product image recommendations", {
          productImagePlanId: draft.productImagePlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: ProductImageGenerationSearchQuery): ProductImageGenerationRecord[] {
    let results = this.records.getAll();

    if (query.productImagePlanId) {
      results = results.filter((r) => r.productImagePlanId === query.productImagePlanId);
    }
    if (query.productId) results = results.filter((r) => r.profile.productId === query.productId);
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.campaignId) results = results.filter((r) => r.profile.campaignId === query.campaignId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.productCategory) results = results.filter((r) => r.profile.productCategory === query.productCategory);
    if (query.photographyMode) {
      results = results.filter((r) => r.photographyPlan.primaryMode === query.photographyMode);
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.productId.toLowerCase().includes(kw) ||
          r.presentationPlan.showcaseLayout.toLowerCase().includes(kw) ||
          r.profile.productCategory.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.productImagePlanId.toLowerCase().includes(textLower) ||
          r.profile.productId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: ProductImageGenerationInput) {
    const bridge = this.foundation.integration;
    const productFoundation = bridge.getProductIntelligenceFoundation();
    if (!productFoundation) return null;

    const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
    const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
    const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
    const creative = creativeRecords[0] ?? null;
    const strategy = creative
      ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
      : null;

    return this.analyzer.extractContextFromProduct(analysis, understanding, creative, strategy, input);
  }

  private registerGenerationAssets(record: ProductImageGenerationRecord): void {
    const registry = this.foundation.getAssetRegistry();

    registry.registerAsset({
      assetId: record.productImagePlanId,
      assetType: ImageGenerationAssetType.ProductImage,
      assetName: `Product Image Plan ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductIntelligenceEngine),
      qualityScore: record.scores.productPresentationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.products, ...record.relationships.generatedImages],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    for (const view of record.presentationPlan.views) {
      registry.registerAsset({
        assetId: `${record.productImagePlanId}-${view.view}`,
        assetType: ImageGenerationAssetType.Image,
        assetName: `${view.view} — ${record.profile.productId}`,
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductIntelligenceEngine),
        qualityScore: record.scores.photographyScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.productImagePlanId],
        relatedProducts: record.relationships.products,
      });
    }

    registry.registerAsset({
      assetId: `gen-${record.productImagePlanId}`,
      assetType: ImageGenerationAssetType.Image,
      assetName: `Generated Product Images v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductIntelligenceEngine),
      qualityScore: record.scores.marketplaceReadinessScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: record.relationships.generatedImages,
      relatedProducts: record.relationships.products,
    });
  }

  private applySafeRepairs(
    lightingPlan: { studioLighting: string },
    backgroundPlan: { backgroundDescription: string },
    consistencyPlan: { rules: unknown[]; shapeLock: boolean; colorLock: boolean },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Studio lighting"))) {
      if (!lightingPlan.studioLighting || lightingPlan.studioLighting.length < 5) {
        lightingPlan.studioLighting = "Three-point studio lighting with soft key, fill, and hair light";
        repairs.push("Default studio lighting applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Background plan"))) {
      if (!backgroundPlan.backgroundDescription || backgroundPlan.backgroundDescription.length < 10) {
        backgroundPlan.backgroundDescription = "Professional studio background for e-commerce product photography";
        repairs.push("Default background description applied");
      }
    }
    if (diagnostics.some((d) => d.includes("consistency rules"))) {
      consistencyPlan.shapeLock = true;
      consistencyPlan.colorLock = true;
      repairs.push("Default consistency locks enforced");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): ProductImageGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
