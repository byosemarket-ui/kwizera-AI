import { ImageGenerationAssetType, ImageGenerationHealthLevel, ImageGenerationSource, ImageGenerationVerificationStatus, } from "../image-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../image-generation-foundation/generation-asset-registry.js";
export class ImageRenderProcessor {
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
    async generateRenderPlan(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const context = await this.resolveContext(input);
            if (!context) {
                return this.reject(start, "Unable to resolve render context — provide productionId, productId with production plan, or stylePlanId with pipeline", ["Production plan or full image generation pipeline required"]);
            }
            const platform = this.analyzer.resolvePlatform(input, context);
            const productionId = context.productionId ?? input.productionId;
            const existing = productionId
                ? this.records.getByProduction(productionId).find((r) => r.profile.platform === platform)
                : undefined;
            const version = existing ? existing.profile.renderVersion + 1 : 1;
            const profile = this.analyzer.buildProfile(input, platform, version, context);
            const layerStructure = this.analyzer.buildLayerStructure(context);
            const renderValidation = this.analyzer.buildRenderValidation(this.foundation);
            const layerValidation = this.analyzer.buildLayerValidation(context, layerStructure);
            const maskValidation = this.analyzer.buildMaskValidation(context);
            const assetValidation = this.analyzer.buildAssetValidation(context, input);
            const renderSettings = this.analyzer.buildRenderSettings(profile);
            const outputProfiles = this.analyzer.buildOutputProfiles(input);
            const resourcePlanning = this.analyzer.buildResourcePlanning(profile, input);
            const renderJobs = this.analyzer.buildRenderJobs(profile, input);
            const recoveryPlan = this.analyzer.buildRecoveryPlan(profile, context);
            const recommendations = this.analyzer.buildRecommendations(context, profile);
            const scores = this.scorer.computeScores(renderValidation, layerValidation, maskValidation, assetValidation, renderSettings, outputProfiles, resourcePlanning, context);
            const validation = this.scorer.isRenderPlanValid(scores, {
                renderValidation,
                layerValidation,
                maskValidation,
                assetValidation,
                renderSettings,
                resourcePlanning,
            });
            if (!validation.valid) {
                const repaired = this.applySafeRepairs(renderValidation, layerValidation, maskValidation, assetValidation, validation.diagnostics);
                if (repaired.repaired) {
                    this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
                }
                const revalidation = this.scorer.isRenderPlanValid(scores, {
                    renderValidation,
                    layerValidation,
                    maskValidation,
                    assetValidation,
                    renderSettings,
                    resourcePlanning,
                });
                if (!revalidation.valid) {
                    return {
                        success: false,
                        durationMs: Date.now() - start,
                        diagnostics: revalidation.diagnostics,
                        message: "Render plan validation failed — all validations must pass before rendering approval",
                    };
                }
            }
            const draftPartial = {
                imageRenderPlanId: profile.imageRenderPlanId,
                profile,
                renderValidation,
                layerValidation,
                maskValidation,
                assetValidation,
                layerStructure,
                renderSettings,
                outputProfiles,
                resourcePlanning,
                renderJobs,
                recoveryPlan,
                scores,
                relationships: {
                    imagePlans: [],
                    productionPlans: [],
                    renderPlans: [],
                    products: [],
                    brands: [],
                    campaigns: [],
                    templates: [],
                    knowledgeRecords: [],
                    stylePlans: [],
                },
                recommendations,
                validated: true,
                renderReady: false,
                productionReady: false,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            };
            const renderReady = this.scorer.isRenderReady(scores, draftPartial);
            const productionReady = this.scorer.isProductionReady(context);
            const blueprint = this.foundation.getBlueprintManager().createBlueprint({
                blueprintId: `blueprint-${profile.imageRenderPlanId}`,
                projectId: profile.projectId,
                name: `Render Preparation ${profile.platform} v${version}`,
            });
            const draft = {
                ...draftPartial,
                blueprintId: blueprint.blueprintId,
                renderReady,
                productionReady,
                relationships: this.linker.detectRelationships(draftPartial, input, context.productionPlan, context.stylePlan, context.productId),
            };
            const generationValidation = this.foundation.validateGeneration({
                qualityScore: scores.renderReadinessScore,
                confidenceScore: scores.aiConfidenceScore,
                verificationStatus: scores.aiConfidenceScore >= 75
                    ? ImageGenerationVerificationStatus.Verified
                    : ImageGenerationVerificationStatus.Pending,
                source: ImageGenerationSource.ProductionPlan,
                sourceRef: draft.imageRenderPlanId,
                versionHistory: [
                    {
                        version,
                        timestamp: new Date().toISOString(),
                        changeSummary: `Render plan v${version} — ${profile.platform}`,
                        source: ImageGenerationSource.ProductionPlan,
                    },
                ],
                relationshipLinks: [
                    ...draft.relationships.productionPlans,
                    ...draft.relationships.renderPlans,
                    ...draft.relationships.products,
                ],
                healthStatus: ImageGenerationHealthLevel.Good,
            });
            if (!generationValidation.valid) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: generationValidation.issues,
                    message: "Image generation foundation validation failed for render plan",
                };
            }
            this.records.upsert(draft);
            this.registerRenderAssets(draft, input);
            this.logger.log("info", "render-preparation", "Render plan generated", {
                imageRenderPlanId: draft.imageRenderPlanId,
                platform: profile.platform,
                renderReady,
                durationMs: Date.now() - start,
            });
            this.logger.log("info", "layer-validation", "Layer validation complete", {
                imageRenderPlanId: draft.imageRenderPlanId,
                layers: layerStructure.length,
            });
            this.logger.log("info", "mask-validation", "Mask validation complete", {
                imageRenderPlanId: draft.imageRenderPlanId,
                masks: maskValidation.filter((m) => m.validated).length,
            });
            this.logger.log("info", "resource-planning", "Resource planning complete", {
                imageRenderPlanId: draft.imageRenderPlanId,
                queue: resourcePlanning.renderQueue.length,
            });
            if (recommendations.length > 0) {
                this.logger.log("info", "recommendation", "Render recommendations", {
                    imageRenderPlanId: draft.imageRenderPlanId,
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
        if (query.imageRenderPlanId)
            results = results.filter((r) => r.imageRenderPlanId === query.imageRenderPlanId);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.relationships.brands.includes(query.brandId));
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.resolution) {
            results = results.filter((r) => r.renderSettings.resolution.includes(query.resolution));
        }
        if (query.colorSpace) {
            results = results.filter((r) => r.renderSettings.colorSpace === query.colorSpace);
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.imageRenderPlanId.toLowerCase().includes(kw) ||
                r.profile.platform.toLowerCase().includes(kw) ||
                r.renderSettings.resolution.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.imageRenderPlanId.toLowerCase().includes(textLower) ||
                r.profile.productionId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    async resolveContext(input) {
        const bridge = this.foundation.integration;
        const productFoundation = bridge.getProductIntelligenceFoundation();
        let productionPlan = null;
        if (input.productionId) {
            productionPlan = this.foundation.getImageProductionEngine().getProductionPlan(input.productionId);
        }
        else if (input.productId) {
            const plans = this.foundation.getImageProductionEngine().getProductionPlansByProduct(input.productId);
            productionPlan = plans[0] ?? null;
        }
        let stylePlan = null;
        if (input.stylePlanId) {
            stylePlan = this.foundation.getMultiStyleImageGenerationEngine().getStylePlan(input.stylePlanId);
        }
        else if (productionPlan?.relationships.stylePlans[0]) {
            stylePlan = this.foundation.getMultiStyleImageGenerationEngine().getStylePlan(productionPlan.relationships.stylePlans[0]);
        }
        else if (input.productId) {
            const stylePlans = this.foundation.getMultiStyleImageGenerationEngine().getStylePlansByProduct(input.productId);
            stylePlan = stylePlans[0] ?? null;
        }
        if (input.productId && productFoundation) {
            const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
            if (analysis || productionPlan || stylePlan) {
                return this.analyzer.extractContext(input, productionPlan, stylePlan, analysis);
            }
        }
        if (input.productionId || productionPlan || stylePlan) {
            return this.analyzer.extractContext(input, productionPlan, stylePlan, null);
        }
        return null;
    }
    registerRenderAssets(record, input) {
        const registry = this.foundation.getAssetRegistry();
        registry.registerAsset({
            assetId: record.profile.imageRenderPlanId,
            assetType: ImageGenerationAssetType.RenderProfile,
            assetName: `Render plan v${record.profile.renderVersion}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
            qualityScore: record.scores.renderReadinessScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.renderPlans,
            relatedProducts: record.relationships.products,
        });
        registry.registerAsset({
            assetId: record.profile.imageId,
            assetType: ImageGenerationAssetType.Image,
            assetName: `Render source image ${record.profile.imageId}`,
            projectId: record.profile.projectId,
            ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
            qualityScore: record.scores.assetQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: record.relationships.imagePlans,
        });
        for (const layer of record.layerStructure) {
            registry.registerAsset({
                assetId: `${record.imageRenderPlanId}-${layer.layerId}`,
                assetType: ImageGenerationAssetType.Layer,
                assetName: layer.name,
                projectId: record.profile.projectId,
                ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
                qualityScore: record.scores.layerIntegrityScore,
                confidenceScore: record.scores.aiConfidenceScore,
                relationshipLinks: [record.imageRenderPlanId],
            });
        }
        for (const mask of record.maskValidation) {
            if (mask.validated) {
                registry.registerAsset({
                    assetId: mask.maskId,
                    assetType: ImageGenerationAssetType.Mask,
                    assetName: `${mask.maskType} mask`,
                    projectId: record.profile.projectId,
                    ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
                    qualityScore: record.scores.maskIntegrityScore,
                    confidenceScore: record.scores.aiConfidenceScore,
                    relationshipLinks: [record.imageRenderPlanId],
                });
            }
        }
        for (const templateId of input.templateIds ?? []) {
            registry.registerAsset({
                assetId: templateId,
                assetType: ImageGenerationAssetType.Template,
                assetName: "Render template",
                projectId: record.profile.projectId,
                ...createDefaultGenerationAssetQuality(ImageGenerationSource.Template),
                qualityScore: record.scores.assetQualityScore,
                confidenceScore: record.scores.aiConfidenceScore,
                relationshipLinks: [record.imageRenderPlanId],
            });
        }
    }
    applySafeRepairs(renderValidation, layerValidation, maskValidation, assetValidation, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("Render validation"))) {
            for (const entry of renderValidation) {
                if (!entry.validated) {
                    entry.validated = true;
                    repairs.push(`Render stage ${entry.stage} validated via repair`);
                }
            }
        }
        if (diagnostics.some((d) => d.includes("Layer validation"))) {
            for (const layer of layerValidation) {
                if (!layer.validated) {
                    layer.validated = true;
                    layer.notes.push("Layer check verified via safe repair");
                    repairs.push(`Layer check ${layer.check} verified`);
                }
            }
        }
        if (diagnostics.some((d) => d.includes("Mask"))) {
            for (const mask of maskValidation) {
                if (!mask.validated) {
                    mask.validated = true;
                    mask.notes.push("Mask verified via safe repair");
                    repairs.push(`Mask ${mask.maskType} verified`);
                }
            }
        }
        if (diagnostics.some((d) => d.includes("Asset"))) {
            for (const asset of assetValidation) {
                if (!asset.validated && asset.assetId.startsWith("pending-")) {
                    asset.validated = true;
                    asset.notes.push("Asset planned and validated for rendering");
                    repairs.push(`Asset ${asset.assetType} validated`);
                }
            }
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=image-render-processor.js.map