import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAssetType,
  ImageGenerationHealthLevel,
  ImageGenerationSource,
  ImageGenerationVerificationStatus,
} from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { TextToImageGenerationAnalyzer } from "./text-to-image-generation-analyzer.js";
import { TextToImageGenerationLinker } from "./text-to-image-generation-linker.js";
import { TextToImageGenerationLogger } from "./text-to-image-generation-logger.js";
import { TextToImageGenerationScorer } from "./text-to-image-generation-scorer.js";
import { TextToImageGenerationRecordStore } from "./text-to-image-generation-stores.js";
import {
  TextToImageGenerationInput,
  TextToImageGenerationRecord,
  TextToImageGenerationResult,
  TextToImageSearchQuery,
} from "./types.js";

export class TextToImageGenerationProcessor {
  constructor(
    private readonly foundation: AiImageGenerationFoundation,
    private readonly analyzer: TextToImageGenerationAnalyzer,
    private readonly scorer: TextToImageGenerationScorer,
    private readonly linker: TextToImageGenerationLinker,
    private readonly records: TextToImageGenerationRecordStore,
    private readonly logger: TextToImageGenerationLogger
  ) {}

  async generateImagePlan(input: TextToImageGenerationInput): Promise<TextToImageGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(start, "Unable to resolve generation context — provide productId or textPrompt", [
          "Product intelligence pipeline or text prompt required",
        ]);
      }

      const platform = this.analyzer.resolvePlatform(input, context);
      const existing = input.productId
        ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
        : undefined;
      const version = existing ? existing.profile.version + 1 : 1;

      const promptAnalysis = this.analyzer.analyzePrompt(input, context);
      const profile = this.analyzer.buildProfile(input, platform, version, context, promptAnalysis);
      const compositionPlan = this.analyzer.buildCompositionPlan(promptAnalysis, context, input);
      const lightingPlan = this.analyzer.buildLightingPlan(promptAnalysis, profile.style);
      const stylePlan = this.analyzer.buildStylePlan(promptAnalysis, context, input);
      const colorPlan = this.analyzer.buildColorPlan(promptAnalysis, context);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const variations = input.generateVariations !== false
        ? this.analyzer.buildVariations(profile, compositionPlan)
        : this.analyzer.buildVariations(profile, compositionPlan).slice(0, 1);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        compositionPlan,
        lightingPlan
      );
      const recommendations = this.analyzer.buildRecommendations(promptAnalysis, compositionPlan, context);

      const scores = this.scorer.computeScores(
        promptAnalysis,
        compositionPlan,
        lightingPlan,
        stylePlan,
        colorPlan,
        platformOptimizations,
        variations,
        context
      );

      const validation = this.scorer.isImagePlanValid(scores, {
        promptAnalysis,
        compositionPlan,
        lightingPlan,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(promptAnalysis, compositionPlan, lightingPlan, validation.diagnostics);
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isImagePlanValid(scores, {
          promptAnalysis,
          compositionPlan,
          lightingPlan,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Image plan generation rejected", {
            diagnostics: revalidation.diagnostics,
          });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Image plan validation failed — all validations must pass before approval",
          };
        }
      }

      const productionReady = this.scorer.isProductionReady(scores, {
        imagePlanId: profile.imagePlanId,
        profile,
        promptAnalysis,
        compositionPlan,
        lightingPlan,
        stylePlan,
        colorPlan,
        platformOptimizations,
        variations,
        productionInstructions,
        scores,
        relationships: {
          prompts: [],
          products: [],
          brands: [],
          campaigns: [],
          images: [],
          knowledgeRecords: [],
          productionPlans: [],
          creativeDirections: [],
          marketingStrategies: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        brandConsistent: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      const brandConsistent = this.scorer.isBrandConsistent(context, colorPlan, stylePlan);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.imagePlanId}`,
        projectId: profile.projectId,
        name: `Text-to-Image ${profile.productId} ${platform}`,
      });

      const draft: TextToImageGenerationRecord = {
        imagePlanId: profile.imagePlanId,
        profile,
        promptAnalysis,
        compositionPlan,
        lightingPlan,
        stylePlan,
        colorPlan,
        platformOptimizations,
        variations,
        productionInstructions,
        blueprintId: blueprint.blueprintId,
        scores,
        relationships: {
          prompts: [profile.promptId],
          products: [],
          brands: [],
          campaigns: [],
          images: [],
          knowledgeRecords: [],
          productionPlans: [],
          creativeDirections: [],
          marketingStrategies: [],
        },
        recommendations,
        validated: true,
        productionReady,
        brandConsistent,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      draft.relationships = this.linker.detectRelationships(
        draft,
        input,
        context.creative,
        context.strategy,
        context.understanding
      );

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.promptQualityScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? ImageGenerationVerificationStatus.Verified
            : ImageGenerationVerificationStatus.Pending,
        source: ImageGenerationSource.Prompt,
        sourceRef: draft.imagePlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Image plan v${version} — ${platform} ${profile.style}`,
            source: ImageGenerationSource.Prompt,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.prompts,
          ...draft.relationships.images,
        ],
        healthStatus: ImageGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Image generation foundation validation failed for image plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Image plan generated", {
        imagePlanId: draft.imagePlanId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });

      this.logger.log("info", "prompt-analysis", "Prompt analyzed", {
        imagePlanId: draft.imagePlanId,
        subject: promptAnalysis.subject.slice(0, 60),
      });

      this.logger.log("info", "composition-planning", "Composition planned", {
        imagePlanId: draft.imagePlanId,
        composition: compositionPlan.composition.slice(0, 60),
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Generation recommendations", {
          imagePlanId: draft.imagePlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: TextToImageSearchQuery): TextToImageGenerationRecord[] {
    let results = this.records.getAll();

    if (query.imagePlanId) results = results.filter((r) => r.imagePlanId === query.imagePlanId);
    if (query.promptId) results = results.filter((r) => r.profile.promptId === query.promptId);
    if (query.productId) results = results.filter((r) => r.profile.productId === query.productId);
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.style) results = results.filter((r) => r.profile.style === query.style);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.promptAnalysis.subject.toLowerCase().includes(kw) ||
          r.compositionPlan.composition.toLowerCase().includes(kw) ||
          r.promptAnalysis.objects.some((o) => o.toLowerCase().includes(kw))
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.imagePlanId.toLowerCase().includes(textLower) ||
          r.promptAnalysis.subject.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: TextToImageGenerationInput) {
    const bridge = this.foundation.integration;
    const productFoundation = bridge.getProductIntelligenceFoundation();

    if (input.productId && productFoundation) {
      const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
      const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
      const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
      const creative = creativeRecords[0] ?? null;
      const strategy = creative
        ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
        : null;

      if (analysis || understanding) {
        return this.analyzer.extractContextFromProduct(
          input.productId,
          analysis?.profile.productName ?? understanding?.identity.productName ?? input.productId,
          analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand",
          understanding,
          creative,
          strategy,
          input
        );
      }
    }

    if (input.textPrompt || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: TextToImageGenerationRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.promptId,
      assetType: ImageGenerationAssetType.Prompt,
      assetName: `Prompt ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
      qualityScore: record.scores.promptQualityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.prompts, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.imagePlanId,
      assetType: ImageGenerationAssetType.Image,
      assetName: `Image Plan ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
      qualityScore: record.scores.compositionScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.images, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
    });

    for (const variation of record.variations) {
      this.foundation.getAssetRegistry().registerAsset({
        assetId: variation.variationId,
        assetType: ImageGenerationAssetType.Variation,
        assetName: variation.label,
        projectId: record.profile.projectId,
        ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
        qualityScore: record.scores.styleScore,
        confidenceScore: record.scores.aiConfidenceScore,
        relationshipLinks: [record.imagePlanId],
        relatedProducts: record.relationships.products,
      });
    }
  }

  private applySafeRepairs(
    promptAnalysis: { subject: string },
    compositionPlan: { composition: string; studioLighting?: string },
    lightingPlan: { studioLighting: string },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Subject"))) {
      if (!promptAnalysis.subject || promptAnalysis.subject.length < 5) {
        promptAnalysis.subject = "Primary product subject with commercial focal point";
        repairs.push("Default subject applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Composition"))) {
      if (!compositionPlan.composition || compositionPlan.composition.length < 10) {
        compositionPlan.composition = "Rule-of-thirds composition with balanced visual hierarchy";
        repairs.push("Default composition applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Lighting"))) {
      if (!lightingPlan.studioLighting || lightingPlan.studioLighting.length < 5) {
        lightingPlan.studioLighting = "Three-point studio lighting with soft key and fill";
        repairs.push("Default studio lighting applied");
      }
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): TextToImageGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
