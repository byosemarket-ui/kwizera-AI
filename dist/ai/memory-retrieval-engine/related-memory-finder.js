import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryIntegrityStatus } from "../memory-storage-engine/types.js";
import { SearchMode } from "./types.js";
export class RelatedMemoryFinder {
    ranker;
    logger;
    constructor(ranker, logger) {
        this.ranker = ranker;
        this.logger = logger;
    }
    findRelated(source, allEntries, limit = 10) {
        const candidates = allEntries.filter((e) => e.memoryId !== source.memoryId);
        const related = candidates.filter((entry) => {
            const strength = this.computeStrength(source, entry);
            return strength >= 30;
        });
        const ranked = this.ranker.rank(related, { mode: SearchMode.Relationship, limit }, source.memoryId);
        this.logger.log("info", "related", `Found ${ranked.length} related memories`, {
            sourceId: source.memoryId,
        });
        return ranked;
    }
    recommend(context, allEntries, excludeIds = [], limit = 5) {
        const candidates = allEntries.filter((e) => !excludeIds.includes(e.memoryId));
        const scored = candidates
            .map((entry) => ({
            entry,
            score: this.computeRecommendationScore(entry, context),
        }))
            .filter((s) => s.score >= 40)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return this.ranker.rank(scored.map((s) => s.entry), { text: context.text, limit });
    }
    computeStrength(source, entry) {
        let strength = 0;
        if (source.relatedProject && entry.searchableText.includes(source.relatedProject.toLowerCase())) {
            strength += 35;
        }
        if (source.relatedWorkflow && entry.searchableText.includes(source.relatedWorkflow.toLowerCase())) {
            strength += 30;
        }
        const sharedTags = source.tags.filter((t) => entry.searchableText.includes(t.toLowerCase()));
        strength += sharedTags.length * 10;
        const typeRelations = this.getTypeRelationStrength(source.memoryType, entry.memoryType);
        strength += typeRelations;
        if (source.category === entry.category)
            strength += 15;
        return Math.min(100, strength);
    }
    computeRecommendationScore(entry, context) {
        let score = 0;
        if (context.text && entry.searchableText.includes(context.text.toLowerCase()))
            score += 40;
        if (context.project && entry.searchableText.includes(context.project.toLowerCase()))
            score += 30;
        if (context.workflow && entry.searchableText.includes(context.workflow.toLowerCase()))
            score += 25;
        if (entry.memoryType === MemoryStorageType.Learning)
            score += 10;
        return score;
    }
    getTypeRelationStrength(sourceType, targetType) {
        const relations = {
            [MemoryStorageType.Project]: [
                MemoryStorageType.Video,
                MemoryStorageType.Marketing,
                MemoryStorageType.Workflow,
                MemoryStorageType.Product,
            ],
            [MemoryStorageType.Video]: [MemoryStorageType.Marketing, MemoryStorageType.Project],
            [MemoryStorageType.Decision]: [MemoryStorageType.Reasoning, MemoryStorageType.Workflow],
            [MemoryStorageType.Reasoning]: [MemoryStorageType.Decision, MemoryStorageType.Learning],
            [MemoryStorageType.Marketing]: [MemoryStorageType.Product, MemoryStorageType.Video],
        };
        const related = relations[sourceType];
        if (related?.includes(targetType))
            return 25;
        return 0;
    }
    categorizeRelated(source, related) {
        const groups = {
            projects: [],
            videos: [],
            products: [],
            marketing: [],
            decisions: [],
            learning: [],
            workflows: [],
        };
        for (const r of related) {
            switch (r.memoryType) {
                case MemoryStorageType.Project:
                    groups.projects.push(r.memoryId);
                    break;
                case MemoryStorageType.Video:
                    groups.videos.push(r.memoryId);
                    break;
                case MemoryStorageType.Product:
                    groups.products.push(r.memoryId);
                    break;
                case MemoryStorageType.Marketing:
                    groups.marketing.push(r.memoryId);
                    break;
                case MemoryStorageType.Decision:
                    groups.decisions.push(r.memoryId);
                    break;
                case MemoryStorageType.Learning:
                    groups.learning.push(r.memoryId);
                    break;
                case MemoryStorageType.Workflow:
                    groups.workflows.push(r.memoryId);
                    break;
            }
        }
        void source;
        return groups;
    }
}
export function isRecordRetrievable(record) {
    return (record.integrityStatus === MemoryIntegrityStatus.Verified ||
        record.integrityStatus === MemoryIntegrityStatus.Unverified);
}
//# sourceMappingURL=related-memory-finder.js.map