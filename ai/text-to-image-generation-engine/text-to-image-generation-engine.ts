import path from "node:path";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAccessPermission,
  ImageGenerationCategory,
  ImageGenerationModuleStatus,
} from "../image-generation-foundation/types.js";
import { TextToImageGenerationAnalyzer } from "./text-to-image-generation-analyzer.js";
import { TextToImageGenerationLinker } from "./text-to-image-generation-linker.js";
import { TextToImageGenerationLogger } from "./text-to-image-generation-logger.js";
import { TextToImageGenerationProcessor } from "./text-to-image-generation-processor.js";
import { TextToImageGenerationScorer } from "./text-to-image-generation-scorer.js";
import { TextToImageGenerationRecordStore } from "./text-to-image-generation-stores.js";
import {
  TextToImageGenerationEngineError,
  TextToImageGenerationEngineStatusReport,
  TextToImageGenerationInput,
  TextToImageGenerationRecord,
  TextToImageGenerationResult,
  TextToImagePlatform,
  TextToImageSearchQuery,
} from "./types.js";

/**
 * AI Text-to-Image Generation Engine — transforms structured prompts into
 * production-ready image generation blueprints.
 */
export class AiTextToImageGenerationEngine {
  private foundation: AiImageGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new TextToImageGenerationLogger();
  readonly records = new TextToImageGenerationRecordStore();

  private readonly analyzer = new TextToImageGenerationAnalyzer();
  private readonly scorer = new TextToImageGenerationScorer();
  private readonly linker = new TextToImageGenerationLinker();
  private processor: TextToImageGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private blueprintTimes: number[] = [];

  initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "text-to-image", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new TextToImageGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Text-to-Image Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageGenerationModule({
      moduleId: "text-to-image-generation-engine",
      moduleName: "Text-to-Image Generation Engine",
      category: ImageGenerationCategory.TextToImage,
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Active,
      dependencies: ["image-generation-engine", "knowledge-engine", "image-intelligence-engine"],
      qualityScore: 92,
      confidenceScore: 90,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "text-to-image"),
      accessPermissions: [
        ImageGenerationAccessPermission.Read,
        ImageGenerationAccessPermission.Write,
        ImageGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Text-to-Image Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateImagePlan(input: TextToImageGenerationInput): Promise<TextToImageGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateImagePlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.blueprintTimes.push(result.durationMs);
    }
    return result;
  }

  getImagePlan(imagePlanId: string): TextToImageGenerationRecord | null {
    this.ensureReady();
    return this.records.get(imagePlanId) ?? null;
  }

  getImagePlansByProduct(productId: string): TextToImageGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getImagePlansByProject(projectId: string): TextToImageGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProject(projectId);
  }

  searchImagePlans(query: TextToImageSearchQuery): TextToImageGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Image plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairImagePlan(productId: string, platform?: TextToImagePlatform): Promise<TextToImageGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing image plan generation", { productId, platform });
    return this.generateImagePlan({
      productId,
      platform,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });
  }

  buildStatusReport(): TextToImageGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgPromptQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.promptQualityScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("text-to-image-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      promptAnalysisStatus: "subject, environment, mood, and style analysis active",
      compositionPlanningStatus: "composition, placement, and perspective planning active",
      stylePlanningStatus: "10 artistic styles with brand alignment",
      platformOptimizationStatus: "8 platform output profiles prepared",
      imagePlansGenerated: all.length,
      averagePromptQualityScore: avgPromptQuality,
      averageProductionReadinessScore: avgProductionReadiness,
      performance: {
        averageGenerationMs: avg(this.generationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageBlueprintMs: avg(this.blueprintTimes),
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
      throw new TextToImageGenerationEngineError(
        "Text-to-Image Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
