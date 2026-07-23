import path from "node:path";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceAccessPermission,
  VideoIntelligenceCategory,
  VideoIntelligenceModuleStatus,
} from "../video-intelligence-foundation/types.js";
import { VideoQualityPredictionAnalyzer } from "./video-quality-prediction-analyzer.js";
import { VideoQualityPredictionLinker } from "./video-quality-prediction-linker.js";
import { VideoQualityPredictionLogger } from "./video-quality-prediction-logger.js";
import { VideoQualityPredictionProcessor } from "./video-quality-prediction-processor.js";
import { VideoQualityPredictionScorer } from "./video-quality-prediction-scorer.js";
import { VideoQualityPredictionRecordStore } from "./video-quality-prediction-stores.js";
import {
  VideoQualityPredictionEngineError,
  VideoQualityPredictionEngineStatusReport,
  VideoQualityPredictionInput,
  VideoQualityPredictionRecord,
  VideoQualityPredictionResult,
  VideoQualityPredictionSearchQuery,
  VideoQualityPredictionPlatform,
} from "./types.js";

/**
 * Video Quality Prediction Engine — predicts quality, risks, and readiness before generation or rendering.
 */
export class AiVideoQualityPredictionEngine {
  private foundation: AiVideoIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VideoQualityPredictionLogger();
  readonly records = new VideoQualityPredictionRecordStore();

  private readonly analyzer = new VideoQualityPredictionAnalyzer();
  private readonly scorer = new VideoQualityPredictionScorer();
  private readonly linker = new VideoQualityPredictionLinker();
  private processor: VideoQualityPredictionProcessor | null = null;

  private predictionTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "quality-prediction", "engine");
    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);
    this.processor = new VideoQualityPredictionProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );
    this.initialized = true;
    this.logger.log("info", "startup", "Video Quality Prediction Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoIntelligenceModule({
      moduleId: "video-quality-prediction",
      moduleName: "Video Quality Prediction Engine",
      category: VideoIntelligenceCategory.QualityPrediction,
      version: "0.1.0",
      status: VideoIntelligenceModuleStatus.Active,
      dependencies: [
        "video-engine",
        "knowledge-engine",
        "video-analysis-engine",
        "video-understanding-engine",
        "scene-intelligence",
        "timeline-intelligence",
        "camera-intelligence",
        "motion-intelligence",
        "video-style-intelligence",
        "video-enhancement-planning",
        "creative-video-intelligence",
        "production-video-planning",
      ],
      qualityScore: 92,
      confidenceScore: 90,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "quality-prediction"),
      accessPermissions: [
        VideoIntelligenceAccessPermission.Read,
        VideoIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Video Quality Prediction Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async predictVideoQuality(input: VideoQualityPredictionInput): Promise<VideoQualityPredictionResult> {
    this.ensureReady();
    const result = await this.processor!.predict(input);
    if (result.success) this.predictionTimes.push(result.durationMs);
    return result;
  }

  getQualityPrediction(videoId: string): VideoQualityPredictionRecord | null {
    this.ensureReady();
    return this.records.get(videoId) ?? null;
  }

  searchQualityPredictions(query: VideoQualityPredictionSearchQuery): VideoQualityPredictionRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(videoId: string): VideoQualityPredictionRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(videoId);
    if (!record) return null;

    const analysis = this.foundation!.getVideoAnalysisEngine().getVideo(videoId);
    const understanding = this.foundation!.getVideoUnderstandingEngine().getUnderstanding(videoId);
    const productionPlan = this.foundation!.getProductionVideoPlanningEngine().getProductionPlan(videoId);
    const creativePlan = this.foundation!.getCreativeVideoIntelligenceEngine().getCreativePlan(videoId);
    const enhancementPlan = this.foundation!.getVideoEnhancementPlanningEngine().getEnhancementPlan(videoId);

    if (!analysis || !understanding || !productionPlan || !creativePlan || !enhancementPlan) {
      return record.relationships;
    }

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      understanding,
      productionPlan,
      creativePlan,
      enhancementPlan,
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge,
      record.relationships.relatedScripts
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairQualityPrediction(videoId: string): Promise<VideoQualityPredictionResult | null> {
    this.ensureReady();

    if (!this.foundation!.getProductionVideoPlanningEngine().getProductionPlan(videoId)?.validated) {
      const repaired = await this.foundation!.getProductionVideoPlanningEngine().repairProductionPlan(videoId);
      if (!repaired?.success) return null;
    }

    const existing = this.records.get(videoId);
    const understanding = this.foundation!.getVideoUnderstandingEngine().getUnderstanding(videoId);

    this.logger.log("info", "validation", "Repairing video quality prediction", { videoId });

    return this.predictVideoQuality({
      videoId,
      projectId: existing?.profile.projectId,
      campaign: existing?.profile.campaign,
      platform: existing?.profile.platform,
      relatedKnowledge: understanding?.relationships.relatedKnowledge,
      relatedProjects: understanding?.relationships.relatedProjects,
      relatedScripts: understanding?.relationships.relatedScripts,
    });
  }

  buildStatusReport(): VideoQualityPredictionEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgOverall =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.overallVideoQualityScore, 0) / all.length)
        : 0;
    const avgProduction =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getProductionVideoPlanningEngine().isStartupComplete()) readinessScore -= 10;
    if (!integration?.knowledgeEngine) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      qualityAnalysisStatus:
        "full video intelligence stack analyzed for quality prediction",
      predictionStatus:
        "production success, engagement, retention, marketing impact and rendering complexity predicted",
      riskDetectionStatus:
        "storytelling, visual, audio, motion, camera, style, asset and rendering risks evaluated",
      recommendationStatus: "improvement recommendations generated from risk analysis",
      relationshipStatus: `${all.length} quality predictions indexed`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      imageIntelligenceBridgeStatus: integration?.imageIntelligenceEngine ? "connected" : "unavailable",
      predictionsCreated: all.length,
      averageOverallQualityScore: avgOverall,
      averageProductionReadinessScore: avgProduction,
      performance: {
        averagePredictionMs: avg(this.predictionTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRelationshipMs: avg(this.relationshipTimes),
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
      throw new VideoQualityPredictionEngineError(
        "Video Quality Prediction Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}

export { VideoQualityPredictionPlatform };
