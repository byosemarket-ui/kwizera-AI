import { ImageGenerationAssetType, ImageGenerationHealthLevel, ImageGenerationSource, ImageGenerationVerificationStatus, } from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
import { ImageEnhanceOperationType, } from "./types.js";
export class ImageEnhancementProcessor {
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
    async generateEnhancementPlan(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context) {
                return this.reject(start, "Unable to resolve enhancement context — provide sourceImageId, editedImageId, productId with pipeline, imageEditingPlanId, or productImagePlanId", ["Source image or upstream pipeline required"]);
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
            const enhancementOperations = this.analyzer.buildEnhancementOperations(input, profile, context);
            const restorationOperations = this.analyzer.buildRestorationOperations(input, profile, context);
            const preservation = this.analyzer.buildPreservation(context);
            const qualityImprovement = this.analyzer.buildQualityImprovement(context);
            const printPreparation = this.analyzer.buildPrintPreparation(profile, input);
            const superResolutionPlan = this.analyzer.buildSuperResolutionPlan(profile);
            const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
            const productionInstructions = this.analyzer.buildProductionInstructions(profile, enhancementOperations, restorationOperations);
            const recommendations = this.analyzer.buildRecommendations(context, imageAnalysis);
            const scores = this.scorer.computeScores(imageAnalysis, enhancementOperations, restorationOperations, preservation, qualityImprovement, printPreparation, superResolutionPlan, platformOptimizations, context);
            const validation = this.scorer.isEnhancementPlanValid(scores, {
                imageAnalysis,
                enhancementOperations,
                restorationOperations,
                preservation,
                printPreparation,
                superResolutionPlan,
            });
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(restorationOperations, enhancementOperations, preservation, printPreparation, superResolutionPlan, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isEnhancementPlanValid(scores, {
                    imageAnalysis,
                    enhancementOperations,
                    restorationOperations,
                    preservation,
                    printPreparation,
                    superResolutionPlan,
                });
                if (!revalidation.valid) {
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Enhancement plan validation failed — all validations must pass before approval",
                    };
                }
            }
            const draftPartial = {
                enhancementPlanId: profile.enhancementPlanId,
                profile,
                imageAnalysis,
                enhancementOperations,
                restorationOperations,
                preservation,
                qualityImprovement,
                printPreparation,
                superResolutionPlan,
                platformOptimizations,
                productionInstructions,
                scores,
                relationships: {
                    sourceImages: [],
                    enhancedImages: [],
                    restoredImages: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    knowledgeRecords: [],
                    imageEditingPlans: [],
                    productImagePlans: [],
                    backgroundPlans: [],
                },
                recommendations,
                validated: true,
                productionReady: false,
                brandConsistent: false,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            const productionReady = this.scorer.isProductionReady(scores, draftPartial);
            const brandConsistent = this.scorer.isBrandConsistent(context, enhancementOperations);
            const blueprint = this.foundation.getBlueprintManager().createBlueprint({
                blueprintId: `blueprint-${profile.enhancementPlanId}`,
                projectId: profile.projectId,
                name: `Enhancement ${sourceImageId} ${platform}`,
            });
            const draft = {
                ...draftPartial,
                blueprintId: blueprint.blueprintId,
                productionReady,
                brandConsistent,
                relationships: this.linker.detectRelationships(draftPartial, input, context.productImagePlan, context.backgroundPlan, context.editingPlan, context.creative, context.strategy, context.understanding),
            };
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.enhancementScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? ImageGenerationVerificationStatus.Verified
                    : ImageGenerationVerificationStatus.Pending,
                source: ImageGenerationSource.ImageIntelligenceEngine,
                sourceRef: draft.enhancementPlanId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Enhancement plan v${version} — ${profile.primaryEnhancement}`,
                        source: ImageGenerationSource.ImageIntelligenceEngine,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.sourceImages,
                    ...draft.relationships.enhancedImages,
                    ...draft.relationships.products,
                ],
                healthStatus: ImageGenerationHealthLevel.Good,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Image generation foundation validation failed for enhancement plan",
                };
            }
            this.records.upsert(draft);
            this.registerGenerationAssets(draft, input);
            this.logger.log("info", "image-analysis", "Image analyzed for enhancement", {
                enhancementPlanId: draft.enhancementPlanId,
                resolution: imageAnalysis.resolution.slice(0, 30),
            });
            this.logger.log("info", "enhancement-operation", "Enhancement plan generated", {
                enhancementPlanId: draft.enhancementPlanId,
                operation: profile.primaryEnhancement,
                productionReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "restoration-operation", "Restoration plan prepared", {
                enhancementPlanId: draft.enhancementPlanId,
                type: restorationOperations.restorationType,
            });
            this.logger.log("info", "super-resolution", "Super resolution plan prepared", {
                enhancementPlanId: draft.enhancementPlanId,
                target: superResolutionPlan.targetResolution,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Enhancement recommendations", {
                    enhancementPlanId: draft.enhancementPlanId,
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
        if (query.enhancementPlanId)
            results = results.filter((r) => r.enhancementPlanId === query.enhancementPlanId);
        if (query.sourceImageId)
            results = results.filter((r) => r.profile.sourceImageId === query.sourceImageId);
        if (query.productId)
            results = results.filter((r) => r.profile.productId === query.productId);
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.campaignId)
            results = results.filter((r) => r.profile.campaignId === query.campaignId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.primaryEnhancement)
            results = results.filter((r) => r.profile.primaryEnhancement === query.primaryEnhancement);
        if (query.restorationType)
            results = results.filter((r) => r.profile.primaryRestoration === query.restorationType);
        if (query.imageCategory)
            results = results.filter((r) => r.profile.imageCategory === query.imageCategory);
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => Object.values(r.enhancementOperations.operationPrompts).some((p) => p.toLowerCase().includes(kw)) ||
                r.imageAnalysis.resolution.toLowerCase().includes(kw) ||
                r.profile.productId.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.enhancementPlanId.toLowerCase().includes(textLower) ||
                r.imageAnalysis.resolution.toLowerCase().includes(textLower));
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
        let backgroundPlan = null;
        if (input.backgroundPlanId) {
            backgroundPlan = this.foundation.getBackgroundGenerationEngine().getBackgroundPlan(input.backgroundPlanId);
        }
        else if (productImagePlan) {
            const bgPlans = this.foundation
                .getBackgroundGenerationEngine()
                .getBackgroundPlansBySourceImage(productImagePlan.productImagePlanId);
            backgroundPlan = bgPlans[0] ?? null;
        }
        let editingPlan = null;
        if (input.imageEditingPlanId) {
            editingPlan = this.foundation.getImageEditingEngine().getEditingPlan(input.imageEditingPlanId);
        }
        else if (input.editedImageId) {
            const editPlans = this.foundation.getImageEditingEngine().getEditingPlansBySourceImage(input.editedImageId);
            editingPlan = editPlans[0] ?? null;
        }
        else if (productImagePlan) {
            const editPlans = this.foundation
                .getImageEditingEngine()
                .getEditingPlansBySourceImage(productImagePlan.productImagePlanId);
            editingPlan = editPlans[0] ?? null;
        }
        if (input.productId && productFoundation) {
            const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
            const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
            const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
            const creative = creativeRecords[0] ?? null;
            const strategy = creative
                ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
                : null;
            if (analysis || understanding || productImagePlan || editingPlan) {
                return this.analyzer.extractContextFromProduct(analysis, understanding, creative, strategy, input, productImagePlan, backgroundPlan, editingPlan);
            }
        }
        if (input.sourceImageId || input.editedImageId || productImagePlan || editingPlan) {
            return this.analyzer.extractContextFromProduct(null, null, null, null, input, productImagePlan, backgroundPlan, editingPlan);
        }
        return null;
    }
    registerGenerationAssets(record, input) {
        const registry = this.foundation.getAssetRegistry();
        registry.registerAsset({
            assetId: record.profile.sourceImageId,
            assetType: ImageGenerationAssetType.Image,
            assetName: `Source for enhancement ${record.profile.primaryEnhancement}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
            qualityScore: record.scores.enhancementScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.sourceImages,
            relatedProducts: record.relationships.products,
        });
        registry.registerAsset({
            assetId: record.profile.enhancedImageId,
            assetType: ImageGenerationAssetType.Image,
            assetName: `Enhanced Image v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
            qualityScore: record.scores.enhancementScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.enhancedImages,
            relatedProducts: record.relationships.products,
        });
        registry.registerAsset({
            assetId: record.profile.restoredImageId,
            assetType: ImageGenerationAssetType.Image,
            assetName: `Restored Image v${record.profile.version}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
            qualityScore: record.scores.restorationScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.restoredImages,
            relatedProducts: record.relationships.products,
        });
        if (input.editedImageId && input.editedImageId !== record.profile.enhancedImageId) {
            registry.registerAsset({
                assetId: input.editedImageId,
                assetType: ImageGenerationAssetType.Layer,
                assetName: "Edited source for enhancement",
                projectId: record.profile.projectId,
                ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
                qualityScore: record.scores.enhancementScore,
                confidenceScore: record.scores.aiConfidenceScore,
                relationshipLinks: [record.enhancementPlanId],
            });
        }
    }
    applySafeRepairs(restoration, operations, preservation, print, superResolution, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Restoration"))) {
            if (!restoration.restorationStrategy || restoration.restorationStrategy.length < 10) {
                restoration.restorationStrategy = "Authenticity-preserving restoration with damage repair and detail recovery";
                repairs.push("Default restoration strategy applied");
            }
        }
        if (diagnostics.some((d) => d.includes("operations"))) {
            if (Object.keys(operations.operationPrompts).length === 0) {
                operations.operationPrompts[ImageEnhanceOperationType.DetailEnhancement] =
                    "Professional image enhancement with authenticity preservation";
                repairs.push("Default enhancement prompt applied");
            }
        }
        if (diagnostics.some((d) => d.includes("preservation"))) {
            preservation.identityLock = true;
            preservation.productLock = true;
            preservation.compositionLock = true;
            repairs.push("Preservation locks enforced");
        }
        if (diagnostics.some((d) => d.includes("Print"))) {
            if (!print.dpiPlanning || print.dpiPlanning.length < 5) {
                print.dpiPlanning = "300 DPI for print, 72 DPI for digital delivery";
                repairs.push("Default DPI planning applied");
            }
        }
        if (diagnostics.some((d) => d.includes("Super resolution"))) {
            if (!superResolution.upscalingMethod || superResolution.upscalingMethod.length < 10) {
                superResolution.upscalingMethod = "Detail-preserving super resolution with edge-aware interpolation";
                repairs.push("Default super resolution method applied");
            }
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=image-enhancement-processor.js.map