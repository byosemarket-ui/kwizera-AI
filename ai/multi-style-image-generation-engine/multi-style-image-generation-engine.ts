import path from "node:path";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAccessPermission,
  ImageGenerationCategory,
  ImageGenerationModuleStatus,
} from "../image-generation-foundation/types.js";
import { MultiStyleImageAnalyzer } from "./multi-style-image-analyzer.js";
import { MultiStyleImageLinker } from "./multi-style-image-linker.js";
import { MultiStyleImageLogger } from "./multi-style-image-logger.js";
import { MultiStyleImageProcessor } from "./multi-style-image-processor.js";
import { MultiStyleImageScorer } from "./multi-style-image-scorer.js";
import { MultiStyleImageRecordStore } from "./multi-style-image-stores.js";
import {
  MultiStyleGenPlatform,
  MultiStyleImageEngineError,
  MultiStyleImageEngineStatusReport,
  MultiStyleImageInput,
  MultiStyleImageRecord,
  MultiStyleImageResult,
  MultiStyleImageSearchQuery,
} from "./types.js";

/**
 * AI Multi-Style Image Generation Engine — generates production-ready style blueprints
 * across multiple artistic, commercial and marketing styles.
 */
export class AiMultiStyleImageGenerationEngine {
  private foundation: AiImageGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MultiStyleImageLogger();
  readonly records = new MultiStyleImageRecordStore();

  private readonly analyzer = new MultiStyleImageAnalyzer();
  private readonly scorer = new MultiStyleImageScorer();
  private readonly linker = new MultiStyleImageLinker();
  private processor: MultiStyleImageProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private planningTimes: number[] = [];

  initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "multi-style", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new MultiStyleImageProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Multi-Style Image Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageGenerationModule({
      moduleId: "multi-style-image-generation-engine",
      moduleName: "Multi-Style Image Generation Engine",
      category: ImageGenerationCategory.MultiStyleImageGeneration,
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Active,
      dependencies: [
        "image-generation-engine",
        "image-to-image-generation-engine",
        "branding-design-generation-engine",
      ],
      qualityScore: 93,
      confidenceScore: 91,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "multi-style"),
      accessPermissions: [
        ImageGenerationAccessPermission.Read,
        ImageGenerationAccessPermission.Write,
        ImageGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Multi-Style Image Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateStylePlan(input: MultiStyleImageInput): Promise<MultiStyleImageResult> {
    this.ensureReady();
    const result = await this.processor!.generateStylePlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.planningTimes.push(result.durationMs);
    }
    return result;
  }

  getStylePlan(stylePlanId: string): MultiStyleImageRecord | null {
    this.ensureReady();
    return this.records.get(stylePlanId) ?? null;
  }

  getStylePlansByProduct(productId: string): MultiStyleImageRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchStylePlans(query: MultiStyleImageSearchQuery): MultiStyleImageRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Style plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairStylePlan(productId: string, platform?: MultiStyleGenPlatform): Promise<MultiStyleImageResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing style plan", { productId, platform });

    const existingPlans = this.records.getByProduct(productId);
    const existing = existingPlans[0] ?? null;
    const productImagePlan = this.foundation!.getProductImageGenerationEngine().getProductImagePlansByProduct(productId)[0] ?? null;
    const brandingPlan = this.foundation!.getBrandingDesignEngine().getBrandingPlansByProduct(productId)[0] ?? null;

    return this.generateStylePlan({
      productId,
      sourceImageId: existing?.profile.sourceImageId ?? productImagePlan?.productImagePlanId,
      productImagePlanId: existing?.relationships.productImagePlans[0] ?? productImagePlan?.productImagePlanId,
      brandingPlanId: existing?.relationships.brandingPlans[0] ?? brandingPlan?.brandDesignId,
      brandId: existing?.profile.brandId,
      platform: platform ?? existing?.profile.platform,
      styleCategory: existing?.profile.styleCategory,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });
  }

  buildStatusReport(): MultiStyleImageEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgStyle =
      all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.styleQualityScore, 0) / all.length) : 0;
    const avgProduction =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("multi-style-image-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      styleLibraryStatus: "32 styles — photorealistic, commercial, artistic, 3D, anime, minimal, vintage, futuristic",
      styleTransformationStatus: "mapping, texture, color, lighting, composition, detail, material adaptation",
      identityPreservationStatus: "7 targets — human, product, logo, packaging, brand colors, typography, visual identity",
      variationStatus: "7 variation types — A/B/C, premium, commercial, social, print",
      stylePlansGenerated: all.length,
      averageStyleQualityScore: avgStyle,
      averageProductionReadinessScore: avgProduction,
      performance: {
        averageGenerationMs: avg(this.generationTimes),
        averageSearchMs: avg(this.searchTimes),
        averagePlanningMs: avg(this.planningTimes),
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
      throw new MultiStyleImageEngineError(
        "Multi-Style Image Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
