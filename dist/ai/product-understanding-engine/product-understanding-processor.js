import { ProductIntelligenceHealthLevel, ProductIntelligenceSource, ProductIntelligenceVerificationStatus, } from "../product-intelligence-foundation/types.js";
import { ProductUnderstandingMarketingGoal, } from "./types.js";
export class ProductUnderstandingProcessor {
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
        const analysisEngine = this.foundation.getProductAnalysisEngine();
        const analysis = analysisEngine.getProduct(input.productId);
        if (!analysis || !analysis.validated) {
            this.logger.log("warn", "validation", "Product understanding rejected — analysis required", {
                productId: input.productId,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["Product must be analyzed and validated before understanding"],
                message: "Complete product analysis required before understanding",
            };
        }
        const marketingGoal = input.marketingGoal ?? ProductUnderstandingMarketingGoal.Conversion;
        const built = this.analyzer.buildFromAnalysis(analysis, marketingGoal);
        const scores = this.scorer.computeScores(built.purpose, built.customer, built.valueAnalysis, built.uniqueValue, built.marketingPreparation);
        const validation = this.scorer.isUnderstandingValid(scores, built.purpose);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Product understanding rejected", {
                productId: input.productId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete understanding rejected — validation required",
            };
        }
        const existing = this.records.get(input.productId);
        const version = existing ? existing.version + 1 : 1;
        const understandingId = existing?.understandingId ?? `product-understanding-${input.productId}`;
        const draft = {
            productId: input.productId,
            understandingId,
            analysisId: analysis.analysisId,
            identity: built.identity,
            purpose: built.purpose,
            customer: {
                ...built.customer,
                customerSegments: [
                    ...new Set([...built.customer.customerSegments, ...(input.customerSegments ?? [])]),
                ],
            },
            valueAnalysis: built.valueAnalysis,
            uniqueValue: built.uniqueValue,
            context: built.context,
            marketingPreparation: built.marketingPreparation,
            scores,
            relationships: {
                similarProducts: [],
                customerSegments: [],
                businessCategories: [],
                marketingStrategies: [],
                creativeStyles: [],
                projects: input.relatedProjects ?? [],
                knowledgeRecords: input.relatedKnowledge ?? [],
            },
            marketingGoal,
            validated: true,
            understoodAt: existing?.understoodAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.relationships = this.linker.detectRelationships(draft, this.records.getAll(), analysis, input.relatedProjects, input.relatedKnowledge);
        const intelligenceValidation = this.foundation.validateProductIntelligence({
            qualityScore: scores.understandingScore,
            confidenceScore: scores.aiConfidenceScore,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? ProductIntelligenceVerificationStatus.Verified
                : ProductIntelligenceVerificationStatus.Pending,
            source: ProductIntelligenceSource.KnowledgeEngine,
            sourceRef: analysis.knowledgeId,
            versionHistory: [
                {
                    version,
                    timestamp: new Date().toISOString(),
                    changeSummary: `Product understanding v${version}`,
                    source: ProductIntelligenceSource.KnowledgeEngine,
                },
            ],
            relationshipLinks: [
                ...draft.relationships.knowledgeRecords,
                ...draft.relationships.similarProducts,
            ],
            healthStatus: ProductIntelligenceHealthLevel.Good,
        });
        if (!intelligenceValidation.valid) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: intelligenceValidation.issues,
                message: "Product intelligence validation failed",
            };
        }
        this.records.upsert(draft);
        this.logger.log("info", "understanding", "Product understanding complete", {
            productId: input.productId,
            understandingScore: scores.understandingScore,
            businessValue: scores.businessValueScore,
            customerValue: scores.customerValueScore,
            version,
        });
        this.logger.log("info", "value-analysis", "Value analysis recorded", {
            productId: input.productId,
            functional: built.valueAnalysis.functionalValue,
            emotional: built.valueAnalysis.emotionalValue,
            commercial: built.valueAnalysis.commercialValue,
        });
        if (draft.relationships.similarProducts.length > 0) {
            this.logger.log("info", "relationship", "Understanding relationships linked", {
                productId: input.productId,
                similar: draft.relationships.similarProducts.length,
            });
        }
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    search(query) {
        const start = Date.now();
        let results = this.records.getAll();
        if (query.purpose) {
            const q = query.purpose.toLowerCase();
            results = results.filter((r) => r.purpose.primaryPurpose.toLowerCase().includes(q));
        }
        if (query.benefits) {
            const q = query.benefits.toLowerCase();
            results = results.filter((r) => r.uniqueValue.keyBenefits.some((b) => b.toLowerCase().includes(q)));
        }
        if (query.customerNeeds) {
            const q = query.customerNeeds.toLowerCase();
            results = results.filter((r) => r.customer.customerNeeds.some((n) => n.toLowerCase().includes(q)));
        }
        if (query.industry) {
            results = results.filter((r) => r.customer.targetIndustry === query.industry);
        }
        if (query.useCase) {
            const q = query.useCase.toLowerCase();
            results = results.filter((r) => r.purpose.primaryPurpose.toLowerCase().includes(q));
        }
        if (query.targetAudience) {
            const q = query.targetAudience.toLowerCase();
            results = results.filter((r) => r.customer.targetCustomer.toLowerCase().includes(q));
        }
        if (query.valueProposition) {
            const q = query.valueProposition.toLowerCase();
            results = results.filter((r) => r.identity.valueProposition.toLowerCase().includes(q));
        }
        if (query.marketingGoal) {
            results = results.filter((r) => r.marketingGoal === query.marketingGoal);
        }
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((r) => r.identity.productName.toLowerCase().includes(q) ||
                r.purpose.primaryPurpose.toLowerCase().includes(q) ||
                r.identity.valueProposition.toLowerCase().includes(q));
        }
        const sliced = results.slice(0, query.limit ?? 20);
        this.logger.log("debug", "search", "Understanding search complete", {
            results: sliced.length,
            durationMs: Date.now() - start,
        });
        return sliced;
    }
}
//# sourceMappingURL=product-understanding-processor.js.map