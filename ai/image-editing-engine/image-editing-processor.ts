import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAssetType,
  ImageGenerationHealthLevel,
  ImageGenerationSource,
  ImageGenerationVerificationStatus,
} from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { ImageEditingAnalyzer } from "./image-editing-analyzer.js";
import { ImageEditingLinker } from "./image-editing-linker.js";
import { ImageEditingLogger } from "./image-editing-logger.js";
import { ImageEditingScorer } from "./image-editing-scorer.js";
import { ImageEditingRecordStore } from "./image-editing-stores.js";
import {
  ImageEditingInput,
  ImageEditingRecord,
  ImageEditingResult,
  ImageEditingSearchQuery,
} from "./types.js";

export class ImageEditingProcessor {
  constructor(
    private readonly foundation: AiImageGenerationFoundation,
    private readonly analyzer: ImageEditingAnalyzer,
    private readonly scorer: ImageEditingScorer,
    private readonly linker: ImageEditingLinker,
    private readonly records: ImageEditingRecordStore,
    private readonly logger: ImageEditingLogger
  ) {}

  async generateEditingPlan(input: ImageEditingInput): Promise<ImageEditingResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(
          start,
          "Unable to resolve editing context — provide sourceImageId, productId with pipeline, productImagePlanId, or backgroundPlanId",
          ["Source image or product intelligence pipeline required"]
        );
      }

      const sourceImageId = this.analyzer.resolveSourceImageId(input, context);
      if (!sourceImageId) {
        return this.reject(start, "Unable to resolve source image ID", ["sourceImageId or upstream plan ID required"]);
      }

      const platform = this.analyzer.resolvePlatform(input);
      const existing = this.records.getBySourceImage(sourceImageId).find((r) => r.profile.platform === platform);
      const version = existing ? existing.profile.version + 1 : 1;

      const profile = this.analyzer.buildProfile(input, platform, version, context, sourceImageId);
      const imageAnalysis = this.analyzer.analyzeImage(context, input);
      const editingOperations = this.analyzer.buildEditingOperations(input, profile, context);
      const inpaintingPlan = this.analyzer.buildInpaintingPlan(input, profile);
      const outpaintingPlan = this.analyzer.buildOutpaintingPlan(input, profile);
      const maskManagement = this.analyzer.buildMaskManagement(input, context);
      const identityPreservation = this.analyzer.buildIdentityPreservation(context);
      const nonDestructiveEditing = this.analyzer.buildNonDestructiveEditing(profile, existing ?? null);
      const qualityImprovement = this.analyzer.buildQualityImprovement(context);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        editingOperations,
        maskManagement
      );
      const recommendations = this.analyzer.buildRecommendations(context, imageAnalysis);

      const scores = this.scorer.computeScores(
        imageAnalysis,
        editingOperations,
        inpaintingPlan,
        outpaintingPlan,
        identityPreservation,
        maskManagement,
        qualityImprovement,
        nonDestructiveEditing,
        platformOptimizations,
        context
      );

      const validation = this.scorer.isEditingPlanValid(scores, {
        imageAnalysis,
        editingOperations,
        inpaintingPlan,
        outpaintingPlan,
        maskManagement,
        identityPreservation,
        nonDestructiveEditing,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(
          inpaintingPlan,
          editingOperations,
          identityPreservation,
          nonDestructiveEditing,
          validation.diagnostics
        );
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isEditingPlanValid(scores, {
          imageAnalysis,
          editingOperations,
          inpaintingPlan,
          outpaintingPlan,
          maskManagement,
          identityPreservation,
          nonDestructiveEditing,
        });
        if (!revalidation.valid) {
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Image editing plan validation failed — all validations must pass before approval",
          };
        }
      }

      const draftPartial: ImageEditingRecord = {
        imageEditingPlanId: profile.imageEditingPlanId,
        profile,
        imageAnalysis,
        editingOperations,
        inpaintingPlan,
        outpaintingPlan,
        maskManagement,
        identityPreservation,
        nonDestructiveEditing,
        qualityImprovement,
        platformOptimizations,
        productionInstructions,
        scores,
        relationships: {
          sourceImages: [],
          editedImages: [],
          products: [],
          brands: [],
          campaigns: [],
          prompts: [],
          masks: [],
          knowledgeRecords: [],
          backgroundPlans: [],
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
      const brandConsistent = this.scorer.isBrandConsistent(context, editingOperations);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.imageEditingPlanId}`,
        projectId: profile.projectId,
        name: `Image Edit ${sourceImageId} ${platform}`,
      });

      const draft: ImageEditingRecord = {
        ...draftPartial,
        blueprintId: blueprint.blueprintId,
        productionReady,
        brandConsistent,
        relationships: this.linker.detectRelationships(
          draftPartial,
          input,
          context.productImagePlan,
          context.backgroundPlan,
          context.creative,
          context.strategy,
          context.understanding
        ),
      };

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.editingQualityScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? ImageGenerationVerificationStatus.Verified
            : ImageGenerationVerificationStatus.Pending,
        source: ImageGenerationSource.UserInput,
        sourceRef: draft.imageEditingPlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Image editing plan v${version} — ${profile.primaryOperation}`,
            source: ImageGenerationSource.UserInput,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.sourceImages,
          ...draft.relationships.editedImages,
          ...draft.relationships.products,
        ],
        healthStatus: ImageGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Image generation foundation validation failed for editing plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft, input);

      this.logger.log("info", "image-analysis", "Image analyzed for editing", {
        imageEditingPlanId: draft.imageEditingPlanId,
        subject: imageAnalysis.subject.slice(0, 40),
      });

      this.logger.log("info", "editing-operation", "Editing plan generated", {
        imageEditingPlanId: draft.imageEditingPlanId,
        operation: profile.primaryOperation,
        productionReady,
        durationMs: Date.now() - start,
      });

      this.logger.log("info", "inpainting", "Inpainting plan prepared", {
        imageEditingPlanId: draft.imageEditingPlanId,
        type: inpaintingPlan.inpaintingType,
      });

      this.logger.log("info", "outpainting", "Outpainting plan prepared", {
        imageEditingPlanId: draft.imageEditingPlanId,
        type: outpaintingPlan.outpaintingType,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Editing recommendations", {
          imageEditingPlanId: draft.imageEditingPlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: ImageEditingSearchQuery): ImageEditingRecord[] {
    let results = this.records.getAll();

    if (query.imageEditingPlanId) results = results.filter((r) => r.imageEditingPlanId === query.imageEditingPlanId);
    if (query.sourceImageId) results = results.filter((r) => r.profile.sourceImageId === query.sourceImageId);
    if (query.productId) results = results.filter((r) => r.profile.productId === query.productId);
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.campaignId) results = results.filter((r) => r.profile.campaignId === query.campaignId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.primaryOperation) results = results.filter((r) => r.profile.primaryOperation === query.primaryOperation);
    if (query.inpaintingType) results = results.filter((r) => r.profile.inpaintingType === query.inpaintingType);
    if (query.outpaintingType) results = results.filter((r) => r.profile.outpaintingType === query.outpaintingType);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.editingOperations.operationPrompts[r.profile.primaryOperation]?.toLowerCase().includes(kw) ||
          r.imageAnalysis.subject.toLowerCase().includes(kw) ||
          r.profile.productId.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.imageEditingPlanId.toLowerCase().includes(textLower) ||
          r.imageAnalysis.subject.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: ImageEditingInput) {
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

    let backgroundPlan = null;
    if (input.backgroundPlanId) {
      backgroundPlan = this.foundation.getBackgroundGenerationEngine().getBackgroundPlan(input.backgroundPlanId);
    } else if (productImagePlan) {
      const bgPlans = this.foundation
        .getBackgroundGenerationEngine()
        .getBackgroundPlansBySourceImage(productImagePlan.productImagePlanId);
      backgroundPlan = bgPlans[0] ?? null;
    }

    if (input.productId && productFoundation) {
      const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
      const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
      const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
      const creative = creativeRecords[0] ?? null;
      const strategy = creative
        ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
        : null;

      if (analysis || understanding || productImagePlan || backgroundPlan) {
        return this.analyzer.extractContextFromProduct(
          analysis,
          understanding,
          creative,
          strategy,
          input,
          productImagePlan,
          backgroundPlan
        );
      }
    }

    if (input.sourceImageId || productImagePlan || backgroundPlan) {
      return this.analyzer.extractContextFromProduct(
        null,
        null,
        null,
        null,
        input,
        productImagePlan,
        backgroundPlan
      );
    }

    return null;
  }

  private registerGenerationAssets(record: ImageEditingRecord, input: ImageEditingInput): void {
    const registry = this.foundation.getAssetRegistry();

    registry.registerAsset({
      assetId: record.profile.sourceImageId,
      assetType: ImageGenerationAssetType.Image,
      assetName: `Source for edit ${record.profile.primaryOperation}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.UserInput),
      qualityScore: record.scores.identityPreservationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: record.relationships.sourceImages,
      relatedProducts: record.relationships.products,
    });

    registry.registerAsset({
      assetId: record.profile.editedImageId,
      assetType: ImageGenerationAssetType.Layer,
      assetName: `Edited Image v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.UserInput),
      qualityScore: record.scores.editingQualityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.editedImages, ...record.relationships.sourceImages],
      relatedProducts: record.relationships.products,
    });

    for (const maskId of record.relationships.masks) {
      registry.registerAsset({
        assetId: maskId,
        assetType: ImageGenerationAssetType.Mask,
        assetName: "Editing mask",
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.UserInput),
        qualityScore: record.scores.identityPreservationScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.imageEditingPlanId],
      });
    }

    if (input.styleReferenceIds?.length) {
      for (const refId of input.styleReferenceIds) {
        registry.registerAsset({
          assetId: refId,
          assetType: ImageGenerationAssetType.Style,
          assetName: "Style reference for editing",
          projectId: record.profile.projectId,
          ...createDefaultGenerationAssetQuality(ImageGenerationSource.UserInput),
          qualityScore: record.scores.editingQualityScore,
          confidenceScore: record.scores.aiConfidenceScore,
          relationshipLinks: [record.imageEditingPlanId],
        });
      }
    }
  }

  private applySafeRepairs(
    inpainting: { reconstructionStrategy: string },
    operations: { operationPrompts: Record<string, string> },
    preservation: { identityLock: boolean; productLock: boolean },
    nonDestructive: { originalPreserved: boolean },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Inpainting"))) {
      if (!inpainting.reconstructionStrategy || inpainting.reconstructionStrategy.length < 10) {
        inpainting.reconstructionStrategy = "Texture-aware inpainting with pattern continuity and detail recovery";
        repairs.push("Default inpainting strategy applied");
      }
    }
    if (diagnostics.some((d) => d.includes("operations"))) {
      const firstKey = Object.keys(operations.operationPrompts)[0];
      if (!firstKey || operations.operationPrompts[firstKey].length < 10) {
        operations.operationPrompts["object-replacement"] =
          "Professional image editing with subject and brand preservation";
        repairs.push("Default editing prompt applied");
      }
    }
    if (diagnostics.some((d) => d.includes("preservation"))) {
      preservation.identityLock = true;
      preservation.productLock = true;
      repairs.push("Identity preservation locks enforced");
    }
    if (diagnostics.some((d) => d.includes("Non-destructive"))) {
      nonDestructive.originalPreserved = true;
      repairs.push("Original preservation enforced");
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): ImageEditingResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
