import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
import { MotionClassification, MotionEventType, ObjectMotionType, TrackingSubjectType, } from "./types.js";
export class MotionIntelligenceProcessor {
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
    async analyze(input) {
        const start = Date.now();
        const analysis = this.foundation.getVideoAnalysisEngine().getVideo(input.videoId);
        const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(input.videoId);
        if (!analysis?.validated) {
            return this.reject(start, input.videoId, "Video must be analyzed and validated before motion analysis");
        }
        if (!sceneDetection?.validated) {
            return this.reject(start, input.videoId, "Scene detection must be completed before motion analysis");
        }
        const timeline = this.foundation.getTimelineIntelligenceEngine().getTimeline(input.videoId);
        const camera = this.foundation.getCameraMovementEngine().getCameraAnalysis(input.videoId);
        const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);
        const built = this.analyzer.analyze(analysis, sceneDetection, timeline, camera, understanding);
        const productionBase = timeline?.scores.productionReadinessScore ?? analysis.scores.productionReadinessScore;
        const cinematicBase = camera?.scores.cinematicScore ?? understanding?.scores.marketingScore ?? 65;
        const scores = this.scorer.computeScores(built.metrics, built.objectMotions, built.subjectTracks, built.motionEvents.length, productionBase, cinematicBase);
        const validation = this.scorer.isAnalysisValid(scores, built.objectMotions.length, built.subjectTracks.length, built.motionEvents.length);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Motion analysis rejected", {
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete motion analysis rejected — validation required",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const intelligenceId = existing?.intelligenceId ?? `motion-intelligence-${input.videoId}`;
        const draft = {
            videoId: input.videoId,
            intelligenceId,
            analysisId: analysis.analysisId,
            detectionId: sceneDetection.detectionId,
            cameraIntelligenceId: camera?.intelligenceId,
            timelineId: timeline?.timelineId,
            metrics: built.metrics,
            objectMotions: built.objectMotions,
            subjectTracks: built.subjectTracks,
            motionEvents: built.motionEvents,
            classifications: built.classifications,
            dominantClassification: built.dominantClassification,
            motionPlan: built.motionPlan,
            scores,
            relationships: {
                relatedScenes: [],
                relatedShots: [],
                relatedCameraMovements: [],
                relatedTimelines: [],
                relatedStoryboards: input.relatedStoryboards ?? [],
                relatedProducts: analysis.relationships.relatedProducts,
                relatedBrands: analysis.relationships.relatedBrands,
                relatedCampaigns: analysis.relationships.relatedCampaigns,
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
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, sceneDetection, timeline, camera, input.relatedProjects, input.relatedKnowledge, input.relatedStoryboards);
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.motionQualityScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? VideoIntelligenceVerificationStatus.Verified
                : VideoIntelligenceVerificationStatus.Pending,
            source: VideoIntelligenceSource.VideoKnowledge,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Motion intelligence v${version}`,
                    source: VideoIntelligenceSource.VideoKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedShots,
                ...draft.relationships.relatedTimelines,
                ...draft.relationships.relatedCameraMovements,
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
        this.logger.log("info", "analysis", "Motion intelligence analysis complete", {
            videoId: input.videoId,
            tracks: draft.subjectTracks.length,
            events: draft.motionEvents.length,
            score: scores.motionQualityScore,
        });
        this.logger.log("info", "tracking", "Subject tracking prepared", {
            videoId: input.videoId,
            tracks: draft.subjectTracks.length,
        });
        this.logger.log("info", "planning", "Motion plan prepared", {
            videoId: input.videoId,
            classification: draft.dominantClassification,
            segments: draft.motionPlan.motionTimeline.length,
        });
        if (draft.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Motion recommendations generated", {
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
        if (query.classification) {
            results = results.filter((r) => r.dominantClassification === query.classification ||
                r.classifications.includes(query.classification));
        }
        if (query.eventType) {
            results = results.filter((r) => r.motionEvents.some((e) => e.type === query.eventType));
        }
        if (query.objectType) {
            results = results.filter((r) => r.objectMotions.some((o) => o.type === query.objectType));
        }
        if (query.subjectType) {
            results = results.filter((r) => r.subjectTracks.some((t) => t.subjectType === query.subjectType));
        }
        if (query.timelineId) {
            results = results.filter((r) => r.relationships.relatedTimelines.includes(query.timelineId));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q)));
        }
        if (query.campaign) {
            const q = query.campaign.toLowerCase();
            results = results.filter((r) => r.relationships.relatedCampaigns.some((c) => c.toLowerCase().includes(q)));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.motionPlan.motionPath.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Motion intelligence search complete", {
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
export { MotionClassification, MotionEventType, ObjectMotionType, TrackingSubjectType };
//# sourceMappingURL=motion-intelligence-processor.js.map