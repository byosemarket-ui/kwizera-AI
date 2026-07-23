import { ImageIntelligenceHealthLevel, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, } from "../image-intelligence-foundation/types.js";
export class ImageQualityPredictionProcessor {
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
    async predict(input) {
        const start = Date.now();
        const analysis = this.foundation.getImageAnalysisEngine().getImage(input.imageId);
        const understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(input.imageId);
        const detection = this.foundation.getObjectDetectionIntelligenceEngine().getDetection(input.imageId);
        const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(input.imageId);
        const composition = this.foundation.getCompositionIntelligenceEngine().getComposition(input.imageId);
        const lightingColor = this.foundation.getLightingColorIntelligenceEngine().getLightingColor(input.imageId);
        const brandVisual = this.foundation.getBrandVisualIntelligenceEngine().getBrandVisual(input.imageId);
        const enhancementPlan = this.foundation.getImageEnhancementPlanningEngine().getEnhancementPlan(input.imageId);
        const creativePlan = this.foundation.getCreativeImageIntelligenceEngine().getCreativePlan(input.imageId);
        const productionPlan = this.foundation.getProductionImagePlanningEngine().getProductionPlan(input.imageId);
        if (!analysis?.validated) {
            return this.fail(start, "Complete image analysis required before quality prediction");
        }
        if (!understanding?.validated) {
            return this.fail(start, "Complete image understanding required before quality prediction");
        }
        if (!detection?.validated) {
            return this.fail(start, "Object detection intelligence required before quality prediction");
        }
        if (!background?.validated) {
            return this.fail(start, "Background intelligence required before quality prediction");
        }
        if (!composition?.validated) {
            return this.fail(start, "Composition intelligence required before quality prediction");
        }
        if (!lightingColor?.validated) {
            return this.fail(start, "Lighting and color intelligence required before quality prediction");
        }
        if (!brandVisual?.validated) {
            return this.fail(start, "Brand visual intelligence required before quality prediction");
        }
        if (!enhancementPlan?.validated) {
            return this.fail(start, "Image enhancement plan required before quality prediction");
        }
        if (!creativePlan?.validated) {
            return this.fail(start, "Creative image plan required before quality prediction");
        }
        if (!productionPlan?.validated) {
            return this.fail(start, "Production image plan required before quality prediction");
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
            productionPlan,
        };
        const built = this.analyzer.buildFromIntelligence(ctx, input.projectId, input.campaign, input.platform);
        const scores = this.scorer.computeScores(ctx, built.checks);
        const highestRiskLevel = this.analyzer.highestRiskLevel(built.risks);
        const validation = this.scorer.isPredictionValid(scores, built.risks, built.checks);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Quality prediction rejected", {
                imageId: input.imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Quality prediction rejected — unresolved critical risks or validation failed",
            };
        }
        const existing = this.records.get(input.imageId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            imageId: input.imageId,
            profile: {
                ...built.profile,
                predictionId: existing?.profile.predictionId ?? built.profile.predictionId,
            },
            analysisId: analysis.analysisId,
            productionPlanId: productionPlan.profile.productionImagePlanId,
            creativePlanId: creativePlan.profile.creativeImageId,
            enhancementPlanId: enhancementPlan.profile.enhancementPlanId,
            analysisSummary: built.analysisSummary,
            scores,
            checks: built.checks,
            predictions: built.predictions,
            risks: built.risks,
            platformQuality: built.platformQuality,
            relationships: {
                relatedImagePlans: [],
                relatedCreativePlans: [],
                relatedProducts: [],
                relatedBrands: [],
                relatedCampaigns: [],
                relatedKnowledge: [],
                relatedProductionHistory: [],
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            keywords: [...new Set([...built.keywords, ...(input.keywords ?? []), highestRiskLevel])],
            highestRiskLevel,
            productionReady: scores.productionReadinessScore >= 55 &&
                highestRiskLevel !== "critical" &&
                built.checks.dependencyValidation,
            validated: true,
            predictedAt: existing?.predictedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, productionPlan, creativePlan, enhancementPlan, input.relatedProjects, input.relatedKnowledge);
        const intelligenceValidation = this.foundation.validateImageIntelligence({
            qualityScore: scores.overallImageQualityScore,
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
                    changeSummary: `Image quality prediction v${version}`,
                    source: ImageIntelligenceSource.System,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedImagePlans,
                ...draft.relationships.relatedCreativePlans,
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
        this.logger.log("info", "prediction", "Image quality prediction created", {
            imageId: input.imageId,
            overall: scores.overallImageQualityScore,
            risk: highestRiskLevel,
            version,
        });
        this.logger.log("info", "quality", "Quality analysis complete", {
            imageId: input.imageId,
            productionReadiness: scores.productionReadinessScore,
        });
        if (built.risks.length > 0) {
            this.logger.log("info", "risk", "Production risks detected", {
                imageId: input.imageId,
                count: built.risks.length,
                highest: highestRiskLevel,
            });
        }
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Quality recommendations generated", {
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
        if (query.predictionId) {
            results = results.filter((r) => r.profile.predictionId === query.predictionId);
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
        if (query.minQualityScore !== undefined) {
            results = results.filter((r) => r.scores.overallImageQualityScore >= query.minQualityScore);
        }
        if (query.riskLevel) {
            const target = query.riskLevel;
            results = results.filter((r) => this.scorer.severityRank(r.highestRiskLevel) >= this.scorer.severityRank(target));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Quality prediction search complete", {
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
//# sourceMappingURL=image-quality-prediction-processor.js.map