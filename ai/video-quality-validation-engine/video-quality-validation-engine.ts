import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { VideoQualityValidationAnalyzer } from "./video-quality-validation-analyzer.js";
import { VideoQualityValidationLinker } from "./video-quality-validation-linker.js";
import { VideoQualityValidationLogger } from "./video-quality-validation-logger.js";
import { VideoQualityValidationProcessor } from "./video-quality-validation-processor.js";
import { VideoQualityValidationScorer } from "./video-quality-validation-scorer.js";
import { QualityValidationRecordStore } from "./video-quality-validation-stores.js";
import {
  QualityValidationInput,
  QualityValidationRecord,
  QualityValidationResult,
  QualityValidationSearchQuery,
  VideoQualityValidationEngineError,
  VideoQualityValidationEngineStatusReport,
} from "./types.js";

/**
 * AI Video Quality Validation Engine — validates every production component
 * before rendering begins, guaranteeing quality, consistency and platform readiness.
 */
export class AiVideoQualityValidationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VideoQualityValidationLogger();
  readonly records = new QualityValidationRecordStore();

  private readonly analyzer = new VideoQualityValidationAnalyzer();
  private readonly scorer = new VideoQualityValidationScorer();
  private readonly linker = new VideoQualityValidationLinker();
  private processor: VideoQualityValidationProcessor | null = null;

  private validationTimes: number[] = [];
  private searchTimes: number[] = [];
  private repairTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "quality-validation", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new VideoQualityValidationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Video Quality Validation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "video-quality-validation-engine",
      moduleName: "Video Quality Validation Engine",
      category: VideoGenerationCategory.VideoQualityValidation,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "rendering-planning-generation-engine"],
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "quality-validation"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Video Quality Validation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async validateVideoQuality(input: QualityValidationInput): Promise<QualityValidationResult> {
    this.ensureReady();
    const result = await this.processor!.validateVideoQuality(input);
    if (result.success) {
      this.validationTimes.push(result.durationMs);
    }
    return result;
  }

  getValidationRecord(validationId: string): QualityValidationRecord | null {
    this.ensureReady();
    return this.records.get(validationId) ?? null;
  }

  getValidationsByStoryboard(storyboardId: string): QualityValidationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchValidations(query: QualityValidationSearchQuery): QualityValidationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Quality validation search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairValidation(
    storyboardId: string,
    platform?: StoryboardGenerationPlatform
  ): Promise<QualityValidationResult | null> {
    this.ensureReady();
    const repairStart = Date.now();
    this.logger.log("info", "repair", "Repairing quality validation", { storyboardId, platform });
    const result = await this.validateVideoQuality({ storyboardId, platform });
    if (result.success) {
      this.repairTimes.push(Date.now() - repairStart);
    }
    return result;
  }

  buildStatusReport(): VideoQualityValidationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgOverall =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.overallQualityScore, 0) / all.length)
        : 0;
    const avgRender =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.renderReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getRenderingPreparationEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("video-quality-validation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      visualValidationStatus: "scene, camera, motion, animation, visual continuity validation active",
      audioValidationStatus: "voice, music, SFX, sync, loudness, balance validation active",
      brandValidationStatus: "logo, colors, typography, campaign consistency validation active",
      validationsGenerated: all.length,
      averageOverallQualityScore: avgOverall,
      averageRenderReadinessScore: avgRender,
      performance: {
        averageValidationMs: avg(this.validationTimes),
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
      throw new VideoQualityValidationEngineError("Video Quality Validation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
