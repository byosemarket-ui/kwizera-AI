import { ProductIntelligenceHealthLevel, ProductIntelligenceSource, ProductIntelligenceVerificationStatus, } from "../product-intelligence-foundation/types.js";
export class AudienceProcessor {
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
        const analysisEngine = this.foundation.getProductAnalysisEngine();
        const understandingEngine = this.foundation.getProductUnderstandingEngine();
        const analysis = analysisEngine.getProduct(input.productId);
        if (!analysis || !analysis.validated) {
            this.logger.log("warn", "validation", "Audience analysis rejected — validated analysis required", {
                productId: input.productId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Product must be analyzed and validated before audience intelligence"],
                message: "Complete product analysis required before audience intelligence",
            };
        }
        const understanding = understandingEngine.getUnderstanding(input.productId);
        if (!understanding || !understanding.validated) {
            this.logger.log("warn", "validation", "Audience analysis rejected — validated understanding required", {
                productId: input.productId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Product must be understood and validated before audience intelligence"],
                message: "Complete product understanding required before audience intelligence",
            };
        }
        const profile = this.analyzer.buildProfile(input, understanding, analysis);
        const demographics = this.analyzer.buildDemographics(input, analysis);
        const psychological = this.analyzer.buildPsychologicalUnderstanding(understanding, profile.marketingGoal);
        const segmentation = this.analyzer.buildSegmentation(understanding, analysis, psychological, profile);
        const marketingPreparation = this.analyzer.buildMarketingPreparation(profile, psychological, segmentation);
        const existing = input.audienceId
            ? this.records.get(input.audienceId)
            : this.records.getByProduct(input.productId)[0];
        const version = existing ? existing.version + 1 : 1;
        const draftRelationships = {
            products: [input.productId],
            brands: [understanding.identity.brand],
            campaigns: input.campaignId ? [input.campaignId] : [],
            creativeStyles: [],
            languages: demographics.language ? [demographics.language] : [],
            industries: [profile.industry],
            customerSegments: understanding.customer.customerSegments,
            knowledgeRecords: understanding.relationships.knowledgeRecords,
        };
        const relationshipCount = draftRelationships.products.length +
            draftRelationships.brands.length +
            draftRelationships.industries.length +
            draftRelationships.customerSegments.length +
            draftRelationships.knowledgeRecords.length;
        const scores = this.scorer.computeScores(profile, demographics, psychological, marketingPreparation, relationshipCount);
        const validation = this.scorer.isAudienceValid(scores, profile, psychological, demographics);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Audience intelligence rejected", {
                productId: input.productId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Audience validation failed — unsupported assumptions rejected",
            };
        }
        const draft = {
            audienceId: profile.audienceId,
            productId: input.productId,
            understandingId: understanding.understandingId,
            analysisId: analysis.analysisId,
            profile,
            demographics,
            psychological,
            segmentation,
            marketingPreparation,
            scores,
            relationships: draftRelationships,
            validated: true,
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), understanding, analysis, input.campaignId);
        const intelligenceValidation = this.foundation.validateProductIntelligence({
            qualityScore: scores.audienceRelevanceScore,
            confidenceScore: scores.audienceConfidenceScore,
            verificationStatus: scores.audienceConfidenceScore >= 75
                ? ProductIntelligenceVerificationStatus.Verified
                : ProductIntelligenceVerificationStatus.Pending,
            source: ProductIntelligenceSource.MarketingKnowledge,
            sourceRef: understanding.analysisId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Audience intelligence v${version}`,
                    source: ProductIntelligenceSource.MarketingKnowledge,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.knowledgeRecords,
                ...draft.relationships.products,
                ...draft.relationships.campaigns,
            ],
            healthStatus: ProductIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                message: "Product intelligence validation failed for audience record",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "audience-analysis", "Audience intelligence prepared", {
            audienceId: draft.audienceId,
            productId: input.productId,
            relevanceScore: scores.audienceRelevanceScore,
            durationMs: Date.now() - start,
        });
        this.logger.log("info", "segmentation", "Audience segmentation recorded", {
            audienceId: draft.audienceId,
            industry: segmentation.industry,
            productType: segmentation.productType,
            needsCount: segmentation.customerNeeds.length,
        });
        this.logger.log("info", "relationship", "Audience relationships updated", {
            audienceId: draft.audienceId,
            relationshipCount: draft.relationships.products.length +
                draft.relationships.brands.length +
                draft.relationships.customerSegments.length,
        });
        return {
            success: true,
            record: draft,
            durationMs: Date.now() - start,
            diagnostics: [],
        };
    }
    search(query) {
        let results = this.records.getAll();
        if (query.productId) {
            results = results.filter((r) => r.productId === query.productId);
        }
        if (query.audienceType) {
            results = results.filter((r) => r.profile.audienceCategory === query.audienceType);
        }
        if (query.industry) {
            const industryLower = query.industry.toLowerCase();
            results = results.filter((r) => r.profile.industry.toLowerCase().includes(industryLower) ||
                r.relationships.industries.some((i) => i.toLowerCase().includes(industryLower)));
        }
        if (query.language) {
            const langLower = query.language.toLowerCase();
            results = results.filter((r) => r.profile.preferredLanguage?.toLowerCase().includes(langLower) ||
                r.demographics.language?.toLowerCase().includes(langLower) ||
                r.relationships.languages.some((l) => l.toLowerCase().includes(langLower)));
        }
        if (query.platform) {
            results = results.filter((r) => r.profile.preferredPlatforms.includes(query.platform));
        }
        if (query.businessGoal) {
            const goalLower = query.businessGoal.toLowerCase();
            results = results.filter((r) => r.segmentation.businessGoals.some((g) => g.toLowerCase().includes(goalLower)));
        }
        if (query.customerNeed) {
            const needLower = query.customerNeed.toLowerCase();
            results = results.filter((r) => r.psychological.customerNeeds.some((n) => n.toLowerCase().includes(needLower)) ||
                r.segmentation.customerNeeds.some((n) => n.toLowerCase().includes(needLower)));
        }
        if (query.marketingGoal) {
            results = results.filter((r) => r.profile.marketingGoal === query.marketingGoal);
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.profile.audienceName.toLowerCase().includes(textLower) ||
                r.profile.audienceId.toLowerCase().includes(textLower) ||
                r.psychological.buyingIntent.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
}
//# sourceMappingURL=audience-processor.js.map