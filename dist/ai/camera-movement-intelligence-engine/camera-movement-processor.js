import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
import { CameraAngle, CameraMovementType, CameraStabilityLevel, ShotFraming, } from "./types.js";
export class CameraMovementProcessor {
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
            return this.reject(start, input.videoId, "Video must be analyzed and validated before camera analysis");
        }
        if (!sceneDetection?.validated) {
            return this.reject(start, input.videoId, "Scene detection must be completed before camera analysis");
        }
        const timeline = this.foundation.getTimelineIntelligenceEngine().getTimeline(input.videoId);
        const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);
        const built = this.analyzer.analyze(analysis, sceneDetection, timeline, understanding);
        const avgContinuity = built.transitions.length > 0
            ? Math.round(built.transitions.reduce((s, t) => s + t.continuityScore, 0) / built.transitions.length)
            : 80;
        const storytellingScore = understanding?.scores.storytellingScore ?? 70;
        const productionBase = timeline?.scores.productionReadinessScore ?? analysis.scores.productionReadinessScore;
        const scores = this.scorer.computeScores(built.shotAnalyses, avgContinuity, productionBase, storytellingScore);
        const validation = this.scorer.isAnalysisValid(scores, built.shotAnalyses.length);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Camera analysis rejected", {
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete camera analysis rejected — validation required",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const intelligenceId = existing?.intelligenceId ?? `camera-movement-${input.videoId}`;
        const dominantShot = built.shotAnalyses[0];
        const draft = {
            videoId: input.videoId,
            intelligenceId,
            analysisId: analysis.analysisId,
            detectionId: sceneDetection.detectionId,
            timelineId: timeline?.timelineId,
            shotAnalyses: built.shotAnalyses,
            transitions: built.transitions,
            dominantMovement: built.movementPlan.recommendedMovement,
            dominantAngle: dominantShot?.angle ?? CameraAngle.EyeLevel,
            dominantFraming: dominantShot?.framing ?? ShotFraming.MediumShot,
            overallStability: built.shotAnalyses.filter((s) => s.stability === CameraStabilityLevel.Stable).length >
                built.shotAnalyses.length / 2
                ? CameraStabilityLevel.Stable
                : CameraStabilityLevel.SlightShake,
            motionSmoothness: built.shotAnalyses.length > 0
                ? Math.round(built.shotAnalyses.reduce((s, sh) => s + sh.motionSmoothness, 0) / built.shotAnalyses.length)
                : 70,
            stabilizationQuality: built.shotAnalyses.length > 0
                ? Math.round(built.shotAnalyses.reduce((s, sh) => s + sh.stabilizationQuality, 0) /
                    built.shotAnalyses.length)
                : 70,
            cinematicPurposes: built.cinematicPurposes,
            movementPlan: built.movementPlan,
            scores,
            relationships: {
                relatedScenes: [],
                relatedShots: [],
                relatedTimelines: [],
                relatedStoryboards: input.relatedStoryboards ?? [],
                relatedScripts: input.relatedScripts ?? [],
                relatedProducts: analysis.relationships.relatedProducts,
                relatedBrands: analysis.relationships.relatedBrands,
                relatedCampaigns: analysis.relationships.relatedCampaigns,
                relatedKnowledge: input.relatedKnowledge ?? [],
                relatedVideos: analysis.relationships.relatedVideos,
                relatedMemory: analysis.relationships.relatedMemory,
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            detectedMovements: built.detectedMovements,
            keywords: built.keywords,
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, sceneDetection, timeline, input.relatedProjects, input.relatedKnowledge, input.relatedStoryboards, input.relatedScripts);
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.cameraMovementScore,
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
                    changeSummary: `Camera movement intelligence v${version}`,
                    source: VideoIntelligenceSource.VideoKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedShots,
                ...draft.relationships.relatedTimelines,
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
        this.logger.log("info", "analysis", "Camera movement analysis complete", {
            videoId: input.videoId,
            shots: draft.shotAnalyses.length,
            movements: draft.detectedMovements.length,
            score: scores.cameraMovementScore,
        });
        this.logger.log("info", "planning", "Camera movement plan prepared", {
            videoId: input.videoId,
            recommended: draft.movementPlan.recommendedMovement,
            style: draft.movementPlan.cinematicStyle,
        });
        if (draft.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Camera recommendations generated", {
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
        if (query.movement) {
            results = results.filter((r) => r.dominantMovement === query.movement ||
                r.detectedMovements.includes(query.movement) ||
                r.shotAnalyses.some((s) => s.movement === query.movement));
        }
        if (query.angle) {
            results = results.filter((r) => r.dominantAngle === query.angle || r.shotAnalyses.some((s) => s.angle === query.angle));
        }
        if (query.framing) {
            results = results.filter((r) => r.dominantFraming === query.framing || r.shotAnalyses.some((s) => s.framing === query.framing));
        }
        if (query.sceneId) {
            results = results.filter((r) => r.shotAnalyses.some((s) => s.sceneId === query.sceneId));
        }
        if (query.shotId) {
            results = results.filter((r) => r.shotAnalyses.some((s) => s.shotId === query.shotId));
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
            results = results.filter((r) => r.movementPlan.recommendedPath.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Camera movement search complete", {
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
export { CameraMovementType, CameraAngle, ShotFraming };
//# sourceMappingURL=camera-movement-processor.js.map