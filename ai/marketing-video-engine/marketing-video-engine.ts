import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { MarketingVideoAnalyzer } from "./marketing-video-analyzer.js";
import { MarketingVideoLinker } from "./marketing-video-linker.js";
import { MarketingVideoLogger } from "./marketing-video-logger.js";
import { MarketingVideoProcessor } from "./marketing-video-processor.js";
import { MarketingVideoScorer } from "./marketing-video-scorer.js";
import { MarketingVideoRecordStore } from "./marketing-video-stores.js";
import {
  MarketingVideoEngineError,
  MarketingVideoEngineStatusReport,
  MarketingVideoInput,
  MarketingVideoRecord,
  MarketingVideoResult,
  MarketingVideoSearchQuery,
} from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

/**
 * AI Marketing Video Engine — high-converting, brand-consistent marketing video plans
 * optimized for audiences and platforms before production rendering.
 */
export class AiMarketingVideoEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MarketingVideoLogger();
  readonly records = new MarketingVideoRecordStore();

  private readonly analyzer = new MarketingVideoAnalyzer();
  private readonly scorer = new MarketingVideoScorer();
  private readonly linker = new MarketingVideoLinker();
  private processor: MarketingVideoProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "marketing-video", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new MarketingVideoProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Marketing Video Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "marketing-video-generation-engine",
      moduleName: "Marketing Video Generation Engine",
      category: VideoGenerationCategory.MarketingVideoPlanning,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "audio-sync-generation-engine"],
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "marketing-video"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Marketing Video Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateMarketingVideoPlans(input: MarketingVideoInput): Promise<MarketingVideoResult> {
    this.ensureReady();
    const result = await this.processor!.generateMarketingVideoPlans(input);
    if (result.success) {
      this.planningTimes.push(result.durationMs);
      this.recommendationTimes.push(result.durationMs);
    }
    return result;
  }

  getMarketingVideoPlan(marketingVideoId: string): MarketingVideoRecord | null {
    this.ensureReady();
    return this.records.get(marketingVideoId) ?? null;
  }

  getMarketingVideoPlansByStoryboard(storyboardId: string): MarketingVideoRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchMarketingVideoPlans(query: MarketingVideoSearchQuery): MarketingVideoRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Marketing video plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairMarketingVideoPlans(
    storyboardId: string,
    platform?: StoryboardGenerationPlatform
  ): Promise<MarketingVideoResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing marketing video plans", { storyboardId, platform });
    return this.generateMarketingVideoPlans({ storyboardId, platform });
  }

  buildStatusReport(): MarketingVideoEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.marketingQualityScore, 0) / all.length)
        : 0;
    const avgReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.platformReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getAudioSynchronizationEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("marketing-video-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      strategyStatus: "campaign objective, value proposition, brand positioning active",
      hookStatus: "first 3 seconds, attention, visual, audio, emotional hooks active",
      ctaStatus: "CTA timing, position, style, animation, visibility planning active",
      marketingPlansGenerated: all.length,
      averageMarketingQualityScore: avgQuality,
      averageProductionReadinessScore: avgReadiness,
      performance: {
        averagePlanningMs: avg(this.planningTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRecommendationMs: avg(this.recommendationTimes),
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
      throw new MarketingVideoEngineError("Marketing Video Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
