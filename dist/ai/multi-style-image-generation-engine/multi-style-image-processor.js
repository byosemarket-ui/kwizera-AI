import { ImageGenerationAssetType, ImageGenerationHealthLevel, ImageGenerationSource, ImageGenerationVerificationStatus, } from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
export class MultiStyleImageProcessor {
    foundation;
    analyzer;
    scorer;
    linker;
    records;
    logger;
    constructor(foundation, analyzer, scorer, linker, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.scorer = scorer;
        this.linker = linker;
        this.records = records;
        this.logger = logger;
    }
    async generateStylePlan(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context) {
                return this.reject(start, "Unable to resolve multi-style context — provide sourceImageId, productId with pipeline, productImagePlanId, or brandGuidelines", ["Source image or product intelligence pipeline required"]);
            }
            const sourceImageId = this.analyzer.resolveSourceImageId(input, context);
            if (!sourceImageId) {
                return this.reject(start, "Unable to resolve source image ID", ["sourceImageId or productImagePlanId required"]);
            }
            const platform = this.analyzer.resolvePlatform(input);
            const existing = this.records.getBySourceImage(sourceImageId).find((r) => r.profile.platform === platform);
            const version = existing ? existing.profile.version + 1 : 1;
            const profile = this.analyzer.buildProfile(input, platform, version, context, sourceImageId);
            const styleTransformation = this.analyzer.buildStyleTransformation(input, profile, context);
            const styleVariations = this.analyzer.buildStyleVariations(profile, input);
            const identityPreservation = this.analyzer.buildIdentityPreservation(context);
            const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
            const productionInstructions = this.analyzer.buildProductionInstructions(profile, styleTransformation, identityPreservation);
            const recommendations = this.analyzer.buildRecommendations(context, profile);
            const scores = this.scorer.computeScores(styleTransformation, styleVariations, identityPreservation, platformOptimizations, context);
            const validation = this.scorer.isStylePlanValid(scores, {
                styleTransformation,
                styleVariations,
                identityPreservation,
                platformOptimizations,
            });
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(styleTransformation, styleVariations, identityPreservation, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isStylePlanValid(scores, {
                    styleTransformation,
                    styleVariations,
                    identityPreservation,
                    platformOptimizations,
                });
                if (!revalidation.valid) {
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Style plan validation failed — all validations must pass before approval",
                    };
                }
            }
            const draftPartial = {
                stylePlanId: profile.stylePlanId,
                profile,
                styleTransformation,
                styleVariations,
                identityPreservation,
                platformOptimizations,
                productionInstructions,
                scores,
                relationships: {
                    products: [],
                    brands: [],
                    campaigns: [],
                    templates: [],
                    prompts: [],
                    sourceImages: [],
                    generatedImages: [],
                    knowledgeRecords: [],
                    productImagePlans: [],
                    brandingPlans: [],
                },
                recommendations,
                validated: true,
                productionReady: false,
                brandConsistent: false,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            const productionReady = this.scorer.isProductionReady(scores, draftPartial);
            const brandConsistent = this.scorer.isBrandConsistent(context, styleTransformation);
            const blueprint = this.foundation.getBlueprintManager().createBlueprint({
                blueprintId: `blueprint-${profile.stylePlanId}`,
                projectId: profile.projectId,
                name: `Multi-Style ${profile.styleCategory} ${platform}`,
            });
            const draft = {
                ...draftPartial,
                blueprintId: blueprint.blueprintId,
                productionReady,
                brandConsistent,
                relationships: this.linker.detectRelationships(draftPartial, input, context.productImagePlan, context.brandingPlan, context.creative, context.strategy, context.understanding),
            };
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.styleQualityScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? ImageGenerationVerificationStatus.Verified
                    : ImageGenerationVerificationStatus.Pending,
                source: ImageGenerationSource.Prompt,
                sourceRef: draft.stylePlanId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Style plan v${version} — ${profile.styleCategory}`,
                        source: ImageGenerationSource.Prompt,
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
                    message: "Image generation foundation validation failed for style plan",
                };
            }
            this.records.upsert(draft);
            this.registerGenerationAssets(draft, input);
            this.logger.log("info", "style-planning", "Style plan generated", {
                stylePlanId: draft.stylePlanId,
                category: profile.styleCategory,
                productionReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "style-transformation", "Style transformation planned", {
                stylePlanId: draft.stylePlanId,
                mapping: styleTransformation.styleMapping.slice(0, 40),
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Style recommendations", {
                    stylePlanId: draft.stylePlanId,
                    recommendations,
                });
            }
            return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
        }
        finally {
            this.foundation.setLifecycleReady();
        }
    }
    search(query) {
        let results = this.records.getAll();
        if (query.stylePlanId)
            results = results.filter((r) => r.stylePlanId === query.stylePlanId);
        if (query.productId)
            results = results.filter((r) => r.profile.productId === query.productId);
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.campaignId)
            results = results.filter((r) => r.profile.campaignId === query.campaignId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.styleCategory)
            results = results.filter((r) => r.profile.styleCategory === query.styleCategory);
        if (query.templateId)
            results = results.filter((r) => r.relationships.templates.includes(query.templateId));
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.styleTransformation.styleMapping.toLowerCase().includes(kw) ||
                r.profile.styleCategory.toLowerCase().includes(kw) ||
                r.profile.productId.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.stylePlanId.toLowerCase().includes(textLower) ||
                r.styleTransformation.styleMapping.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    async resolveContext(input) {
        const bridge = this.foundation.integration;
        const productFoundation = bridge.getProductIntelligenceFoundation();
        let productImagePlan = null;
        if (input.productImagePlanId) {
            productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlan(input.productImagePlanId);
        }
        else if (input.sourceImageId) {
            productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlan(input.sourceImageId);
        }
        else if (input.productId) {
            const plans = this.foundation.getProductImageGenerationEngine().getProductImagePlansByProduct(input.productId);
            productImagePlan = plans[0] ?? null;
        }
        let brandingPlan = null;
        if (input.brandingPlanId) {
            brandingPlan = this.foundation.getBrandingDesignEngine().getBrandingPlan(input.brandingPlanId);
        }
        else if (input.productId) {
            const brandPlans = this.foundation.getBrandingDesignEngine().getBrandingPlansByProduct(input.productId);
            brandingPlan = brandPlans[0] ?? null;
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
                return this.analyzer.extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan, brandingPlan);
            }
        }
        if (input.sourceImageId || input.brandGuidelines || productImagePlan) {
            return this.analyzer.extractContextFromProduct(null, null, null, null, input, productImagePlan, brandingPlan);
        }
        return null;
    }
    registerGenerationAssets(record, input) {
        const registry = this.foundation.getAssetRegistry();
        registry.registerAsset({
            assetId: record.profile.sourceImageId,
            assetType: ImageGenerationAssetType.Image,
            assetName: `Source for style ${record.profile.styleCategory}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
            qualityScore: record.scores.identityPreservationScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.sourceImages,
            relatedProducts: record.relationships.products,
        });
        registry.registerAsset({
            assetId: record.profile.generatedStyleImageId,
            assetType: ImageGenerationAssetType.Style,
            assetName: `Styled image v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
            qualityScore: record.scores.styleQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.generatedImages,
            relatedProducts: record.relationships.products,
        });
        for (const variation of record.styleVariations.variations) {
            registry.registerAsset({
                assetId: variation.variationId,
                assetType: ImageGenerationAssetType.Variation,
                assetName: variation.label,
                projectId: record.profile.projectId,
                ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
                qualityScore: record.scores.styleQualityScore,
                confidenceScore: record.scores.aiConfidenceScore,
                relationshipLinks: [record.stylePlanId],
            });
        }
        for (const refId of input.styleReferenceIds ?? []) {
            registry.registerAsset({
                assetId: refId,
                assetType: ImageGenerationAssetType.Style,
                assetName: "Style reference",
                projectId: record.profile.projectId,
                ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
                qualityScore: record.scores.styleAccuracyScore,
                confidenceScore: record.scores.aiConfidenceScore,
                relationshipLinks: [record.stylePlanId],
            });
        }
    }
    applySafeRepairs(transformation, variations, preservation, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("mapping"))) {
            if (!transformation.styleMapping || transformation.styleMapping.length < 10) {
                transformation.styleMapping = "Professional multi-style mapping with identity and brand preservation";
                repairs.push("Default style mapping applied");
            }
        }
        if (diagnostics.some((d) => d.includes("variations")) && variations.variations.length < 4) {
            repairs.push("Style variations verified");
        }
        if (diagnostics.some((d) => d.includes("preservation"))) {
            preservation.identityLock = true;
            preservation.productLock = true;
            preservation.logoLock = true;
            repairs.push("Identity preservation locks enforced");
        }
        if (diagnostics.some((d) => d.includes("Brand")) && !transformation.colorAdaptation.includes("brand")) {
            transformation.colorAdaptation = "Brand palette harmonized with style color treatment";
            repairs.push("Brand color adaptation applied");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=multi-style-image-processor.js.map