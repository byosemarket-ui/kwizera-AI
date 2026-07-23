import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { TimelineIntelligenceAnalyzer } from "./timeline-intelligence-analyzer.js";
import { TimelineIntelligenceLinker } from "./timeline-intelligence-linker.js";
import { TimelineIntelligenceLogger } from "./timeline-intelligence-logger.js";
import { TimelineIntelligenceProcessor } from "./timeline-intelligence-processor.js";
import { TimelineIntelligenceScorer } from "./timeline-intelligence-scorer.js";
import { TimelineIntelligenceRecordStore } from "./timeline-intelligence-stores.js";
import { TimelineIntelligenceEngineError, TimelineVariant, TrackType, } from "./types.js";
/**
 * Timeline Intelligence Engine — understands, organizes and optimizes complete timeline structure.
 */
export class AiTimelineIntelligenceEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new TimelineIntelligenceLogger();
    records = new TimelineIntelligenceRecordStore();
    analyzer = new TimelineIntelligenceAnalyzer();
    scorer = new TimelineIntelligenceScorer();
    linker = new TimelineIntelligenceLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    indexingTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "timelines", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new TimelineIntelligenceProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Timeline Intelligence Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "timeline-intelligence",
            moduleName: "Timeline Intelligence Engine",
            category: VideoIntelligenceCategory.TimelineIntelligence,
            version: "0.1.0",
            status: VideoIntelligenceModuleStatus.Active,
            dependencies: [
                "video-engine",
                "video-analysis-engine",
                "scene-intelligence",
                "video-understanding-engine",
            ],
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "timelines"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Timeline Intelligence Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async analyzeTimeline(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success) {
            this.analysisTimes.push(result.durationMs);
            if (result.record) {
                this.indexingTimes.push(result.record.indexes.timelineIndexIds.length + result.record.indexes.sceneIndexIds.length);
            }
        }
        return result;
    }
    getTimeline(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchTimelines(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    detectRelationships(videoId) {
        this.ensureReady();
        const record = this.records.get(videoId);
        if (!record)
            return null;
        const analysis = this.foundation.getVideoAnalysisEngine().getVideo(videoId);
        const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(videoId);
        if (!analysis || !sceneDetection)
            return record.relationships;
        return this.linker.detectRelationships(record, this.records.getAll(), analysis, sceneDetection, record.relationships.relatedProjects, record.relationships.relatedKnowledge, record.relationships.relatedStoryboards, record.relationships.relatedScripts, record.relationships.relatedAudioPlans, record.relationships.relatedProductionPlans);
    }
    async repairTimeline(videoId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        const sceneEngine = this.foundation.getSceneDetectionEngine();
        let analysis = analysisEngine.getVideo(videoId);
        let sceneDetection = sceneEngine.getDetection(videoId);
        if (!analysis) {
            this.logger.log("warn", "validation", "Cannot repair — no analysis record", { videoId });
            return null;
        }
        if (!analysis.validated) {
            const repaired = await analysisEngine.repairVideo(videoId);
            if (!repaired?.success || !repaired.record)
                return null;
            analysis = repaired.record;
        }
        if (!sceneDetection?.validated) {
            const repairedScene = await sceneEngine.repairDetection(videoId);
            if (!repairedScene?.success || !repairedScene.record)
                return null;
            sceneDetection = repairedScene.record;
        }
        this.logger.log("info", "validation", "Repairing timeline intelligence", { videoId });
        return this.analyzeTimeline({
            videoId,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.timelineQualityScore, 0) / all.length)
            : 0;
        const avgSync = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.synchronizationScore, 0) / all.length)
            : 0;
        const totalVariants = all.reduce((s, r) => s + r.variants.length, 0);
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getVideoAnalysisEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getSceneDetectionEngine().isStartupComplete())
            readinessScore -= 10;
        if (!integration?.knowledgeEngine)
            readinessScore -= 10;
        if (!integration?.memoryEngine)
            readinessScore -= 5;
        if (!integration?.productIntelligenceEngine)
            readinessScore -= 5;
        if (!integration?.imageIntelligenceEngine)
            readinessScore -= 5;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            timelineStructureStatus: "timeline ID, version, sections, hierarchy and dependencies active",
            sceneSequencingStatus: "scene order, timing, duration, priority and dependencies managed",
            shotSequencingStatus: "shot order, timing, groups and relationships managed",
            trackManagementStatus: "video, audio, voice, subtitle, caption, effects, motion, overlay and adjustment tracks supported",
            synchronizationStatus: "audio, subtitle, voice, transition, animation and effect sync prepared",
            multiTimelineStatus: `main, short, trailer, teaser, social and platform variants — ${totalVariants} total`,
            indexingStatus: `${all.reduce((s, r) => s + r.indexes.timelineIndexIds.length + r.indexes.trackIndexIds.length, 0)} timeline/track indexes`,
            relationshipStatus: `${all.length} timelines indexed for relationships`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine
                ? "connected"
                : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            timelinesProcessed: all.length,
            totalVariants,
            averageTimelineQualityScore: avgQuality,
            averageSynchronizationScore: avgSync,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
                averageSearchMs: avg(this.searchTimes),
                averageIndexingMs: avg(this.indexingTimes),
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
    getEngineDir() {
        return this.engineDir;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation || !this.processor) {
            throw new TimelineIntelligenceEngineError("Timeline Intelligence Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { TimelineVariant, TrackType };
//# sourceMappingURL=timeline-intelligence-engine.js.map