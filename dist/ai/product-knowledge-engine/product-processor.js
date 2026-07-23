import crypto from "node:crypto";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export class ProductProcessor {
    foundation;
    analyzer;
    scorer;
    recommender;
    linker;
    learner;
    records;
    logger;
    constructor(foundation, analyzer, scorer, recommender, linker, learner, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.scorer = scorer;
        this.recommender = recommender;
        this.linker = linker;
        this.learner = learner;
        this.records = records;
        this.logger = logger;
    }
    async analyze(input) {
        const start = Date.now();
        const analysis = this.analyzer.analyze(input);
        const scores = this.scorer.computeScores(analysis.profile, analysis.visual, analysis.brand, analysis.marketing, analysis.customer);
        const validation = this.scorer.isAnalysisValid(analysis.profile, scores);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Product analysis rejected", {
                productName: analysis.profile.productName,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Incomplete or low-quality product knowledge rejected",
            };
        }
        const productId = input.productId ?? `prod-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const knowledgeId = `product-knowledge-${productId}`;
        const existing = this.records.get(productId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            productId,
            knowledgeId,
            profile: analysis.profile,
            visual: analysis.visual,
            brand: analysis.brand,
            marketing: analysis.marketing,
            customer: analysis.customer,
            scores,
            relationships: {
                relatedProducts: [],
                relatedBrands: [],
                relatedVideos: [],
                relatedImages: [],
                relatedMarketingCampaigns: [],
                relatedProjects: [],
                relatedCreativeStyles: [],
                relatedCustomerSegments: [],
            },
            recommendations: [],
            tags: input.tags ?? [],
            keywords: input.keywords ?? [
                analysis.profile.productName,
                analysis.profile.brand,
                analysis.profile.category,
                analysis.profile.subcategory,
            ],
            language: input.language ?? "en",
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.recommendations = this.recommender.recommend(draft);
        draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());
        const storage = this.foundation.getStorageEngine();
        const stored = await storage.storeRecord({
            knowledgeId,
            knowledgeType: KnowledgeStorageType.Product,
            category: "product",
            title: analysis.profile.productName,
            description: this.buildKnowledgeDescription(draft),
            summary: `Product analysis: ${analysis.profile.category}/${analysis.profile.subcategory} — quality ${scores.productQualityScore}`,
            source: "product-knowledge-engine",
            tags: [
                ...(input.tags ?? []),
                analysis.profile.category,
                analysis.profile.subcategory,
                analysis.profile.marketingGoal,
            ],
            keywords: [
                ...draft.keywords,
                analysis.profile.brand,
                ...analysis.profile.features,
                ...analysis.profile.colors,
            ].filter(Boolean),
            relatedKnowledge: input.relatedKnowledge ?? [],
            relatedMemory: input.relatedMemory ?? [],
            qualityScore: scores.productQualityScore,
            confidenceScore: scores.aiConfidenceScore,
            sourceReliability: 85,
            verificationStatus: scores.aiConfidenceScore >= 75
                ? KnowledgeVerificationStatus.Verified
                : KnowledgeVerificationStatus.Pending,
            payload: draft,
        });
        if (!stored.success) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: stored.validation?.diagnostics ?? ["Knowledge storage failed"],
                message: stored.validation?.message,
            };
        }
        const graph = this.foundation.getGraphEngine();
        this.ensureGraphNode(graph, knowledgeId, draft.profile.productName, this.buildKnowledgeDescription(draft));
        for (const relatedProductId of draft.relationships.relatedProducts) {
            const related = this.records.get(relatedProductId);
            if (!related)
                continue;
            this.ensureGraphNode(graph, related.knowledgeId, related.profile.productName, this.buildKnowledgeDescription(related));
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: related.knowledgeId,
                relationshipType: KnowledgeRelationType.SimilarTo,
                evidence: `Similar product detected during analysis of ${productId}`,
                strengthScore: 72,
                confidenceScore: 78,
            });
        }
        for (const relatedId of input.relatedKnowledge ?? []) {
            const indexEntry = storage.findIndexEntry(relatedId);
            if (!indexEntry)
                continue;
            graph.createNode(relatedId, KnowledgeNodeType.Product, indexEntry.title, indexEntry.searchableText);
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: relatedId,
                relationshipType: KnowledgeRelationType.RelatedTo,
                evidence: `Knowledge link from product analysis ${productId}`,
                strengthScore: 80,
                confidenceScore: 85,
            });
        }
        await graph.evolveGraph(knowledgeId);
        this.learner.learnFromAnalysis(draft);
        this.records.upsert(draft);
        this.logger.log("info", "analysis", "Product analyzed and stored", {
            productId,
            knowledgeId,
            category: analysis.profile.category,
            quality: scores.productQualityScore,
            version,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    async search(query) {
        const retrieval = this.foundation.getRetrievalEngine();
        const search = await retrieval.search({
            mode: KnowledgeSearchMode.Hybrid,
            knowledgeType: KnowledgeStorageType.Product,
            text: query.text ?? query.productName,
            keywords: query.brand ? [query.brand] : query.features,
            limit: query.limit ?? 20,
        });
        let results = search.results
            .map((r) => r.record?.payload ? r.record.payload : undefined)
            .filter((r) => Boolean(r));
        if (results.length === 0) {
            results = this.filterLocal(this.records.getAll(), query);
        }
        return results;
    }
    filterLocal(records, query) {
        return records.filter((r) => {
            if (query.productName && !r.profile.productName.toLowerCase().includes(query.productName.toLowerCase())) {
                return false;
            }
            if (query.brand && !r.profile.brand.toLowerCase().includes(query.brand.toLowerCase()))
                return false;
            if (query.category && r.profile.category !== query.category)
                return false;
            if (query.subcategory && r.profile.subcategory !== query.subcategory)
                return false;
            if (query.color && !r.profile.colors.some((c) => c.toLowerCase().includes(query.color.toLowerCase()))) {
                return false;
            }
            if (query.minPrice !== undefined && r.profile.price < query.minPrice)
                return false;
            if (query.maxPrice !== undefined && r.profile.price > query.maxPrice)
                return false;
            if (query.supplier && r.profile.supplier !== query.supplier)
                return false;
            if (query.targetAudience && !r.profile.targetAudience.toLowerCase().includes(query.targetAudience.toLowerCase())) {
                return false;
            }
            if (query.marketingGoal && r.profile.marketingGoal !== query.marketingGoal)
                return false;
            if (query.features?.length) {
                const haystack = r.profile.features.join(" ").toLowerCase();
                if (!query.features.some((f) => haystack.includes(f.toLowerCase())))
                    return false;
            }
            return true;
        });
    }
    ensureGraphNode(graph, nodeId, title, searchableText) {
        if (!graph.getGraph().nodes[nodeId]) {
            graph.createNode(nodeId, KnowledgeNodeType.Product, title, searchableText);
        }
    }
    buildKnowledgeDescription(record) {
        return [
            `Product analysis for ${record.profile.productName}`,
            `Category: ${record.profile.category}/${record.profile.subcategory}`,
            `Brand: ${record.profile.brand}`,
            `Price: ${record.profile.price} ${record.profile.currency}`,
            `Audience: ${record.profile.targetAudience}`,
            `Quality: ${record.scores.productQualityScore}`,
            `Marketing readiness: ${record.scores.marketingReadinessScore}`,
            `Features: ${record.profile.features.join(", ")}`,
        ].join(". ");
    }
}
//# sourceMappingURL=product-processor.js.map