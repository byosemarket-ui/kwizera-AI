import path from "node:path";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceAccessPermission,
  VideoIntelligenceCategory,
  VideoIntelligenceModuleStatus,
} from "../video-intelligence-foundation/types.js";
import { VideoStyleAnalyzer } from "./video-style-analyzer.js";
import { VideoStyleLinker } from "./video-style-linker.js";
import { VideoStyleLogger } from "./video-style-logger.js";
import { VideoStyleProcessor } from "./video-style-processor.js";
import { VideoStyleScorer } from "./video-style-scorer.js";
import { VideoStyleRecordStore } from "./video-style-stores.js";
import { VideoStyleTemplateLibrary } from "./video-style-template-library.js";
import {
  CinematicStyleClass,
  StyleTemplatePlatform,
  VideoStyleEngineStatusReport,
  VideoStyleIntelligenceEngineError,
  VideoStyleIntelligenceInput,
  VideoStyleIntelligenceRecord,
  VideoStyleIntelligenceResult,
  VideoStyleSearchQuery,
} from "./types.js";

/**
 * Video Style Intelligence Engine — analyzes, classifies and plans visual, cinematic and editing style.
 */
export class AiVideoStyleIntelligenceEngine {
  private foundation: AiVideoIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VideoStyleLogger();
  readonly records = new VideoStyleRecordStore();
  readonly templateLibrary = new VideoStyleTemplateLibrary();

  private readonly analyzer = new VideoStyleAnalyzer();
  private readonly scorer = new VideoStyleScorer();
  private readonly linker = new VideoStyleLinker();
  private processor: VideoStyleProcessor | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];

  initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "styles", "engine");
    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);
    this.processor = new VideoStyleProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );
    this.initialized = true;
    this.logger.log("info", "startup", "Video Style Intelligence Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    this.foundation!.registerVideoIntelligenceModule({
      moduleId: "video-style-intelligence",
      moduleName: "Video Style Intelligence Engine",
      category: VideoIntelligenceCategory.CreativeVideo,
      version: "0.1.0",
      status: VideoIntelligenceModuleStatus.Active,
      dependencies: [
        "video-engine",
        "video-analysis-engine",
        "video-understanding-engine",
        "scene-intelligence",
        "timeline-intelligence",
        "camera-intelligence",
        "motion-intelligence",
      ],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "styles"),
      accessPermissions: [
        VideoIntelligenceAccessPermission.Read,
        VideoIntelligenceAccessPermission.Write,
        VideoIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });
    this.startupComplete = true;
    this.logger.log("info", "startup", "Video Style Intelligence Engine startup complete", {
      recordsLoaded: this.records.getCount(),
      templates: this.templateLibrary.getAllTemplates().length,
    });
  }

  async analyzeStyle(input: VideoStyleIntelligenceInput): Promise<VideoStyleIntelligenceResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getStyleAnalysis(videoId: string): VideoStyleIntelligenceRecord | null {
    this.ensureReady();
    return this.records.get(videoId) ?? null;
  }

  searchStyleAnalysis(query: VideoStyleSearchQuery): VideoStyleIntelligenceRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  async repairStyleAnalysis(videoId: string): Promise<VideoStyleIntelligenceResult | null> {
    this.ensureReady();
    const analysisEngine = this.foundation!.getVideoAnalysisEngine();
    const sceneEngine = this.foundation!.getSceneDetectionEngine();
    const timelineEngine = this.foundation!.getTimelineIntelligenceEngine();
    const cameraEngine = this.foundation!.getCameraMovementEngine();
    const motionEngine = this.foundation!.getMotionIntelligenceEngine();

    let analysis = analysisEngine.getVideo(videoId);
    if (!analysis) return null;

    if (!analysis.validated) {
      const repaired = await analysisEngine.repairVideo(videoId);
      if (!repaired?.success || !repaired.record) return null;
      analysis = repaired.record;
    }

    if (!sceneEngine.getDetection(videoId)?.validated) {
      const repairedScene = await sceneEngine.repairDetection(videoId);
      if (!repairedScene?.success) return null;
    }

    if (!timelineEngine.getTimeline(videoId)?.validated) {
      await timelineEngine.repairTimeline(videoId);
    }

    if (!cameraEngine.getCameraAnalysis(videoId)?.validated) {
      await cameraEngine.repairCameraAnalysis(videoId);
    }

    if (!motionEngine.getMotionAnalysis(videoId)?.validated) {
      await motionEngine.repairMotionAnalysis(videoId);
    }

    if (!this.foundation!.getVideoUnderstandingEngine().getUnderstanding(videoId)?.validated) {
      await this.foundation!.getVideoUnderstandingEngine().repairUnderstanding(videoId);
    }

    this.logger.log("info", "validation", "Repairing video style analysis", { videoId });
    return this.analyzeStyle({
      videoId,
      relatedKnowledge: analysis.relationships.relatedKnowledge,
      relatedProjects: analysis.relationships.relatedProjects,
    });
  }

  buildStatusReport(): VideoStyleEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const all = this.records.getAll();
    const avgConsistency =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.styleConsistencyScore, 0) / all.length)
        : 0;
    const avgBrand =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.brandStyleScore, 0) / all.length)
        : 0;
    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getVideoUnderstandingEngine().isStartupComplete()) readinessScore -= 10;
    if (!this.foundation?.getMotionIntelligenceEngine().isStartupComplete()) readinessScore -= 10;
    if (!integration?.knowledgeEngine) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      styleAnalysisStatus:
        "color grading, lighting, composition, camera, motion, background, typography, graphics, visual identity",
      editingStyleStatus:
        "rhythm, pacing, transitions, cuts, effects, animation, captions, audio sync",
      cinematicClassificationStatus:
        "commercial, documentary, corporate, luxury, modern, minimal, technology, fashion, social media",
      brandStyleStatus: "brand colors, typography, logo usage, consistency, CTA, marketing identity",
      templateLibraryStatus: `${this.templateLibrary.getAllTemplates().length} reusable style templates`,
      relationshipStatus: `${all.length} videos indexed for style relationships`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
      videosProcessed: all.length,
      templatesAvailable: this.templateLibrary.getAllTemplates().length,
      averageStyleConsistencyScore: avgConsistency,
      averageBrandStyleScore: avgBrand,
      performance: {
        averageAnalysisMs: avg(this.analysisTimes),
        averageSearchMs: avg(this.searchTimes),
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation || !this.processor) {
      throw new VideoStyleIntelligenceEngineError(
        "Video Style Intelligence Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}

export { CinematicStyleClass, StyleTemplatePlatform };
