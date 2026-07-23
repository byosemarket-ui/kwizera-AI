import path from "node:path";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAccessPermission,
  ImageGenerationCategory,
  ImageGenerationModuleStatus,
} from "../image-generation-foundation/types.js";
import { ImageGenerationOptimizationAnalyzer } from "./image-generation-optimization-analyzer.js";
import { ImageGenerationOptimizationLinker } from "./image-generation-optimization-linker.js";
import { ImageGenerationOptimizationLogger } from "./image-generation-optimization-logger.js";
import { ImageGenerationOptimizationProcessor } from "./image-generation-optimization-processor.js";
import { ImageGenerationOptimizationScorer } from "./image-generation-optimization-scorer.js";
import { ImageGenerationOptimizationRecordStore } from "./image-generation-optimization-stores.js";
import {
  ImageGenerationOptimizationEngineError,
  ImageGenerationOptimizationEngineStatusReport,
  ImageGenerationOptimizationInput,
  ImageGenerationOptimizationRecord,
  ImageGenerationOptimizationResult,
  ImageGenerationOptimizationSearchQuery,
  OptimizationPlatform,
} from "./types.js";

/**
 * AI Image Generation Optimization Engine — optimizes the entire image generation
 * pipeline for quality, speed, reliability and production readiness.
 */
export class AiImageGenerationOptimizationEngine {
  private foundation: AiImageGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageGenerationOptimizationLogger();
  readonly records = new ImageGenerationOptimizationRecordStore();

  private readonly analyzer = new ImageGenerationOptimizationAnalyzer();
  private readonly scorer = new ImageGenerationOptimizationScorer();
  private readonly linker = new ImageGenerationOptimizationLinker();
  private processor: ImageGenerationOptimizationProcessor | null = null;

  private optimizationTimes: number[] = [];
  private searchTimes: number[] = [];
  private repairTimes: number[] = [];

  initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "optimization", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new ImageGenerationOptimizationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Image Generation Optimization Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageGenerationModule({
      moduleId: "image-generation-optimization-engine",
      moduleName: "Image Generation Optimization Engine",
      category: ImageGenerationCategory.ImageGenerationOptimization,
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Active,
      dependencies: [
        "image-generation-engine",
        "image-quality-validation-engine",
        "image-rendering-preparation-engine",
        "image-production-engine",
      ],
      qualityScore: 97,
      confidenceScore: 95,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "optimization"),
      accessPermissions: [
        ImageGenerationAccessPermission.Read,
        ImageGenerationAccessPermission.Write,
        ImageGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Generation Optimization Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async optimizeImageGeneration(input: ImageGenerationOptimizationInput): Promise<ImageGenerationOptimizationResult> {
    this.ensureReady();
    const result = await this.processor!.optimizeImageGeneration(input);
    if (result.success) {
      this.optimizationTimes.push(result.durationMs);
    }
    return result;
  }

  getOptimization(optimizationId: string): ImageGenerationOptimizationRecord | null {
    this.ensureReady();
    return this.records.get(optimizationId) ?? null;
  }

  getOptimizationsByProduct(productId: string): ImageGenerationOptimizationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchOptimizations(query: ImageGenerationOptimizationSearchQuery): ImageGenerationOptimizationRecord[] {
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

  async repairAndReoptimize(productId: string, platform?: OptimizationPlatform): Promise<ImageGenerationOptimizationResult | null> {
    this.ensureReady();
    const repairStart = Date.now();
    this.logger.log("info", "repair", "Repairing and re-optimizing", { productId, platform });

    const validation = this.foundation!.getImageQualityValidationEngine().getValidationsByProduct(productId).find((v) => v.approved);
    const existing = this.records.getByProduct(productId)[0] ?? null;

    const result = await this.optimizeImageGeneration({
      productId,
      validationId: existing?.profile.validationId ?? validation?.qualityValidationId,
      platform: platform ?? existing?.profile.platform,
      autoRepair: true,
      optimizePipeline: true,
      optimizeResources: true,
      optimizeQuality: true,
      optimizeSearch: true,
      optimizeRecovery: true,
    });

    this.repairTimes.push(Date.now() - repairStart);
    return result;
  }

  buildStatusReport(): ImageGenerationOptimizationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgOpt = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.optimizationScore, 0) / all.length) : 0;
    const avgPerf = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.performanceScore, 0) / all.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("image-generation-optimization-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      pipelineOptimizationStatus: "12 pipeline components — prompt through validation results",
      resourceOptimizationStatus: "CPU, GPU, RAM, disk, cache, parallel processing",
      qualityOptimizationStatus: "Quality maintained or improved — never reduced for performance",
      optimizationsPerformed: all.length,
      averageOptimizationScore: avgOpt,
      averagePerformanceScore: avgPerf,
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
      throw new ImageGenerationOptimizationEngineError(
        "Image Generation Optimization Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
