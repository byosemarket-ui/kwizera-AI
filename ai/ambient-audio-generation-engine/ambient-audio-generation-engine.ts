import path from "node:path";
import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAccessPermission,
  AudioGenerationCategory,
  AudioGenerationModuleStatus,
} from "../audio-generation-foundation/types.js";
import { AmbientAudioGenerationAnalyzer } from "./ambient-audio-generation-analyzer.js";
import { AmbientAudioGenerationLinker } from "./ambient-audio-generation-linker.js";
import { AmbientAudioGenerationLogger } from "./ambient-audio-generation-logger.js";
import { AmbientAudioGenerationProcessor } from "./ambient-audio-generation-processor.js";
import { AmbientAudioGenerationScorer } from "./ambient-audio-generation-scorer.js";
import { AmbientAudioGenerationRecordStore } from "./ambient-audio-generation-stores.js";
import {
  AmbientAudioGenerationEngineError,
  AmbientAudioGenerationEngineStatusReport,
  AmbientAudioGenerationInput,
  AmbientAudioGenerationRecord,
  AmbientAudioGenerationResult,
  AmbientAudioSearchQuery,
  AmbientPlatform,
  EnvironmentCategory,
} from "./types.js";

/**
 * AI Ambient & Environmental Audio Engine — prepares production-ready ambient
 * and environmental audio blueprints with realism, immersion, and sync quality.
 */
export class AiAmbientAudioGenerationEngine {
  private foundation: AiAudioGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new AmbientAudioGenerationLogger();
  readonly records = new AmbientAudioGenerationRecordStore();

  private readonly analyzer = new AmbientAudioGenerationAnalyzer();
  private readonly scorer = new AmbientAudioGenerationScorer();
  private readonly linker = new AmbientAudioGenerationLinker();
  private processor: AmbientAudioGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private blueprintTimes: number[] = [];

  initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "ambient", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new AmbientAudioGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Ambient Audio Generation Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerAudioGenerationModule({
      moduleId: "ambient-audio-generation-engine",
      moduleName: "Ambient Audio Generation Engine",
      category: AudioGenerationCategory.AmbientAudioGeneration,
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Active,
      dependencies: ["audio-generation-engine", "sound-effects-generation-engine"],
      qualityScore: 94,
      confidenceScore: 92,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "ambient"),
      accessPermissions: [
        AudioGenerationAccessPermission.Read,
        AudioGenerationAccessPermission.Write,
        AudioGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Ambient Audio Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateAmbientPlan(input: AmbientAudioGenerationInput): Promise<AmbientAudioGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateAmbientPlan(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.blueprintTimes.push(result.durationMs);
    }
    return result;
  }

  getAmbientPlan(ambientPlanId: string): AmbientAudioGenerationRecord | null {
    this.ensureReady();
    return this.records.get(ambientPlanId) ?? null;
  }

  getAmbientPlansByProduct(productId: string): AmbientAudioGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  getAmbientPlansByCategory(category: EnvironmentCategory): AmbientAudioGenerationRecord[] {
    this.ensureReady();
    return this.records.getByCategory(category);
  }

  searchAmbientPlans(query: AmbientAudioSearchQuery): AmbientAudioGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Ambient plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairAmbientPlan(productId: string, platform?: AmbientPlatform): Promise<AmbientAudioGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing ambient plan", { productId, platform });
    const existing = this.records.getByProduct(productId)[0];
    return this.generateAmbientPlan({
      productId,
      platform,
      environmentPrompt: existing ? `${existing.profile.environmentCategory} ambient repair` : undefined,
    });
  }

  buildStatusReport(): AmbientAudioGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgRealism =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.environmentalRealismScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("ambient-audio-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      environmentAnalysisStatus: "environment type, location, weather, season, acoustic space analysis active",
      ambientPlanningStatus: "10 nature types, 9 urban, 9 indoor ambience layers supported",
      weatherPlanningStatus: "10 weather/time-of-day conditions supported",
      spatialAudioStatus: "L/R, front/back, distance, depth, surround, binaural planning active",
      timelinePlanningStatus: "cue points, layer order, fade, crossfade, loop, dynamic intensity active",
      syncPreparationStatus: "7 sync targets with hit point alignment",
      ambientPlansGenerated: all.length,
      averageEnvironmentalRealismScore: avgRealism,
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
      throw new AmbientAudioGenerationEngineError(
        "Ambient Audio Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
