import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { LightingColorAnalyzer } from "./lighting-color-analyzer.js";
import { LightingColorLinker } from "./lighting-color-linker.js";
import { LightingColorLogger } from "./lighting-color-logger.js";
import { LightingColorProcessor } from "./lighting-color-processor.js";
import { LightingColorScorer } from "./lighting-color-scorer.js";
import { LightingColorIntelligenceRecordStore } from "./lighting-color-stores.js";
import {
  LightingColorIntelligenceEngineError,
  LightingColorIntelligenceEngineStatusReport,
  LightingColorIntelligenceInput,
  LightingColorIntelligenceRecord,
  LightingColorIntelligenceResult,
  LightingColorIntelligenceSearchQuery,
} from "./types.js";

/**
 * Lighting & Color Intelligence Engine — analyzes lighting and color for creative production planning.
 */
export class AiLightingColorIntelligenceEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new LightingColorLogger();
  readonly records = new LightingColorIntelligenceRecordStore();

  private readonly analyzer = new LightingColorAnalyzer();
  private readonly scorer = new LightingColorScorer();
  private readonly linker = new LightingColorLinker();
  private processor: LightingColorProcessor | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "lighting-color", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new LightingColorProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Lighting & Color Intelligence Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "lighting-color-intelligence",
      moduleName: "Lighting & Color Intelligence",
      category: ImageIntelligenceCategory.LightingColor,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: ["image-engine", "image-analysis-engine", "image-understanding-engine"],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "lighting-color"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Write,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Lighting & Color Intelligence Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async analyzeLightingColor(input: LightingColorIntelligenceInput): Promise<LightingColorIntelligenceResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getLightingColor(imageId: string): LightingColorIntelligenceRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  searchLightingColor(query: LightingColorIntelligenceSearchQuery): LightingColorIntelligenceRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(imageId: string): LightingColorIntelligenceRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(imageId);
    if (!record) return null;

    const analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    const understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
    const composition = this.foundation!.getCompositionIntelligenceEngine().getComposition(imageId);
    const background = this.foundation!.getBackgroundIntelligenceEngine().getBackground(imageId);
    if (!analysis || !understanding) return record.relationships;

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      understanding,
      composition,
      background,
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairLightingColor(imageId: string): Promise<LightingColorIntelligenceResult | null> {
    this.ensureReady();

    let analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    let understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);

    if (!analysis?.validated) {
      const repairedAnalysis = await this.foundation!.getImageAnalysisEngine().repairImage(imageId);
      if (!repairedAnalysis?.success || !repairedAnalysis.record) return null;
      analysis = repairedAnalysis.record;
    }

    if (!understanding?.validated) {
      const repairedUnderstanding = await this.foundation!.getImageUnderstandingEngine().repairUnderstanding(imageId);
      if (!repairedUnderstanding?.success) return null;
      understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
      if (!understanding) return null;
    }

    this.logger.log("info", "validation", "Repairing lighting & color intelligence", { imageId });
    return this.analyzeLightingColor({
      imageId,
      relatedKnowledge: understanding.relationships.relatedKnowledge,
      relatedProjects: understanding.relationships.relatedProjects,
    });
  }

  buildStatusReport(): LightingColorIntelligenceEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgLighting =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.lightingQualityScore, 0) / all.length)
        : 0;
    const avgColor =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.colorQualityScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getImageAnalysisEngine().isStartupComplete()) readinessScore -= 10;
    if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete()) readinessScore -= 10;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      lightingAnalysisStatus:
        "type, direction, intensity, uniformity, exposure, shadows, highlights and reflections analyzed",
      colorAnalysisStatus:
        "palette, harmony, contrast, saturation, vibrance, hue distribution, white balance and temperature analyzed",
      brandColorStatus: "brand color matching and compatibility scoring active",
      improvementPlanningStatus: "lighting and color improvement strategies prepared — no modification performed",
      relationshipStatus: `${all.length} images indexed for lighting & color relationships`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      imagesAnalyzed: all.length,
      averageLightingScore: avgLighting,
      averageColorScore: avgColor,
      performance: {
        averageAnalysisMs: avg(this.analysisTimes),
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
      throw new LightingColorIntelligenceEngineError(
        "Lighting & Color Intelligence Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
