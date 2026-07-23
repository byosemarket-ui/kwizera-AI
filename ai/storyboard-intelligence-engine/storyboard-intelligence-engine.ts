import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceAccessPermission,
  ProductIntelligenceCategory,
  ProductIntelligenceModuleStatus,
} from "../product-intelligence-foundation/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { StoryboardAnalyzer } from "./storyboard-analyzer.js";
import { StoryboardLinker } from "./storyboard-linker.js";
import { StoryboardLogger } from "./storyboard-logger.js";
import { StoryboardProcessor } from "./storyboard-processor.js";
import { StoryboardScorer } from "./storyboard-scorer.js";
import { StoryboardRecordStore } from "./storyboard-stores.js";
import {
  StoryboardIntelligenceEngineError,
  StoryboardIntelligenceEngineStatusReport,
  StoryboardIntelligenceInput,
  StoryboardIntelligenceRecord,
  StoryboardIntelligenceResult,
  StoryboardSearchQuery,
} from "./types.js";

/**
 * Storyboard Intelligence Engine — transforms approved creative direction into
 * production-ready storyboard intelligence before any media is generated.
 */
export class AiStoryboardIntelligenceEngine {
  private foundation: AiProductIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new StoryboardLogger();
  readonly records = new StoryboardRecordStore();

  private readonly analyzer = new StoryboardAnalyzer();
  private readonly scorer = new StoryboardScorer();
  private readonly linker = new StoryboardLinker();
  private processor: StoryboardProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "storyboard", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new StoryboardProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Storyboard Intelligence Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerProductIntelligenceModule({
      moduleId: "storyboard-intelligence",
      moduleName: "Storyboard Intelligence Engine",
      category: ProductIntelligenceCategory.StoryboardIntelligence,
      version: "0.1.0",
      status: ProductIntelligenceModuleStatus.Active,
      dependencies: [
        "product-engine",
        "product-analysis-engine",
        "product-understanding-engine",
        "audience-intelligence",
        "marketing-strategy-intelligence",
        "creative-direction",
        "knowledge-engine",
      ],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "storyboard"),
      accessPermissions: [
        ProductIntelligenceAccessPermission.Read,
        ProductIntelligenceAccessPermission.Write,
        ProductIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Storyboard Intelligence Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async createStoryboard(input: StoryboardIntelligenceInput): Promise<StoryboardIntelligenceResult> {
    this.ensureReady();
    const result = await this.processor!.createStoryboard(input);
    if (result.success) this.planningTimes.push(result.durationMs);
    return result;
  }

  getStoryboard(storyboardId: string): StoryboardIntelligenceRecord | null {
    this.ensureReady();
    return this.records.get(storyboardId) ?? null;
  }

  getStoryboardsByProduct(productId: string): StoryboardIntelligenceRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchStoryboards(query: StoryboardSearchQuery): StoryboardIntelligenceRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Storyboard search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  detectRelationships(storyboardId: string): StoryboardIntelligenceRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(storyboardId);
    if (!record) return null;

    const creative = this.foundation!.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
    const strategy = this.foundation!.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
    const understanding = this.foundation!.getProductUnderstandingEngine().getUnderstanding(record.productId);
    if (!creative || !strategy || !understanding) return record.relationships;

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      creative,
      strategy,
      understanding
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairStoryboard(productId: string, platform?: CreativePlatform): Promise<StoryboardIntelligenceResult | null> {
    this.ensureReady();
    const creativeEngine = this.foundation!.getCreativeDirectionEngine();

    let creative = creativeEngine.getCreativeDirectionsByProduct(productId)[0];
    if (!creative?.validated) {
      const repaired = await creativeEngine.repairCreativeDirection(productId, platform);
      if (!repaired?.success || !repaired.record) return null;
      creative = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing storyboard", { productId });
    return this.createStoryboard({
      productId,
      creativeId: creative.creativeId,
      includeSocialProof: false,
    });
  }

  buildStatusReport(): StoryboardIntelligenceEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.storyboardQualityScore, 0) / all.length)
        : 0;
    const avgStorytelling =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.storytellingScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getCreativeDirectionEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      storyboardPlanningStatus: "scene sequences, story flow, and timing intelligence active",
      scenePlanningStatus: "full scene plans with camera, visual, and CTA placement",
      continuityStatus: `${all.length} storyboards indexed with continuity validation`,
      storyboardsPrepared: all.length,
      averageStoryboardQualityScore: avgQuality,
      averageStorytellingScore: avgStorytelling,
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
      throw new StoryboardIntelligenceEngineError(
        "Storyboard Intelligence Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
