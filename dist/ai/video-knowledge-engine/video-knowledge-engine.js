import path from "node:path";
import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource, } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { VideoAnalyzer } from "./video-analyzer.js";
import { VideoLearner } from "./video-learner.js";
import { VideoKnowledgeLogger } from "./video-logger.js";
import { VideoProcessor } from "./video-processor.js";
import { VideoRelationshipLinker, VideoRecommender } from "./video-recommender.js";
import { VideoScorer } from "./video-scorer.js";
import { VideoPatternStore, VideoRecordStore } from "./video-stores.js";
import { VideoKnowledgeEngineError, } from "./types.js";
/**
 * Video Knowledge Engine — understands, analyzes and learns from promotional video knowledge.
 */
export class AiVideoKnowledgeEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoKnowledgeLogger();
    patterns = new VideoPatternStore();
    records = new VideoRecordStore();
    analyzer = new VideoAnalyzer();
    scorer = new VideoScorer();
    recommender = new VideoRecommender();
    linker = new VideoRelationshipLinker();
    processor = null;
    learner = null;
    analysisTimes = [];
    searchTimes = [];
    recommendationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const videoDir = path.join(storageRoot, "knowledge", "videos", "engine");
        this.logger.initialize(logDir);
        this.patterns.initialize(videoDir);
        this.records.initialize(videoDir);
        this.learner = new VideoLearner(this.patterns, this.logger);
        this.processor = new VideoProcessor(foundation, this.analyzer, this.scorer, this.recommender, this.linker, this.learner, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Video Knowledge Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation
            .getStorageEngine()
            .getIndexEntries()
            .filter((e) => e.knowledgeType === KnowledgeStorageType.Video);
        for (const entry of entries) {
            const read = await this.foundation.getStorageEngine().getRecord(entry.knowledgeId);
            if (read.success && read.record?.payload) {
                const payload = read.record.payload;
                if (payload.videoId)
                    this.records.upsert(payload);
            }
        }
        this.foundation.registerKnowledgeModule({
            knowledgeId: "video-knowledge",
            knowledgeName: "Video Knowledge",
            category: KnowledgeCategory.Video,
            version: "0.1.0",
            status: KnowledgeModuleStatus.Active,
            dependencies: ["knowledge-engine", "memory-engine"],
            source: KnowledgeSource.Video,
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.storageRoot, "knowledge", "videos"),
            accessPermissions: [
                KnowledgeAccessPermission.Read,
                KnowledgeAccessPermission.Write,
                KnowledgeAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Knowledge Engine startup complete", {
            videosLoaded: this.records.getCount(),
            patternsLoaded: this.patterns.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async analyzeVideo(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getVideo(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    async searchVideos(query) {
        this.ensureReady();
        const start = Date.now();
        const results = await this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    getRecommendations(videoId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(videoId);
        if (!record)
            return [];
        const recs = this.recommender.recommend(record);
        this.recommendationTimes.push(Date.now() - start);
        return recs;
    }
    detectRelationships(videoId) {
        this.ensureReady();
        const record = this.records.get(videoId);
        if (!record)
            return null;
        return this.linker.detectSimilar(record, this.records.getAll());
    }
    getLearnedPatterns() {
        this.ensureReady();
        return this.patterns.getAll();
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgStory = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.storytellingScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            sceneAnalysisStatus: "per-scene analysis active for all video records",
            editingKnowledgeStatus: "editing rhythm, transitions and continuity tracked",
            marketingKnowledgeStatus: "hook timing, CTA and emotional flow analyzed",
            relationshipStatus: `${all.length} videos indexed for relationship detection`,
            videosAnalyzed: all.length,
            patternsLearned: this.patterns.getCount(),
            averageStorytellingScore: avgStory,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRecommendationMs: avg(this.recommendationTimes),
            },
            knownIssues: [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new VideoKnowledgeEngineError("Video Knowledge Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=video-knowledge-engine.js.map