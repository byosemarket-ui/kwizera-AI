import { ImageIntelligenceHealthLevel, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, } from "../image-intelligence-foundation/types.js";
export class BackgroundProcessor {
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
        const analysisEngine = this.foundation.getImageAnalysisEngine();
        const understandingEngine = this.foundation.getImageUnderstandingEngine();
        const detectionEngine = this.foundation.getObjectDetectionIntelligenceEngine();
        const analysis = analysisEngine.getImage(input.imageId);
        const understanding = understandingEngine.getUnderstanding(input.imageId);
        const detection = detectionEngine.getDetection(input.imageId);
        if (!analysis?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated image analysis required before background intelligence"],
                message: "Complete image analysis required before background intelligence",
            };
        }
        if (!understanding?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated image understanding required before background intelligence"],
                message: "Complete image understanding required before background intelligence",
            };
        }
        if (!detection?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated object detection required before background intelligence"],
                message: "Complete object detection required before background intelligence",
            };
        }
        const built = this.analyzer.buildFromIntelligence(analysis, understanding, detection, input.industry);
        const scores = this.scorer.computeScores(built.analysis, built.quality, built.suitability);
        const validation = this.scorer.isAnalysisValid(scores, built.backgroundLabel);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Background analysis rejected", {
                imageId: input.imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete background analysis rejected — validation required",
            };
        }
        const existing = this.records.get(input.imageId);
        const version = existing ? existing.version + 1 : 1;
        const backgroundId = existing?.backgroundId ?? `background-${input.imageId}`;
        const draft = {
            imageId: input.imageId,
            backgroundId,
            analysisId: analysis.analysisId,
            understandingId: understanding.understandingId,
            detectionId: detection.detectionId,
            backgroundLabel: built.backgroundLabel,
            analysis: built.analysis,
            classification: built.classification,
            quality: built.quality,
            suitability: built.suitability,
            replacementPlan: built.replacementPlan,
            scores,
            relationships: {
                relatedProducts: [],
                relatedBrands: [],
                relatedScenes: [],
                relatedCreativeStyles: [],
                relatedMarketingCampaigns: [],
                relatedVisualPlans: [],
                relatedKnowledge: [],
                relatedBackgrounds: [],
                relatedImages: [],
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            keywords: [...new Set([...built.keywords, ...(input.keywords ?? [])])],
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, detection, input.relatedProjects, input.relatedKnowledge);
        const intelligenceValidation = this.foundation.validateImageIntelligence({
            qualityScore: scores.backgroundQualityScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? ImageIntelligenceVerificationStatus.Verified
                : ImageIntelligenceVerificationStatus.Pending,
            source: ImageIntelligenceSource.ImageKnowledge,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Background intelligence v${version}`,
                    source: ImageIntelligenceSource.ImageKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedImages,
                ...draft.relationships.relatedBackgrounds,
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
        this.logger.log("info", "analysis", "Background analysis complete", {
            imageId: input.imageId,
            backgroundType: built.analysis.backgroundType,
            qualityScore: scores.backgroundQualityScore,
            version,
        });
        this.logger.log("info", "classification", "Background classified", {
            imageId: input.imageId,
            type: built.classification.backgroundType,
            tags: built.classification.classificationTags,
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Background recommendations generated", {
                imageId: input.imageId,
                count: built.recommendations.length,
            });
        }
        if (draft.relationships.relatedImages.length > 0) {
            this.logger.log("info", "relationship", "Background relationships linked", {
                imageId: input.imageId,
                relatedImages: draft.relationships.relatedImages.length,
                relatedBackgrounds: draft.relationships.relatedBackgrounds.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.imageId) {
            results = results.filter((r) => r.imageId === query.imageId);
        }
        if (query.backgroundType) {
            results = results.filter((r) => r.classification.backgroundType === query.backgroundType);
        }
        if (query.industry) {
            const q = query.industry.toLowerCase();
            results = results.filter((r) => r.classification.industryFit.toLowerCase().includes(q));
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q)));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
        }
        if (query.scene) {
            const q = query.scene.toLowerCase();
            results = results.filter((r) => r.relationships.relatedScenes.some((s) => s.toLowerCase().includes(q)));
        }
        if (query.creativeStyle) {
            const q = query.creativeStyle.toLowerCase();
            results = results.filter((r) => r.relationships.relatedCreativeStyles.some((s) => s.toLowerCase().includes(q)));
        }
        if (query.marketingGoal) {
            results = results.filter((r) => r.keywords.includes(query.marketingGoal));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Background intelligence search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=background-processor.js.map