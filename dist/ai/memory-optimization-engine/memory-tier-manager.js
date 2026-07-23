import fs from "node:fs";
import path from "node:path";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryTier } from "./types.js";
const FREQUENT_ACCESS_THRESHOLD = 3;
const INACTIVE_DAYS = 90;
export class MemoryTierManager {
    foundation;
    storageRoot;
    logger;
    tiersPath = "";
    assignments = new Map();
    constructor(foundation, storageRoot, logger) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.logger = logger;
    }
    initialize(optimizationDir) {
        this.tiersPath = path.join(optimizationDir, "tiers.json");
        if (fs.existsSync(this.tiersPath)) {
            const data = JSON.parse(fs.readFileSync(this.tiersPath, "utf8"));
            for (const assignment of data) {
                this.assignments.set(assignment.memoryId, assignment);
            }
        }
    }
    classifyAll() {
        const storage = this.foundation.getStorageEngine();
        const usageStats = this.loadUsageStats();
        const now = new Date().toISOString();
        for (const entry of storage.getIndexEntries()) {
            const usage = usageStats.get(entry.memoryId);
            const accessCount = usage?.accessCount ?? 0;
            const lastAccessTime = usage?.lastAccessTime ?? entry.lastUpdate;
            let tier = MemoryTier.Active;
            if (entry.memoryType === MemoryStorageType.System) {
                tier = MemoryTier.System;
            }
            else if (entry.memoryType === MemoryStorageType.Learning) {
                tier = MemoryTier.Learning;
            }
            else {
                const read = storage.findIndexEntry(entry.memoryId);
                const inactiveDays = this.daysSince(lastAccessTime);
                if (inactiveDays >= INACTIVE_DAYS) {
                    tier = MemoryTier.Historical;
                }
                else if (accessCount >= FREQUENT_ACCESS_THRESHOLD) {
                    tier = MemoryTier.FrequentlyUsed;
                }
            }
            const existing = this.assignments.get(entry.memoryId);
            if (existing?.tier === MemoryTier.Archived) {
                tier = MemoryTier.Archived;
            }
            this.assignments.set(entry.memoryId, {
                memoryId: entry.memoryId,
                memoryType: entry.memoryType,
                tier,
                accessCount,
                lastAccessTime,
                assignedAt: now,
            });
        }
        this.persist();
        return [...this.assignments.values()];
    }
    getTier(memoryId) {
        return this.assignments.get(memoryId);
    }
    getByTier(tier) {
        return [...this.assignments.values()].filter((a) => a.tier === tier);
    }
    getDistribution() {
        const dist = {
            [MemoryTier.Active]: 0,
            [MemoryTier.FrequentlyUsed]: 0,
            [MemoryTier.Learning]: 0,
            [MemoryTier.Archived]: 0,
            [MemoryTier.Historical]: 0,
            [MemoryTier.System]: 0,
        };
        for (const assignment of this.assignments.values()) {
            dist[assignment.tier]++;
        }
        return dist;
    }
    markArchived(memoryId) {
        const existing = this.assignments.get(memoryId);
        if (existing) {
            existing.tier = MemoryTier.Archived;
            existing.assignedAt = new Date().toISOString();
            this.persist();
        }
    }
    getTiersPath() {
        return this.tiersPath;
    }
    loadUsageStats() {
        const statsPath = path.join(this.storageRoot, "memory", "retrieval", "usage-stats.json");
        const map = new Map();
        if (!fs.existsSync(statsPath))
            return map;
        const data = JSON.parse(fs.readFileSync(statsPath, "utf8"));
        for (const stat of data) {
            map.set(stat.memoryId, stat);
        }
        return map;
    }
    daysSince(isoDate) {
        const diff = Date.now() - new Date(isoDate).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    persist() {
        fs.writeFileSync(this.tiersPath, JSON.stringify([...this.assignments.values()], null, 2), "utf8");
    }
}
//# sourceMappingURL=memory-tier-manager.js.map