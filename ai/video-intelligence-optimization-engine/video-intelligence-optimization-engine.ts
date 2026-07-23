import path from "node:path";
import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceAccessPermission,
  VideoIntelligenceCategory,
  VideoIntelligenceModuleStatus,
} from "../video-intelligence-foundation/types.js";
import type { VideoQualityPredictionPlatform } from "../video-quality-prediction-engine/types.js";
import { VideoIntelligenceOptimizationAnalyzer } from "./video-intelligence-optimization-analyzer.js";
import { VideoIntelligenceOptimizationLinker } from "./video-intelligence-optimization-linker.js";
import { VideoIntelligenceOptimizationLogger } from "./video-intelligence-optimization-logger.js";
import { VideoIntelligenceOptimizationProcessor } from "./video-intelligence-optimization-processor.js";
import { VideoIntelligenceOptimizationScorer } from "./video-intelligence-optimization-scorer.js";
import { VideoIntelligenceOptimizationRecordStore } from "./video-intelligence-optimization-stores.js";
import {
  VideoIntelligenceOptimizationEngineError,
  VideoIntelligenceOptimizationEngineStatusReport,
  VideoIntelligenceOptimizationInput,
  VideoIntelligenceOptimizationRecord,
  VideoIntelligenceOptimizationResult,
  VideoIntelligenceOptimizationSearchQuery,
} from "./types.js";

/**
 * Video Intelligence Optimization Engine — continuously improves quality,
 * speed, consistency and efficiency across all Video Intelligence modules.
 */
export class AiVideoIntelligenceOptimizationEngine {
  private foundation: AiVideoIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VideoIntelligenceOptimizationLogger();
  readonly records = new VideoIntelligenceOptimizationRecordStore();

  private readonly analyzer = new VideoIntelligenceOptimizationAnalyzer();
  private readonly scorer = new VideoIntelligenceOptimizationScorer();
  private readonly linker = new VideoIntelligenceOptimizationLinker();
  private processor: VideoIntelligenceOptimizationProcessor | null = null;

  private optimizationTimes: number[] = [];
  private searchTimes: number[] = [];
  private recoveryTimes: number[] = [];

  initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "optimization", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new VideoIntelligenceOptimizationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Video Intelligence Optimization Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoIntelligenceModule({
      moduleId: "video-intelligence-optimization",
      moduleName: "Video Intelligence Optimization Engine",
      category: VideoIntelligenceCategory.Optimization,
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
        "video-style-intelligence",
        "video-enhancement-planning",
        "creative-video-intelligence",
        "production-video-planning",
        "video-quality-prediction",
      ],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "optimization"),
      accessPermissions: [
        VideoIntelligenceAccessPermission.Read,
        VideoIntelligenceAccessPermission.Admin,
        VideoIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Video Intelligence Optimization Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async runOptimization(input: VideoIntelligenceOptimizationInput): Promise<VideoIntelligenceOptimizationResult> {
    this.ensureReady();
    const result = await this.processor!.runOptimization(input);
    if (result.success) this.optimizationTimes.push(result.durationMs);
    return result;
  }

  getOptimization(optimizationId: string): VideoIntelligenceOptimizationRecord | null {
    this.ensureReady();
    return this.records.get(optimizationId) ?? null;
  }

  getOptimizationsByVideo(videoId: string): VideoIntelligenceOptimizationRecord[] {
    this.ensureReady();
    return this.records.getByVideo(videoId);
  }

  searchOptimizations(query: VideoIntelligenceOptimizationSearchQuery): VideoIntelligenceOptimizationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Optimization search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  restoreRecoveryPoint(recoveryId: string): boolean {
    this.ensureReady();
    const start = Date.now();
    const restored = this.processor!.restoreRecoveryPoint(recoveryId);
    this.recoveryTimes.push(Date.now() - start);
    return restored;
  }

  async repairOptimization(
    videoId: string,
    _platform?: VideoQualityPredictionPlatform
  ): Promise<VideoIntelligenceOptimizationResult | null> {
    this.ensureReady();
    const qualityEngine = this.foundation!.getVideoQualityPredictionEngine();

    let qp = qualityEngine.getQualityPrediction(videoId);
    if (!qp?.productionReady) {
      const repaired = await qualityEngine.repairQualityPrediction(videoId);
      if (!repaired?.success || !repaired.record) return null;
      qp = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing video optimization", { videoId });
    return this.runOptimization({ videoId });
  }

  getCache() {
    this.ensureReady();
    return this.records.getCache();
  }

  buildStatusReport(): VideoIntelligenceOptimizationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgImprovement =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.overallImprovementScore, 0) / all.length)
        : 0;
    const avgStorytelling =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.storytellingImprovementScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getVideoQualityPredictionEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      optimizationStatus: "continuous improvement across all Video Intelligence modules active",
      cacheStatus: `cache hit rate ${this.records.getCache().hitRate}%`,
      recoveryStatus: "recovery points created before every optimization run",
      optimizationsCompleted: all.length,
      averageImprovementScore: avgImprovement,
      averageStorytellingImprovement: avgStorytelling,
      performance: {
        averageOptimizationMs: avg(this.optimizationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRecoveryMs: avg(this.recoveryTimes),
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
      throw new VideoIntelligenceOptimizationEngineError(
        "Video Intelligence Optimization Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
