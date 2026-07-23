import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceAccessPermission,
  ProductIntelligenceCategory,
  ProductIntelligenceModuleStatus,
} from "../product-intelligence-foundation/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { ProductionPlanningAnalyzer } from "./production-planning-analyzer.js";
import { ProductionPlanningLinker } from "./production-planning-linker.js";
import { ProductionPlanningLogger } from "./production-planning-logger.js";
import { ProductionPlanningProcessor } from "./production-planning-processor.js";
import { ProductionPlanningScorer } from "./production-planning-scorer.js";
import { ProductionPlanningRecordStore } from "./production-planning-stores.js";
import {
  ProductionPlanningEngineError,
  ProductionPlanningEngineStatusReport,
  ProductionPlanningInput,
  ProductionPlanningRecord,
  ProductionPlanningResult,
  ProductionPlanningSearchQuery,
} from "./types.js";

/**
 * Production Planning Engine — combines all approved planning modules into
 * a complete production-ready execution plan before media generation.
 */
export class AiProductionPlanningEngine {
  private foundation: AiProductIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ProductionPlanningLogger();
  readonly records = new ProductionPlanningRecordStore();

  private readonly analyzer = new ProductionPlanningAnalyzer();
  private readonly scorer = new ProductionPlanningScorer();
  private readonly linker = new ProductionPlanningLinker();
  private processor: ProductionPlanningProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "production", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new ProductionPlanningProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Production Planning Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerProductIntelligenceModule({
      moduleId: "production-planning",
      moduleName: "Production Planning Engine",
      category: ProductIntelligenceCategory.ProductionPlanning,
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
        "audio-planning",
        "knowledge-engine",
      ],
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "production"),
      accessPermissions: [
        ProductIntelligenceAccessPermission.Read,
        ProductIntelligenceAccessPermission.Write,
        ProductIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Production Planning Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async createProductionPlan(input: ProductionPlanningInput): Promise<ProductionPlanningResult> {
    this.ensureReady();
    const result = await this.processor!.createProductionPlan(input);
    if (result.success) this.planningTimes.push(result.durationMs);
    return result;
  }

  getProductionPlan(productionPlanId: string): ProductionPlanningRecord | null {
    this.ensureReady();
    return this.records.get(productionPlanId) ?? null;
  }

  getProductionPlansByProduct(productId: string): ProductionPlanningRecord[] {
    this.ensureReady();
    return this.records.getByProduct(productId);
  }

  searchProductionPlans(query: ProductionPlanningSearchQuery): ProductionPlanningRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    this.logger.log("info", "search", "Production plan search executed", {
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });
    return results;
  }

  detectRelationships(productionPlanId: string): ProductionPlanningRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(productionPlanId);
    if (!record) return null;

    const storyboard = this.foundation!.getStoryboardIntelligenceEngine().getStoryboard(record.storyboardId);
    const scriptPlan = this.foundation!.getScriptPlanningEngine().getScriptPlan(record.scriptPlanId);
    const visualPlan = this.foundation!.getVisualPlanningEngine().getVisualPlan(record.visualPlanId);
    const audioPlan = this.foundation!.getAudioPlanningEngine().getAudioPlan(record.audioPlanId);
    const creative = this.foundation!.getCreativeDirectionEngine().getCreativeDirection(record.creativeId);
    const strategy = this.foundation!.getMarketingStrategyIntelligenceEngine().getStrategy(record.strategyId);
    const understanding = this.foundation!.getProductUnderstandingEngine().getUnderstanding(record.productId);
    if (!storyboard || !scriptPlan || !visualPlan || !audioPlan || !creative || !strategy || !understanding) {
      return record.relationships;
    }

    const updated = this.linker.detectRelationships(
      record,
      storyboard,
      scriptPlan,
      visualPlan,
      audioPlan,
      creative,
      strategy,
      understanding
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairProductionPlan(productId: string, platform?: CreativePlatform): Promise<ProductionPlanningResult | null> {
    this.ensureReady();
    const audioEngine = this.foundation!.getAudioPlanningEngine();

    let audioPlan = audioEngine.getAudioPlansByProduct(productId)[0];
    if (!audioPlan?.productionReady) {
      const repaired = await audioEngine.repairAudioPlan(productId, platform);
      if (!repaired?.success || !repaired.record) return null;
      audioPlan = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing production plan", { productId });
    return this.createProductionPlan({
      productId,
      storyboardId: audioPlan.storyboardId,
      scriptPlanId: audioPlan.scriptPlanId,
      visualPlanId: audioPlan.visualPlanId,
      audioPlanId: audioPlan.audioPlanId,
    });
  }

  buildStatusReport(): ProductionPlanningEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;
    const avgDependency =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.dependencyScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getAudioPlanningEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      productionPlanningStatus: "production execution plans combining all upstream modules active",
      workflowPlanningStatus: "pre-production through delivery workflow planned",
      assetValidationStatus: "required asset slots validated before render queue",
      dependencyValidationStatus: "storyboard, script, visual, audio and intelligence dependencies verified",
      productionPlansPrepared: all.length,
      averageProductionReadinessScore: avgReadiness,
      averageDependencyScore: avgDependency,
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
      throw new ProductionPlanningEngineError("Production Planning Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
