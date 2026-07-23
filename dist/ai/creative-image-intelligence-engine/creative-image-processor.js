import { ImageIntelligenceHealthLevel, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, } from "../image-intelligence-foundation/types.js";
export class CreativeImageProcessor {
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
    async plan(input) {
        const start = Date.now();
        const analysis = this.foundation.getImageAnalysisEngine().getImage(input.imageId);
        const understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(input.imageId);
        const composition = this.foundation.getCompositionIntelligenceEngine().getComposition(input.imageId);
        const brandVisual = this.foundation.getBrandVisualIntelligenceEngine().getBrandVisual(input.imageId);
        if (!analysis?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated image analysis required before creative planning"],
                message: "Complete image analysis required before creative image intelligence",
            };
        }
        if (!understanding?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated image understanding required before creative planning"],
                message: "Complete image understanding required before creative image intelligence",
            };
        }
        if (!composition?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated composition intelligence required for layout planning"],
                message: "Composition intelligence required before creative image planning",
            };
        }
        if (!brandVisual?.validated) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Validated brand visual intelligence required for brand-aligned creative planning"],
                message: "Brand visual intelligence required before creative image planning",
            };
        }
        const enhancementPlan = this.foundation.getImageEnhancementPlanningEngine().getEnhancementPlan(input.imageId) ?? null;
        const built = this.analyzer.buildFromIntelligence(analysis, understanding, composition, brandVisual, enhancementPlan, input.projectId, input.campaign, input.platform, input.layoutType, input.creativeStyle, input.marketingType);
        const scores = this.scorer.computeScores(composition, brandVisual, understanding, Boolean(enhancementPlan));
        const validation = this.scorer.isPlanValid(scores, brandVisual, composition);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Creative plan rejected", {
                imageId: input.imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Creative image plan rejected — brand, marketing and layout alignment required",
            };
        }
        const existing = this.records.get(input.imageId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            imageId: input.imageId,
            profile: {
                ...built.profile,
                creativeImageId: existing?.profile.creativeImageId ?? built.profile.creativeImageId,
            },
            analysisId: analysis.analysisId,
            understandingId: understanding.understandingId,
            compositionId: composition.compositionId,
            brandVisualId: brandVisual.brandVisualId,
            enhancementPlanId: enhancementPlan?.profile.enhancementPlanId,
            layoutPlanning: built.layoutPlanning,
            creativeStyle: built.creativeStylePlan,
            marketingPreparation: built.marketingPreparation,
            platformPreparation: built.platformPreparation,
            productionInstructions: built.productionInstructions,
            scores,
            relationships: {
                relatedProducts: [],
                relatedBrands: [],
                relatedCampaigns: [],
                relatedCreativeStyles: [],
                relatedMarketingStrategy: [],
                relatedVisualPlans: [],
                relatedEnhancementPlans: [],
                relatedCompositionIntelligence: [],
                relatedBrandVisualIntelligence: [],
                relatedProjects: input.relatedProjects ?? [],
                relatedKnowledge: [],
            },
            recommendations: built.recommendations,
            keywords: [...new Set([...built.keywords, ...(input.keywords ?? []), built.layoutPlanning.layoutType])],
            productionReady: scores.creativeLayoutScore >= 55 && scores.brandConsistencyScore >= 55,
            validated: true,
            plannedAt: existing?.plannedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, understanding, composition, brandVisual, enhancementPlan, input.relatedProjects, input.relatedKnowledge);
        const intelligenceValidation = this.foundation.validateImageIntelligence({
            qualityScore: scores.creativeLayoutScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? ImageIntelligenceVerificationStatus.Verified
                : ImageIntelligenceVerificationStatus.Pending,
            source: ImageIntelligenceSource.CreativeDirection,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Creative image plan v${version} (planning only)`,
                    source: ImageIntelligenceSource.CreativeDirection,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedCompositionIntelligence,
                ...draft.relationships.relatedBrandVisualIntelligence,
                ...draft.relationships.relatedEnhancementPlans,
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
        this.logger.log("info", "planning", "Creative image plan created", {
            imageId: input.imageId,
            platform: built.profile.platform,
            layoutScore: scores.creativeLayoutScore,
            version,
        });
        this.logger.log("info", "layout", "Layout planning prepared", {
            imageId: input.imageId,
            layoutType: built.layoutPlanning.layoutType,
            hierarchy: built.layoutPlanning.visualHierarchy.slice(0, 80),
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Creative recommendations generated", {
                imageId: input.imageId,
                count: built.recommendations.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.imageId)
            results = results.filter((r) => r.imageId === query.imageId);
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.profile.brand.toLowerCase().includes(q));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.profile.product.toLowerCase().includes(q));
        }
        if (query.campaign) {
            const q = query.campaign.toLowerCase();
            results = results.filter((r) => r.profile.campaign.toLowerCase().includes(q));
        }
        if (query.platform) {
            results = results.filter((r) => r.profile.platform === query.platform);
        }
        if (query.creativeType) {
            results = results.filter((r) => r.layoutPlanning.layoutType === query.creativeType);
        }
        if (query.creativeStyle) {
            results = results.filter((r) => r.creativeStyle.primaryStyle === query.creativeStyle ||
                r.creativeStyle.secondaryStyle === query.creativeStyle);
        }
        if (query.minLayoutScore !== undefined) {
            results = results.filter((r) => r.scores.creativeLayoutScore >= query.minLayoutScore);
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Creative image search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=creative-image-processor.js.map