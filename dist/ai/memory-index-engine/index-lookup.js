import { IndexSearchMode, IndexType } from "./types.js";
export class IndexLookup {
    invertedStore;
    relationshipIndex;
    constructor(invertedStore, relationshipIndex) {
        this.invertedStore = invertedStore;
        this.relationshipIndex = relationshipIndex;
    }
    lookup(query) {
        const mode = query.mode ?? IndexSearchMode.Hybrid;
        const typesUsed = [];
        const resultSets = [];
        if (query.memoryId) {
            typesUsed.push(IndexType.MemoryId);
            resultSets.push(this.invertedStore.lookup(IndexType.MemoryId, query.memoryId));
            return { memoryIds: this.unique(resultSets.flat()), indexTypesUsed: typesUsed };
        }
        if (query.project) {
            typesUsed.push(IndexType.Project);
            resultSets.push(this.invertedStore.lookup(IndexType.Project, query.project));
        }
        if (query.category) {
            typesUsed.push(IndexType.Category);
            resultSets.push(this.invertedStore.lookup(IndexType.Category, query.category));
        }
        if (query.brand) {
            typesUsed.push(IndexType.Brand);
            resultSets.push(this.invertedStore.lookup(IndexType.Brand, query.brand));
        }
        if (query.tags?.length) {
            typesUsed.push(IndexType.Tags);
            for (const tag of query.tags) {
                resultSets.push(this.invertedStore.lookup(IndexType.Tags, tag));
            }
        }
        if (query.keywords?.length) {
            typesUsed.push(IndexType.Keywords);
            for (const kw of query.keywords) {
                resultSets.push(this.invertedStore.lookup(IndexType.Keywords, kw));
            }
        }
        if (query.workflow) {
            typesUsed.push(IndexType.Workflow);
            resultSets.push(this.invertedStore.lookup(IndexType.Workflow, query.workflow));
        }
        if (query.aiModule) {
            typesUsed.push(IndexType.AiModule);
            resultSets.push(this.invertedStore.lookup(IndexType.AiModule, query.aiModule));
        }
        if (query.relatedTo) {
            typesUsed.push(IndexType.Related);
            resultSets.push(this.relationshipIndex.getRelated(query.relatedTo));
        }
        if (query.text) {
            typesUsed.push(IndexType.Keywords);
            if (mode === IndexSearchMode.Exact) {
                const allKeywords = this.invertedStore.lookupAll(IndexType.Keywords);
                const exact = Object.entries(allKeywords)
                    .filter(([k]) => k === query.text.toLowerCase())
                    .flatMap(([, ids]) => ids);
                resultSets.push(exact);
            }
            else {
                const allKeywords = this.invertedStore.lookupAll(IndexType.Keywords);
                const text = query.text.toLowerCase();
                const matched = Object.entries(allKeywords)
                    .filter(([k]) => k.includes(text))
                    .flatMap(([, ids]) => ids);
                resultSets.push(matched);
                const allTags = this.invertedStore.lookupAll(IndexType.Tags);
                const tagMatched = Object.entries(allTags)
                    .filter(([k]) => k.includes(text))
                    .flatMap(([, ids]) => ids);
                resultSets.push(tagMatched);
            }
        }
        if (resultSets.length === 0) {
            return { memoryIds: [], indexTypesUsed: typesUsed };
        }
        let ids;
        if (mode === IndexSearchMode.Hybrid && resultSets.length > 1) {
            ids = this.intersect(resultSets);
            if (ids.length === 0)
                ids = this.union(resultSets);
        }
        else {
            ids = this.union(resultSets);
        }
        if (query.limit) {
            ids = ids.slice(0, query.limit);
        }
        return { memoryIds: ids, indexTypesUsed: typesUsed };
    }
    unique(ids) {
        return [...new Set(ids)];
    }
    union(sets) {
        return this.unique(sets.flat());
    }
    intersect(sets) {
        if (sets.length === 0)
            return [];
        return sets.reduce((acc, set) => acc.filter((id) => set.includes(id)));
    }
}
//# sourceMappingURL=index-lookup.js.map