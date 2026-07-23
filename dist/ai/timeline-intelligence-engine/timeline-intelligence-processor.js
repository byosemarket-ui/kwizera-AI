import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
import { TimelineIntelligenceIndexer } from "./timeline-intelligence-indexer.js";
import { TrackType, TimelineVariant, } from "./types.js";
export class TimelineIntelligenceProcessor {
    foundation;
    analyzer;
    scorer;
    linker;
    records;
    logger;
    indexer;
    constructor(foundation, analyzer, scorer, linker, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.scorer = scorer;
        this.linker = linker;
        this.records = records;
        this.logger = logger;
        this.indexer = new TimelineIntelligenceIndexer(foundation);
    }
    async analyze(input) {
        const start = Date.now();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const sceneEngine = this.foundation.getSceneDetectionEngine();
        const analysis = analysisEngine.getVideo(input.videoId);
        const sceneDetection = sceneEngine.getDetection(input.videoId);
        if (!analysis || !analysis.validated) {
            this.logger.log("warn", "validation", "Timeline intelligence rejected — analysis required", {
                videoId: input.videoId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Video must be analyzed and validated before timeline intelligence"],
                message: "Complete video analysis required before timeline intelligence",
            };
        }
        if (!sceneDetection || !sceneDetection.validated) {
            this.logger.log("warn", "validation", "Timeline intelligence rejected — scene detection required", {
                videoId: input.videoId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Scene detection must be completed before timeline intelligence"],
                message: "Complete scene detection required before timeline intelligence",
            };
        }
        const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);
        const built = this.analyzer.analyze(analysis, sceneDetection, understanding, input);
        const scores = this.scorer.computeScores(analysis.technical.durationMs, sceneDetection.sceneCount, sceneDetection.shotCount, built.tracks.length, built.variants.length, built.synchronization, built.optimization, built.editingReadiness, built.renderingReadiness, analysis.frame.frameConsistencyScore);
        const validation = this.scorer.isTimelineValid(scores, sceneDetection.sceneCount, built.tracks.length);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Timeline intelligence rejected", {
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete timeline rejected — validation required",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const timelineVersion = existing ? existing.timelineVersion + 1 : 1;
        const intelligenceId = existing?.intelligenceId ?? `timeline-intelligence-${input.videoId}`;
        const draft = {
            videoId: input.videoId,
            intelligenceId,
            analysisId: analysis.analysisId,
            detectionId: sceneDetection.detectionId,
            understandingId: understanding?.understandingId,
            timelineId: built.timelineId,
            timelineVersion,
            timelineLengthMs: analysis.technical.durationMs,
            sections: built.sections,
            hierarchy: built.hierarchy,
            dependencies: built.dependencies,
            sceneSequence: built.sceneSequence,
            shotSequence: built.shotSequence,
            tracks: built.tracks,
            synchronization: built.synchronization,
            optimization: built.optimization,
            variants: built.variants,
            indexes: {
                timelineIndexIds: [],
                sceneIndexIds: [],
                shotIndexIds: [],
                trackIndexIds: [],
                syncIndexIds: [],
            },
            scores,
            relationships: {
                relatedVideos: analysis.relationships.relatedVideos,
                relatedScenes: [],
                relatedShots: [],
                relatedProducts: analysis.relationships.relatedProducts,
                relatedBrands: analysis.relationships.relatedBrands,
                relatedCampaigns: analysis.relationships.relatedCampaigns,
                relatedStoryboards: input.relatedStoryboards ?? [],
                relatedScripts: input.relatedScripts ?? [],
                relatedAudioPlans: input.relatedAudioPlans ?? [],
                relatedProductionPlans: input.relatedProductionPlans ?? [],
                relatedKnowledge: input.relatedKnowledge ?? [],
                relatedMemory: analysis.relationships.relatedMemory,
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            editingReadiness: built.editingReadiness,
            renderingReadiness: built.renderingReadiness,
            keywords: built.keywords,
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, sceneDetection, input.relatedProjects, input.relatedKnowledge, input.relatedStoryboards, input.relatedScripts, input.relatedAudioPlans, input.relatedProductionPlans);
        const indexStart = Date.now();
        draft.indexes = this.indexer.createIndexes(draft, input.projectId);
        const indexMs = Date.now() - indexStart;
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.timelineQualityScore,
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
                    changeSummary: `Timeline intelligence v${version}`,
                    source: VideoIntelligenceSource.System,
                },
            ],
            relationshipLinks: [
                ...draft.indexes.timelineIndexIds,
                ...draft.indexes.sceneIndexIds,
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
        this.logger.log("info", "timeline", "Timeline intelligence complete", {
            videoId: input.videoId,
            timelineId: draft.timelineId,
            variants: draft.variants.length,
            quality: scores.timelineQualityScore,
            version,
        });
        this.logger.log("info", "sync", "Synchronization analysis complete", {
            videoId: input.videoId,
            overallSync: draft.synchronization.overallSyncScore,
        });
        this.logger.log("info", "track", "Track management complete", {
            videoId: input.videoId,
            tracks: draft.tracks.length,
        });
        this.logger.log("info", "indexing", "Timeline indexes created", {
            videoId: input.videoId,
            timelines: draft.indexes.timelineIndexIds.length,
            scenes: draft.indexes.sceneIndexIds.length,
            durationMs: indexMs,
        });
        if (draft.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Timeline recommendations generated", {
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
        if (query.timelineId) {
            results = results.filter((r) => r.timelineId === query.timelineId ||
                r.variants.some((v) => v.timelineId === query.timelineId));
        }
        if (query.sceneId) {
            results = results.filter((r) => r.sceneSequence.some((s) => s.sceneId === query.sceneId));
        }
        if (query.shotId) {
            results = results.filter((r) => r.shotSequence.some((s) => s.shotId === query.shotId));
        }
        if (query.trackType) {
            results = results.filter((r) => r.tracks.some((t) => t.trackType === query.trackType));
        }
        if (query.variant) {
            results = results.filter((r) => r.variants.some((v) => v.variant === query.variant));
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
            results = results.filter((r) => r.timelineId.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Timeline intelligence search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
export { TrackType, TimelineVariant };
//# sourceMappingURL=timeline-intelligence-processor.js.map