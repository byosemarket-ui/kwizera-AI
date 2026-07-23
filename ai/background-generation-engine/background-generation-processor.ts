import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAssetType,
  ImageGenerationHealthLevel,
  ImageGenerationSource,
  ImageGenerationVerificationStatus,
} from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { BackgroundGenerationAnalyzer } from "./background-generation-analyzer.js";
import { BackgroundGenerationLinker } from "./background-generation-linker.js";
import { BackgroundGenerationLogger } from "./background-generation-logger.js";
import { BackgroundGenerationScorer } from "./background-generation-scorer.js";
import { BackgroundGenerationRecordStore } from "./background-generation-stores.js";
import {
  BackgroundGenerationInput,
  BackgroundGenerationRecord,
  BackgroundGenerationResult,
  BackgroundGenerationSearchQuery,
} from "./types.js";

export class BackgroundGenerationProcessor {
  constructor(
    private readonly foundation: AiImageGenerationFoundation,
    private readonly analyzer: BackgroundGenerationAnalyzer,
    private readonly scorer: BackgroundGenerationScorer,
    private readonly linker: BackgroundGenerationLinker,
    private readonly records: BackgroundGenerationRecordStore,
    private readonly logger: BackgroundGenerationLogger
  ) {}

  async generateBackgroundPlan(input: BackgroundGenerationInput): Promise<BackgroundGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(start, "Unable to resolve background context — provide sourceImageId, productId with pipeline, or productImagePlanId", [
          "Source image or product intelligence pipeline required",
        ]);
      }

      const sourceImageId = this.analyzer.resolveSourceImageId(input, context);
      if (!sourceImageId) {
        return this.reject(start, "Unable to resolve source image ID", ["sourceImageId or productImagePlanId required"]);
      }

      const platform = this.analyzer.resolvePlatform(input);
      const existing = this.records.getBySourceImage(sourceImageId).find((r) => r.profile.platform === platform);
      const version = existing ? existing.profile.version + 1 : 1;

      const profile = this.analyzer.buildProfile(input, platform, version, context, sourceImageId);
      const backgroundAnalysis = this.analyzer.analyzeBackground(context, input);
      const subjectPreservation = this.analyzer.buildSubjectPreservation(context);
      const generationPlan = this.analyzer.buildGenerationPlan(input, profile, context);
      const replacementPlan = this.analyzer.buildReplacementPlan(profile, input);
      const lightingMatching = this.analyzer.buildLightingMatching(backgroundAnalysis, context);
      const depthPlanning = this.analyzer.buildDepthPlanning(backgroundAnalysis);
      const qualityImprovement = this.analyzer.buildQualityImprovement(context);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        generationPlan,
        lightingMatching
      );
      const recommendations = this.analyzer.buildRecommendations(context, backgroundAnalysis);

      const scores = this.scorer.computeScores(
        backgroundAnalysis,
        subjectPreservation,
        generationPlan,
        lightingMatching,
        depthPlanning,
        qualityImprovement,
        replacementPlan,
        platformOptimizations,
        context
      );

      const validation = this.scorer.isBackgroundPlanValid(scores, {
        backgroundAnalysis,
        subjectPreservation,
        lightingMatching,
        depthPlanning,
        generationPlan,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(lightingMatching, generationPlan, subjectPreservation, validation.diagnostics);
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isBackgroundPlanValid(scores, {
          backgroundAnalysis,
          subjectPreservation,
          lightingMatching,
          depthPlanning,
          generationPlan,
        });
        if (!revalidation.valid) {
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Background plan validation failed — all validations must pass before approval",
          };
        }
      }

      const draftPartial: BackgroundGenerationRecord = {
        backgroundPlanId: profile.backgroundPlanId,
        profile,
        backgroundAnalysis,
        subjectPreservation,
        generationPlan,
        replacementPlan,
        lightingMatching,
        depthPlanning,
        qualityImprovement,
        platformOptimizations,
        productionInstructions,
        scores,
        relationships: {
          sourceImages: [],
          generatedImages: [],
          products: [],
          brands: [],
          campaigns: [],
          prompts: [],
          templates: [],
          knowledgeRecords: [],
          productImagePlans: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        brandConsistent: false,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      const productionReady = this.scorer.isProductionReady(scores, draftPartial);
      const brandConsistent = this.scorer.isBrandConsistent(context, generationPlan);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.backgroundPlanId}`,
        projectId: profile.projectId,
        name: `Background ${sourceImageId} ${platform}`,
      });

      const draft: BackgroundGenerationRecord = {
        ...draftPartial,
        blueprintId: blueprint.blueprintId,
        productionReady,
        brandConsistent,
        relationships: this.linker.detectRelationships(
          draftPartial,
          input,
          context.productImagePlan,
          context.creative,
          context.strategy,
          context.understanding
        ),
      };

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.backgroundQualityScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? ImageGenerationVerificationStatus.Verified
            : ImageGenerationVerificationStatus.Pending,
        source: ImageGenerationSource.ImageIntelligenceEngine,
        sourceRef: draft.backgroundPlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Background plan v${version} — ${profile.targetBackground}`,
            source: ImageGenerationSource.ImageIntelligenceEngine,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.sourceImages,
          ...draft.relationships.generatedImages,
          ...draft.relationships.products,
        ],
        healthStatus: ImageGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Image generation foundation validation failed for background plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft, input);

      this.logger.log("info", "background-analysis", "Background analyzed", {
        backgroundPlanId: draft.backgroundPlanId,
        type: backgroundAnalysis.backgroundType,
      });

      this.logger.log("info", "background-generation", "Background plan generated", {
        backgroundPlanId: draft.backgroundPlanId,
        target: profile.targetBackground,
        productionReady,
        durationMs: Date.now() - start,
      });

      this.logger.log("info", "lighting-matching", "Lighting matched", {
        backgroundPlanId: draft.backgroundPlanId,
        direction: lightingMatching.lightDirection.slice(0, 40),
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Background recommendations", {
          backgroundPlanId: draft.backgroundPlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: BackgroundGenerationSearchQuery): BackgroundGenerationRecord[] {
    let results = this.records.getAll();

    if (query.backgroundPlanId) results = results.filter((r) => r.backgroundPlanId === query.backgroundPlanId);
    if (query.sourceImageId) results = results.filter((r) => r.profile.sourceImageId === query.sourceImageId);
    if (query.productId) results = results.filter((r) => r.profile.productId === query.productId);
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.campaignId) results = results.filter((r) => r.profile.campaignId === query.campaignId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.targetBackground) results = results.filter((r) => r.profile.targetBackground === query.targetBackground);
    if (query.marketingPreset) results = results.filter((r) => r.profile.marketingPreset === query.marketingPreset);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.generationPlan.generationPrompt.toLowerCase().includes(kw) ||
          r.backgroundAnalysis.sceneEnvironment.toLowerCase().includes(kw) ||
          r.profile.productId.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.backgroundPlanId.toLowerCase().includes(textLower) ||
          r.generationPlan.generationPrompt.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: BackgroundGenerationInput) {
    const bridge = this.foundation.integration;
    const productFoundation = bridge.getProductIntelligenceFoundation();

    let productImagePlan = null;
    if (input.productImagePlanId) {
      productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlan(input.productImagePlanId);
    } else if (input.sourceImageId) {
      productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlan(input.sourceImageId);
    } else if (input.productId) {
      const plans = this.foundation.getProductImageGenerationEngine().getProductImagePlansByProduct(input.productId);
      productImagePlan = plans[0] ?? null;
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
          productImagePlan
        );
      }
    }

    if (input.sourceImageId || productImagePlan) {
      return this.analyzer.extractContextFromProduct(null, null, null, null, input, productImagePlan);
    }

    return null;
  }

  private registerGenerationAssets(record: BackgroundGenerationRecord, input: BackgroundGenerationInput): void {
    const registry = this.foundation.getAssetRegistry();

    registry.registerAsset({
      assetId: record.profile.sourceImageId,
      assetType: ImageGenerationAssetType.Image,
      assetName: `Source for background ${record.profile.targetBackground}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
      qualityScore: record.scores.subjectPreservationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: record.relationships.sourceImages,
      relatedProducts: record.relationships.products,
    });

    registry.registerAsset({
      assetId: record.profile.generatedBackgroundId,
      assetType: ImageGenerationAssetType.Background,
      assetName: `Generated Background v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
      qualityScore: record.scores.backgroundQualityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.generatedImages, ...record.relationships.sourceImages],
      relatedProducts: record.relationships.products,
    });

    if (input.subjectMaskId) {
      registry.registerAsset({
        assetId: input.subjectMaskId,
        assetType: ImageGenerationAssetType.Mask,
        assetName: "Subject preservation mask",
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
        qualityScore: record.scores.subjectPreservationScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.backgroundPlanId],
      });
    }

    for (const variation of record.replacementPlan.variations) {
      registry.registerAsset({
        assetId: variation.variationId,
        assetType: ImageGenerationAssetType.Variation,
        assetName: variation.label,
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
        qualityScore: record.scores.backgroundQualityScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.backgroundPlanId],
      });
    }
  }

  private applySafeRepairs(
    lighting: { lightDirection: string; shadowConsistency: string },
    generation: { generationPrompt: string },
    preservation: { identityLock: boolean; productLock: boolean },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Lighting"))) {
      if (!lighting.shadowConsistency || lighting.shadowConsistency.length < 5) {
        lighting.shadowConsistency = "Shadow matched to key light direction with consistent opacity";
        repairs.push("Default shadow consistency applied");
      }
    }
    if (diagnostics.some((d) => d.includes("generation plan"))) {
      if (!generation.generationPrompt || generation.generationPrompt.length < 10) {
        generation.generationPrompt = "Professional background replacement with subject preservation";
        repairs.push("Default generation prompt applied");
      }
    }
    if (diagnostics.some((d) => d.includes("preservation"))) {
      preservation.identityLock = true;
      preservation.productLock = true;
      repairs.push("Preservation locks enforced");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): BackgroundGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
