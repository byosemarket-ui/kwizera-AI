import { ImageIntelligenceHealthLevel, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, } from "../image-intelligence-foundation/types.js";
export class LightingColorProcessor {
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
        const analysis = analysisEngine.getImage(input.imageId);
        const understanding = understandingEngine.getUnderstanding(input.imageId);
        if (!analysis?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated image analysis required before lighting & color intelligence"],
                message: "Complete image analysis required before lighting & color intelligence",
            };
        }
        if (!understanding?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated image understanding required before lighting & color intelligence"],
                message: "Complete image understanding required before lighting & color intelligence",
            };
        }
        const composition = this.foundation.getCompositionIntelligenceEngine().getComposition(input.imageId);
        const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(input.imageId);
        const built = this.analyzer.buildFromIntelligence(analysis, understanding, composition, background, input.industry);
        const scores = this.scorer.computeScores(built.lighting, built.color, built.lightingSuitability, built.colorSuitability);
        const validation = this.scorer.isAnalysisValid(scores, built.color);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Lighting & color analysis rejected", {
                imageId: input.imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete lighting & color analysis rejected — validation required",
            };
        }
        const existing = this.records.get(input.imageId);
        const version = existing ? existing.version + 1 : 1;
        const lightingColorId = existing?.lightingColorId ?? `lighting-color-${input.imageId}`;
        const draft = {
            imageId: input.imageId,
            lightingColorId,
            analysisId: analysis.analysisId,
            understandingId: understanding.understandingId,
            compositionId: composition?.compositionId,
            backgroundId: background?.backgroundId,
            lighting: built.lighting,
            color: built.color,
            lightingSuitability: built.lightingSuitability,
            colorSuitability: built.colorSuitability,
            lightingPlan: built.lightingPlan,
            colorPlan: built.colorPlan,
            scores,
            relationships: {
                relatedProducts: [],
                relatedBrands: [],
                relatedCreativeStyles: [],
                relatedBackgrounds: [],
                relatedCompositionPlans: [],
                relatedStoryboards: [],
                relatedMarketingCampaigns: [],
                relatedKnowledge: [],
                relatedImages: [],
                relatedProjects: input.relatedProjects ?? [],
            },
            recommendations: built.recommendations,
            keywords: [...new Set([...built.keywords, ...(input.keywords ?? []), ...(input.marketingGoal ? [input.marketingGoal] : [])])],
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, composition, background, input.relatedProjects, input.relatedKnowledge);
        const intelligenceValidation = this.foundation.validateImageIntelligence({
            qualityScore: scores.lightingQualityScore,
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
                    changeSummary: `Lighting & color intelligence v${version}`,
                    source: ImageIntelligenceSource.ImageKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedImages,
                ...draft.relationships.relatedCompositionPlans,
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
        this.logger.log("info", "lighting", "Lighting analysis complete", {
            imageId: input.imageId,
            lightingType: built.lighting.lightingType,
            qualityScore: scores.lightingQualityScore,
            version,
        });
        this.logger.log("info", "color", "Color analysis complete", {
            imageId: input.imageId,
            colorTemperature: built.color.colorTemperature,
            brandMatch: built.color.brandColorMatching,
            qualityScore: scores.colorQualityScore,
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Lighting & color recommendations generated", {
                imageId: input.imageId,
                count: built.recommendations.length,
            });
        }
        if (draft.relationships.relatedImages.length > 0) {
            this.logger.log("info", "relationship", "Lighting & color relationships linked", {
                imageId: input.imageId,
                relatedImages: draft.relationships.relatedImages.length,
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
        if (query.lightingType) {
            results = results.filter((r) => r.lighting.lightingType === query.lightingType);
        }
        if (query.colorPalette) {
            const q = query.colorPalette.toLowerCase();
            results = results.filter((r) => r.color.colorPalette.some((c) => c.toLowerCase().includes(q)) ||
                r.color.dominantColors.some((c) => c.toLowerCase().includes(q)));
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q)));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
        }
        if (query.creativeStyle) {
            const q = query.creativeStyle.toLowerCase();
            results = results.filter((r) => r.relationships.relatedCreativeStyles.some((s) => s.toLowerCase().includes(q)));
        }
        if (query.industry) {
            const q = query.industry.toLowerCase();
            results = results.filter((r) => r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        if (query.marketingGoal) {
            results = results.filter((r) => r.keywords.includes(query.marketingGoal));
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Lighting & color intelligence search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=lighting-color-processor.js.map