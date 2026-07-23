import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import {
  VideoGenerationAccessPermission,
  VideoGenerationCategory,
  VideoGenerationModuleStatus,
} from "../video-generation-foundation/types.js";
import { SceneGenerationAnalyzer } from "./scene-generation-analyzer.js";
import { SceneGenerationLinker } from "./scene-generation-linker.js";
import { SceneGenerationLogger } from "./scene-generation-logger.js";
import { SceneGenerationProcessor } from "./scene-generation-processor.js";
import { SceneGenerationScorer } from "./scene-generation-scorer.js";
import { SceneGenerationRecordStore } from "./scene-generation-stores.js";
import {
  SceneGenerationEngineError,
  SceneGenerationEngineStatusReport,
  SceneGenerationInput,
  SceneGenerationRecord,
  SceneGenerationResult,
  SceneGenerationSearchQuery,
  StoryboardGenerationPlatform,
} from "./types.js";

/**
 * AI Scene Generation Engine — transforms approved storyboards into
 * production-ready scene blueprints for AI video generation.
 */
export class AiSceneGenerationEngine {
  private foundation: AiVideoGenerationFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new SceneGenerationLogger();
  readonly records = new SceneGenerationRecordStore();

  private readonly analyzer = new SceneGenerationAnalyzer();
  private readonly scorer = new SceneGenerationScorer();
  private readonly linker = new SceneGenerationLinker();
  private processor: SceneGenerationProcessor | null = null;

  private generationTimes: number[] = [];
  private searchTimes: number[] = [];
  private shotPlanningTimes: number[] = [];

  initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getGenerationRoot(), "scenes", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new SceneGenerationProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Scene Generation Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerVideoGenerationModule({
      moduleId: "scene-generation-engine",
      moduleName: "Scene Generation Engine",
      category: VideoGenerationCategory.SceneGeneration,
      version: "0.1.0",
      status: VideoGenerationModuleStatus.Active,
      dependencies: ["video-generation-engine", "story-generation-engine", "video-intelligence-engine"],
      qualityScore: 92,
      confidenceScore: 90,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "scenes"),
      accessPermissions: [
        VideoGenerationAccessPermission.Read,
        VideoGenerationAccessPermission.Write,
        VideoGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Scene Generation Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async generateScenes(input: SceneGenerationInput): Promise<SceneGenerationResult> {
    this.ensureReady();
    const result = await this.processor!.generateScenes(input);
    if (result.success) {
      this.generationTimes.push(result.durationMs);
      this.shotPlanningTimes.push(result.durationMs);
    }
    return result;
  }

  getScene(sceneId: string): SceneGenerationRecord | null {
    this.ensureReady();
    return this.records.get(sceneId) ?? null;
  }

  getScenesByStoryboard(storyboardId: string): SceneGenerationRecord[] {
    this.ensureReady();
    return this.records.getByStoryboard(storyboardId);
  }

  getScenesByProduct(productId: string): SceneGenerationRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchScenes(query: SceneGenerationSearchQuery): SceneGenerationRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Scene search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  async repairScenes(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<SceneGenerationResult | null> {
    this.ensureReady();
    this.logger.log("info", "repair", "Repairing scene generation", { storyboardId, platform });
    return this.generateScenes({ storyboardId, platform });
  }

  buildStatusReport(): SceneGenerationEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.sceneQualityScore, 0) / all.length)
        : 0;
    const avgProductionReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getStoryGenerationEngine().isStartupComplete()) readinessScore -= 10;

    const module = this.foundation?.getRegistry().getModule("scene-generation-engine");
    if (!module?.implemented) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      generationStatus: "scene blueprints with shots, layout, and planning active",
      shotPlanningStatus: "shot sequences with camera angle, movement, and focus point",
      compositionStatus: "visual composition, character, and object planning active",
      scenesGenerated: all.length,
      averageSceneQualityScore: avgQuality,
      averageProductionReadinessScore: avgProductionReadiness,
      performance: {
        averageGenerationMs: avg(this.generationTimes),
        averageSearchMs: avg(this.searchTimes),
        averageShotPlanningMs: avg(this.shotPlanningTimes),
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
      throw new SceneGenerationEngineError(
        "Scene Generation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
