import fs from "node:fs";
import path from "node:path";
import { VideoIndexType } from "./types.js";
export class FrameIndexManager {
    logger;
    indexes = new Map();
    indexesPath = "";
    catalogPath = "";
    lookupTimes = [];
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.indexesPath = storage.getIndexesPath();
        this.catalogPath = path.join(this.indexesPath, "frame-index-catalog.json");
        fs.mkdirSync(this.indexesPath, { recursive: true });
        for (const type of Object.values(VideoIndexType)) {
            fs.mkdirSync(path.join(this.indexesPath, type), { recursive: true });
        }
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "indexing", "Frame index manager initialized", {
            indexCount: this.indexes.size,
        });
    }
    indexEntry(input) {
        const indexId = input.indexId ??
            `idx-${input.indexType}-${input.videoId}-${input.frameNumber ?? input.timecodeMs ?? Date.now()}`;
        const entry = {
            ...input,
            indexId,
            createdAt: new Date().toISOString(),
        };
        this.indexes.set(indexId, entry);
        this.persist();
        return entry;
    }
    indexFrame(projectId, videoId, frameNumber, timecodeMs, opts) {
        return this.indexEntry({
            indexType: opts?.keyframe ? VideoIndexType.Keyframe : VideoIndexType.Frame,
            projectId,
            videoId,
            frameNumber,
            timecodeMs,
            keyframe: opts?.keyframe,
            sceneId: opts?.sceneId,
            timelineId: opts?.timelineId,
            relationshipLinks: [videoId, projectId],
        });
    }
    indexScene(projectId, videoId, sceneId, startMs, endMs, timelineId) {
        return this.indexEntry({
            indexType: VideoIndexType.Scene,
            projectId,
            videoId,
            sceneId,
            timecodeMs: startMs,
            timelineId,
            label: `scene-${sceneId}`,
            relationshipLinks: [sceneId, videoId, projectId],
        });
    }
    indexTimeline(projectId, videoId, timelineId) {
        return this.indexEntry({
            indexType: VideoIndexType.Timeline,
            projectId,
            videoId,
            timelineId,
            label: `timeline-${timelineId}`,
            relationshipLinks: [timelineId, videoId, projectId],
        });
    }
    indexShot(projectId, videoId, shotId, sceneId, timecodeMs) {
        return this.indexEntry({
            indexType: VideoIndexType.Shot,
            projectId,
            videoId,
            shotId,
            sceneId,
            timecodeMs,
            label: `shot-${shotId}`,
            relationshipLinks: [shotId, sceneId, videoId],
        });
    }
    indexSequence(projectId, videoId, sequenceId) {
        return this.indexEntry({
            indexType: VideoIndexType.Sequence,
            projectId,
            videoId,
            sequenceId,
            label: `sequence-${sequenceId}`,
            relationshipLinks: [sequenceId, videoId, projectId],
        });
    }
    lookupById(indexId) {
        const start = Date.now();
        const entry = this.indexes.get(indexId);
        this.lookupTimes.push(Date.now() - start);
        return entry;
    }
    lookupByFrame(videoId, frameNumber) {
        const start = Date.now();
        const entry = [...this.indexes.values()].find((e) => e.videoId === videoId &&
            e.frameNumber === frameNumber &&
            (e.indexType === VideoIndexType.Frame || e.indexType === VideoIndexType.Keyframe));
        this.lookupTimes.push(Date.now() - start);
        return entry;
    }
    lookupByTimecode(videoId, timecodeMs, toleranceMs = 50) {
        const start = Date.now();
        const entry = [...this.indexes.values()].find((e) => e.videoId === videoId &&
            e.timecodeMs !== undefined &&
            Math.abs(e.timecodeMs - timecodeMs) <= toleranceMs);
        this.lookupTimes.push(Date.now() - start);
        return entry;
    }
    searchIndexes(query) {
        const start = Date.now();
        let results = [...this.indexes.values()];
        if (query.projectId)
            results = results.filter((e) => e.projectId === query.projectId);
        if (query.videoId)
            results = results.filter((e) => e.videoId === query.videoId);
        if (query.indexType)
            results = results.filter((e) => e.indexType === query.indexType);
        if (query.sceneId)
            results = results.filter((e) => e.sceneId === query.sceneId);
        if (query.timelineId)
            results = results.filter((e) => e.timelineId === query.timelineId);
        this.lookupTimes.push(Date.now() - start);
        return results.slice(0, query.limit ?? 100);
    }
    getCount() {
        return this.indexes.size;
    }
    getCountByType() {
        const counts = {};
        for (const entry of this.indexes.values()) {
            counts[entry.indexType] = (counts[entry.indexType] ?? 0) + 1;
        }
        return counts;
    }
    getAverageLookupMs() {
        if (this.lookupTimes.length === 0)
            return 0;
        return Math.round(this.lookupTimes.reduce((a, b) => a + b, 0) / this.lookupTimes.length);
    }
    verifyIntegrity() {
        const issues = [];
        if (!fs.existsSync(this.indexesPath)) {
            issues.push("Frame index directory missing");
        }
        for (const type of Object.values(VideoIndexType)) {
            if (!fs.existsSync(path.join(this.indexesPath, type))) {
                issues.push(`Index type directory missing: ${type}`);
            }
        }
        return { valid: issues.length === 0, issues };
    }
    loadFromDisk() {
        const raw = fs.readFileSync(this.catalogPath, "utf8");
        const catalog = JSON.parse(raw);
        this.indexes.clear();
        for (const entry of catalog.indexes) {
            this.indexes.set(entry.indexId, entry);
        }
    }
    persist() {
        const byType = {};
        for (const entry of this.indexes.values()) {
            byType[entry.indexType] = (byType[entry.indexType] ?? 0) + 1;
        }
        const catalog = {
            lastUpdated: new Date().toISOString(),
            totalEntries: this.indexes.size,
            indexes: [...this.indexes.values()],
            byType,
        };
        fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), "utf8");
    }
}
//# sourceMappingURL=frame-index-manager.js.map