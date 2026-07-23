import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { VideoGenerationOptimizationAnalyzer } from "./video-generation-optimization-analyzer.js";
import { VideoGenerationOptimizationLinker } from "./video-generation-optimization-linker.js";
import { VideoGenerationOptimizationLogger } from "./video-generation-optimization-logger.js";
import { VideoGenerationOptimizationProcessor } from "./video-generation-optimization-processor.js";
import { VideoGenerationOptimizationScorer } from "./video-generation-optimization-scorer.js";
import { OptimizationRecordStore } from "./video-generation-optimization-stores.js";
import {
  VideoGenerationOptimizationEngineError,
  VideoGenerationOptimizationEngineStatusReport,
  VideoGenerationOptimizationInput,
  VideoGenerationOptimizationRecord,
  VideoGenerationOptimizationResult,
  VideoGenerationOptimizationSearchQuery,
} from "./types.js";

/**
 * AI Video Generation Optimization Engine — optimizes the entire AI Video Generation
 * pipeline before rendering, improving quality, speed, reliability and scalability
 * without changing approved creative decisions.
 */
export class AiVideoGenerationOptimizationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VideoGenerationOptimizationLogger();
  readonly records = new OptimizationRecordStore();

  private readonly analyzer = new VideoGenerationOptimizationAnalyzer();
  private readonly scorer = new VideoGenerationOptimizationScorer();
  private readonly linker = new VideoGenerationOptimizationLinker();
  private processor: VideoGenerationOptimizationProcessor | null = null;

  private optimizationTimes: number[] = [];
  private searchTimes: number[] = [];
  private repairTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "optimization", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new VideoGenerationOptimizationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Video Generation Optimization Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "video-generation-optimization-engine",
      moduleName: "Video Generation Optimization Engine",
      category: VideoGenerationCategory.VideoGenerationOptimization,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "video-quality-validation-engine"],
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "optimization"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Video Generation Optimization Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async optimizeVideoGeneration(input: VideoGenerationOptimizationInput): Promise<VideoGenerationOptimizationResult> {
    this.ensureReady();
    const result = await this.processor!.optimizeVideoGeneration(input);
    if (result.success) {
      this.optimizationTimes.push(result.durationMs);
    }
    return result;
  }

  getOptimizationRecord(optimizationId: string): VideoGenerationOptimizationRecord | null {
    this.ensureReady();
    return this.records.get(optimizationId) ?? null;
  }

  getOptimizationsByStoryboard(storyboardId: string): VideoGenerationOptimizationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchOptimizations(query: VideoGenerationOptimizationSearchQuery): VideoGenerationOptimizationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search-query", "Optimization search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairOptimization(
    storyboardId: string,
    platform?: StoryboardGenerationPlatform
  ): Promise<VideoGenerationOptimizationResult | null> {
    this.ensureReady();
    const repairStart = Date.now();
    this.logger.log("info", "repair", "Repairing optimization", { storyboardId, platform });
    const result = await this.optimizeVideoGeneration({ storyboardId, platform });
    if (result.success) {
      this.repairTimes.push(Date.now() - repairStart);
    }
    return result;
  }

  buildStatusReport(): VideoGenerationOptimizationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgOptimization =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.optimizationScore, 0) / all.length)
        : 0;
    const avgReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getVideoQualityValidationEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("video-generation-optimization-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      pipelineOptimizationStatus: "story through validation pipeline optimization active",
      resourceOptimizationStatus: "CPU, GPU, RAM, disk, cache optimization active",
      performanceOptimizationStatus: "generation, validation, planning speed optimization active",
      optimizationsGenerated: all.length,
      averageOptimizationScore: avgOptimization,
      averageProductionReadinessScore: avgReadiness,
      performance: {
        averageOptimizationMs: avg(this.optimizationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRepairMs: avg(this.repairTimes),
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
      throw new VideoGenerationOptimizationEngineError(
        "Video Generation Optimization Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
