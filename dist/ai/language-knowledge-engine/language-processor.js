import crypto from "node:crypto";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export class LanguageProcessor {
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
        const scores = this.scorer.computeScores(analysis.grammar, analysis.marketing, analysis.subtitles, analysis.localization, analysis.content, analysis.writingStyle);
        const validation = this.scorer.isAnalysisValid(analysis.content, scores);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Language analysis rejected", {
                language: analysis.language,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Unverified language knowledge rejected",
            };
        }
        const languageId = input.languageId ?? `lang-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const knowledgeId = `language-knowledge-${languageId}`;
        const existing = this.records.get(languageId);
        const version = existing ? existing.version + 1 : 1;
        const draft = {
            languageId,
            knowledgeId,
            language: analysis.language,
            detectedLanguage: analysis.detectedLanguage,
            topic: analysis.topic,
            industry: analysis.industry,
            brandName: analysis.brandName,
            productName: analysis.productName,
            audience: analysis.audience,
            marketingGoal: analysis.marketingGoal,
            writingStyle: analysis.writingStyle,
            scriptType: analysis.scriptType,
            content: analysis.content,
            grammar: analysis.grammar,
            marketing: analysis.marketing,
            voice: analysis.voice,
            subtitles: analysis.subtitles,
            localization: analysis.localization,
            scores,
            relationships: {
                relatedLanguages: [],
                relatedMarketingStyles: [],
                relatedProducts: [],
                relatedBrands: [],
                relatedCampaigns: [],
                relatedScripts: [],
                relatedVideos: [],
                relatedSubtitles: [],
            },
            recommendations: [],
            tags: input.tags ?? [],
            keywords: input.keywords ?? [analysis.language, analysis.topic, analysis.writingStyle],
            analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version,
        };
        draft.recommendations = this.recommender.recommend(draft);
        draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());
        const storage = this.foundation.getStorageEngine();
        const stored = await storage.storeRecord({
            knowledgeId,
            knowledgeType: KnowledgeStorageType.Language,
            category: "language",
            title: `${analysis.language} — ${analysis.scriptType}`,
            description: this.buildKnowledgeDescription(draft),
            summary: `Language analysis: ${analysis.language} — grammar ${scores.grammarScore}`,
            source: "language-knowledge-engine",
            tags: [...(input.tags ?? []), analysis.language, analysis.writingStyle, analysis.scriptType],
            keywords: [
                ...draft.keywords,
                analysis.brandName,
                analysis.productName,
                analysis.topic,
            ].filter(Boolean),
            relatedKnowledge: input.relatedKnowledge ?? [],
            relatedMemory: input.relatedMemory ?? [],
            qualityScore: scores.grammarScore,
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
        this.ensureGraphNode(graph, knowledgeId, draft.content.slice(0, 60), this.buildKnowledgeDescription(draft));
        for (const relatedId of draft.relationships.relatedLanguages) {
            const related = this.records.get(relatedId);
            if (!related)
                continue;
            this.ensureGraphNode(graph, related.knowledgeId, related.content.slice(0, 60), this.buildKnowledgeDescription(related));
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: related.knowledgeId,
                relationshipType: KnowledgeRelationType.SimilarTo,
                evidence: `Related language content for ${languageId}`,
                strengthScore: 72,
                confidenceScore: 78,
            });
        }
        for (const relatedId of input.relatedKnowledge ?? []) {
            const indexEntry = storage.findIndexEntry(relatedId);
            if (!indexEntry)
                continue;
            graph.createNode(relatedId, KnowledgeNodeType.Language, indexEntry.title, indexEntry.searchableText);
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: relatedId,
                relationshipType: KnowledgeRelationType.RelatedTo,
                evidence: `Knowledge link from language analysis ${languageId}`,
                strengthScore: 80,
                confidenceScore: 85,
            });
        }
        await graph.evolveGraph(knowledgeId);
        this.learner.learnFromAnalysis(draft);
        this.records.upsert(draft);
        this.logger.log("info", "analysis", "Language content analyzed and stored", {
            languageId,
            knowledgeId,
            language: analysis.language,
            grammar: scores.grammarScore,
            version,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    }
    async search(query) {
        const retrieval = this.foundation.getRetrievalEngine();
        const search = await retrieval.search({
            mode: KnowledgeSearchMode.Hybrid,
            knowledgeType: KnowledgeStorageType.Language,
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
            if (query.language && r.language !== query.language)
                return false;
            if (query.topic && !r.topic.toLowerCase().includes(query.topic.toLowerCase()))
                return false;
            if (query.writingStyle && r.writingStyle !== query.writingStyle)
                return false;
            if (query.marketingGoal && r.marketingGoal !== query.marketingGoal)
                return false;
            if (query.industry && !r.industry.toLowerCase().includes(query.industry.toLowerCase()))
                return false;
            if (query.brand && !r.brandName.toLowerCase().includes(query.brand.toLowerCase()))
                return false;
            if (query.product && !r.productName.toLowerCase().includes(query.product.toLowerCase()))
                return false;
            if (query.audience && !r.audience.toLowerCase().includes(query.audience.toLowerCase()))
                return false;
            if (query.scriptType && r.scriptType !== query.scriptType)
                return false;
            if (query.minGrammarScore && r.scores.grammarScore < query.minGrammarScore)
                return false;
            if (query.text && !r.content.toLowerCase().includes(query.text.toLowerCase()))
                return false;
            return true;
        });
    }
    ensureGraphNode(graph, nodeId, title, searchableText) {
        if (!graph.getGraph().nodes[nodeId]) {
            graph.createNode(nodeId, KnowledgeNodeType.Language, title, searchableText);
        }
    }
    buildKnowledgeDescription(record) {
        return [
            `Language analysis: ${record.language}`,
            `Style: ${record.writingStyle}`,
            `Script: ${record.scriptType}`,
            `Topic: ${record.topic}`,
            `Brand: ${record.brandName}`,
            `Grammar: ${record.scores.grammarScore}`,
            `Marketing: ${record.scores.marketingScore}`,
            `Translation readiness: ${record.scores.translationReadinessScore}`,
        ].join(". ");
    }
}
//# sourceMappingURL=language-processor.js.map