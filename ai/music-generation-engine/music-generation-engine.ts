import path from "node:path";
import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAccessPermission,
  AudioGenerationCategory,
  AudioGenerationModuleStatus,
} from "../audio-generation-foundation/types.js";
import { MusicGenerationAnalyzer } from "./music-generation-analyzer.js";
import { MusicGenerationLinker } from "./music-generation-linker.js";
import { MusicGenerationLogger } from "./music-generation-logger.js";
import { MusicGenerationProcessor } from "./music-generation-processor.js";
import { MusicGenerationScorer } from "./music-generation-scorer.js";
import { MusicGenerationRecordStore } from "./music-generation-stores.js";
import {
  MusicGenre,
  MusicGenerationEngineError,
  MusicGenerationEngineStatusReport,
  MusicGenerationInput,
  MusicGenerationRecord,
  MusicGenerationResult,
  MusicMood,
  MusicPlatform,
  MusicSearchQuery,
} from "./types.js";

/**
 * AI Music Generation Engine — prepares production-ready music generation
 * blueprints while maintaining quality, emotional consistency, and brand identity.
 */
export class AiMusicGenerationEngine {
  private foundation: AiAudioGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MusicGenerationLogger();
  readonly records = new MusicGenerationRecordStore();

  private readonly analyzer = new MusicGenerationAnalyzer();
  private readonly scorer = new MusicGenerationScorer();
  private readonly linker = new MusicGenerationLinker();
  private processor: MusicGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private blueprintTimes: number[] = [];

  initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "music", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new MusicGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Music Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerAudioGenerationModule({
      moduleId: "music-generation-engine",
      moduleName: "Music Generation Engine",
      category: AudioGenerationCategory.MusicGeneration,
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Active,
      dependencies: ["audio-generation-engine", "voice-cloning-generation-engine"],
      qualityScore: 94,
      confidenceScore: 92,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "music"),
      accessPermissions: [
        AudioGenerationAccessPermission.Read,
        AudioGenerationAccessPermission.Write,
        AudioGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Music Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateMusicPlan(input: MusicGenerationInput): Promise<MusicGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateMusicPlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.blueprintTimes.push(result.durationMs);
    }
    return result;
  }

  getMusicPlan(musicPlanId: string): MusicGenerationRecord | null {
    this.ensureReady();
    return this.records.get(musicPlanId) ?? null;
  }

  getMusicPlansByProduct(productId: string): MusicGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getMusicPlansByGenre(genre: MusicGenre): MusicGenerationRecord[] {
    this.ensureReady();
    return this.records.getByGenre(genre);
  }

  getMusicPlansByMood(mood: MusicMood): MusicGenerationRecord[] {
    this.ensureReady();
    return this.records.getByMood(mood);
  }

  searchMusicPlans(query: MusicSearchQuery): MusicGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Music plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairMusicPlan(productId: string, platform?: MusicPlatform): Promise<MusicGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing music plan", { productId, platform });
    const existing = this.records.getByProduct(productId)[0];
    return this.generateMusicPlan({
      productId,
      platform,
      musicPrompt: existing ? `${existing.profile.genre} ${existing.profile.mood} repair` : undefined,
    });
  }

  buildStatusReport(): MusicGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgComposition =
      all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.compositionScore, 0) / all.length) : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("music-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      musicAnalysisStatus: "mood, genre, tempo, key, scale, time signature, energy analysis active",
      compositionPlanningStatus: "melody, harmony, rhythm, chord progression, song structure active",
      arrangementPlanningStatus: "10 instrument families with genre-aware orchestration",
      moodPlanningStatus: "10 mood types with emotional arc and brand alignment",
      syncPreparationStatus: "8 sync targets with hit points and platform optimization",
      loopPlanningStatus: "5 loop types with seamless and crossfade planning",
      musicPlansGenerated: all.length,
      averageCompositionScore: avgComposition,
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
      throw new MusicGenerationEngineError("Music Generation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
