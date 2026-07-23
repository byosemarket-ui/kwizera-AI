import crypto from "node:crypto";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
export class ImageProcessor {
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
        const diagnostics = [];
        if (!input.imagePath || !input.imageName) {
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: ["imagePath and imageName are required"],
                message: "Invalid image input",
            };
        }
        const imageId = input.imageId ?? `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const knowledgeId = `image-knowledge-${imageId}`;
        const analysis = this.analyzer.analyze(input);
        const scores = this.scorer.computeScores(analysis.visual, analysis.metrics, analysis.productPresentation, analysis.design, analysis.brand);
        const validation = this.scorer.isAnalysisValid(scores);
        if (!validation.valid) {
            this.logger.log("warn", "validation", "Image analysis rejected", {
                imageId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
                message: "Low-quality analysis rejected",
            };
        }
        const draft = {
            imageId,
            knowledgeId,
            imagePath: input.imagePath,
            imageName: input.imageName,
            imageType: analysis.imageType,
            visual: analysis.visual,
            metrics: analysis.metrics,
            productPresentation: analysis.productPresentation,
            design: analysis.design,
            brand: analysis.brand,
            scores,
            relationships: {
                similarImages: [],
                similarProducts: [],
                similarBrands: [],
                similarStyles: [],
                similarLayouts: [],
                similarCampaigns: [],
            },
            recommendations: [],
            tags: input.tags ?? [],
            keywords: input.keywords ?? [],
            language: input.language ?? "en",
            analyzedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version: 1,
        };
        draft.recommendations = this.recommender.recommend(draft);
        draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());
        const storage = this.foundation.getStorageEngine();
        const stored = await storage.storeRecord({
            knowledgeId,
            knowledgeType: KnowledgeStorageType.Image,
            category: "image",
            title: input.imageName,
            description: this.buildKnowledgeDescription(draft),
            summary: `Image analysis: ${analysis.imageType} — quality ${scores.imageQualityScore}`,
            source: "image-knowledge-engine",
            tags: [...(input.tags ?? []), analysis.imageType, analysis.design.creativeStyle],
            keywords: [
                ...(input.keywords ?? []),
                input.product ?? "",
                input.brandName ?? "",
                ...analysis.visual.dominantColors,
            ].filter(Boolean),
            relatedKnowledge: input.relatedKnowledge ?? [],
            relatedMemory: input.relatedMemory ?? [],
            qualityScore: scores.imageQualityScore,
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
        this.ensureGraphNode(graph, knowledgeId, draft.imageName, this.buildKnowledgeDescription(draft));
        for (const relatedImageId of draft.relationships.similarImages) {
            const related = this.records.get(relatedImageId);
            if (!related)
                continue;
            this.ensureGraphNode(graph, related.knowledgeId, related.imageName, this.buildKnowledgeDescription(related));
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: related.knowledgeId,
                relationshipType: KnowledgeRelationType.SimilarTo,
                evidence: `Similar image relationship detected during analysis of ${imageId}`,
                strengthScore: 70,
                confidenceScore: 75,
            });
        }
        for (const relatedId of input.relatedKnowledge ?? []) {
            const indexEntry = this.foundation.getStorageEngine().findIndexEntry(relatedId);
            if (!indexEntry)
                continue;
            graph.createNode(relatedId, KnowledgeNodeType.Product, indexEntry.title, indexEntry.searchableText);
            graph.createRelationship({
                sourceId: knowledgeId,
                targetId: relatedId,
                relationshipType: KnowledgeRelationType.RelatedTo,
                evidence: `Explicit knowledge link from image analysis ${imageId}`,
                strengthScore: 80,
                confidenceScore: 85,
            });
        }
        await graph.evolveGraph(knowledgeId);
        this.learner.learnFromAnalysis(draft);
        this.records.upsert(draft);
        this.logger.log("info", "analysis", "Image analyzed and stored", {
            imageId,
            knowledgeId,
            quality: scores.imageQualityScore,
        });
        return { success: true, record: draft, durationMs: Date.now() - start, diagnostics };
    }
    async search(query) {
        const retrieval = this.foundation.getRetrievalEngine();
        const search = await retrieval.search({
            mode: KnowledgeSearchMode.Hybrid,
            knowledgeType: KnowledgeStorageType.Image,
            text: query.text,
            tags: query.product ? [query.product] : undefined,
            keywords: query.brand ? [query.brand] : undefined,
            limit: query.limit ?? 20,
        });
        let results = search.results
            .map((r) => {
            if (!r.record?.payload)
                return undefined;
            return r.record.payload;
        })
            .filter((r) => Boolean(r));
        if (results.length === 0) {
            results = this.filterLocal(this.records.getAll(), query);
        }
        return results;
    }
    filterLocal(records, query) {
        return records.filter((r) => {
            if (query.imageType && r.imageType !== query.imageType)
                return false;
            if (query.product && !r.visual.products.some((p) => p.toLowerCase().includes(query.product.toLowerCase()))) {
                return false;
            }
            if (query.brand && !r.brand.brandIdentity.toLowerCase().includes(query.brand.toLowerCase()))
                return false;
            if (query.color && !r.visual.dominantColors.some((c) => c.includes(query.color)))
                return false;
            if (query.style && r.design.creativeStyle !== query.style)
                return false;
            if (query.layout && r.design.layout !== query.layout)
                return false;
            if (query.category && r.productPresentation.category !== query.category)
                return false;
            if (query.minQuality && r.scores.imageQualityScore < query.minQuality)
                return false;
            if (query.minComposition && r.scores.compositionScore < query.minComposition)
                return false;
            if (query.language && r.language !== query.language)
                return false;
            return true;
        });
    }
    ensureGraphNode(graph, nodeId, title, searchableText) {
        if (!graph.getGraph().nodes[nodeId]) {
            graph.createNode(nodeId, KnowledgeNodeType.Image, title, searchableText);
        }
    }
    buildKnowledgeDescription(record) {
        return [
            `Image analysis for ${record.imageName}`,
            `Type: ${record.imageType}`,
            `Style: ${record.design.creativeStyle}`,
            `Products: ${record.visual.products.join(", ") || "none"}`,
            `Brand: ${record.brand.brandIdentity}`,
            `Composition: ${record.visual.composition}`,
            `Quality: ${record.scores.imageQualityScore}`,
            `Marketing readiness: ${record.scores.marketingReadinessScore}`,
        ].join(". ");
    }
}
//# sourceMappingURL=image-processor.js.map