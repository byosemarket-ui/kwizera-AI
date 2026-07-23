import crypto from "node:crypto";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export class MarketingProcessor {
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
        if (!input.campaignName) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["campaignName is required"],
                message: "Invalid marketing input",
            };
        }
        const campaignId = input.campaignId ?? `camp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const knowledgeId = `marketing-knowledge-${campaignId}`;
        const analysis = this.analyzer.analyze(input);
        const scores = this.scorer.computeScores(analysis.brand, analysis.structure, analysis.campaign, analysis.customer, analysis.content, analysis.storytelling);
        const validation = this.scorer.isAnalysisValid(scores);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Marketing analysis rejected", {
                campaignId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Low-quality marketing knowledge rejected",
            };
        }
        const draft = {
            campaignId,
            knowledgeId,
            campaignName: input.campaignName,
            campaignType: analysis.campaignType,
            marketingGoal: analysis.marketingGoal,
            productName: input.product ?? analysis.positioning.productName,
            brandName: input.brandName ?? "unknown",
            platform: analysis.platform,
            audience: analysis.audience,
            brand: analysis.brand,
            positioning: analysis.positioning,
            customerJourney: analysis.customerJourney,
            customer: analysis.customer,
            structure: analysis.structure,
            campaign: analysis.campaign,
            content: analysis.content,
            platformKnowledge: analysis.platformKnowledge,
            storytelling: analysis.storytelling,
            scores,
            relationships: {
                relatedProducts: [],
                relatedBrands: [],
                relatedVideos: [],
                relatedCampaigns: [],
                relatedCustomers: [],
                relatedCreativeStyles: [],
                relatedBusinessGoals: [],
            },
            recommendations: [],
            tags: input.tags ?? [],
            keywords: input.keywords ?? analysis.content.keywords,
            language: input.language ?? "en",
            analyzedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version: 1,
        };
        draft.recommendations = this.recommender.recommend(draft);
        draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());
        this.logger.log("info", "customer", "Customer knowledge analyzed", {
            campaignId,
            intent: draft.customer.customerIntent,
            needs: draft.customer.customerNeeds.length,
            triggers: draft.customer.buyingTriggers.length,
        });
        const storage = this.foundation.getStorageEngine();
        const stored = await storage.storeRecord({
            knowledgeId,
            knowledgeType: KnowledgeStorageType.Marketing,
            category: "marketing",
            title: input.campaignName,
            description: this.buildKnowledgeDescription(draft),
            summary: `Marketing analysis: ${analysis.campaignType} — conversion readiness ${scores.conversionReadinessScore}`,
            source: "marketing-knowledge-engine",
            tags: [...(input.tags ?? []), analysis.campaignType, analysis.marketingGoal, analysis.platform],
            keywords: [
                ...draft.keywords,
                draft.productName,
                draft.brandName,
                analysis.campaign.marketingStyle,
                analysis.marketingGoal,
            ].filter(Boolean),
            relatedKnowledge: input.relatedKnowledge ?? [],
            relatedMemory: input.relatedMemory ?? [],
            qualityScore: scores.marketingQualityScore,
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
        this.ensureGraphNode(graph, knowledgeId, draft.campaignName, this.buildKnowledgeDescription(draft));
        for (const relatedCampaignId of draft.relationships.relatedCampaigns) {
            const related = this.records.get(relatedCampaignId);
            if (!related)
                continue;
            this.ensureGraphNode(graph, related.knowledgeId, related.campaignName, this.buildKnowledgeDescription(related));
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: related.knowledgeId,
                relationshipType: KnowledgeRelationType.SimilarTo,
                evidence: `Similar campaign detected during analysis of ${campaignId}`,
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
                evidence: `Knowledge link from marketing analysis ${campaignId}`,
                strengthScore: 80,
                confidenceScore: 85,
            });
        }
        await graph.evolveGraph(knowledgeId);
        this.learner.learnFromAnalysis(draft);
        this.records.upsert(draft);
        this.logger.log("info", "analysis", "Marketing campaign analyzed and stored", {
            campaignId,
            knowledgeId,
            marketingQuality: scores.marketingQualityScore,
            conversionReadiness: scores.conversionReadinessScore,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    async search(query) {
        const retrieval = this.foundation.getRetrievalEngine();
        const search = await retrieval.search({
            mode: KnowledgeSearchMode.Hybrid,
            knowledgeType: KnowledgeStorageType.Marketing,
            text: query.text,
            keywords: query.product ? [query.product] : query.keywords,
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
            if (query.campaignType && r.campaignType !== query.campaignType)
                return false;
            if (query.marketingGoal && r.marketingGoal !== query.marketingGoal)
                return false;
            if (query.product && !r.productName.toLowerCase().includes(query.product.toLowerCase()))
                return false;
            if (query.brand && !r.brandName.toLowerCase().includes(query.brand.toLowerCase()))
                return false;
            if (query.platform && r.platform !== query.platform)
                return false;
            if (query.audience && !r.audience.toLowerCase().includes(query.audience.toLowerCase()))
                return false;
            if (query.language && r.language !== query.language)
                return false;
            if (query.storytelling && r.storytelling.narrativeArc !== query.storytelling)
                return false;
            if (query.cta && !r.structure.callToAction.toLowerCase().includes(query.cta.toLowerCase())) {
                return false;
            }
            if (query.minConversionReadiness &&
                r.scores.conversionReadinessScore < query.minConversionReadiness) {
                return false;
            }
            if (query.keywords?.length) {
                const haystack = [...r.keywords, ...r.content.keywords].join(" ").toLowerCase();
                if (!query.keywords.some((k) => haystack.includes(k.toLowerCase())))
                    return false;
            }
            return true;
        });
    }
    ensureGraphNode(graph, nodeId, title, searchableText) {
        if (!graph.getGraph().nodes[nodeId]) {
            graph.createNode(nodeId, KnowledgeNodeType.MarketingCampaign, title, searchableText);
        }
    }
    buildKnowledgeDescription(record) {
        return [
            `Marketing analysis for ${record.campaignName}`,
            `Type: ${record.campaignType}`,
            `Goal: ${record.marketingGoal}`,
            `Platform: ${record.platform}`,
            `Product: ${record.productName}`,
            `Brand: ${record.brandName}`,
            `Audience: ${record.audience}`,
            `Marketing quality: ${record.scores.marketingQualityScore}`,
            `Conversion readiness: ${record.scores.conversionReadinessScore}`,
            `Storytelling: ${record.scores.storytellingScore}`,
        ].join(". ");
    }
}
//# sourceMappingURL=marketing-processor.js.map