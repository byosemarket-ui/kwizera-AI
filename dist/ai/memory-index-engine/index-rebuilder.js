export class IndexRebuilder {
    invertedStore;
    relationshipIndex;
    indexBuilder;
    logger;
    constructor(invertedStore, relationshipIndex, indexBuilder, logger) {
        this.invertedStore = invertedStore;
        this.relationshipIndex = relationshipIndex;
        this.indexBuilder = indexBuilder;
        this.logger = logger;
    }
    async rebuild(storageEngine) {
        const start = Date.now();
        this.logger.log("info", "rebuild", "Starting full index rebuild");
        this.invertedStore.clearAll();
        this.relationshipIndex.clear();
        const entries = storageEngine.getIndexEntries();
        const allIds = entries.map((e) => e.memoryId);
        let indexed = 0;
        let relationships = 0;
        for (const entry of entries) {
            const read = await storageEngine.getRecord(entry.memoryId, "memory-index-engine");
            if (read.success && read.record) {
                this.indexBuilder.indexRecord(read.record, allIds);
                indexed++;
                relationships += this.relationshipIndex.getRelated(entry.memoryId).length;
            }
        }
        const durationMs = Date.now() - start;
        this.logger.log("info", "rebuild", "Index rebuild complete", {
            indexed,
            relationships,
            durationMs,
        });
        return {
            success: true,
            recordsIndexed: indexed,
            relationshipsBuilt: relationships,
            durationMs,
            dataProtected: true,
        };
    }
}
//# sourceMappingURL=index-rebuilder.js.map