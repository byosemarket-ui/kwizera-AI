import path from "node:path";
import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAccessPermission,
  AudioGenerationCategory,
  AudioGenerationModuleStatus,
} from "../audio-generation-foundation/types.js";
import { SoundEffectsGenerationAnalyzer } from "./sound-effects-generation-analyzer.js";
import { SoundEffectsGenerationLinker } from "./sound-effects-generation-linker.js";
import { SoundEffectsGenerationLogger } from "./sound-effects-generation-logger.js";
import { SoundEffectsGenerationProcessor } from "./sound-effects-generation-processor.js";
import { SoundEffectsGenerationScorer } from "./sound-effects-generation-scorer.js";
import { SoundEffectsGenerationRecordStore } from "./sound-effects-generation-stores.js";
import {
  SoundCategory,
  SoundEffectsGenerationEngineError,
  SoundEffectsGenerationEngineStatusReport,
  SoundEffectsGenerationInput,
  SoundEffectsGenerationRecord,
  SoundEffectsGenerationResult,
  SoundEffectsSearchQuery,
  SfxPlatform,
} from "./types.js";

/**
 * AI Sound Effects Generation Engine — prepares production-ready sound effect
 * blueprints while maintaining realism, synchronization, and production quality.
 */
export class AiSoundEffectsGenerationEngine {
  private foundation: AiAudioGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new SoundEffectsGenerationLogger();
  readonly records = new SoundEffectsGenerationRecordStore();

  private readonly analyzer = new SoundEffectsGenerationAnalyzer();
  private readonly scorer = new SoundEffectsGenerationScorer();
  private readonly linker = new SoundEffectsGenerationLinker();
  private processor: SoundEffectsGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private blueprintTimes: number[] = [];

  initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "sound-effects", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new SoundEffectsGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Sound Effects Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerAudioGenerationModule({
      moduleId: "sound-effects-generation-engine",
      moduleName: "Sound Effects Generation Engine",
      category: AudioGenerationCategory.SoundEffectsGeneration,
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Active,
      dependencies: ["audio-generation-engine", "music-generation-engine"],
      qualityScore: 94,
      confidenceScore: 92,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "sound-effects"),
      accessPermissions: [
        AudioGenerationAccessPermission.Read,
        AudioGenerationAccessPermission.Write,
        AudioGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Sound Effects Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateSoundEffectPlan(input: SoundEffectsGenerationInput): Promise<SoundEffectsGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateSoundEffectPlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.blueprintTimes.push(result.durationMs);
    }
    return result;
  }

  getSoundEffectPlan(soundPlanId: string): SoundEffectsGenerationRecord | null {
    this.ensureReady();
    return this.records.get(soundPlanId) ?? null;
  }

  getSoundEffectPlansByProduct(productId: string): SoundEffectsGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getSoundEffectPlansByCategory(category: SoundCategory): SoundEffectsGenerationRecord[] {
    this.ensureReady();
    return this.records.getByCategory(category);
  }

  searchSoundEffectPlans(query: SoundEffectsSearchQuery): SoundEffectsGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Sound effect plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairSoundEffectPlan(productId: string, platform?: SfxPlatform): Promise<SoundEffectsGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing sound effect plan", { productId, platform });
    const existing = this.records.getByProduct(productId)[0];
    return this.generateSoundEffectPlan({
      productId,
      platform,
      soundPrompt: existing ? `${existing.profile.soundCategory} repair SFX` : undefined,
    });
  }

  buildStatusReport(): SoundEffectsGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgRealism =
      all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.realismScore, 0) / all.length) : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("sound-effects-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      soundAnalysisStatus: "scene, environment, action, objects, distance, intensity analysis active",
      foleyPlanningStatus: "8 foley types with scene-matched planning",
      environmentalPlanningStatus: "12 environmental sound types supported",
      cinematicPlanningStatus: "8 cinematic SFX types with impact/whoosh/rise planning",
      timelinePlanningStatus: "cue points, layers, fade, crossfade planning active",
      syncPreparationStatus: "7 sync targets with hit point alignment",
      soundPlansGenerated: all.length,
      averageRealismScore: avgRealism,
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
      throw new SoundEffectsGenerationEngineError(
        "Sound Effects Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
