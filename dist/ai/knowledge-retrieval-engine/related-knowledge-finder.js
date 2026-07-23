import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeSearchMode, } from "./types.js";
export class RelatedKnowledgeFinder {
    ranker;
    logger;
    constructor(ranker, logger) {
        this.ranker = ranker;
        this.logger = logger;
    }
    findRelated(source, allEntries, limit = 10) {
        const candidates = allEntries.filter((e) => e.knowledgeId !== source.knowledgeId);
        const related = candidates.filter((entry) => {
            const strength = this.computeStrength(source, entry);
            return strength >= 30;
        });
        const ranked = this.ranker.rank(related, { mode: KnowledgeSearchMode.Relationship, limit }, source.knowledgeId);
        this.logger.log("info", "related", `Found ${ranked.length} related knowledge records`, {
            sourceId: source.knowledgeId,
        });
        return ranked;
    }
    recommend(context, allEntries, excludeIds = [], limit = 5) {
        const candidates = allEntries.filter((e) => !excludeIds.includes(e.knowledgeId));
        const scored = candidates
            .map((entry) => ({
            entry,
            score: this.computeRecommendationScore(entry, context),
        }))
            .filter((s) => s.score >= 40)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return this.ranker.rank(scored.map((s) => s.entry), {
            mode: KnowledgeSearchMode.Recommendation,
            text: context.text ?? context.objective,
            context: { objective: context.objective, domain: context.domain, workflowId: context.workflow },
            limit,
        });
    }
    categorizeRelated(source, related) {
        const groups = {
            relatedKnowledge: [...source.relatedKnowledge],
            relatedMemory: [...source.relatedMemory],
            relatedProjects: [],
            relatedProducts: [],
            relatedVideos: [],
            relatedMarketing: [],
            relatedDecisions: [],
            relatedLearning: [],
            relatedWorkflows: [],
        };
        for (const r of related) {
            groups.relatedKnowledge.push(r.knowledgeId);
            switch (r.knowledgeType) {
                case KnowledgeStorageType.Product:
                    groups.relatedProducts.push(r.knowledgeId);
                    break;
                case KnowledgeStorageType.Video:
                    groups.relatedVideos.push(r.knowledgeId);
                    break;
                case KnowledgeStorageType.Marketing:
                    groups.relatedMarketing.push(r.knowledgeId);
                    break;
                case KnowledgeStorageType.Decision:
                    groups.relatedDecisions.push(r.knowledgeId);
                    break;
                case KnowledgeStorageType.Reasoning:
                    groups.relatedLearning.push(r.knowledgeId);
                    break;
                case KnowledgeStorageType.Workflow:
                    groups.relatedWorkflows.push(r.knowledgeId);
                    break;
                case KnowledgeStorageType.Business:
                    groups.relatedProjects.push(r.knowledgeId);
                    break;
            }
        }
        for (const memId of source.relatedMemory) {
            if (memId.includes("project"))
                groups.relatedProjects.push(memId);
        }
        return groups;
    }
    computeStrength(source, entry) {
        let strength = 0;
        if (source.relatedKnowledge.includes(entry.knowledgeId))
            strength += 50;
        if (source.relatedMemory.some((m) => entry.searchableText.includes(m.toLowerCase())))
            strength += 35;
        const sharedTags = source.tags.filter((t) => entry.searchableText.includes(t.toLowerCase()));
        strength += sharedTags.length * 10;
        const sharedKeywords = source.keywords.filter((k) => entry.searchableText.includes(k.toLowerCase()));
        strength += sharedKeywords.length * 8;
        strength += this.getTypeRelationStrength(source.knowledgeType, entry.knowledgeType);
        if (source.category === entry.category)
            strength += 15;
        if (source.classification.topic === entry.topic)
            strength += 20;
        return Math.min(100, strength);
    }
    computeRecommendationScore(entry, context) {
        let score = 0;
        if (context.text && entry.searchableText.includes(context.text.toLowerCase()))
            score += 40;
        if (context.objective && entry.searchableText.includes(context.objective.toLowerCase()))
            score += 35;
        if (context.domain && entry.searchableText.includes(context.domain.toLowerCase()))
            score += 25;
        if (context.workflow && entry.searchableText.includes(context.workflow.toLowerCase()))
            score += 25;
        if (entry.knowledgeType === KnowledgeStorageType.Reasoning)
            score += 10;
        if (entry.importance === "high" || entry.importance === "critical")
            score += 10;
        return score;
    }
    getTypeRelationStrength(sourceType, targetType) {
        const relations = {
            [KnowledgeStorageType.Product]: [
                KnowledgeStorageType.Marketing,
                KnowledgeStorageType.Video,
                KnowledgeStorageType.Brand,
                KnowledgeStorageType.Image,
            ],
            [KnowledgeStorageType.Video]: [KnowledgeStorageType.Marketing, KnowledgeStorageType.Product, KnowledgeStorageType.Creative],
            [KnowledgeStorageType.Decision]: [KnowledgeStorageType.Reasoning, KnowledgeStorageType.Workflow],
            [KnowledgeStorageType.Reasoning]: [KnowledgeStorageType.Decision, KnowledgeStorageType.Industry],
            [KnowledgeStorageType.Marketing]: [KnowledgeStorageType.Product, KnowledgeStorageType.Brand],
            [KnowledgeStorageType.Workflow]: [KnowledgeStorageType.Decision, KnowledgeStorageType.Technical],
        };
        const related = relations[sourceType];
        if (related?.includes(targetType))
            return 25;
        return 0;
    }
}
//# sourceMappingURL=related-knowledge-finder.js.map