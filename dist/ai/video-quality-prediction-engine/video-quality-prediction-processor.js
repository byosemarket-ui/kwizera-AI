import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
export class VideoQualityPredictionProcessor {
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
        const analysis = this.foundation.getVideoAnalysisEngine().getVideo(input.videoId);
        const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);
        const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(input.videoId);
        const timeline = this.foundation.getTimelineIntelligenceEngine().getTimeline(input.videoId);
        const camera = this.foundation.getCameraMovementEngine().getCameraAnalysis(input.videoId);
        const motion = this.foundation.getMotionIntelligenceEngine().getMotionAnalysis(input.videoId);
        const style = this.foundation.getVideoStyleIntelligenceEngine().getStyleAnalysis(input.videoId);
        const enhancementPlan = this.foundation.getVideoEnhancementPlanningEngine().getEnhancementPlan(input.videoId);
        const creativePlan = this.foundation.getCreativeVideoIntelligenceEngine().getCreativePlan(input.videoId);
        const productionPlan = this.foundation.getProductionVideoPlanningEngine().getProductionPlan(input.videoId);
        if (!analysis?.validated) {
            return this.fail(start, input.videoId, "Complete video analysis required before quality prediction");
        }
        if (!understanding?.validated) {
            return this.fail(start, input.videoId, "Complete video understanding required before quality prediction");
        }
        if (!sceneDetection?.validated) {
            return this.fail(start, input.videoId, "Scene detection required before quality prediction");
        }
        if (!timeline?.validated) {
            return this.fail(start, input.videoId, "Timeline intelligence required before quality prediction");
        }
        if (!camera?.validated) {
            return this.fail(start, input.videoId, "Camera movement intelligence required before quality prediction");
        }
        if (!motion?.validated) {
            return this.fail(start, input.videoId, "Motion intelligence required before quality prediction");
        }
        if (!style?.validated) {
            return this.fail(start, input.videoId, "Video style intelligence required before quality prediction");
        }
        if (!enhancementPlan?.validated) {
            return this.fail(start, input.videoId, "Video enhancement plan required before quality prediction");
        }
        if (!creativePlan?.validated) {
            return this.fail(start, input.videoId, "Creative video plan required before quality prediction");
        }
        if (!productionPlan?.validated) {
            return this.fail(start, input.videoId, "Production video plan required before quality prediction");
        }
        const ctx = {
            analysis,
            understanding,
            sceneDetection,
            timeline,
            camera,
            motion,
            style,
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
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Quality prediction rejected — unresolved critical risks or validation failed",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            videoId: input.videoId,
            profile: {
                ...built.profile,
                predictionId: existing?.profile.predictionId ?? built.profile.predictionId,
                predictionVersion: version,
            },
            analysisId: analysis.analysisId,
            productionPlanId: productionPlan.profile.productionPlanId,
            creativePlanId: creativePlan.profile.creativeVideoId,
            enhancementPlanId: enhancementPlan.intelligenceId,
            analysisSummary: built.analysisSummary,
            scores,
            checks: built.checks,
            predictions: built.predictions,
            risks: built.risks,
            platformQuality: built.platformQuality,
            relationships: {
                relatedStoryboards: [],
                relatedProductionPlans: [],
                relatedProducts: [],
                relatedBrands: [],
                relatedCampaigns: [],
                relatedScripts: [],
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
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, productionPlan, creativePlan, enhancementPlan, input.relatedProjects, input.relatedKnowledge, input.relatedScripts);
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.overallVideoQualityScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? VideoIntelligenceVerificationStatus.Verified
                : VideoIntelligenceVerificationStatus.Pending,
            source: VideoIntelligenceSource.System,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Video quality prediction v${version}`,
                    source: VideoIntelligenceSource.System,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedStoryboards,
                ...draft.relationships.relatedProductionPlans,
            ],
            healthStatus: VideoIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                message: "Video intelligence validation failed",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "prediction", "Video quality prediction created", {
            videoId: input.videoId,
            overall: scores.overallVideoQualityScore,
            risk: highestRiskLevel,
            version,
        });
        this.logger.log("info", "quality", "Quality analysis complete", {
            videoId: input.videoId,
            productionReadiness: scores.productionReadinessScore,
        });
        if (built.risks.length > 0) {
            this.logger.log("info", "risk", "Production risks detected", {
                videoId: input.videoId,
                count: built.risks.length,
                highest: highestRiskLevel,
            });
        }
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Quality recommendations generated", {
                videoId: input.videoId,
                count: built.recommendations.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.videoId)
            results = results.filter((r) => r.videoId === query.videoId);
        if (query.predictionId) {
            results = results.filter((r) => r.profile.predictionId === query.predictionId);
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.profile.brand.toLowerCase().includes(q) ||
                r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q)));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.profile.product.toLowerCase().includes(q) ||
                r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
        }
        if (query.campaign) {
            const q = query.campaign.toLowerCase();
            results = results.filter((r) => r.profile.campaign.toLowerCase().includes(q) ||
                r.relationships.relatedCampaigns.some((c) => c.toLowerCase().includes(q)));
        }
        if (query.platform) {
            results = results.filter((r) => r.profile.platform === query.platform);
        }
        if (query.minQualityScore !== undefined) {
            results = results.filter((r) => r.scores.overallVideoQualityScore >= query.minQualityScore);
        }
        if (query.riskLevel) {
            const target = query.riskLevel;
            results = results.filter((r) => this.scorer.severityRank(r.highestRiskLevel) >= this.scorer.severityRank(target));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.profile.predictionId.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Quality prediction search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
    fail(start, videoId, message) {
        this.logger.log("warn", "validation", message, { videoId });
        return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: [message],
            message,
        };
    }
}
//# sourceMappingURL=video-quality-prediction-processor.js.map