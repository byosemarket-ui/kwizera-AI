import crypto from "node:crypto";
import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
import { VideoType } from "../video-knowledge-engine/types.js";
import { VideoAnalysisIndexer } from "./video-analysis-indexer.js";
import { VideoAnalysisType, } from "./types.js";
const TYPE_TO_KNOWLEDGE = {
    [VideoAnalysisType.Advertisement]: VideoType.Marketing,
    [VideoAnalysisType.Commercial]: VideoType.Commercial,
    [VideoAnalysisType.ProductShowcase]: VideoType.Product,
    [VideoAnalysisType.Tutorial]: VideoType.Tutorial,
    [VideoAnalysisType.SocialMedia]: VideoType.Social,
    [VideoAnalysisType.Documentary]: VideoType.Cinematic,
    [VideoAnalysisType.Presentation]: VideoType.Brand,
    [VideoAnalysisType.Interview]: VideoType.Brand,
    [VideoAnalysisType.Animation]: VideoType.Promotional,
    [VideoAnalysisType.Corporate]: VideoType.Brand,
    [VideoAnalysisType.Other]: VideoType.Marketing,
};
export class VideoAnalysisProcessor {
    foundation;
    analyzer;
    completeness;
    scorer;
    linker;
    records;
    logger;
    indexer;
    constructor(foundation, analyzer, completeness, scorer, linker, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.completeness = completeness;
        this.scorer = scorer;
        this.linker = linker;
        this.records = records;
        this.logger = logger;
        this.indexer = new VideoAnalysisIndexer(foundation);
    }
    async analyze(input) {
        const start = Date.now();
        const analysis = this.analyzer.analyze(input);
        const missingFields = this.completeness.detect(input, analysis.technical);
        const criticallyIncomplete = this.completeness.isCriticallyIncomplete(missingFields);
        const { scores, productionReadiness } = this.scorer.computeScores(analysis.technical, analysis.frame, analysis.timeline, analysis.audio, analysis.visual, missingFields);
        const validation = this.scorer.isAnalysisValid(scores, missingFields, criticallyIncomplete);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Video analysis rejected — incomplete or low quality", {
                videoName: analysis.technical.videoName,
                missingFields,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                missingFields,
                message: "Incomplete video analysis rejected — validation required before approval",
            };
        }
        const videoId = input.videoId ?? `vai-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const analysisId = `video-analysis-${videoId}`;
        const existing = this.records.get(videoId);
        const version = existing ? existing.version + 1 : 1;
        analysis.technical.videoId = videoId;
        let knowledgeId;
        const knowledgeFoundation = this.foundation.integration.getKnowledgeFoundation();
        if (knowledgeFoundation) {
            const knowledgeResult = await knowledgeFoundation.getVideoKnowledgeEngine().analyzeVideo({
                videoId,
                videoPath: analysis.technical.filePath,
                videoName: analysis.technical.videoName,
                videoType: TYPE_TO_KNOWLEDGE[analysis.classification.videoType],
                duration: analysis.technical.durationMs / 1000,
                resolution: analysis.technical.resolution,
                aspectRatio: analysis.technical.aspectRatio,
                product: input.product,
                brandName: input.brand,
                category: analysis.classification.category,
                language: input.language,
                visual: {
                    lighting: `brightness-${analysis.visual.brightness}`,
                    colorGrading: analysis.visual.dominantColors.join(", "),
                    brandingConsistency: analysis.visual.visualStability,
                },
                audio: {
                    audioQuality: analysis.audio.overallAudioQualityScore,
                },
                tags: input.tags,
                keywords: input.keywords,
                relatedKnowledge: input.relatedKnowledge,
                relatedMemory: input.relatedMemory,
            });
            if (knowledgeResult.success && knowledgeResult.record) {
                knowledgeId = knowledgeResult.record.knowledgeId;
            }
        }
        const draft = {
            videoId,
            analysisId,
            knowledgeId,
            technical: analysis.technical,
            frame: analysis.frame,
            timeline: analysis.timeline,
            audio: analysis.audio,
            visual: analysis.visual,
            classification: analysis.classification,
            productionReadiness,
            scores,
            relationships: {
                relatedProducts: input.product ? [input.product] : [],
                relatedBrands: input.brand ? [input.brand] : [],
                relatedImages: input.relatedImages ?? [],
                relatedAudio: analysis.audio.tracks.map((t) => t.trackId),
                relatedCampaigns: input.campaign ? [input.campaign] : [],
                relatedStoryboards: [],
                relatedCreativeStyles: [analysis.classification.creativeStyle],
                relatedKnowledge: input.relatedKnowledge ?? [],
                relatedVideos: input.relatedVideos ?? [],
                relatedMemory: input.relatedMemory ?? [],
                relatedProjects: input.relatedProjects ?? (input.projectId ? [input.projectId] : []),
            },
            indexes: {
                frameIndexIds: [],
                keyframeIndexIds: [],
                timelineIndexIds: [],
                sceneIndexIds: [],
                audioIndexIds: [],
                metadataIndexIds: [],
            },
            recommendations: this.scorer.buildRecommendations(scores, analysis.frame, analysis.audio),
            missingFields,
            tags: input.tags ?? [],
            keywords: input.keywords ?? [
                analysis.technical.videoName,
                analysis.classification.videoType,
                input.product ?? "",
                input.brand ?? "",
                analysis.technical.resolution,
            ].filter(Boolean),
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), knowledgeId ? [knowledgeId, ...(input.relatedKnowledge ?? [])] : input.relatedKnowledge ?? [], input.relatedMemory ?? []);
        draft.indexes = this.indexer.createIndexes(draft, input.projectId);
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.technicalQualityScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? VideoIntelligenceVerificationStatus.Verified
                : VideoIntelligenceVerificationStatus.Pending,
            source: VideoIntelligenceSource.VideoKnowledge,
            sourceRef: knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Video analysis v${version}`,
                    source: VideoIntelligenceSource.VideoKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedVideos,
                ...draft.indexes.frameIndexIds,
            ],
            healthStatus: VideoIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                missingFields,
                message: "Video intelligence validation failed",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "classification", "Video classified", {
            videoId,
            videoType: analysis.classification.videoType,
            category: analysis.classification.category,
        });
        this.logger.log("info", "timeline", "Timeline analysis complete", {
            videoId,
            scenes: analysis.timeline.sceneCount,
            shots: analysis.timeline.shotCount,
        });
        this.logger.log("info", "audio", "Audio analysis complete", {
            videoId,
            tracks: analysis.audio.tracks.length,
            quality: analysis.audio.overallAudioQualityScore,
        });
        this.logger.log("info", "indexing", "Video indexes created", {
            videoId,
            frames: draft.indexes.frameIndexIds.length,
            keyframes: draft.indexes.keyframeIndexIds.length,
            scenes: draft.indexes.sceneIndexIds.length,
        });
        this.logger.log("info", "analysis", "Video analysis complete", {
            videoId,
            analysisId,
            completeness: scores.videoCompletenessScore,
            confidence: scores.aiConfidenceScore,
            knowledgeId,
            version,
        });
        if (draft.relationships.relatedVideos.length > 0) {
            this.logger.log("info", "relationship", "Video relationships detected", {
                videoId,
                relatedVideos: draft.relationships.relatedVideos.length,
                relatedBrands: draft.relationships.relatedBrands.length,
            });
        }
        return {
            success: true,
            record: draft,
            durationMs: Date.now() - start,
            diagnostics: [],
            missingFields,
        };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.videoName) {
            const q = query.videoName.toLowerCase();
            results = results.filter((r) => r.technical.videoName.toLowerCase().includes(q));
        }
        if (query.videoType) {
            results = results.filter((r) => r.classification.videoType === query.videoType);
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
        if (query.resolution) {
            results = results.filter((r) => r.technical.resolution === query.resolution);
        }
        if (query.fps !== undefined) {
            results = results.filter((r) => r.technical.fps === query.fps);
        }
        if (query.minDurationMs !== undefined) {
            results = results.filter((r) => r.technical.durationMs >= query.minDurationMs);
        }
        if (query.maxDurationMs !== undefined) {
            results = results.filter((r) => r.technical.durationMs <= query.maxDurationMs);
        }
        if (query.tags?.length) {
            results = results.filter((r) => query.tags.some((t) => r.tags.includes(t)));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.some((rk) => rk.toLowerCase().includes(k.toLowerCase()))));
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.technical.videoName.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)) ||
                r.tags.some((t) => t.toLowerCase().includes(q)));
        }
        const limit = query.limit ?? 20;
        const sliced = results.slice(0, limit);
        this.logger.log("debug", "search", "Video analysis search complete", {
            query: query.text ?? query.videoName ?? "filter",
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=video-analysis-processor.js.map