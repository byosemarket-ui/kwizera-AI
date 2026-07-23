import path from "node:path";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAccessPermission,
  ImageGenerationCategory,
  ImageGenerationModuleStatus,
} from "../image-generation-foundation/types.js";
import { ProductImageGenerationAnalyzer } from "./product-image-generation-analyzer.js";
import { ProductImageGenerationLinker } from "./product-image-generation-linker.js";
import { ProductImageGenerationLogger } from "./product-image-generation-logger.js";
import { ProductImageGenerationProcessor } from "./product-image-generation-processor.js";
import { ProductImageGenerationScorer } from "./product-image-generation-scorer.js";
import { ProductImageGenerationRecordStore } from "./product-image-generation-stores.js";
import {
  ProductImageGenerationEngineError,
  ProductImageGenerationEngineStatusReport,
  ProductImageGenerationInput,
  ProductImageGenerationRecord,
  ProductImageGenerationResult,
  ProductImageGenPlatform,
  ProductImageGenerationSearchQuery,
} from "./types.js";

/**
 * AI Product Image Generation Engine — prepares production-ready product image
 * generation blueprints for e-commerce, marketing, advertising and branding.
 */
export class AiProductImageGenerationEngine {
  private foundation: AiImageGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ProductImageGenerationLogger();
  readonly records = new ProductImageGenerationRecordStore();

  private readonly analyzer = new ProductImageGenerationAnalyzer();
  private readonly scorer = new ProductImageGenerationScorer();
  private readonly linker = new ProductImageGenerationLinker();
  private processor: ProductImageGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private planningTimes: number[] = [];

  initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "product-images", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new ProductImageGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Product Image Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageGenerationModule({
      moduleId: "product-image-generation-engine",
      moduleName: "Product Image Generation Engine",
      category: ImageGenerationCategory.ProductImageGeneration,
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Active,
      dependencies: ["image-generation-engine", "product-intelligence-engine", "image-intelligence-engine"],
      qualityScore: 94,
      confidenceScore: 92,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "product-images"),
      accessPermissions: [
        ImageGenerationAccessPermission.Read,
        ImageGenerationAccessPermission.Write,
        ImageGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Product Image Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateProductImagePlan(input: ProductImageGenerationInput): Promise<ProductImageGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateProductImagePlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.planningTimes.push(result.durationMs);
    }
    return result;
  }

  getProductImagePlan(productImagePlanId: string): ProductImageGenerationRecord | null {
    this.ensureReady();
    return this.records.get(productImagePlanId) ?? null;
  }

  getProductImagePlansByProduct(productId: string): ProductImageGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getProductImagePlansByCategory(productCategory: string): ProductImageGenerationRecord[] {
    this.ensureReady();
    return this.records.getByCategory(productCategory);
  }

  searchProductImagePlans(query: ProductImageGenerationSearchQuery): ProductImageGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Product image plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairProductImagePlan(
    productId: string,
    platform?: ProductImageGenPlatform
  ): Promise<ProductImageGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing product image plan", { productId, platform });
    return this.generateProductImagePlan({
      productId,
      platform,
      generateMarketingVariations: true,
      generatePlatformOptimizations: true,
    });
  }

  buildStatusReport(): ProductImageGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgPresentation =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productPresentationScore, 0) / all.length)
        : 0;
    const avgMarketplace =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.marketplaceReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("product-image-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      productPlanningStatus: "10 presentation views with showcase layout and catalogue structure",
      photographyPlanningStatus: "7 photography modes with studio, commercial, and luxury treatment",
      backgroundPlanningStatus: "7 background environments for e-commerce and marketing",
      consistencyStatus: "6 consistency rules with shape, color, and packaging locks",
      marketplaceOptimizationStatus: "8 platform profiles with 6 marketing variations",
      productImagePlansGenerated: all.length,
      averageProductPresentationScore: avgPresentation,
      averageMarketplaceReadinessScore: avgMarketplace,
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
      throw new ProductImageGenerationEngineError(
        "Product Image Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
