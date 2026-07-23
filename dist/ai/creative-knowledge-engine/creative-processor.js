import crypto from "node:crypto";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export class CreativeProcessor {
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
        if (!input.projectName) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["projectName is required"],
                message: "Invalid creative input",
            };
        }
        const analysis = this.analyzer.analyze(input);
        const brandConsistency = input.visual?.balance ?? 85;
        const scores = this.scorer.computeScores(analysis.visual, analysis.storytelling, analysis.animation, analysis.cinematic, brandConsistency);
        const validation = this.scorer.isAnalysisValid(scores);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Creative analysis rejected", {
                projectName: input.projectName,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Poor-quality creative knowledge rejected",
            };
        }
        const creativeId = input.creativeId ?? `creative-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const knowledgeId = `creative-knowledge-${creativeId}`;
        const existing = this.records.get(creativeId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            creativeId,
            knowledgeId,
            projectName: input.projectName,
            domain: analysis.domain,
            creativeStyle: analysis.creativeStyle,
            platform: analysis.platform,
            industry: analysis.industry,
            brandName: analysis.brandName,
            productName: analysis.productName,
            marketingGoal: analysis.marketingGoal,
            colorPalette: analysis.colorPalette,
            animationStyle: analysis.animationStyle,
            visual: analysis.visual,
            storytelling: analysis.storytelling,
            animation: analysis.animation,
            cinematic: analysis.cinematic,
            social: analysis.social,
            scores,
            relationships: {
                creativeStyles: [],
                relatedProducts: [],
                relatedBrands: [],
                relatedVideos: [],
                relatedImages: [],
                relatedCampaigns: [],
                relatedMarketingStrategies: [],
                relatedTemplates: [],
                relatedWorkflows: [],
            },
            recommendations: [],
            tags: input.tags ?? [],
            keywords: input.keywords ?? [
                analysis.domain,
                analysis.creativeStyle,
                analysis.brandName,
                analysis.platform,
            ],
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.recommendations = this.recommender.recommend(draft);
        draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());
        const storage = this.foundation.getStorageEngine();
        const stored = await storage.storeRecord({
            knowledgeId,
            knowledgeType: KnowledgeStorageType.Creative,
            category: "creative",
            title: input.projectName,
            description: this.buildKnowledgeDescription(draft),
            summary: `Creative analysis: ${analysis.domain} — quality ${scores.creativeQualityScore}`,
            source: "creative-knowledge-engine",
            tags: [...(input.tags ?? []), analysis.domain, analysis.creativeStyle, analysis.platform],
            keywords: [
                ...draft.keywords,
                analysis.brandName,
                analysis.productName,
                ...analysis.colorPalette,
            ].filter(Boolean),
            relatedKnowledge: input.relatedKnowledge ?? [],
            relatedMemory: input.relatedMemory ?? [],
            qualityScore: scores.creativeQualityScore,
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
        this.ensureGraphNode(graph, knowledgeId, draft.projectName, this.buildKnowledgeDescription(draft));
        for (const relatedId of draft.relationships.creativeStyles) {
            const related = this.records.get(relatedId);
            if (!related)
                continue;
            this.ensureGraphNode(graph, related.knowledgeId, related.projectName, this.buildKnowledgeDescription(related));
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: related.knowledgeId,
                relationshipType: KnowledgeRelationType.SimilarTo,
                evidence: `Similar creative style for ${creativeId}`,
                strengthScore: 72,
                confidenceScore: 78,
            });
        }
        for (const relatedId of input.relatedKnowledge ?? []) {
            const indexEntry = storage.findIndexEntry(relatedId);
            if (!indexEntry)
                continue;
            graph.createNode(relatedId, KnowledgeNodeType.CreativeStyle, indexEntry.title, indexEntry.searchableText);
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: relatedId,
                relationshipType: KnowledgeRelationType.RelatedTo,
                evidence: `Knowledge link from creative analysis ${creativeId}`,
                strengthScore: 80,
                confidenceScore: 85,
            });
        }
        await graph.evolveGraph(knowledgeId);
        this.learner.learnFromAnalysis(draft);
        this.records.upsert(draft);
        this.logger.log("info", "analysis", "Creative project analyzed and stored", {
            creativeId,
            knowledgeId,
            domain: analysis.domain,
            quality: scores.creativeQualityScore,
            version,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    async search(query) {
        const retrieval = this.foundation.getRetrievalEngine();
        const search = await retrieval.search({
            mode: KnowledgeSearchMode.Hybrid,
            knowledgeType: KnowledgeStorageType.Creative,
            text: query.text,
            keywords: query.brand ? [query.brand] : undefined,
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
            if (query.creativeStyle && r.creativeStyle !== query.creativeStyle)
                return false;
            if (query.designType && r.domain !== query.designType)
                return false;
            if (query.industry && !r.industry.toLowerCase().includes(query.industry.toLowerCase()))
                return false;
            if (query.brand && !r.brandName.toLowerCase().includes(query.brand.toLowerCase()))
                return false;
            if (query.product && !r.productName.toLowerCase().includes(query.product.toLowerCase()))
                return false;
            if (query.animationStyle && r.animationStyle !== query.animationStyle)
                return false;
            if (query.platform && r.platform !== query.platform)
                return false;
            if (query.marketingGoal && r.marketingGoal !== query.marketingGoal)
                return false;
            if (query.typography && !r.visual.typography.toLowerCase().includes(query.typography.toLowerCase())) {
                return false;
            }
            if (query.minCreativeQuality && r.scores.creativeQualityScore < query.minCreativeQuality)
                return false;
            if (query.colorPalette?.length) {
                if (!query.colorPalette.some((c) => r.colorPalette.includes(c)))
                    return false;
            }
            return true;
        });
    }
    ensureGraphNode(graph, nodeId, title, searchableText) {
        if (!graph.getGraph().nodes[nodeId]) {
            graph.createNode(nodeId, KnowledgeNodeType.CreativeStyle, title, searchableText);
        }
    }
    buildKnowledgeDescription(record) {
        return [
            `Creative analysis for ${record.projectName}`,
            `Domain: ${record.domain}`,
            `Style: ${record.creativeStyle}`,
            `Platform: ${record.platform}`,
            `Brand: ${record.brandName}`,
            `Visual: ${record.scores.visualDesignScore}`,
            `Storytelling: ${record.scores.storytellingScore}`,
            `Animation: ${record.scores.animationScore}`,
            `Quality: ${record.scores.creativeQualityScore}`,
        ].join(". ");
    }
}
//# sourceMappingURL=creative-processor.js.map