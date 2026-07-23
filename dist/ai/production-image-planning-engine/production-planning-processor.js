import { ImageIntelligenceHealthLevel, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, } from "../image-intelligence-foundation/types.js";
export class ProductionPlanningProcessor {
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
    async plan(input) {
        const start = Date.now();
        const integration = this.foundation.integration.getStatus();
        const analysis = this.foundation.getImageAnalysisEngine().getImage(input.imageId);
        const understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(input.imageId);
        const detection = this.foundation.getObjectDetectionIntelligenceEngine().getDetection(input.imageId);
        const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(input.imageId);
        const composition = this.foundation.getCompositionIntelligenceEngine().getComposition(input.imageId);
        const lightingColor = this.foundation.getLightingColorIntelligenceEngine().getLightingColor(input.imageId);
        const brandVisual = this.foundation.getBrandVisualIntelligenceEngine().getBrandVisual(input.imageId);
        const enhancementPlan = this.foundation.getImageEnhancementPlanningEngine().getEnhancementPlan(input.imageId);
        const creativePlan = this.foundation.getCreativeImageIntelligenceEngine().getCreativePlan(input.imageId);
        if (!analysis?.validated) {
            return this.fail(start, "Complete image analysis required before production planning");
        }
        if (!understanding?.validated) {
            return this.fail(start, "Complete image understanding required before production planning");
        }
        if (!detection?.validated) {
            return this.fail(start, "Object detection intelligence required before production planning");
        }
        if (!background?.validated) {
            return this.fail(start, "Background intelligence required before production planning");
        }
        if (!composition?.validated) {
            return this.fail(start, "Composition intelligence required before production planning");
        }
        if (!lightingColor?.validated) {
            return this.fail(start, "Lighting and color intelligence required before production planning");
        }
        if (!brandVisual?.validated) {
            return this.fail(start, "Brand visual intelligence required before production planning");
        }
        if (!enhancementPlan?.validated) {
            return this.fail(start, "Image enhancement plan required before production planning");
        }
        if (!creativePlan?.validated) {
            return this.fail(start, "Creative image plan required before production planning");
        }
        const ctx = {
            analysis,
            understanding,
            detection,
            background,
            composition,
            lightingColor,
            brandVisual,
            enhancementPlan,
            creativePlan,
            knowledgeConnected: integration.knowledgeEngine,
            memoryConnected: integration.memoryEngine,
            productIntelligenceConnected: integration.productIntelligenceEngine,
        };
        const built = this.analyzer.buildFromIntelligence(ctx, input.projectId, input.campaign, input.platform);
        const scores = this.scorer.computeScores(built.dependencies, built.assets, enhancementPlan.scores.enhancementReadinessScore, creativePlan.scores.creativeLayoutScore);
        const validation = this.scorer.isPlanValid(built.dependencies, scores, built.assets);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Production plan rejected", {
                imageId: input.imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Production plan rejected — all dependencies must pass validation",
            };
        }
        const existing = this.records.get(input.imageId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            imageId: input.imageId,
            profile: {
                ...built.profile,
                productionImagePlanId: existing?.profile.productionImagePlanId ?? built.profile.productionImagePlanId,
            },
            analysisId: analysis.analysisId,
            understandingId: understanding.understandingId,
            detectionId: detection.detectionId,
            backgroundId: background.backgroundId,
            compositionId: composition.compositionId,
            lightingColorId: lightingColor.lightingColorId,
            brandVisualId: brandVisual.brandVisualId,
            enhancementPlanId: enhancementPlan.profile.enhancementPlanId,
            creativeImagePlanId: creativePlan.profile.creativeImageId,
            workflow: built.workflow,
            assets: built.assets,
            dependencies: built.dependencies,
            renderPreparation: built.renderPreparation,
            exportPreparation: built.exportPreparation,
            platformRules: built.platformRules,
            recoveryPlan: built.recoveryPlan,
            scores,
            relationships: {
                relatedCreativeImagePlans: [],
                relatedEnhancementPlans: [],
                relatedProducts: [],
                relatedBrands: [],
                relatedCampaigns: [],
                relatedMarketingStrategy: [],
                relatedKnowledge: [],
                relatedProductionHistory: [],
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            keywords: [...new Set([...built.keywords, ...(input.keywords ?? [])])],
            productionReady: scores.productionReadinessScore >= 55 && built.dependencies.allRequiredPassed,
            validated: true,
            plannedAt: existing?.plannedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, enhancementPlan, creativePlan, input.relatedProjects, input.relatedKnowledge);
        const intelligenceValidation = this.foundation.validateImageIntelligence({
            qualityScore: scores.productionReadinessScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? ImageIntelligenceVerificationStatus.Verified
                : ImageIntelligenceVerificationStatus.Pending,
            source: ImageIntelligenceSource.System,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Production image plan v${version} (planning only)`,
                    source: ImageIntelligenceSource.System,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedCreativeImagePlans,
                ...draft.relationships.relatedEnhancementPlans,
            ],
            healthStatus: ImageIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                message: "Image intelligence validation failed",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "planning", "Production image plan created", {
            imageId: input.imageId,
            platform: built.profile.platform,
            readiness: scores.productionReadinessScore,
            version,
        });
        this.logger.log("info", "workflow", "Production workflow prepared", {
            imageId: input.imageId,
            dependencies: built.dependencies.passedCount,
        });
        this.logger.log("info", "dependency", "Dependency validation complete", {
            imageId: input.imageId,
            passed: built.dependencies.allRequiredPassed,
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Production recommendations generated", {
                imageId: input.imageId,
                count: built.recommendations.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.imageId)
            results = results.filter((r) => r.imageId === query.imageId);
        if (query.productionPlanId) {
            results = results.filter((r) => r.profile.productionImagePlanId === query.productionPlanId);
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.profile.brand.toLowerCase().includes(q));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.profile.product.toLowerCase().includes(q));
        }
        if (query.campaign) {
            const q = query.campaign.toLowerCase();
            results = results.filter((r) => r.profile.campaign.toLowerCase().includes(q));
        }
        if (query.platform) {
            results = results.filter((r) => r.profile.platform === query.platform);
        }
        if (query.workflow) {
            const q = query.workflow;
            results = results.filter((r) => r.keywords.includes(q));
        }
        if (query.asset) {
            const q = query.asset.toLowerCase();
            results = results.filter((r) => r.keywords.some((k) => k.toLowerCase().includes(q)) ||
                JSON.stringify(r.assets).toLowerCase().includes(q));
        }
        if (query.minReadinessScore !== undefined) {
            results = results.filter((r) => r.scores.productionReadinessScore >= query.minReadinessScore);
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Production planning search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
    fail(start, message) {
        return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: [message],
            message,
        };
    }
}
//# sourceMappingURL=production-planning-processor.js.map