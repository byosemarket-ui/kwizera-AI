import path from "node:path";
import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAccessPermission,
  AudioGenerationCategory,
  AudioGenerationModuleStatus,
} from "../audio-generation-foundation/types.js";
import { AudioQualityValidationAnalyzer } from "./audio-quality-validation-analyzer.js";
import { AudioQualityValidationLinker } from "./audio-quality-validation-linker.js";
import { AudioQualityValidationLogger } from "./audio-quality-validation-logger.js";
import { AudioQualityValidationProcessor } from "./audio-quality-validation-processor.js";
import { AudioQualityValidationScorer } from "./audio-quality-validation-scorer.js";
import { AudioQualityValidationRecordStore } from "./audio-quality-validation-stores.js";
import {
  AudioQualityValidationEngineError,
  AudioQualityValidationEngineStatusReport,
  AudioQualityValidationInput,
  AudioQualityValidationPlatform,
  AudioQualityValidationRecord,
  AudioQualityValidationResult,
  AudioQualityValidationSearchQuery,
} from "./types.js";

/**
 * AI Audio Quality Validation Engine — validates every audio production component
 * before rendering and export.
 */
export class AiAudioQualityValidationEngine {
  private foundation: AiAudioGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new AudioQualityValidationLogger();
  readonly records = new AudioQualityValidationRecordStore();

  private readonly analyzer = new AudioQualityValidationAnalyzer();
  private readonly scorer = new AudioQualityValidationScorer();
  private readonly linker = new AudioQualityValidationLinker();
  private processor: AudioQualityValidationProcessor | null = null;

  private validationTimes: number[] = [];
  private searchTimes: number[] = [];
  private repairTimes: number[] = [];

  initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "quality-validation", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new AudioQualityValidationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Audio Quality Validation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerAudioGenerationModule({
      moduleId: "audio-quality-validation-engine",
      moduleName: "AI Audio Quality Validation Engine",
      category: AudioGenerationCategory.AudioQualityValidation,
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Active,
      dependencies: [
        "audio-generation-engine",
        "audio-production-engine",
        "audio-rendering-preparation-engine",
      ],
      qualityScore: 96,
      confidenceScore: 94,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "quality-validation"),
      accessPermissions: [
        AudioGenerationAccessPermission.Read,
        AudioGenerationAccessPermission.Write,
        AudioGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Audio Quality Validation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async validateAudioQuality(input: AudioQualityValidationInput): Promise<AudioQualityValidationResult> {
    this.ensureReady();
    const result = await this.processor!.validateAudioQuality(input);
    if (result.success) {
      this.validationTimes.push(result.durationMs);
    }
    return result;
  }

  getValidation(audioQualityValidationId: string): AudioQualityValidationRecord | null {
    this.ensureReady();
    return this.records.get(audioQualityValidationId) ?? null;
  }

  getValidationsByProduct(productId: string): AudioQualityValidationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchValidations(query: AudioQualityValidationSearchQuery): AudioQualityValidationRecord[] {
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

  async repairAndRevalidate(productId: string, platform?: AudioQualityValidationPlatform): Promise<AudioQualityValidationResult | null> {
    this.ensureReady();
    const repairStart = Date.now();
    this.logger.log("info", "repair", "Repairing and revalidating audio quality", { productId, platform });

    const existing = this.records.getByProduct(productId)[0] ?? null;
    const renderPlan = this.foundation!.getAudioRenderingPreparationEngine().getRenderPlansByProduct(productId)[0] ?? null;
    const productionPlan = this.foundation!.getAudioProductionEngine().getProductionPlansByProduct(productId)[0] ?? null;

    const result = await this.validateAudioQuality({
      productId,
      renderPlanId: existing?.profile.renderPlanId ?? renderPlan?.audioRenderPlanId,
      productionId: existing?.profile.productionId ?? productionPlan?.audioProductionId,
      platform: platform ?? existing?.profile.platform,
      autoRepair: true,
      validatePlatform: true,
    });

    this.repairTimes.push(Date.now() - repairStart);
    return result;
  }

  buildStatusReport(): AudioQualityValidationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.overallAudioQualityScore, 0) / all.length) : 0;
    const approvedCount = all.filter((r) => r.approved).length;
    const approvalRate = all.length > 0 ? Math.round((approvedCount / all.length) * 100) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("audio-quality-validation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      audioQualityStatus: "10 checks — sample rate, bit depth, loudness, peak, dynamic range, SNR, noise, distortion, clipping, frequency",
      trackValidationStatus: "7 track checks — structure, order, groups, bus, send, automation, mute/solo",
      syncValidationStatus: "6 sync checks — video, lip sync, dialogue, music, SFX, ambient timing",
      brandValidationStatus: "4 brand checks — audio identity, voice, style, campaign consistency",
      validationsPerformed: all.length,
      averageOverallQualityScore: avgQuality,
      averageApprovalRate: approvalRate,
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
      throw new AudioQualityValidationEngineError("Audio Quality Validation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
