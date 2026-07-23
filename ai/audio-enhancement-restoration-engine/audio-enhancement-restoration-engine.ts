import path from "node:path";
import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAccessPermission,
  AudioGenerationCategory,
  AudioGenerationModuleStatus,
} from "../audio-generation-foundation/types.js";
import { AudioEnhancementRestorationAnalyzer } from "./audio-enhancement-restoration-analyzer.js";
import { AudioEnhancementRestorationLinker } from "./audio-enhancement-restoration-linker.js";
import { AudioEnhancementRestorationLogger } from "./audio-enhancement-restoration-logger.js";
import { AudioEnhancementRestorationProcessor } from "./audio-enhancement-restoration-processor.js";
import { AudioEnhancementRestorationScorer } from "./audio-enhancement-restoration-scorer.js";
import { AudioEnhancementRestorationRecordStore } from "./audio-enhancement-restoration-stores.js";
import {
  AudioEnhancementGenerationEngineStatusReport,
  AudioEnhancementGenerationInput,
  AudioEnhancementGenerationRecord,
  AudioEnhancementGenerationResult,
  AudioEnhancementRestorationEngineError,
  AudioEnhancementSearchQuery,
  AudioInputCategory,
  AudioEnhancementPlatform,
  AudioEnhancementType,
} from "./types.js";

/**
 * AI Audio Enhancement & Restoration Engine — prepares production-ready audio
 * enhancement and restoration blueprints preserving clarity and quality.
 */
export class AiAudioEnhancementRestorationEngine {
  private foundation: AiAudioGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new AudioEnhancementRestorationLogger();
  readonly records = new AudioEnhancementRestorationRecordStore();

  private readonly analyzer = new AudioEnhancementRestorationAnalyzer();
  private readonly scorer = new AudioEnhancementRestorationScorer();
  private readonly linker = new AudioEnhancementRestorationLinker();
  private processor: AudioEnhancementRestorationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private blueprintTimes: number[] = [];

  initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "enhancement", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new AudioEnhancementRestorationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Audio Enhancement & Restoration Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerAudioGenerationModule({
      moduleId: "audio-enhancement-generation-engine",
      moduleName: "Audio Enhancement & Restoration Engine",
      category: AudioGenerationCategory.AudioEnhancement,
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Active,
      dependencies: ["audio-generation-engine", "ambient-audio-generation-engine"],
      qualityScore: 94,
      confidenceScore: 92,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "enhancement"),
      accessPermissions: [
        AudioGenerationAccessPermission.Read,
        AudioGenerationAccessPermission.Write,
        AudioGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Audio Enhancement & Restoration Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateEnhancementPlan(input: AudioEnhancementGenerationInput): Promise<AudioEnhancementGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateEnhancementPlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.blueprintTimes.push(result.durationMs);
    }
    return result;
  }

  getEnhancementPlan(enhancementPlanId: string): AudioEnhancementGenerationRecord | null {
    this.ensureReady();
    return this.records.get(enhancementPlanId) ?? null;
  }

  getEnhancementPlansByProduct(productId: string): AudioEnhancementGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getEnhancementPlansByType(enhancementType: AudioEnhancementType): AudioEnhancementGenerationRecord[] {
    this.ensureReady();
    return this.records.getByType(enhancementType);
  }

  searchEnhancementPlans(query: AudioEnhancementSearchQuery): AudioEnhancementGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Enhancement plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairEnhancementPlan(
    productId: string,
    platform?: AudioEnhancementPlatform
  ): Promise<AudioEnhancementGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing enhancement plan", { productId, platform });
    const existing = this.records.getByProduct(productId)[0];
    return this.generateEnhancementPlan({
      productId,
      platform,
      audioPrompt: existing ? `${existing.profile.enhancementType} audio enhancement repair` : undefined,
    });
  }

  buildStatusReport(): AudioEnhancementGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgClarity =
      all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.audioClarityScore, 0) / all.length) : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("audio-enhancement-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      audioAnalysisStatus: "sample rate, bit depth, loudness, SNR, defect detection active",
      enhancementPlanningStatus: "8 enhancement techniques supported",
      restorationPlanningStatus: "9 restoration techniques supported",
      voiceImprovementStatus: "speech clarity, de-esser, plosive, sibilance planning active",
      musicImprovementStatus: "instrument separation, harmony, frequency balance active",
      syncPreparationStatus: "video sync, timeline alignment, lip sync metadata active",
      enhancementPlansGenerated: all.length,
      averageAudioClarityScore: avgClarity,
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
      throw new AudioEnhancementRestorationEngineError(
        "Audio Enhancement & Restoration Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
