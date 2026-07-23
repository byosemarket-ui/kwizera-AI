import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
import { CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType, } from "./types.js";
export class CreativeVideoProcessor {
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
    async planCreative(input) {
        const start = Date.now();
        const analysis = this.foundation.getVideoAnalysisEngine().getVideo(input.videoId);
        const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(input.videoId);
        if (!analysis?.validated) {
            return this.reject(start, input.videoId, "Video must be analyzed and validated before creative planning");
        }
        if (!sceneDetection?.validated) {
            return this.reject(start, input.videoId, "Scene detection must be completed before creative planning");
        }
        const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);
        const style = this.foundation.getVideoStyleIntelligenceEngine().getStyleAnalysis(input.videoId);
        const motion = this.foundation.getMotionIntelligenceEngine().getMotionAnalysis(input.videoId);
        const camera = this.foundation.getCameraMovementEngine().getCameraAnalysis(input.videoId);
        const enhancement = this.foundation.getVideoEnhancementPlanningEngine().getEnhancementPlan(input.videoId);
        const built = this.analyzer.analyze(analysis, sceneDetection, understanding, style, motion, camera, enhancement, input.projectId, input.platform, input.creativeType);
        const storytellingBase = understanding?.scores.storytellingScore ?? 70;
        const marketingBase = understanding?.scores.marketingScore ?? 70;
        const brandConsistency = style?.scores.brandStyleScore ?? style?.brandStyle.visualConsistency ?? 70;
        const productionBase = enhancement?.scores.productionReadinessScore ?? analysis.scores.productionReadinessScore;
        const templateMatch = built.templates[0]?.matchScore ?? 60;
        const scores = this.scorer.computeScores(built.storyboard, built.recommendations.length, templateMatch, storytellingBase, marketingBase, brandConsistency, productionBase);
        const validation = this.scorer.isPlanValid(scores, built.storyboard.sceneOrder.length, built.recommendations.length, built.templates.length);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Creative plan rejected", {
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete creative plan rejected — validation required",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const intelligenceId = existing?.intelligenceId ?? `creative-video-${input.videoId}`;
        const draft = {
            videoId: input.videoId,
            intelligenceId,
            analysisId: analysis.analysisId,
            detectionId: sceneDetection.detectionId,
            enhancementPlanId: enhancement?.intelligenceId,
            styleIntelligenceId: style?.intelligenceId,
            profile: { ...built.profile, creativeVersion: version },
            creativeType: built.creativeType,
            storyboard: built.storyboard,
            structure: built.structure,
            visualPlan: built.visualPlan,
            audioPlan: built.audioPlan,
            marketingPlan: built.marketingPlan,
            platformPlans: built.platformPlans,
            templates: built.templates,
            productionInstructions: built.productionInstructions,
            scores,
            relationships: {
                relatedStoryboards: input.relatedStoryboards ?? [],
                relatedProducts: analysis.relationships.relatedProducts,
                relatedBrands: analysis.relationships.relatedBrands,
                relatedCampaigns: analysis.relationships.relatedCampaigns,
                relatedMotionPlans: [],
                relatedCameraPlans: [],
                relatedEnhancementPlans: [],
                relatedScripts: input.relatedScripts ?? [],
                relatedKnowledge: input.relatedKnowledge ?? [],
                relatedVideos: analysis.relationships.relatedVideos,
                relatedMemory: analysis.relationships.relatedMemory,
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            keywords: built.keywords,
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, sceneDetection, motion, camera, enhancement, style, input.relatedProjects, input.relatedKnowledge, input.relatedStoryboards, input.relatedScripts);
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.creativeScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? VideoIntelligenceVerificationStatus.Verified
                : VideoIntelligenceVerificationStatus.Pending,
            source: VideoIntelligenceSource.CreativeDirection,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Creative video intelligence v${version}`,
                    source: VideoIntelligenceSource.CreativeDirection,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedStoryboards,
                ...draft.relationships.relatedEnhancementPlans,
                ...draft.relationships.relatedKnowledge,
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
        this.logger.log("info", "planning", "Creative video plan complete", {
            videoId: input.videoId,
            type: draft.creativeType,
            score: scores.creativeScore,
        });
        this.logger.log("info", "storyboard", "Storyboard plan prepared", {
            videoId: input.videoId,
            scenes: draft.storyboard.sceneOrder.length,
            hook: draft.storyboard.openingHook.slice(0, 40),
        });
        if (draft.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Creative recommendations generated", {
                videoId: input.videoId,
                count: draft.recommendations.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.videoId)
            results = results.filter((r) => r.videoId === query.videoId);
        if (query.creativeType)
            results = results.filter((r) => r.creativeType === query.creativeType);
        if (query.templateType) {
            results = results.filter((r) => r.templates.some((t) => t.type === query.templateType));
        }
        if (query.story) {
            const q = query.story.toLowerCase();
            results = results.filter((r) => r.storyboard.storyStructure.toLowerCase().includes(q));
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
            results = results.filter((r) => r.profile.platform === query.platform ||
                r.platformPlans.some((p) => p.platform === query.platform));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.profile.creativeVideoId.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Creative video search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
    reject(start, videoId, message) {
        this.logger.log("warn", "validation", message, { videoId });
        return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: [message],
            message,
        };
    }
}
export { CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType };
//# sourceMappingURL=creative-video-processor.js.map