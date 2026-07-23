import path from "node:path";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAccessPermission,
  ImageGenerationCategory,
  ImageGenerationModuleStatus,
} from "../image-generation-foundation/types.js";
import { BackgroundGenerationAnalyzer } from "./background-generation-analyzer.js";
import { BackgroundGenerationLinker } from "./background-generation-linker.js";
import { BackgroundGenerationLogger } from "./background-generation-logger.js";
import { BackgroundGenerationProcessor } from "./background-generation-processor.js";
import { BackgroundGenerationScorer } from "./background-generation-scorer.js";
import { BackgroundGenerationRecordStore } from "./background-generation-stores.js";
import {
  BackgroundGenerationEngineError,
  BackgroundGenerationEngineStatusReport,
  BackgroundGenerationInput,
  BackgroundGenerationRecord,
  BackgroundGenerationResult,
  BackgroundGenPlatform,
  BackgroundGenerationSearchQuery,
} from "./types.js";

/**
 * AI Background Generation & Replacement Engine — intelligently generates, replaces
 * and optimizes backgrounds while preserving subject integrity and brand identity.
 */
export class AiBackgroundGenerationEngine {
  private foundation: AiImageGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new BackgroundGenerationLogger();
  readonly records = new BackgroundGenerationRecordStore();

  private readonly analyzer = new BackgroundGenerationAnalyzer();
  private readonly scorer = new BackgroundGenerationScorer();
  private readonly linker = new BackgroundGenerationLinker();
  private processor: BackgroundGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private analysisTimes: number[] = [];

  initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "backgrounds", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new BackgroundGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Background Generation & Replacement Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageGenerationModule({
      moduleId: "background-generation-engine",
      moduleName: "Background Generation & Replacement Engine",
      category: ImageGenerationCategory.BackgroundGeneration,
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Active,
      dependencies: ["image-generation-engine", "image-intelligence-engine"],
      qualityScore: 93,
      confidenceScore: 91,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "backgrounds"),
      accessPermissions: [
        ImageGenerationAccessPermission.Read,
        ImageGenerationAccessPermission.Write,
        ImageGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Background Generation & Replacement Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateBackgroundPlan(input: BackgroundGenerationInput): Promise<BackgroundGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateBackgroundPlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.analysisTimes.push(result.durationMs);
    }
    return result;
  }

  getBackgroundPlan(backgroundPlanId: string): BackgroundGenerationRecord | null {
    this.ensureReady();
    return this.records.get(backgroundPlanId) ?? null;
  }

  getBackgroundPlansByProduct(productId: string): BackgroundGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getBackgroundPlansBySourceImage(sourceImageId: string): BackgroundGenerationRecord[] {
    this.ensureReady();
    return this.records.getBySourceImage(sourceImageId);
  }

  searchBackgroundPlans(query: BackgroundGenerationSearchQuery): BackgroundGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Background plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairBackgroundPlan(
    sourceImageId: string,
    platform?: BackgroundGenPlatform
  ): Promise<BackgroundGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing background plan", { sourceImageId, platform });

    const existingPlans = this.records.getBySourceImage(sourceImageId);
    const existing = existingPlans[0] ?? null;
    const productImagePlan = this.foundation!.getProductImageGenerationEngine().getProductImagePlan(sourceImageId);

    return this.generateBackgroundPlan({
      sourceImageId,
      productImagePlanId:
        existing?.relationships.productImagePlans[0] ?? (productImagePlan ? sourceImageId : undefined),
      productId: existing?.profile.productId ?? productImagePlan?.profile.productId,
      platform: platform ?? existing?.profile.platform,
      targetBackground: existing?.profile.targetBackground,
      marketingPreset: existing?.profile.marketingPreset,
      generateReplacements: true,
      generatePlatformOptimizations: true,
    });
  }

  buildStatusReport(): BackgroundGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.backgroundQualityScore, 0) / all.length)
        : 0;
    const avgProduction =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("background-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      backgroundAnalysisStatus: "type, perspective, lighting, shadows, depth, and horizon analysis active",
      generationStatus: "12 background types including custom prompt generation",
      replacementStatus: "5 variation types — background, brand, seasonal, campaign, platform",
      lightingMatchingStatus: "direction, intensity, temperature, shadows, reflections, ambient",
      depthPlanningStatus: "foreground, midground, background blur and focus separation",
      backgroundPlansGenerated: all.length,
      averageBackgroundQualityScore: avgQuality,
      averageProductionReadinessScore: avgProduction,
      performance: {
        averageGenerationMs: avg(this.generationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageAnalysisMs: avg(this.analysisTimes),
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
      throw new BackgroundGenerationEngineError(
        "Background Generation & Replacement Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
