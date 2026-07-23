import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { ImageQualityPredictionAnalyzer } from "./image-quality-prediction-analyzer.js";
import { ImageQualityPredictionLinker } from "./image-quality-prediction-linker.js";
import { ImageQualityPredictionLogger } from "./image-quality-prediction-logger.js";
import { ImageQualityPredictionProcessor } from "./image-quality-prediction-processor.js";
import { ImageQualityPredictionScorer } from "./image-quality-prediction-scorer.js";
import { ImageQualityPredictionRecordStore } from "./image-quality-prediction-stores.js";
import {
  ImageQualityPredictionEngineError,
  ImageQualityPredictionEngineStatusReport,
  ImageQualityPredictionInput,
  ImageQualityPredictionRecord,
  ImageQualityPredictionResult,
  ImageQualityPredictionSearchQuery,
} from "./types.js";

/**
 * Image Quality Prediction Engine — evaluates expected quality and production readiness before generation.
 */
export class AiImageQualityPredictionEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageQualityPredictionLogger();
  readonly records = new ImageQualityPredictionRecordStore();

  private readonly analyzer = new ImageQualityPredictionAnalyzer();
  private readonly scorer = new ImageQualityPredictionScorer();
  private readonly linker = new ImageQualityPredictionLinker();
  private processor: ImageQualityPredictionProcessor | null = null;

  private predictionTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "quality-prediction", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new ImageQualityPredictionProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Image Quality Prediction Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "image-quality-prediction",
      moduleName: "Image Quality Prediction",
      category: ImageIntelligenceCategory.QualityPrediction,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: [
        "image-engine",
        "knowledge-engine",
        "production-image-planning",
        "creative-image-intelligence",
        "image-enhancement-planning",
      ],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "quality-prediction"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Quality Prediction Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async predictQuality(input: ImageQualityPredictionInput): Promise<ImageQualityPredictionResult> {
    this.ensureReady();
    const result = await this.processor!.predict(input);
    if (result.success) this.predictionTimes.push(result.durationMs);
    return result;
  }

  getQualityPrediction(imageId: string): ImageQualityPredictionRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  searchQualityPredictions(query: ImageQualityPredictionSearchQuery): ImageQualityPredictionRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(imageId: string): ImageQualityPredictionRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(imageId);
    if (!record) return null;

    const analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    const understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
    const productionPlan = this.foundation!.getProductionImagePlanningEngine().getProductionPlan(imageId);
    const creativePlan = this.foundation!.getCreativeImageIntelligenceEngine().getCreativePlan(imageId);
    const enhancementPlan = this.foundation!.getImageEnhancementPlanningEngine().getEnhancementPlan(imageId);

    if (!analysis || !understanding || !productionPlan || !creativePlan || !enhancementPlan) {
      return record.relationships;
    }

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      understanding,
      productionPlan,
      creativePlan,
      enhancementPlan,
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairQualityPrediction(imageId: string): Promise<ImageQualityPredictionResult | null> {
    this.ensureReady();
    const foundation = this.foundation!;

    if (!foundation.getProductionImagePlanningEngine().getProductionPlan(imageId)?.validated) {
      const repaired = await foundation.getProductionImagePlanningEngine().repairProductionPlan(imageId);
      if (!repaired?.success) return null;
    }

    const existing = this.records.get(imageId);
    const understanding = foundation.getImageUnderstandingEngine().getUnderstanding(imageId);

    this.logger.log("info", "validation", "Repairing quality prediction", { imageId });

    return this.predictQuality({
      imageId,
      projectId: existing?.profile.projectId,
      campaign: existing?.profile.campaign,
      platform: existing?.profile.platform,
      relatedKnowledge: understanding?.relationships.relatedKnowledge,
      relatedProjects: understanding?.relationships.relatedProjects,
    });
  }

  buildStatusReport(): ImageQualityPredictionEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgOverall =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.overallImageQualityScore, 0) / all.length)
        : 0;
    const avgProduction =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getProductionImagePlanningEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      qualityAnalysisStatus: "full image intelligence stack analyzed for quality prediction",
      predictionStatus: "production success, marketing impact and platform performance predicted",
      riskDetectionStatus: "resolution, composition, lighting, brand and asset risks evaluated",
      recommendationStatus: "improvement recommendations generated from risk analysis",
      relationshipStatus: `${all.length} quality predictions indexed`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      predictionsCreated: all.length,
      averageOverallQualityScore: avgOverall,
      averageProductionReadinessScore: avgProduction,
      performance: {
        averagePredictionMs: avg(this.predictionTimes),
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
      throw new ImageQualityPredictionEngineError(
        "Image Quality Prediction Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
