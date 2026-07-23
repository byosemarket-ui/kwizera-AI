import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
export class ProductionVideoProcessor {
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
    async planProduction(input) {
        const start = Date.now();
        const integration = this.foundation.integration.getStatus();
        const analysis = this.foundation.getVideoAnalysisEngine().getVideo(input.videoId);
        const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);
        const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(input.videoId);
        const timeline = this.foundation.getTimelineIntelligenceEngine().getTimeline(input.videoId);
        const camera = this.foundation.getCameraMovementEngine().getCameraAnalysis(input.videoId);
        const motion = this.foundation.getMotionIntelligenceEngine().getMotionAnalysis(input.videoId);
        const style = this.foundation.getVideoStyleIntelligenceEngine().getStyleAnalysis(input.videoId);
        const enhancementPlan = this.foundation.getVideoEnhancementPlanningEngine().getEnhancementPlan(input.videoId);
        const creativePlan = this.foundation.getCreativeVideoIntelligenceEngine().getCreativePlan(input.videoId);
        if (!analysis?.validated) {
            return this.fail(start, input.videoId, "Complete video analysis required before production planning");
        }
        if (!understanding?.validated) {
            return this.fail(start, input.videoId, "Complete video understanding required before production planning");
        }
        if (!sceneDetection?.validated) {
            return this.fail(start, input.videoId, "Scene detection required before production planning");
        }
        if (!timeline?.validated) {
            return this.fail(start, input.videoId, "Timeline intelligence required before production planning");
        }
        if (!camera?.validated) {
            return this.fail(start, input.videoId, "Camera movement intelligence required before production planning");
        }
        if (!motion?.validated) {
            return this.fail(start, input.videoId, "Motion intelligence required before production planning");
        }
        if (!style?.validated) {
            return this.fail(start, input.videoId, "Video style intelligence required before production planning");
        }
        if (!enhancementPlan?.validated) {
            return this.fail(start, input.videoId, "Video enhancement plan required before production planning");
        }
        if (!creativePlan?.validated) {
            return this.fail(start, input.videoId, "Creative video plan required before production planning");
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
            foundationReady: this.foundation.isStartupComplete(),
            knowledgeConnected: integration.knowledgeEngine,
            memoryConnected: integration.memoryEngine,
            productIntelligenceConnected: integration.productIntelligenceEngine,
            imageIntelligenceConnected: integration.imageIntelligenceEngine,
        };
        const built = this.analyzer.buildFromIntelligence(ctx, input.projectId, input.campaign, input.platform);
        const scores = this.scorer.computeScores(built.dependencies, built.assets, enhancementPlan.scores.enhancementReadinessScore, creativePlan.scores.creativeScore);
        const validation = this.scorer.isPlanValid(built.dependencies, scores, built.assets);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Production plan rejected", {
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Production plan rejected — all dependencies must pass validation",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const intelligenceId = existing?.intelligenceId ?? `production-video-${input.videoId}`;
        const draft = {
            videoId: input.videoId,
            intelligenceId,
            analysisId: analysis.analysisId,
            understandingId: understanding.understandingId,
            detectionId: sceneDetection.detectionId,
            timelineId: timeline.timelineId,
            cameraId: camera.intelligenceId,
            motionId: motion.intelligenceId,
            styleId: style.intelligenceId,
            enhancementPlanId: enhancementPlan.intelligenceId,
            creativePlanId: creativePlan.profile.creativeVideoId,
            profile: {
                ...built.profile,
                productionPlanId: existing?.profile.productionPlanId ?? built.profile.productionPlanId,
                productionVersion: version,
            },
            workflow: built.workflow,
            assets: built.assets,
            dependencies: built.dependencies,
            renderPreparation: built.renderPreparation,
            exportPreparation: built.exportPreparation,
            deliveryInstructions: built.deliveryInstructions,
            platformRules: built.platformRules,
            recoveryPlan: built.recoveryPlan,
            scores,
            relationships: {
                relatedStoryboards: [],
                relatedProductionPlans: [],
                relatedEnhancementPlans: [],
                relatedProducts: [],
                relatedBrands: [],
                relatedCampaigns: [],
                relatedScripts: [],
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
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, enhancementPlan, creativePlan, input.relatedProjects, input.relatedKnowledge, input.relatedScripts);
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.productionReadinessScore,
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
                    changeSummary: `Production video plan v${version} (planning only)`,
                    source: VideoIntelligenceSource.System,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedStoryboards,
                ...draft.relationships.relatedEnhancementPlans,
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
        this.logger.log("info", "planning", "Production video plan created", {
            videoId: input.videoId,
            platform: built.profile.platform,
            readiness: scores.productionReadinessScore,
            version,
        });
        this.logger.log("info", "workflow", "Production workflow prepared", {
            videoId: input.videoId,
            dependencies: built.dependencies.passedCount,
        });
        this.logger.log("info", "asset", "Asset validation complete", {
            videoId: input.videoId,
            sourceReady: draft.assets.sourceVideos.every((a) => a.status !== "missing"),
        });
        this.logger.log("info", "dependency", "Dependency validation complete", {
            videoId: input.videoId,
            passed: built.dependencies.allRequiredPassed,
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Production recommendations generated", {
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
        if (query.productionPlanId) {
            results = results.filter((r) => r.profile.productionPlanId === query.productionPlanId);
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
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.profile.productionPlanId.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Production video search complete", {
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
//# sourceMappingURL=production-video-processor.js.map