import { MemoryRecordStatus } from "../memory-storage-engine/types.js";
const INACTIVE_DAYS = 90;
const MIN_QUALITY_TO_KEEP_ACTIVE = 30;
export class ArchiveManager {
    foundation;
    tierManager;
    logger;
    constructor(foundation, tierManager, logger) {
        this.foundation = foundation;
        this.tierManager = tierManager;
        this.logger = logger;
    }
    async archiveInactive() {
        const start = Date.now();
        const storage = this.foundation.getStorageEngine();
        const archived = [];
        for (const entry of storage.getIndexEntries()) {
            const read = await storage.getRecord(entry.memoryId);
            if (!read.success || !read.record)
                continue;
            if (read.record.status === MemoryRecordStatus.Archived)
                continue;
            const inactiveDays = this.daysSince(read.record.lastUpdate);
            if (inactiveDays >= INACTIVE_DAYS && read.record.qualityScore < MIN_QUALITY_TO_KEEP_ACTIVE) {
                const result = await storage.updateRecord(entry.memoryId, {
                    status: MemoryRecordStatus.Archived,
                    tags: [...read.record.tags, "auto-archived"],
                });
                if (result.success) {
                    this.tierManager.markArchived(entry.memoryId);
                    archived.push(entry.memoryId);
                }
            }
        }
        this.logger.log("info", "archive", "Archive operation complete", {
            archived: archived.length,
        });
        return { archived: archived.length, memoryIds: archived, durationMs: Date.now() - start };
    }
    daysSince(isoDate) {
        const diff = Date.now() - new Date(isoDate).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
}
//# sourceMappingURL=archive-manager.js.map