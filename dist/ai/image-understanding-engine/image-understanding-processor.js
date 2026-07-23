import { ImageIntelligenceHealthLevel, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, } from "../image-intelligence-foundation/types.js";
import { ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, } from "./types.js";
export class ImageUnderstandingProcessor {
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
    async understand(input) {
        const start = Date.now();
        const analysisEngine = this.foundation.getImageAnalysisEngine();
        const analysis = analysisEngine.getImage(input.imageId);
        if (!analysis || !analysis.validated) {
            this.logger.log("warn", "validation", "Image understanding rejected — analysis required", {
                imageId: input.imageId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Image must be analyzed and validated before understanding"],
                message: "Complete image analysis required before understanding",
            };
        }
        const marketingGoal = input.marketingGoal ?? ImageUnderstandingMarketingGoal.Conversion;
        const platform = input.platform ?? ImageUnderstandingPlatform.MultiPlatform;
        const industry = input.industry ?? analysis.classification.category;
        const built = this.analyzer.buildFromAnalysis(analysis, marketingGoal, platform, industry);
        const scores = this.scorer.computeScores(built.purpose, built.scene, built.visual, built.product, built.brand, built.marketing);
        const validation = this.scorer.isUnderstandingValid(scores, built.purpose);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Image understanding rejected", {
                imageId: input.imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete understanding rejected — validation required",
            };
        }
        const existing = this.records.get(input.imageId);
        const version = existing ? existing.version + 1 : 1;
        const understandingId = existing?.understandingId ?? `image-understanding-${input.imageId}`;
        const draft = {
            imageId: input.imageId,
            understandingId,
            analysisId: analysis.analysisId,
            identity: built.identity,
            purpose: built.purpose,
            context: built.context,
            scene: built.scene,
            visual: built.visual,
            product: built.product,
            brand: built.brand,
            marketing: built.marketing,
            scores,
            relationships: {
                relatedProducts: analysis.relationships.relatedProducts,
                relatedBrands: analysis.relationships.relatedBrands,
                relatedProjects: input.relatedProjects ?? [],
                relatedMarketingCampaigns: analysis.relationships.relatedMarketingCampaigns,
                relatedCreativeStyles: [analysis.classification.creativeStyle],
                relatedKnowledge: input.relatedKnowledge ?? [],
                relatedImages: analysis.relationships.relatedImages,
                relatedStoryboards: input.relatedStoryboards ?? [],
                relatedMemory: analysis.relationships.relatedMemory,
            },
            recommendations: built.recommendations,
            marketingGoal,
            platform,
            industry,
            keywords: built.keywords,
            validated: true,
            understoodAt: existing?.understoodAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, input.relatedProjects, input.relatedKnowledge, input.relatedStoryboards);
        const intelligenceValidation = this.foundation.validateImageIntelligence({
            qualityScore: scores.imageUnderstandingScore,
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
                    changeSummary: `Image understanding v${version}`,
                    source: ImageIntelligenceSource.ImageKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.relatedKnowledge,
                ...draft.relationships.relatedImages,
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
        this.logger.log("info", "understanding", "Image understanding complete", {
            imageId: input.imageId,
            understandingScore: scores.imageUnderstandingScore,
            productScore: scores.productUnderstandingScore,
            marketingReadiness: scores.marketingReadinessScore,
            version,
        });
        this.logger.log("info", "scene", "Scene understanding recorded", {
            imageId: input.imageId,
            sceneType: built.scene.sceneType,
            environment: built.scene.environment,
        });
        if (built.recommendations.length > 0) {
            this.logger.log("info", "recommendation", "Understanding recommendations generated", {
                imageId: input.imageId,
                count: built.recommendations.length,
            });
        }
        if (draft.relationships.relatedImages.length > 0) {
            this.logger.log("info", "relationship", "Understanding relationships linked", {
                imageId: input.imageId,
                relatedImages: draft.relationships.relatedImages.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.imagePurpose) {
            const q = query.imagePurpose.toLowerCase();
            results = results.filter((r) => r.purpose.primaryPurpose.toLowerCase().includes(q));
        }
        if (query.product) {
            const q = query.product.toLowerCase();
            results = results.filter((r) => r.product.productContext.toLowerCase().includes(q) ||
                r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
        }
        if (query.brand) {
            const q = query.brand.toLowerCase();
            results = results.filter((r) => r.brand.brandIdentity.toLowerCase().includes(q));
        }
        if (query.marketingGoal) {
            results = results.filter((r) => r.marketingGoal === query.marketingGoal);
        }
        if (query.creativeStyle) {
            const q = query.creativeStyle.toLowerCase();
            results = results.filter((r) => r.context.creativeContext.toLowerCase().includes(q));
        }
        if (query.industry) {
            results = results.filter((r) => r.industry === query.industry);
        }
        if (query.platform) {
            results = results.filter((r) => r.platform === query.platform);
        }
        if (query.sceneType) {
            results = results.filter((r) => r.scene.sceneType === query.sceneType);
        }
        if (query.keywords?.length) {
            results = results.filter((r) => query.keywords.some((k) => r.keywords.includes(k)));
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.identity.imageName.toLowerCase().includes(q) ||
                r.purpose.primaryPurpose.toLowerCase().includes(q) ||
                r.keywords.some((k) => k.toLowerCase().includes(q)));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Image understanding search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=image-understanding-processor.js.map