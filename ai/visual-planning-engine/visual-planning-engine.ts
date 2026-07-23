import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceAccessPermission,
  ProductIntelligenceCategory,
  ProductIntelligenceModuleStatus,
} from "../product-intelligence-foundation/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { VisualPlanningAnalyzer } from "./visual-planning-analyzer.js";
import { VisualPlanningLinker } from "./visual-planning-linker.js";
import { VisualPlanningLogger } from "./visual-planning-logger.js";
import { VisualPlanningProcessor } from "./visual-planning-processor.js";
import { VisualPlanningScorer } from "./visual-planning-scorer.js";
import { VisualPlanningRecordStore } from "./visual-planning-stores.js";
import {
  VisualPlanningEngineError,
  VisualPlanningEngineStatusReport,
  VisualPlanningInput,
  VisualPlanningRecord,
  VisualPlanningResult,
  VisualPlanningSearchQuery,
} from "./types.js";

/**
 * Visual Planning Engine — prepares complete visual production plans before
 * image or video generation, aligned with storyboard, script plan, brand and strategy.
 */
export class AiVisualPlanningEngine {
  private foundation: AiProductIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VisualPlanningLogger();
  readonly records = new VisualPlanningRecordStore();

  private readonly analyzer = new VisualPlanningAnalyzer();
  private readonly scorer = new VisualPlanningScorer();
  private readonly linker = new VisualPlanningLinker();
  private processor: VisualPlanningProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "visual", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new VisualPlanningProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Visual Planning Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerProductIntelligenceModule({
      moduleId: "visual-planning",
      moduleName: "Visual Planning Engine",
      category: ProductIntelligenceCategory.VisualPlanning,
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
        "knowledge-engine",
      ],
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "visual"),
      accessPermissions: [
        ProductIntelligenceAccessPermission.Read,
        ProductIntelligenceAccessPermission.Write,
        ProductIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Visual Planning Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async createVisualPlan(input: VisualPlanningInput): Promise<VisualPlanningResult> {
    this.ensureReady();
    const result = await this.processor!.createVisualPlan(input);
    if (result.success) this.planningTimes.push(result.durationMs);
    return result;
  }

  getVisualPlan(visualPlanId: string): VisualPlanningRecord | null {
    this.ensureReady();
    return this.records.get(visualPlanId) ?? null;
  }

  getVisualPlansByProduct(productId: string): VisualPlanningRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchVisualPlans(query: VisualPlanningSearchQuery): VisualPlanningRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Visual plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  detectRelationships(visualPlanId: string): VisualPlanningRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(visualPlanId);
    if (!record) return null;

    const storyboard = this.foundation!.getStoryboardIntelligenceEngine().getStoryboard(record.storyboardId);
    const scriptPlan = this.foundation!.getScriptPlanningEngine().getScriptPlan(record.scriptPlanId);
    const creative = this.foundation!.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
    const strategy = this.foundation!.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
    const understanding = this.foundation!.getProductUnderstandingEngine().getUnderstanding(record.productId);
    if (!storyboard || !scriptPlan || !creative || !strategy || !understanding) return record.relationships;

    const updated = this.linker.detectRelationships(
      record,
      storyboard,
      scriptPlan,
      creative,
      strategy,
      understanding
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairVisualPlan(productId: string, platform?: CreativePlatform): Promise<VisualPlanningResult | null> {
    this.ensureReady();
    const scriptEngine = this.foundation!.getScriptPlanningEngine();

    let scriptPlan = scriptEngine.getScriptPlansByProduct(productId)[0];
    if (!scriptPlan?.productionReady) {
      const repaired = await scriptEngine.repairScriptPlan(productId, platform);
      if (!repaired?.success || !repaired.record) return null;
      scriptPlan = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing visual plan", { productId });
    return this.createVisualPlan({
      productId,
      storyboardId: scriptPlan.storyboardId,
      scriptPlanId: scriptPlan.scriptPlanId,
    });
  }

  buildStatusReport(): VisualPlanningEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgPlanning =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.visualPlanningScore, 0) / all.length)
        : 0;
    const avgComposition =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.compositionScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getScriptPlanningEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      visualPlanningStatus: "scene visuals, product placement, and composition planning active",
      cameraPlanningStatus: "camera framing, movement, and shot planning ready",
      backgroundPlanningStatus: "background styles and environment planning active",
      visualPlansPrepared: all.length,
      averageVisualPlanningScore: avgPlanning,
      averageCompositionScore: avgComposition,
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
      throw new VisualPlanningEngineError("Visual Planning Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
