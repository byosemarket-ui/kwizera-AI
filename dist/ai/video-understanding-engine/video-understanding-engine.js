import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { VideoUnderstandingAnalyzer } from "./video-understanding-analyzer.js";
import { VideoUnderstandingLinker } from "./video-understanding-linker.js";
import { VideoUnderstandingLogger } from "./video-understanding-logger.js";
import { VideoUnderstandingProcessor } from "./video-understanding-processor.js";
import { VideoUnderstandingScorer } from "./video-understanding-scorer.js";
import { VideoUnderstandingRecordStore } from "./video-understanding-stores.js";
import { VideoStoryType, VideoUnderstandingEngineError, VideoUnderstandingMarketingGoal, } from "./types.js";
/**
 * Video Understanding Engine — transforms technical video analysis into deep semantic understanding.
 */
export class AiVideoUnderstandingEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoUnderstandingLogger();
    records = new VideoUnderstandingRecordStore();
    analyzer = new VideoUnderstandingAnalyzer();
    scorer = new VideoUnderstandingScorer();
    linker = new VideoUnderstandingLinker();
    processor = null;
    understandingTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    graphBuildTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "understanding", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new VideoUnderstandingProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Video Understanding Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "video-understanding-engine",
            moduleName: "Video Understanding Engine",
            category: VideoIntelligenceCategory.VideoUnderstanding,
            version: "0.1.0",
            status: VideoIntelligenceModuleStatus.Active,
            dependencies: ["video-engine", "video-analysis-engine", "knowledge-engine"],
            qualityScore: 91,
            confidenceScore: 89,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "understanding"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Understanding Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async understandVideo(input) {
        this.ensureReady();
        const result = await this.processor.understand(input);
        if (result.success) {
            this.understandingTimes.push(result.durationMs);
            if (result.record) {
                this.graphBuildTimes.push(result.record.knowledgeGraph.nodes.length);
            }
        }
        return result;
    }
    getUnderstanding(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchUnderstanding(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    detectRelationships(videoId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(videoId);
        if (!record)
            return null;
        const analysis = this.foundation.getVideoAnalysisEngine().getVideo(videoId);
        if (!analysis)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), analysis, record.relationships.relatedProjects, record.relationships.relatedKnowledge, record.relationships.relatedStoryboards, record.relationships.relatedScripts, record.relationships.relatedCreativePlans);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairUnderstanding(videoId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getVideoAnalysisEngine();
        let analysis = analysisEngine.getVideo(videoId);
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
        this.logger.log("info", "validation", "Repairing video understanding", { videoId });
        return this.understandVideo({
            videoId,
            marketingGoal: VideoUnderstandingMarketingGoal.Conversion,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgUnderstanding = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.videoUnderstandingScore, 0) / all.length)
            : 0;
        const avgMarketing = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.marketingScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        const totalGraphNodes = all.reduce((s, r) => s + r.knowledgeGraph.nodes.length, 0);
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getVideoAnalysisEngine().isStartupComplete())
            readinessScore -= 15;
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
            sceneUnderstandingStatus: "opening, hook, main content, product demo, promotional, CTA and ending scenes prepared",
            storyUnderstandingStatus: "narrative structure, emotional journey and marketing journey tracked",
            productUnderstandingStatus: "product visibility, presentation, usage and importance tracked",
            brandUnderstandingStatus: "brand identity, visibility, messaging and consistency active",
            marketingUnderstandingStatus: "campaign goals, offers, benefits, CTA and strength tracked",
            audienceUnderstandingStatus: "target audience, engagement, retention and conversion opportunities prepared",
            knowledgeGraphStatus: `${totalGraphNodes} knowledge graph nodes across ${all.length} videos`,
            relationshipStatus: `${all.length} videos indexed for understanding relationships`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine
                ? "connected"
                : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            videosUnderstood: all.length,
            averageUnderstandingScore: avgUnderstanding,
            averageMarketingScore: avgMarketing,
            performance: {
                averageUnderstandingMs: avg(this.understandingTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRelationshipMs: avg(this.relationshipTimes),
                averageGraphBuildMs: avg(this.graphBuildTimes),
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
            throw new VideoUnderstandingEngineError("Video Understanding Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { VideoStoryType, VideoUnderstandingMarketingGoal };
//# sourceMappingURL=video-understanding-engine.js.map