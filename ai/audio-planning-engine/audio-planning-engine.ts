import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceAccessPermission,
  ProductIntelligenceCategory,
  ProductIntelligenceModuleStatus,
} from "../product-intelligence-foundation/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { AudioPlanningAnalyzer } from "./audio-planning-analyzer.js";
import { AudioPlanningLinker } from "./audio-planning-linker.js";
import { AudioPlanningLogger } from "./audio-planning-logger.js";
import { AudioPlanningProcessor } from "./audio-planning-processor.js";
import { AudioPlanningScorer } from "./audio-planning-scorer.js";
import { AudioPlanningRecordStore } from "./audio-planning-stores.js";
import {
  AudioPlanningEngineError,
  AudioPlanningEngineStatusReport,
  AudioPlanningInput,
  AudioPlanningRecord,
  AudioPlanningResult,
  AudioPlanningSearchQuery,
} from "./types.js";

/**
 * Audio Planning Engine — prepares complete audio production plans before
 * voice, music or sound effects generation, aligned with storyboard, script, visual plan, brand and strategy.
 */
export class AiAudioPlanningEngine {
  private foundation: AiProductIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new AudioPlanningLogger();
  readonly records = new AudioPlanningRecordStore();

  private readonly analyzer = new AudioPlanningAnalyzer();
  private readonly scorer = new AudioPlanningScorer();
  private readonly linker = new AudioPlanningLinker();
  private processor: AudioPlanningProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "audio", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new AudioPlanningProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Audio Planning Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerProductIntelligenceModule({
      moduleId: "audio-planning",
      moduleName: "Audio Planning Engine",
      category: ProductIntelligenceCategory.AudioPlanning,
      version: "0.1.0",
      status: ProductIntelligenceModuleStatus.Active,
      dependencies: [
        "product-engine",
        "product-analysis-engine",
        "product-understanding-engine",
        "audience-intelligence",
        "marketing-strategy-intelligence",
        "creative-direction",
        "storyboard-intelligence",
        "script-planning",
        "visual-planning",
        "knowledge-engine",
      ],
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "audio"),
      accessPermissions: [
        ProductIntelligenceAccessPermission.Read,
        ProductIntelligenceAccessPermission.Write,
        ProductIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Audio Planning Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async createAudioPlan(input: AudioPlanningInput): Promise<AudioPlanningResult> {
    this.ensureReady();
    const result = await this.processor!.createAudioPlan(input);
    if (result.success) this.planningTimes.push(result.durationMs);
    return result;
  }

  getAudioPlan(audioPlanId: string): AudioPlanningRecord | null {
    this.ensureReady();
    return this.records.get(audioPlanId) ?? null;
  }

  getAudioPlansByProduct(productId: string): AudioPlanningRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchAudioPlans(query: AudioPlanningSearchQuery): AudioPlanningRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Audio plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  detectRelationships(audioPlanId: string): AudioPlanningRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(audioPlanId);
    if (!record) return null;

    const storyboard = this.foundation!.getStoryboardIntelligenceEngine().getStoryboard(record.storyboardId);
    const scriptPlan = this.foundation!.getScriptPlanningEngine().getScriptPlan(record.scriptPlanId);
    const visualPlan = this.foundation!.getVisualPlanningEngine().getVisualPlan(record.visualPlanId);
    const creative = this.foundation!.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
    const strategy = this.foundation!.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
    const understanding = this.foundation!.getProductUnderstandingEngine().getUnderstanding(record.productId);
    if (!storyboard || !scriptPlan || !visualPlan || !creative || !strategy || !understanding) {
      return record.relationships;
    }

    const updated = this.linker.detectRelationships(
      record,
      storyboard,
      scriptPlan,
      visualPlan,
      creative,
      strategy,
      understanding
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairAudioPlan(productId: string, platform?: CreativePlatform): Promise<AudioPlanningResult | null> {
    this.ensureReady();
    const visualEngine = this.foundation!.getVisualPlanningEngine();

    let visualPlan = visualEngine.getVisualPlansByProduct(productId)[0];
    if (!visualPlan?.productionReady) {
      const repaired = await visualEngine.repairVisualPlan(productId, platform);
      if (!repaired?.success || !repaired.record) return null;
      visualPlan = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing audio plan", { productId });
    return this.createAudioPlan({
      productId,
      storyboardId: visualPlan.storyboardId,
      scriptPlanId: visualPlan.scriptPlanId,
      visualPlanId: visualPlan.visualPlanId,
    });
  }

  buildStatusReport(): AudioPlanningEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgPlanning =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.audioPlanningScore, 0) / all.length)
        : 0;
    const avgSync =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.synchronizationScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getVisualPlanningEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      audioPlanningStatus: "voice-over, music, sfx and timing planning active",
      voicePlanningStatus: "voice style, pacing, and emphasis rules ready",
      musicPlanningStatus: "intro, background, ending music and volume strategy planned",
      synchronizationStatus: "voice, music, subtitle and scene timing sync active",
      audioPlansPrepared: all.length,
      averageAudioPlanningScore: avgPlanning,
      averageSynchronizationScore: avgSync,
      performance: {
        averagePlanningMs: avg(this.planningTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRelationshipMs: avg(this.relationshipTimes),
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
      throw new AudioPlanningEngineError("Audio Planning Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
