import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { EnhancementPlanningAnalyzer } from "./enhancement-planning-analyzer.js";
import { EnhancementPlanningLinker } from "./enhancement-planning-linker.js";
import { EnhancementPlanningLogger } from "./enhancement-planning-logger.js";
import { EnhancementPlanningProcessor } from "./enhancement-planning-processor.js";
import { EnhancementPlanningScorer } from "./enhancement-planning-scorer.js";
import { ImageEnhancementPlanningRecordStore } from "./enhancement-planning-stores.js";
import {
  ImageEnhancementPlanningEngineError,
  ImageEnhancementPlanningEngineStatusReport,
  ImageEnhancementPlanningInput,
  ImageEnhancementPlanningRecord,
  ImageEnhancementPlanningResult,
  ImageEnhancementPlanningSearchQuery,
} from "./types.js";

/**
 * Image Enhancement Planning Engine — prepares non-destructive enhancement plans before image processing.
 */
export class AiImageEnhancementPlanningEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new EnhancementPlanningLogger();
  readonly records = new ImageEnhancementPlanningRecordStore();

  private readonly analyzer = new EnhancementPlanningAnalyzer();
  private readonly scorer = new EnhancementPlanningScorer();
  private readonly linker = new EnhancementPlanningLinker();
  private processor: EnhancementPlanningProcessor | null = null;

  private planningTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "enhancement-planning", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new EnhancementPlanningProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Image Enhancement Planning Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "image-enhancement-planning",
      moduleName: "Image Enhancement Planning",
      category: ImageIntelligenceCategory.EnhancementPlanning,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: [
        "image-engine",
        "image-analysis-engine",
        "image-understanding-engine",
      ],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "enhancement-planning"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Write,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Enhancement Planning Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async planEnhancement(input: ImageEnhancementPlanningInput): Promise<ImageEnhancementPlanningResult> {
    this.ensureReady();
    const result = await this.processor!.plan(input);
    if (result.success) this.planningTimes.push(result.durationMs);
    return result;
  }

  getEnhancementPlan(imageId: string): ImageEnhancementPlanningRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  searchEnhancementPlans(query: ImageEnhancementPlanningSearchQuery): ImageEnhancementPlanningRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(imageId: string): ImageEnhancementPlanningRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(imageId);
    if (!record) return null;

    const analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    const understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
    if (!analysis || !understanding) return record.relationships;

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      understanding,
      this.foundation!.getBackgroundIntelligenceEngine().getBackground(imageId),
      this.foundation!.getCompositionIntelligenceEngine().getComposition(imageId),
      this.foundation!.getLightingColorIntelligenceEngine().getLightingColor(imageId),
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairEnhancementPlan(imageId: string): Promise<ImageEnhancementPlanningResult | null> {
    this.ensureReady();

    let analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    let understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);

    if (!analysis?.validated) {
      const repaired = await this.foundation!.getImageAnalysisEngine().repairImage(imageId);
      if (!repaired?.success || !repaired.record) return null;
      analysis = repaired.record;
    }

    if (!understanding?.validated) {
      const repaired = await this.foundation!.getImageUnderstandingEngine().repairUnderstanding(imageId);
      if (!repaired?.success) return null;
      understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
      if (!understanding) return null;
    }

    this.logger.log("info", "validation", "Repairing enhancement plan", { imageId });
    return this.planEnhancement({
      imageId,
      relatedKnowledge: understanding.relationships.relatedKnowledge,
      relatedProjects: understanding.relationships.relatedProjects,
    });
  }

  buildStatusReport(): ImageEnhancementPlanningEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgReadiness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.enhancementReadinessScore, 0) / all.length)
        : 0;
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.imageQualityScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getImageAnalysisEngine().isStartupComplete()) readinessScore -= 10;
    if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      enhancementPlanningStatus:
        "resolution, noise, sharpening, exposure, contrast, color, background and object enhancement planned",
      qualityAnalysisStatus: "resolution, sharpness, noise, artifacts, exposure, contrast, white balance analyzed",
      restorationPlanningStatus: "scratch, dust, artifact, blur and quality recovery planning prepared",
      backgroundPlanningStatus: "cleanup, blur, simplification, harmonization and isolation planning prepared",
      relationshipStatus: `${all.length} enhancement plans indexed`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      plansCreated: all.length,
      averageReadinessScore: avgReadiness,
      averageQualityScore: avgQuality,
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
      throw new ImageEnhancementPlanningEngineError(
        "Image Enhancement Planning Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
