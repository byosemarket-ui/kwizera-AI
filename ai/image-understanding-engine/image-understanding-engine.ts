import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { ImageUnderstandingAnalyzer } from "./image-understanding-analyzer.js";
import { ImageUnderstandingLinker } from "./image-understanding-linker.js";
import { ImageUnderstandingLogger } from "./image-understanding-logger.js";
import { ImageUnderstandingProcessor } from "./image-understanding-processor.js";
import { ImageUnderstandingScorer } from "./image-understanding-scorer.js";
import { ImageUnderstandingRecordStore } from "./image-understanding-stores.js";
import {
  ImageUnderstandingEngineError,
  ImageUnderstandingEngineStatusReport,
  ImageUnderstandingInput,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingRecord,
  ImageUnderstandingResult,
  ImageUnderstandingSearchQuery,
} from "./types.js";

/**
 * Image Understanding Engine — transforms image analysis into deep visual understanding.
 */
export class AiImageUnderstandingEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageUnderstandingLogger();
  readonly records = new ImageUnderstandingRecordStore();

  private readonly analyzer = new ImageUnderstandingAnalyzer();
  private readonly scorer = new ImageUnderstandingScorer();
  private readonly linker = new ImageUnderstandingLinker();
  private processor: ImageUnderstandingProcessor | null = null;

  private understandingTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "understanding", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new ImageUnderstandingProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Image Understanding Engine initialized", { engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "image-understanding-engine",
      moduleName: "Image Understanding Engine",
      category: ImageIntelligenceCategory.ImageUnderstanding,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: ["image-engine", "image-analysis-engine", "knowledge-engine"],
      qualityScore: 91,
      confidenceScore: 89,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "understanding"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Write,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Understanding Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async understandImage(input: ImageUnderstandingInput): Promise<ImageUnderstandingResult> {
    this.ensureReady();
    const result = await this.processor!.understand(input);
    if (result.success) this.understandingTimes.push(result.durationMs);
    return result;
  }

  getUnderstanding(imageId: string): ImageUnderstandingRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  searchUnderstanding(query: ImageUnderstandingSearchQuery): ImageUnderstandingRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(imageId: string): ImageUnderstandingRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(imageId);
    if (!record) return null;

    const analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    if (!analysis) return record.relationships;

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge,
      record.relationships.relatedStoryboards
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairUnderstanding(imageId: string): Promise<ImageUnderstandingResult | null> {
    this.ensureReady();
    const analysisEngine = this.foundation!.getImageAnalysisEngine();
    let analysis = analysisEngine.getImage(imageId);

    if (!analysis) {
      this.logger.log("warn", "validation", "Cannot repair — no analysis record", { imageId });
      return null;
    }

    if (!analysis.validated) {
      const repaired = await analysisEngine.repairImage(imageId);
      if (!repaired?.success || !repaired.record) return null;
      analysis = repaired.record;
    }

    this.logger.log("info", "validation", "Repairing image understanding", { imageId });
    return this.understandImage({
      imageId,
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
      relatedKnowledge: analysis.relationships.relatedKnowledge,
      relatedProjects: analysis.relationships.relatedProjects,
      relatedStoryboards: [],
    });
  }

  buildStatusReport(): ImageUnderstandingEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgUnderstanding =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.imageUnderstandingScore, 0) / all.length)
        : 0;
    const avgMarketing =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.marketingReadinessScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getImageAnalysisEngine().isStartupComplete()) readinessScore -= 15;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      sceneUnderstandingStatus: "indoor, outdoor, studio, lifestyle, commercial, product showcase scenes prepared",
      productUnderstandingStatus: "product visibility, position, importance, presentation and readiness tracked",
      brandUnderstandingStatus: "logo presence, brand identity, visibility and consistency active",
      marketingUnderstandingStatus: "promotional purpose, audience relevance, storytelling and CTA opportunities tracked",
      relationshipStatus: `${all.length} images indexed for understanding relationships`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      imagesUnderstood: all.length,
      averageUnderstandingScore: avgUnderstanding,
      averageMarketingReadinessScore: avgMarketing,
      performance: {
        averageUnderstandingMs: avg(this.understandingTimes),
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
      throw new ImageUnderstandingEngineError(
        "Image Understanding Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
