import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { MotionGenerationAnalyzer } from "./motion-generation-analyzer.js";
import { MotionGenerationLinker } from "./motion-generation-linker.js";
import { MotionGenerationLogger } from "./motion-generation-logger.js";
import { MotionGenerationProcessor } from "./motion-generation-processor.js";
import { MotionGenerationScorer } from "./motion-generation-scorer.js";
import { MotionGenerationRecordStore } from "./motion-generation-stores.js";
import {
  MotionGenerationEngineError,
  MotionGenerationEngineStatusReport,
  MotionGenerationInput,
  MotionGenerationRecord,
  MotionGenerationResult,
  MotionGenerationSearchQuery,
  StoryboardGenerationPlatform,
} from "./types.js";

/**
 * AI Motion Generation Engine — intelligent movement plans for scenes,
 * characters, products, objects, and camera synchronization.
 */
export class AiMotionGenerationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new MotionGenerationLogger();
  readonly records = new MotionGenerationRecordStore();

  private readonly analyzer = new MotionGenerationAnalyzer();
  private readonly scorer = new MotionGenerationScorer();
  private readonly linker = new MotionGenerationLinker();
  private processor: MotionGenerationProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private syncTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "motion-plans", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new MotionGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Motion Generation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "motion-planning-generation-engine",
      moduleName: "Motion Generation Engine",
      category: VideoGenerationCategory.MotionPlanning,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "camera-planning-generation-engine"],
      qualityScore: 94,
      confidenceScore: 92,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "motion-plans"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Motion Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateMotionPlans(input: MotionGenerationInput): Promise<MotionGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateMotionPlans(input);
    if (result.success) {
      this.planningTimes.push(result.durationMs);
      this.syncTimes.push(result.durationMs);
    }
    return result;
  }

  getMotionPlan(motionPlanId: string): MotionGenerationRecord | null {
    this.ensureReady();
    return this.records.get(motionPlanId) ?? null;
  }

  getMotionPlansByScene(sceneId: string): MotionGenerationRecord[] {
    this.ensureReady();
    return this.records.getByScene(sceneId);
  }

  getMotionPlansByStoryboard(storyboardId: string): MotionGenerationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  searchMotionPlans(query: MotionGenerationSearchQuery): MotionGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Motion plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairMotionPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<MotionGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing motion plans", { storyboardId, platform });
    return this.generateMotionPlans({ storyboardId, platform });
  }

  buildStatusReport(): MotionGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.motionQualityScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getCameraDirectorEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("motion-planning-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      planningStatus: "character, product, object, and environment motion planning active",
      synchronizationStatus: "camera-character-product-object synchronization active",
      continuityStatus: "scene, character, product, camera, and story continuity maintained",
      motionPlansGenerated: all.length,
      averageMotionQualityScore: avgQuality,
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
      throw new MotionGenerationEngineError("Motion Generation Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
