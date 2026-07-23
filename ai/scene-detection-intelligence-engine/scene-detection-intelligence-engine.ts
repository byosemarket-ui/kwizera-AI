import path from "node:path";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceAccessPermission,
  VideoIntelligenceCategory,
  VideoIntelligenceModuleStatus,
} from "../video-intelligence-foundation/types.js";
import { SceneDetectionAnalyzer } from "./scene-detection-analyzer.js";
import { SceneDetectionLinker } from "./scene-detection-linker.js";
import { SceneDetectionLogger } from "./scene-detection-logger.js";
import { SceneDetectionProcessor } from "./scene-detection-processor.js";
import { SceneDetectionScorer } from "./scene-detection-scorer.js";
import { SceneDetectionRecordStore } from "./scene-detection-stores.js";
import {
  SceneClassification,
  SceneDetectionEngineError,
  SceneDetectionEngineStatusReport,
  SceneDetectionInput,
  SceneDetectionRecord,
  SceneDetectionResult,
  SceneDetectionSearchQuery,
  ShotType,
  TransitionType,
} from "./types.js";

/**
 * Scene Detection Intelligence Engine — detects, organizes and understands scenes, shots and transitions.
 */
export class AiSceneDetectionIntelligenceEngine {
  private foundation: AiVideoIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new SceneDetectionLogger();
  readonly records = new SceneDetectionRecordStore();

  private readonly analyzer = new SceneDetectionAnalyzer();
  private readonly scorer = new SceneDetectionScorer();
  private readonly linker = new SceneDetectionLinker();
  private processor: SceneDetectionProcessor | null = null;

  private detectionTimes: number[] = [];
  private searchTimes: number[] = [];
  private indexingTimes: number[] = [];

  initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "scenes", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new SceneDetectionProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Scene Detection Intelligence Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoIntelligenceModule({
      moduleId: "scene-intelligence",
      moduleName: "Scene Detection Intelligence Engine",
      category: VideoIntelligenceCategory.SceneIntelligence,
      version: "0.1.0",
      status: VideoIntelligenceModuleStatus.Active,
      dependencies: ["video-engine", "video-analysis-engine", "video-understanding-engine"],
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "scenes"),
      accessPermissions: [
        VideoIntelligenceAccessPermission.Read,
        VideoIntelligenceAccessPermission.Write,
        VideoIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Scene Detection Intelligence Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async detectScenes(input: SceneDetectionInput): Promise<SceneDetectionResult> {
    this.ensureReady();
    const result = await this.processor!.detect(input);
    if (result.success) {
      this.detectionTimes.push(result.durationMs);
      if (result.record) {
        this.indexingTimes.push(
          result.record.indexes.sceneIndexIds.length + result.record.indexes.shotIndexIds.length
        );
      }
    }
    return result;
  }

  getDetection(videoId: string): SceneDetectionRecord | null {
    this.ensureReady();
    return this.records.get(videoId) ?? null;
  }

  searchDetections(query: SceneDetectionSearchQuery): SceneDetectionRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(videoId: string): SceneDetectionRecord["relationships"] | null {
    this.ensureReady();
    const record = this.records.get(videoId);
    if (!record) return null;

    const analysis = this.foundation!.getVideoAnalysisEngine().getVideo(videoId);
    if (!analysis) return record.relationships;

    return this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge,
      record.relationships.relatedStoryboards,
      record.relationships.relatedScripts
    );
  }

  async repairDetection(videoId: string): Promise<SceneDetectionResult | null> {
    this.ensureReady();
    const analysisEngine = this.foundation!.getVideoAnalysisEngine();
    let analysis = analysisEngine.getVideo(videoId);

    if (!analysis) {
      this.logger.log("warn", "validation", "Cannot repair — no analysis record", { videoId });
      return null;
    }

    if (!analysis.validated) {
      const repaired = await analysisEngine.repairVideo(videoId);
      if (!repaired?.success || !repaired.record) return null;
      analysis = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing scene detection", { videoId });
    return this.detectScenes({
      videoId,
      relatedKnowledge: analysis.relationships.relatedKnowledge,
      relatedProjects: analysis.relationships.relatedProjects,
    });
  }

  buildStatusReport(): SceneDetectionEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgSceneScore =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.sceneDetectionScore, 0) / all.length)
        : 0;
    const avgTimelineAccuracy =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.timelineAccuracyScore, 0) / all.length)
        : 0;
    const totalScenes = all.reduce((s, r) => s + r.sceneCount, 0);
    const totalShots = all.reduce((s, r) => s + r.shotCount, 0);

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getVideoAnalysisEngine().isStartupComplete()) readinessScore -= 15;
    if (!integration?.knowledgeEngine) readinessScore -= 10;
    if (!integration?.memoryEngine) readinessScore -= 5;
    if (!integration?.productIntelligenceEngine) readinessScore -= 5;
    if (!integration?.imageIntelligenceEngine) readinessScore -= 5;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      sceneDetectionStatus: "scene boundaries, duration, type, order, priority and purpose detection active",
      shotDetectionStatus: "shot boundaries, type, camera change and relationship detection active",
      transitionDetectionStatus: "cut, fade, dissolve, wipe, zoom and custom transition detection prepared",
      indexingStatus: `${all.reduce((s, r) => s + r.indexes.sceneIndexIds.length + r.indexes.shotIndexIds.length, 0)} scene/shot indexes created`,
      relationshipStatus: `${all.length} videos indexed for scene relationships`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine
        ? "connected"
        : "unavailable",
      imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
      videosProcessed: all.length,
      totalScenesDetected: totalScenes,
      totalShotsDetected: totalShots,
      averageSceneDetectionScore: avgSceneScore,
      averageTimelineAccuracyScore: avgTimelineAccuracy,
      performance: {
        averageDetectionMs: avg(this.detectionTimes),
        averageSearchMs: avg(this.searchTimes),
        averageIndexingMs: avg(this.indexingTimes),
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

  getEngineDir(): string {
    return this.engineDir;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation || !this.processor) {
      throw new SceneDetectionEngineError(
        "Scene Detection Intelligence Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}

export { SceneClassification, ShotType, TransitionType };
