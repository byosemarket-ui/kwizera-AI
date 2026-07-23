import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { VisualEffectsGenerationAnalyzer } from "./visual-effects-generation-analyzer.js";
import { VisualEffectsGenerationLinker } from "./visual-effects-generation-linker.js";
import { VisualEffectsGenerationLogger } from "./visual-effects-generation-logger.js";
import { VisualEffectsGenerationProcessor } from "./visual-effects-generation-processor.js";
import { VisualEffectsGenerationScorer } from "./visual-effects-generation-scorer.js";
import { VisualEffectsGenerationRecordStore } from "./visual-effects-generation-stores.js";
import {
  VisualEffectsGenerationEngineError,
  VisualEffectsGenerationEngineStatusReport,
  VisualEffectsGenerationInput,
  VisualEffectsGenerationRecord,
  VisualEffectsGenerationResult,
  VisualEffectsGenerationSearchQuery,
} from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

/**
 * AI Visual Effects Generation Engine — production-ready visual effects blueprints
 * for lighting, atmospheric, product, environment, transition, and color effects.
 */
export class AiVisualEffectsGenerationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VisualEffectsGenerationLogger();
  readonly records = new VisualEffectsGenerationRecordStore();

  private readonly analyzer = new VisualEffectsGenerationAnalyzer();
  private readonly scorer = new VisualEffectsGenerationScorer();
  private readonly linker = new VisualEffectsGenerationLinker();
  private processor: VisualEffectsGenerationProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private syncTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "effects", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new VisualEffectsGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Visual Effects Generation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "visual-effects-planning-generation-engine",
      moduleName: "Visual Effects Generation Engine",
      category: VideoGenerationCategory.VisualEffectsPlanning,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "animation-planning-generation-engine"],
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "effects"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Visual Effects Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateVisualEffectPlans(input: VisualEffectsGenerationInput): Promise<VisualEffectsGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateVisualEffectPlans(input);
    if (result.success) {
      this.planningTimes.push(result.durationMs);
      this.syncTimes.push(result.durationMs);
    }
    return result;
  }

  getVisualEffectPlan(visualEffectPlanId: string): VisualEffectsGenerationRecord | null {
    this.ensureReady();
    return this.records.get(visualEffectPlanId) ?? null;
  }

  getVisualEffectPlansByScene(sceneId: string): VisualEffectsGenerationRecord[] {
    this.ensureReady();
    return this.records.getByScene(sceneId);
  }

  getVisualEffectPlansByStoryboard(storyboardId: string): VisualEffectsGenerationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchVisualEffectPlans(query: VisualEffectsGenerationSearchQuery): VisualEffectsGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Visual effect plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairVisualEffectPlans(
    storyboardId: string,
    platform?: StoryboardGenerationPlatform
  ): Promise<VisualEffectsGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing visual effect plans", { storyboardId, platform });
    return this.generateVisualEffectPlans({ storyboardId, platform });
  }

  buildStatusReport(): VisualEffectsGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.visualEffectsScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getAnimationGenerationEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("visual-effects-planning-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      planningStatus: "lighting, atmospheric, product, environment, transition, text/graphic, color effects active",
      synchronizationStatus: "motion, camera, audio, animation, transition synchronization active",
      cinematicStatus: "cinematic LUT, HDR, depth of field, film grain planning active",
      visualEffectPlansGenerated: all.length,
      averageVisualEffectsScore: avgQuality,
      averageProductionReadinessScore: avgProductionReadiness,
      performance: {
        averagePlanningMs: avg(this.planningTimes),
        averageSearchMs: avg(this.searchTimes),
        averageSyncMs: avg(this.syncTimes),
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
      throw new VisualEffectsGenerationEngineError("Visual Effects Generation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
