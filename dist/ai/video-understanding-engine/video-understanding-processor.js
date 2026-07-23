import { VideoIntelligenceHealthLevel, VideoIntelligenceSource, VideoIntelligenceVerificationStatus, } from "../video-intelligence-foundation/types.js";
import { VideoUnderstandingGraphBuilder } from "./video-understanding-graph.js";
import { VideoStoryType, VideoUnderstandingMarketingGoal, } from "./types.js";
export class VideoUnderstandingProcessor {
    foundation;
    analyzer;
    scorer;
    linker;
    records;
    logger;
    graphBuilder = new VideoUnderstandingGraphBuilder();
    constructor(foundation, analyzer, scorer, linker, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.scorer = scorer;
        this.linker = linker;
        this.records = records;
        this.logger = logger;
    }
    async understand(input) {
        const start = Date.now();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const analysis = analysisEngine.getVideo(input.videoId);
        if (!analysis || !analysis.validated) {
            this.logger.log("warn", "validation", "Video understanding rejected — analysis required", {
                videoId: input.videoId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Video must be analyzed and validated before understanding"],
                message: "Complete video analysis required before understanding",
            };
        }
        const marketingGoal = input.marketingGoal ?? VideoUnderstandingMarketingGoal.Conversion;
        const storyType = input.storyType ?? VideoStoryType.Other;
        const industry = input.industry ?? analysis.classification.category;
        const built = this.analyzer.buildFromAnalysis(analysis, marketingGoal, storyType, industry);
        const scores = this.scorer.computeScores(built.purpose, built.story, built.product, built.brand, built.audience, built.marketing, analysis.scores.productionReadinessScore);
        const validation = this.scorer.isUnderstandingValid(scores, built.purpose);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Video understanding rejected", {
                videoId: input.videoId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete understanding rejected — validation required",
            };
        }
        const existing = this.records.get(input.videoId);
        const version = existing ? existing.version + 1 : 1;
        const understandingId = existing?.understandingId ?? `video-understanding-${input.videoId}`;
        const draft = {
            videoId: input.videoId,
            understandingId,
            analysisId: analysis.analysisId,
            identity: built.identity,
            purpose: built.purpose,
            context: built.context,
            scenes: built.scenes,
            sceneRelationships: built.sceneRelationships,
            story: built.story,
            product: built.product,
            brand: built.brand,
            audience: built.audience,
            marketing: built.marketing,
            structure: built.structure,
            knowledgeGraph: { nodes: [], edges: [] },
            scores,
            relationships: {
                relatedProducts: analysis.relationships.relatedProducts,
                relatedBrands: analysis.relationships.relatedBrands,
                relatedCampaigns: analysis.relationships.relatedCampaigns,
                relatedImages: analysis.relationships.relatedImages,
                relatedStoryboards: input.relatedStoryboards ?? [],
                relatedScripts: input.relatedScripts ?? [],
                relatedCreativePlans: input.relatedCreativePlans ?? [],
                relatedKnowledge: input.relatedKnowledge ?? [],
                relatedVideos: analysis.relationships.relatedVideos,
                relatedMemory: analysis.relationships.relatedMemory,
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            marketingGoal,
            storyType: built.resolvedStoryType,
            industry,
            keywords: built.keywords,
            validated: true,
            understoodAt: existing?.understoodAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, input.relatedProjects, input.relatedKnowledge, input.relatedStoryboards, input.relatedScripts, input.relatedCreativePlans);
        const graphStart = Date.now();
        draft.knowledgeGraph = this.graphBuilder.build(draft);
        const graphMs = Date.now() - graphStart;
        const intelligenceValidation = this.foundation.validateVideoIntelligence({
            qualityScore: scores.videoUnderstandingScore,
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
                    changeSummary: `Video understanding v${version}`,
                    source: VideoIntelligenceSource.VideoKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedVideos,
                ...draft.knowledgeGraph.nodes.map((n) => n.nodeId),
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
        this.logger.log("info", "understanding", "Video understanding complete", {
            videoId: input.videoId,
            understandingScore: scores.videoUnderstandingScore,
            storytellingScore: scores.storytellingScore,
            marketingScore: scores.marketingScore,
            version,
        });
        this.logger.log("info", "story", "Story understanding recorded", {
            videoId: input.videoId,
            storyType: built.story.storyType,
            narrativeStructure: built.story.narrativeStructure,
        });
        this.logger.log("info", "scene", "Scene understanding recorded", {
            videoId: input.videoId,
            sceneCount: built.scenes.length,
            roles: built.scenes.map((s) => s.role).join(", "),
        });
        this.logger.log("info", "graph", "Knowledge graph built", {
            videoId: input.videoId,
            nodes: draft.knowledgeGraph.nodes.length,
            edges: draft.knowledgeGraph.edges.length,
            durationMs: graphMs,
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Understanding recommendations generated", {
                videoId: input.videoId,
                count: built.recommendations.length,
            });
        }
        if (draft.relationships.relatedVideos.length > 0) {
            this.logger.log("info", "relationship", "Understanding relationships linked", {
                videoId: input.videoId,
                relatedVideos: draft.relationships.relatedVideos.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.videoPurpose) {
            const q = query.videoPurpose.toLowerCase();
            results = results.filter((r) => r.purpose.primaryPurpose.toLowerCase().includes(q));
        }
        if (query.storyType) {
            results = results.filter((r) => r.story.storyType === query.storyType);
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.product.mainProduct.toLowerCase().includes(q) ||
                r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.brand.brandIdentity.toLowerCase().includes(q));
        }
        if (query.campaign) {
            const q = query.campaign.toLowerCase();
            results = results.filter((r) => r.relationships.relatedCampaigns.some((c) => c.toLowerCase().includes(q)));
        }
        if (query.audience) {
            const q = query.audience.toLowerCase();
            results = results.filter((r) => r.audience.targetAudience.toLowerCase().includes(q));
        }
        if (query.marketingGoal) {
            results = results.filter((r) => r.marketingGoal === query.marketingGoal);
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.identity.videoName.toLowerCase().includes(q) ||
                r.purpose.primaryPurpose.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Video understanding search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=video-understanding-processor.js.map