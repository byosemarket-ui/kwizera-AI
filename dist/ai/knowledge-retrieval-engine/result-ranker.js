import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeSearchMode, } from "./types.js";
import { KnowledgeSearchQueryBuilder } from "./search-query-builder.js";
export class KnowledgeResultRanker {
    usageTracker;
    queryBuilder = new KnowledgeSearchQueryBuilder();
    constructor(usageTracker) {
        this.usageTracker = usageTracker;
    }
    rank(entries, query, relatedToId) {
        const mode = query.mode ?? KnowledgeSearchMode.Hybrid;
        const ranked = entries.map((entry) => {
            const usage = this.usageTracker.getStat(entry.knowledgeId);
            const factors = this.computeFactors(entry, query, usage, relatedToId, mode);
            return {
                knowledgeId: entry.knowledgeId,
                knowledgeType: entry.knowledgeType,
                title: entry.title,
                category: entry.category,
                topic: entry.topic,
                ranking: factors,
                rank: 0,
            };
        });
        ranked.sort((a, b) => {
            if (b.ranking.compositeScore !== a.ranking.compositeScore) {
                return b.ranking.compositeScore - a.ranking.compositeScore;
            }
            return b.ranking.qualityScore - a.ranking.qualityScore;
        });
        const limit = query.limit ?? 20;
        return ranked.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
    }
    computeFactors(entry, query, usage, relatedToId, mode) {
        const relevanceScore = this.computeRelevance(entry, query, mode);
        const qualityScore = this.estimateQuality(entry);
        const confidenceScore = this.estimateConfidence(entry);
        const sourceReliability = this.estimateSourceReliability(entry);
        const usageFrequency = Math.min(usage.accessCount, 100);
        const learningImportance = this.computeLearningImportance(entry);
        const relationshipStrength = relatedToId
            ? this.computeRelationshipStrength(entry, relatedToId)
            : mode === KnowledgeSearchMode.Relationship
                ? 50
                : 0;
        const recencyScore = this.computeRecencyScore(entry.lastUpdated, usage.lastAccessTime);
        const businessRelevance = this.computeBusinessRelevance(entry, query);
        const priorityBonus = mode === KnowledgeSearchMode.Priority ? qualityScore * 0.1 : 0;
        const verificationBonus = entry.verificationStatus === KnowledgeVerificationStatus.Verified ? 10 : 0;
        const compositeScore = Math.round(relevanceScore * 0.22 +
            qualityScore * 0.2 +
            confidenceScore * 0.15 +
            sourceReliability * 0.1 +
            Math.min(usageFrequency, 20) +
            recencyScore * 0.08 +
            learningImportance * 0.08 +
            relationshipStrength * 0.07 +
            businessRelevance * 0.05 +
            priorityBonus +
            verificationBonus);
        return {
            relevanceScore,
            qualityScore,
            confidenceScore,
            sourceReliability,
            relationshipStrength,
            learningImportance,
            usageFrequency,
            recencyScore,
            businessRelevance,
            compositeScore: Math.min(100, Math.max(0, compositeScore)),
        };
    }
    computeRelevance(entry, query, mode) {
        let score = 50;
        if (query.text) {
            const text = query.text.toLowerCase();
            if (entry.title.toLowerCase().includes(text))
                score += 25;
            if (entry.searchableText.includes(text))
                score += 15;
            if (mode === KnowledgeSearchMode.Semantic || mode === KnowledgeSearchMode.Hybrid) {
                score += Math.round(this.queryBuilder.computeSemanticScore(text, entry.searchableText) * 30);
            }
        }
        if (query.tags?.length) {
            const matches = query.tags.filter((t) => entry.searchableText.includes(t.toLowerCase())).length;
            score += matches * 10;
        }
        if (query.keywords?.length) {
            const matches = query.keywords.filter((k) => entry.searchableText.includes(k.toLowerCase())).length;
            score += matches * 8;
        }
        if (query.category && entry.category.toLowerCase().includes(query.category.toLowerCase())) {
            score += 15;
        }
        if (query.topic && entry.topic.toLowerCase().includes(query.topic.toLowerCase())) {
            score += 12;
        }
        if (query.context?.objective) {
            score += Math.round(this.queryBuilder.computeSemanticScore(query.context.objective, entry.searchableText) * 25);
        }
        return Math.min(100, score);
    }
    estimateQuality(entry) {
        let score = 65;
        if (entry.verificationStatus === KnowledgeVerificationStatus.Verified)
            score += 20;
        else if (entry.verificationStatus === KnowledgeVerificationStatus.Pending)
            score += 5;
        if (entry.title.length > 10)
            score += 5;
        if (entry.searchableText.length > 50)
            score += 5;
        if (entry.version > 1)
            score += 5;
        score += this.importanceBonus(entry.importance);
        return Math.min(100, score);
    }
    estimateConfidence(entry) {
        let score = 60;
        if (entry.verificationStatus === KnowledgeVerificationStatus.Verified)
            score += 25;
        if (entry.importance === "critical" || entry.importance === "high")
            score += 10;
        return Math.min(100, score);
    }
    estimateSourceReliability(entry) {
        if (entry.source.includes("validation") || entry.source.includes("kwizera"))
            return 85;
        if (entry.source.includes("memory"))
            return 80;
        return 70;
    }
    computeLearningImportance(entry) {
        if (entry.knowledgeType === KnowledgeStorageType.Reasoning)
            return 90;
        if (entry.knowledgeType === KnowledgeStorageType.Decision)
            return 85;
        if (entry.knowledgeType === KnowledgeStorageType.Workflow)
            return 75;
        if (entry.knowledgeType === KnowledgeStorageType.Industry)
            return 70;
        return 45;
    }
    computeRelationshipStrength(entry, relatedToId) {
        if (entry.knowledgeId === relatedToId)
            return 0;
        if (entry.searchableText.includes(relatedToId.toLowerCase()))
            return 80;
        return 30;
    }
    computeRecencyScore(lastUpdated, lastAccess) {
        const updateAge = Date.now() - new Date(lastUpdated).getTime();
        const accessAge = Date.now() - new Date(lastAccess).getTime();
        const day = 86400000;
        let score = 0;
        if (updateAge < day)
            score += 40;
        else if (updateAge < day * 7)
            score += 25;
        else if (updateAge < day * 30)
            score += 10;
        if (accessAge < day)
            score += 20;
        return Math.min(60, score);
    }
    computeBusinessRelevance(entry, query) {
        let score = 40;
        if (entry.knowledgeType === KnowledgeStorageType.Business ||
            entry.knowledgeType === KnowledgeStorageType.Product ||
            entry.knowledgeType === KnowledgeStorageType.Marketing) {
            score += 20;
        }
        if (query.context?.domain && entry.searchableText.includes(query.context.domain.toLowerCase())) {
            score += 25;
        }
        return Math.min(100, score);
    }
    importanceBonus(importance) {
        switch (importance) {
            case "critical":
                return 15;
            case "high":
                return 10;
            case "medium":
                return 5;
            default:
                return 0;
        }
    }
}
//# sourceMappingURL=result-ranker.js.map