import path from "node:path";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryAccessPermission, MemoryCategory, MemoryModuleStatus } from "../memory-foundation/types.js";
import { VideoHistoryStore } from "./video-history-store.js";
import { VideoLearner } from "./video-learner.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoPatternDetector } from "./video-pattern-detector.js";
import { VideoPatternStore } from "./video-pattern-store.js";
import { VideoProcessor, recordFromMemory } from "./video-processor.js";
import { VideoRelationshipLinker } from "./video-relationship-linker.js";
import { VideoScorer } from "./video-scorer.js";
import { VideoMemoryEngineError, VideoStatus, } from "./types.js";
/**
 * Video Memory Engine — permanent video production knowledge storage and learning.
 */
export class AiVideoMemoryEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoMemoryLogger();
    history = new VideoHistoryStore();
    patterns = new VideoPatternStore();
    videos = new Map();
    scorer = new VideoScorer();
    linker = null;
    patternDetector = null;
    learner = null;
    processor = null;
    saveTimes = [];
    loadTimes = [];
    searchTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const videoDir = path.join(storageRoot, "memory", "videos");
        this.logger.initialize(logDir);
        this.history.initialize(videoDir);
        this.patterns.initialize(videoDir);
        this.linker = new VideoRelationshipLinker(foundation, this.logger);
        this.patternDetector = new VideoPatternDetector(this.patterns);
        this.learner = new VideoLearner(foundation, this.logger);
        this.processor = new VideoProcessor(foundation, this.history, this.scorer, this.patternDetector, this.linker, this.learner, this.logger, this.videos);
        this.initialized = true;
        this.logger.log("info", "startup", "Video Memory Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation
            .getStorageEngine()
            .getIndexEntries()
            .filter((e) => e.memoryType === MemoryStorageType.Video);
        for (const entry of entries) {
            const read = await this.foundation.getStorageEngine().getRecord(entry.memoryId);
            if (read.success && read.record) {
                this.videos.set(entry.memoryId, recordFromMemory(read.record));
            }
        }
        this.foundation.registerMemoryModule({
            memoryId: "video-memory",
            memoryName: "Video Memory",
            category: MemoryCategory.Video,
            version: "0.1.0",
            status: MemoryModuleStatus.Active,
            dependencies: ["memory-engine"],
            storageLocation: path.join(this.storageRoot, "memory", "videos"),
            accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Memory Engine startup complete", {
            videosLoaded: this.videos.size,
            patternsLoaded: this.patterns.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async createVideo(input) {
        this.ensureReady();
        const result = await this.processor.create(input);
        if (result.success)
            this.saveTimes.push(result.durationMs);
        return result;
    }
    async updateVideo(videoId, input) {
        this.ensureReady();
        const result = await this.processor.update(videoId, input);
        if (result.success)
            this.saveTimes.push(result.durationMs);
        return result;
    }
    async completeVideo(videoId, userSatisfaction) {
        this.ensureReady();
        return this.processor.complete(videoId, userSatisfaction);
    }
    async getVideo(videoId) {
        this.ensureReady();
        const start = Date.now();
        const video = await this.processor.loadVideo(videoId);
        this.loadTimes.push(Date.now() - start);
        return video;
    }
    async listVideos() {
        this.ensureReady();
        return [...this.videos.values()];
    }
    getVideoRelationships(videoId) {
        const video = this.videos.get(videoId);
        if (!video || !this.linker)
            return null;
        return this.linker.link(video.videoId, video.projectId, video.brand, video.category, video.tags);
    }
    getDetectedPatterns() {
        return [...this.patterns.getAll()];
    }
    getReusablePatterns() {
        return this.patterns.getReusable();
    }
    searchVideos(query) {
        this.ensureReady();
        const start = Date.now();
        let results = [...this.videos.values()];
        if (query.name) {
            const lower = query.name.toLowerCase();
            results = results.filter((v) => v.videoName.toLowerCase().includes(lower));
        }
        if (query.projectId)
            results = results.filter((v) => v.projectId === query.projectId);
        if (query.brand) {
            const lower = query.brand.toLowerCase();
            results = results.filter((v) => v.brand.toLowerCase().includes(lower));
        }
        if (query.category)
            results = results.filter((v) => v.category === query.category);
        if (query.language)
            results = results.filter((v) => v.language === query.language);
        if (query.marketingGoal) {
            const lower = query.marketingGoal.toLowerCase();
            results = results.filter((v) => v.marketingGoal.toLowerCase().includes(lower));
        }
        if (query.style) {
            const lower = query.style.toLowerCase();
            results = results.filter((v) => v.visual.motionStyle.toLowerCase().includes(lower) ||
                v.tags.some((t) => t.toLowerCase().includes(lower)));
        }
        if (query.sceneType) {
            const lower = query.sceneType.toLowerCase();
            results = results.filter((v) => v.scenes.some((s) => s.scenePurpose.toLowerCase().includes(lower)));
        }
        if (query.callToAction) {
            const lower = query.callToAction.toLowerCase();
            results = results.filter((v) => v.marketing.callToAction.toLowerCase().includes(lower));
        }
        if (query.animation) {
            const lower = query.animation.toLowerCase();
            results = results.filter((v) => v.scenes.some((s) => s.animationStyle.toLowerCase().includes(lower)));
        }
        if (query.music) {
            const lower = query.music.toLowerCase();
            results = results.filter((v) => v.audio.backgroundMusic.toLowerCase().includes(lower));
        }
        if (query.transition) {
            const lower = query.transition.toLowerCase();
            results = results.filter((v) => v.scenes.some((s) => s.transitionType.toLowerCase().includes(lower)));
        }
        if (query.tags?.length) {
            results = results.filter((v) => query.tags.some((t) => v.tags.includes(t)));
        }
        const searchMs = Date.now() - start;
        this.searchTimes.push(searchMs);
        this.logger.log("info", "search", "Video search complete", {
            results: results.length,
            searchMs,
        });
        return results;
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    buildStatusReport() {
        const videos = [...this.videos.values()];
        const patterns = this.patterns.getAll();
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        const completed = videos.filter((v) => v.status === VideoStatus.Completed).length;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            patternDetectionStatus: `${patterns.length} pattern(s), ${this.patterns.getReusable().length} reusable`,
            relationshipStatus: `${videos.reduce((s, v) => s + v.relatedMemories.length, 0)} relationship link(s)`,
            totalVideos: videos.length,
            totalPatterns: patterns.length,
            searchPerformance: {
                averageSearchMs: avg(this.searchTimes),
                lastSearchMs: this.searchTimes[this.searchTimes.length - 1] ?? 0,
            },
            storageIntegrity: videos.length > 0 ? "verified" : "awaiting videos",
            performance: {
                averageSaveMs: avg(this.saveTimes),
                averageLoadMs: avg(this.loadTimes),
                totalVersions: videos.reduce((s, v) => s + v.versions.length, 0),
            },
            knownIssues: completed === 0 && videos.length > 0 ? ["No completed videos for learning yet"] : [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new VideoMemoryEngineError("Video Memory Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=video-memory-engine.js.map