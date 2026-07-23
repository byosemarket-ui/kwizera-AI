import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { VideoAnalysisAnalyzer } from "./video-analysis-analyzer.js";
import { VideoAnalysisCompletenessDetector } from "./video-analysis-completeness.js";
import { VideoAnalysisLinker } from "./video-analysis-linker.js";
import { VideoAnalysisLogger } from "./video-analysis-logger.js";
import { VideoAnalysisProcessor } from "./video-analysis-processor.js";
import { VideoAnalysisScorer } from "./video-analysis-scorer.js";
import { VideoAnalysisRecordStore } from "./video-analysis-stores.js";
import { VideoAnalysisEngineError, VideoFileFormat, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, FrameRateMode, VideoColorSpace, } from "./types.js";
/**
 * Video Analysis Engine — collects, organizes and analyzes technical and structural video information
 * before understanding, enhancement or generation begins.
 */
export class AiVideoAnalysisEngine {
    foundation = null;
    storageRoot = "";
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoAnalysisLogger();
    records = new VideoAnalysisRecordStore();
    analyzer = new VideoAnalysisAnalyzer();
    completeness = new VideoAnalysisCompletenessDetector();
    scorer = new VideoAnalysisScorer();
    linker = new VideoAnalysisLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    indexingTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "analysis", "engine");
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.records.initialize(this.engineDir);
        this.processor = new VideoAnalysisProcessor(foundation, this.analyzer, this.completeness, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Video Analysis Engine initialized", {
            storageRoot,
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "video-analysis-engine",
            moduleName: "Video Analysis Engine",
            category: VideoIntelligenceCategory.VideoAnalysis,
            version: "0.1.0",
            status: VideoIntelligenceModuleStatus.Active,
            dependencies: ["video-engine", "knowledge-engine", "memory-engine", "image-intelligence-engine"],
            qualityScore: 92,
            confidenceScore: 90,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "analysis"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Write,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Analysis Engine startup complete", {
            videosLoaded: this.records.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async analyzeVideo(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success) {
            this.analysisTimes.push(result.durationMs);
            const indexCount = (result.record?.indexes.frameIndexIds.length ?? 0) +
                (result.record?.indexes.keyframeIndexIds.length ?? 0);
            this.indexingTimes.push(indexCount);
        }
        return result;
    }
    getVideo(videoId) {
        this.ensureReady();
        return this.records.get(videoId) ?? null;
    }
    searchVideos(query) {
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
        return this.linker.detectRelationships(record, this.records.getAll(), record.relationships.relatedKnowledge, record.relationships.relatedMemory);
    }
    async repairVideo(videoId) {
        this.ensureReady();
        const existing = this.records.get(videoId);
        if (!existing)
            return null;
        const repairedInput = {
            videoId,
            videoName: existing.technical.videoName,
            filePath: existing.technical.filePath,
            fileFormat: existing.technical.fileFormat,
            container: existing.technical.container,
            videoCodec: existing.technical.videoCodec,
            videoCodecProfile: existing.technical.videoCodecProfile,
            audioCodec: existing.technical.audioCodec,
            fileSizeBytes: existing.technical.fileSizeBytes > 0 ? existing.technical.fileSizeBytes : 5_000_000,
            durationMs: existing.technical.durationMs > 0 ? existing.technical.durationMs : 30_000,
            width: existing.technical.width,
            height: existing.technical.height,
            fps: existing.technical.fps,
            frameRateMode: existing.technical.frameRateMode,
            bitrateKbps: existing.technical.bitrateKbps,
            hdrSupported: existing.technical.hdrSupported,
            colorSpace: existing.technical.colorSpace,
            metadata: Object.keys(existing.technical.metadata).length
                ? existing.technical.metadata
                : { source: "repair-pipeline" },
            creationDate: existing.technical.creationDate ?? new Date().toISOString(),
            lastModifiedDate: existing.technical.lastModifiedDate ?? new Date().toISOString(),
            visual: existing.visual,
            frame: existing.frame,
            timeline: existing.timeline,
            audio: existing.audio,
            videoType: existing.classification.videoType,
            category: existing.classification.category,
            subcategory: existing.classification.subcategory,
            creativeStyle: existing.classification.creativeStyle,
            product: existing.relationships.relatedProducts[0],
            brand: existing.relationships.relatedBrands[0],
            language: existing.audio.primaryLanguage,
            sceneCount: existing.timeline.sceneCount,
            shotCount: existing.timeline.shotCount,
            tags: existing.tags.length ? existing.tags : ["repaired"],
            keywords: existing.keywords.length ? existing.keywords : [existing.technical.videoName],
            relatedKnowledge: existing.relationships.relatedKnowledge,
            relatedMemory: existing.relationships.relatedMemory,
            relatedProjects: existing.relationships.relatedProjects,
            relatedImages: existing.relationships.relatedImages,
            relatedVideos: existing.relationships.relatedVideos,
            projectId: existing.relationships.relatedProjects[0],
            campaign: existing.relationships.relatedCampaigns[0],
        };
        this.logger.log("info", "validation", "Repairing video analysis record", { videoId });
        return this.analyzeVideo(repairedInput);
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgCompleteness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.videoCompletenessScore, 0) / all.length)
            : 0;
        const avgConfidence = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.aiConfidenceScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
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
            classificationStatus: "advertisement, commercial, product-showcase, tutorial, social-media, documentary, presentation, interview, animation, corporate classification active",
            timelineAnalysisStatus: "scene, shot, segment and frame distribution analysis active",
            audioAnalysisStatus: "multi-track audio, loudness, sync and silence detection active",
            indexingStatus: `${all.reduce((s, r) => s + r.indexes.frameIndexIds.length + r.indexes.keyframeIndexIds.length, 0)} frame indexes created`,
            relationshipStatus: `${all.length} videos indexed for relationship detection`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine
                ? "connected"
                : "unavailable",
            imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
            videosAnalyzed: all.length,
            averageCompletenessScore: avgCompleteness,
            averageConfidenceScore: avgConfidence,
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
            throw new VideoAnalysisEngineError("Video Analysis Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
export { VideoFileFormat, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, FrameRateMode, VideoColorSpace, };
//# sourceMappingURL=video-analysis-engine.js.map