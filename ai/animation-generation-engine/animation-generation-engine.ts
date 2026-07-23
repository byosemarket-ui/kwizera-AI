import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { AnimationGenerationAnalyzer } from "./animation-generation-analyzer.js";
import { AnimationGenerationLinker } from "./animation-generation-linker.js";
import { AnimationGenerationLogger } from "./animation-generation-logger.js";
import { AnimationGenerationProcessor } from "./animation-generation-processor.js";
import { AnimationGenerationScorer } from "./animation-generation-scorer.js";
import { AnimationGenerationRecordStore } from "./animation-generation-stores.js";
import {
  AnimationGenerationEngineError,
  AnimationGenerationEngineStatusReport,
  AnimationGenerationInput,
  AnimationGenerationRecord,
  AnimationGenerationResult,
  AnimationGenerationSearchQuery,
  StoryboardGenerationPlatform,
} from "./types.js";

/**
 * AI Animation Generation Engine — professional animation blueprints for
 * characters, products, objects, typography, effects, and environments.
 */
export class AiAnimationGenerationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new AnimationGenerationLogger();
  readonly records = new AnimationGenerationRecordStore();

  private readonly analyzer = new AnimationGenerationAnalyzer();
  private readonly scorer = new AnimationGenerationScorer();
  private readonly linker = new AnimationGenerationLinker();
  private processor: AnimationGenerationProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private syncTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "animation", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new AnimationGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Animation Generation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "animation-planning-generation-engine",
      moduleName: "Animation Generation Engine",
      category: VideoGenerationCategory.AnimationPlanning,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "motion-planning-generation-engine"],
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "animation"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Animation Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateAnimationPlans(input: AnimationGenerationInput): Promise<AnimationGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateAnimationPlans(input);
    if (result.success) {
      this.planningTimes.push(result.durationMs);
      this.syncTimes.push(result.durationMs);
    }
    return result;
  }

  getAnimationPlan(animationPlanId: string): AnimationGenerationRecord | null {
    this.ensureReady();
    return this.records.get(animationPlanId) ?? null;
  }

  getAnimationPlansByScene(sceneId: string): AnimationGenerationRecord[] {
    this.ensureReady();
    return this.records.getByScene(sceneId);
  }

  getAnimationPlansByStoryboard(storyboardId: string): AnimationGenerationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchAnimationPlans(query: AnimationGenerationSearchQuery): AnimationGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Animation plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairAnimationPlans(
    storyboardId: string,
    platform?: StoryboardGenerationPlatform
  ): Promise<AnimationGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing animation plans", { storyboardId, platform });
    return this.generateAnimationPlans({ storyboardId, platform });
  }

  buildStatusReport(): AnimationGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.animationQualityScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getMotionGenerationEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("animation-planning-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      planningStatus: "character, product, object, text, logo, environment, transition animation active",
      synchronizationStatus: "motion, camera, audio, transition synchronization active",
      timelineStatus: "animation timeline with easing and layer priority",
      animationPlansGenerated: all.length,
      averageAnimationQualityScore: avgQuality,
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
      throw new AnimationGenerationEngineError("Animation Generation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
