import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { RenderingPreparationAnalyzer } from "./rendering-preparation-analyzer.js";
import { RenderingPreparationLinker } from "./rendering-preparation-linker.js";
import { RenderingPreparationLogger } from "./rendering-preparation-logger.js";
import { RenderingPreparationProcessor } from "./rendering-preparation-processor.js";
import { RenderingPreparationScorer } from "./rendering-preparation-scorer.js";
import { RenderingPreparationRecordStore } from "./rendering-preparation-stores.js";
import {
  RenderingPreparationEngineError,
  RenderingPreparationEngineStatusReport,
  RenderingPreparationInput,
  RenderingPreparationRecord,
  RenderingPreparationResult,
  RenderingPreparationSearchQuery,
} from "./types.js";

/**
 * AI Rendering Preparation Engine — validates, organizes and prepares assets,
 * timelines and production instructions required before rendering starts.
 */
export class AiRenderingPreparationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new RenderingPreparationLogger();
  readonly records = new RenderingPreparationRecordStore();

  private readonly analyzer = new RenderingPreparationAnalyzer();
  private readonly scorer = new RenderingPreparationScorer();
  private readonly linker = new RenderingPreparationLinker();
  private processor: RenderingPreparationProcessor | null = null;

  private preparationTimes: number[] = [];
  private searchTimes: number[] = [];
  private validationTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "rendering", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new RenderingPreparationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Rendering Preparation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "rendering-planning-generation-engine",
      moduleName: "Rendering Preparation Engine",
      category: VideoGenerationCategory.RenderingPlanning,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "video-production-generation-engine"],
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "rendering"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Rendering Preparation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async prepareRenderPlans(input: RenderingPreparationInput): Promise<RenderingPreparationResult> {
    this.ensureReady();
    const result = await this.processor!.prepareRenderPlans(input);
    if (result.success) {
      this.preparationTimes.push(result.durationMs);
      this.validationTimes.push(result.durationMs);
    }
    return result;
  }

  getRenderPlan(renderPlanId: string): RenderingPreparationRecord | null {
    this.ensureReady();
    return this.records.get(renderPlanId) ?? null;
  }

  getRenderPlansByStoryboard(storyboardId: string): RenderingPreparationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchRenderPlans(query: RenderingPreparationSearchQuery): RenderingPreparationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Render plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairRenderPlans(
    storyboardId: string,
    platform?: StoryboardGenerationPlatform
  ): Promise<RenderingPreparationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing render plans", { storyboardId, platform });
    return this.prepareRenderPlans({ storyboardId, platform });
  }

  buildStatusReport(): RenderingPreparationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.renderReadinessScore, 0) / all.length)
        : 0;
    const avgAsset =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.assetQualityScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getVideoProductionEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("rendering-planning-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      validationStatus: "storyboard through production render validation active",
      resourcePlanningStatus: "CPU, GPU, RAM, storage, cache allocation planning active",
      timelineStatus: "scene, camera, motion, animation, audio, subtitle, effect, render timelines active",
      renderPlansGenerated: all.length,
      averageRenderReadinessScore: avgReadiness,
      averageAssetQualityScore: avgAsset,
      performance: {
        averagePreparationMs: avg(this.preparationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageValidationMs: avg(this.validationTimes),
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
      throw new RenderingPreparationEngineError("Rendering Preparation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
