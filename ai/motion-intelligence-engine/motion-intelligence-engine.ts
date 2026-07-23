import path from "node:path";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceAccessPermission,
  VideoIntelligenceCategory,
  VideoIntelligenceModuleStatus,
} from "../video-intelligence-foundation/types.js";
import { MotionIntelligenceAnalyzer } from "./motion-intelligence-analyzer.js";
import { MotionIntelligenceLinker } from "./motion-intelligence-linker.js";
import { MotionIntelligenceLogger } from "./motion-intelligence-logger.js";
import { MotionIntelligenceProcessor } from "./motion-intelligence-processor.js";
import { MotionIntelligenceScorer } from "./motion-intelligence-scorer.js";
import { MotionIntelligenceRecordStore } from "./motion-intelligence-stores.js";
import {
  MotionClassification,
  MotionIntelligenceEngineError,
  MotionIntelligenceEngineStatusReport,
  MotionIntelligenceInput,
  MotionIntelligenceRecord,
  MotionIntelligenceResult,
  MotionIntelligenceSearchQuery,
  MotionEventType,
  ObjectMotionType,
  TrackingSubjectType,
} from "./types.js";

/**
 * Motion Intelligence Engine — detects, analyzes, understands and plans all movement inside videos.
 */
export class AiMotionIntelligenceEngine {
  private foundation: AiVideoIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MotionIntelligenceLogger();
  readonly records = new MotionIntelligenceRecordStore();

  private readonly analyzer = new MotionIntelligenceAnalyzer();
  private readonly scorer = new MotionIntelligenceScorer();
  private readonly linker = new MotionIntelligenceLinker();
  private processor: MotionIntelligenceProcessor | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];

  initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "motion", "intelligence");
    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);
    this.processor = new MotionIntelligenceProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );
    this.initialized = true;
    this.logger.log("info", "startup", "Motion Intelligence Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    this.foundation!.registerVideoIntelligenceModule({
      moduleId: "motion-intelligence",
      moduleName: "Motion Intelligence Engine",
      category: VideoIntelligenceCategory.MotionIntelligence,
      version: "0.1.0",
      status: VideoIntelligenceModuleStatus.Active,
      dependencies: [
        "video-engine",
        "video-analysis-engine",
        "scene-intelligence",
        "timeline-intelligence",
        "camera-intelligence",
      ],
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "motion"),
      accessPermissions: [
        VideoIntelligenceAccessPermission.Read,
        VideoIntelligenceAccessPermission.Write,
        VideoIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });
    this.startupComplete = true;
    this.logger.log("info", "startup", "Motion Intelligence Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async analyzeMotion(input: MotionIntelligenceInput): Promise<MotionIntelligenceResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getMotionAnalysis(videoId: string): MotionIntelligenceRecord | null {
    this.ensureReady();
    return this.records.get(videoId) ?? null;
  }

  searchMotionAnalysis(query: MotionIntelligenceSearchQuery): MotionIntelligenceRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  async repairMotionAnalysis(videoId: string): Promise<MotionIntelligenceResult | null> {
    this.ensureReady();
    const analysisEngine = this.foundation!.getVideoAnalysisEngine();
    const sceneEngine = this.foundation!.getSceneDetectionEngine();
    const timelineEngine = this.foundation!.getTimelineIntelligenceEngine();
    const cameraEngine = this.foundation!.getCameraMovementEngine();

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

    this.logger.log("info", "validation", "Repairing motion intelligence analysis", { videoId });
    return this.analyzeMotion({
      videoId,
      relatedKnowledge: analysis.relationships.relatedKnowledge,
      relatedProjects: analysis.relationships.relatedProjects,
    });
  }

  buildStatusReport(): MotionIntelligenceEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.motionQualityScore, 0) / all.length)
        : 0;
    const avgTracking =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.trackingAccuracyScore, 0) / all.length)
        : 0;
    const totalTracks = all.reduce((s, r) => s + r.subjectTracks.length, 0);
    const totalEvents = all.reduce((s, r) => s + r.motionEvents.length, 0);
    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getSceneDetectionEngine().isStartupComplete()) readinessScore -= 10;
    if (!this.foundation?.getCameraMovementEngine().isStartupComplete()) readinessScore -= 10;
    if (!integration?.knowledgeEngine) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      motionAnalysisStatus:
        "presence, direction, speed, intensity, duration, continuity, density, stability",
      trackingStatus: "subject, object, multi-object, entry, exit, reappearance",
      classificationStatus:
        "static, slow, normal, fast, action, cinematic, promotional, dynamic, animated",
      eventDetectionStatus:
        "start, stop, direction change, speed change, collision, interaction, focus, attention",
      planningStatus: "timeline, path, sync, continuity, enhancement, AI blueprint",
      relationshipStatus: `${all.length} videos indexed for motion relationships`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
      videosProcessed: all.length,
      totalTracks,
      totalEvents,
      averageMotionQualityScore: avgQuality,
      averageTrackingAccuracyScore: avgTracking,
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
      throw new MotionIntelligenceEngineError(
        "Motion Intelligence Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}

export { MotionClassification, MotionEventType, ObjectMotionType, TrackingSubjectType };
