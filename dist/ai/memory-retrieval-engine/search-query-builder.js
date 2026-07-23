import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { SearchMode } from "./types.js";
export class SearchQueryBuilder {
    filterCandidates(entries, query) {
        let candidates = [...entries];
        const mode = query.mode ?? SearchMode.Hybrid;
        if (query.memoryId) {
            candidates = candidates.filter((e) => e.memoryId === query.memoryId);
            return candidates;
        }
        if (query.memoryType) {
            candidates = candidates.filter((e) => e.memoryType === query.memoryType);
        }
        if (query.category) {
            const cat = query.category.toLowerCase();
            candidates = candidates.filter((e) => e.category.toLowerCase().includes(cat));
        }
        if (query.project) {
            candidates = candidates.filter((e) => e.searchableText.includes(query.project.toLowerCase()) ||
                e.category === "project");
        }
        if (query.workflow) {
            candidates = candidates.filter((e) => e.searchableText.includes(query.workflow.toLowerCase()));
        }
        if (query.tags?.length) {
            candidates = candidates.filter((e) => query.tags.every((tag) => e.searchableText.includes(tag.toLowerCase())));
        }
        if (query.keywords?.length) {
            candidates = candidates.filter((e) => query.keywords.some((kw) => e.searchableText.includes(kw.toLowerCase())));
        }
        if (query.text) {
            const text = query.text.toLowerCase();
            if (mode === SearchMode.Exact) {
                candidates = candidates.filter((e) => e.title.toLowerCase() === text || e.memoryId === text);
            }
            else {
                candidates = candidates.filter((e) => e.searchableText.includes(text));
            }
        }
        if (query.dateFrom) {
            const from = new Date(query.dateFrom).getTime();
            candidates = candidates.filter((e) => new Date(e.lastUpdate).getTime() >= from);
        }
        if (query.dateTo) {
            const to = new Date(query.dateTo).getTime();
            candidates = candidates.filter((e) => new Date(e.lastUpdate).getTime() <= to);
        }
        if (query.relatedTo) {
            candidates = candidates.filter((e) => e.memoryId !== query.relatedTo);
        }
        if (mode === SearchMode.Recent) {
            candidates.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime());
        }
        this.applyTypeFilter(candidates, query);
        return candidates;
    }
    applyTypeFilter(candidates, query) {
        const typeMap = {
            product: MemoryStorageType.Product,
            video: MemoryStorageType.Video,
            marketing: MemoryStorageType.Marketing,
            decision: MemoryStorageType.Decision,
            reasoning: MemoryStorageType.Reasoning,
            language: MemoryStorageType.Language,
            userPreference: MemoryStorageType.UserPreference,
        };
        for (const [field, type] of Object.entries(typeMap)) {
            const value = query[field];
            if (typeof value === "string" && value.length > 0) {
                const idx = candidates.findIndex((e) => e.memoryType === type);
                if (idx >= 0) {
                    candidates.splice(0, candidates.length, ...candidates.filter((e) => e.memoryType === type && e.searchableText.includes(value.toLowerCase())));
                }
            }
        }
    }
}
//# sourceMappingURL=search-query-builder.js.map