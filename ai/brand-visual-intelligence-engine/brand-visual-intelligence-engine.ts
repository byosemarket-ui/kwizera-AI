import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { BrandVisualAnalyzer } from "./brand-visual-analyzer.js";
import { BrandVisualLinker } from "./brand-visual-linker.js";
import { BrandVisualLogger } from "./brand-visual-logger.js";
import { BrandVisualProcessor } from "./brand-visual-processor.js";
import { BrandVisualScorer } from "./brand-visual-scorer.js";
import { BrandVisualIntelligenceRecordStore } from "./brand-visual-stores.js";
import {
  BrandVisualIntelligenceEngineError,
  BrandVisualIntelligenceEngineStatusReport,
  BrandVisualIntelligenceInput,
  BrandVisualIntelligenceRecord,
  BrandVisualIntelligenceResult,
  BrandVisualIntelligenceSearchQuery,
} from "./types.js";

/**
 * Brand Visual Intelligence Engine — understands, validates and protects brand visual identity.
 */
export class AiBrandVisualIntelligenceEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new BrandVisualLogger();
  readonly records = new BrandVisualIntelligenceRecordStore();

  private readonly analyzer = new BrandVisualAnalyzer();
  private readonly scorer = new BrandVisualScorer();
  private readonly linker = new BrandVisualLinker();
  private processor: BrandVisualProcessor | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private relationshipTimes: number[] = [];

  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "brand-visual", "engine");

    this.logger.initialize(path.join(storageRoot, "logs"));
    this.records.initialize(this.engineDir);

    this.processor = new BrandVisualProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Brand Visual Intelligence Engine initialized", {
      engineDir: this.engineDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "brand-visual-intelligence",
      moduleName: "Brand Visual Intelligence",
      category: ImageIntelligenceCategory.BrandVisual,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: [
        "image-engine",
        "image-analysis-engine",
        "image-understanding-engine",
        "object-detection-intelligence",
        "knowledge-engine",
      ],
      qualityScore: 92,
      confidenceScore: 90,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "brand-visual"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Write,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Brand Visual Intelligence Engine startup complete", {
      recordsLoaded: this.records.getCount(),
    });
  }

  async analyzeBrandVisual(input: BrandVisualIntelligenceInput): Promise<BrandVisualIntelligenceResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getBrandVisual(imageId: string): BrandVisualIntelligenceRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  getBrandRecords(brandName: string): BrandVisualIntelligenceRecord[] {
    this.ensureReady();
    return this.records.getByBrand(brandName);
  }

  searchBrandVisual(query: BrandVisualIntelligenceSearchQuery): BrandVisualIntelligenceRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(imageId: string): BrandVisualIntelligenceRecord["relationships"] | null {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(imageId);
    if (!record) return null;

    const analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    const understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
    const detection = this.foundation!.getObjectDetectionIntelligenceEngine().getDetection(imageId);
    if (!analysis || !understanding || !detection) return record.relationships;

    const updated = this.linker.detectRelationships(
      record,
      this.records.getAll(),
      analysis,
      understanding,
      detection,
      record.relationships.relatedProjects,
      record.relationships.relatedKnowledge
    );
    this.relationshipTimes.push(Date.now() - start);
    return updated;
  }

  async repairBrandVisual(imageId: string): Promise<BrandVisualIntelligenceResult | null> {
    this.ensureReady();

    let analysis = this.foundation!.getImageAnalysisEngine().getImage(imageId);
    let understanding = this.foundation!.getImageUnderstandingEngine().getUnderstanding(imageId);
    let detection = this.foundation!.getObjectDetectionIntelligenceEngine().getDetection(imageId);

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

    if (!detection?.validated) {
      const repaired = await this.foundation!.getObjectDetectionIntelligenceEngine().repairDetection(imageId);
      if (!repaired?.success) return null;
      detection = this.foundation!.getObjectDetectionIntelligenceEngine().getDetection(imageId);
      if (!detection) return null;
    }

    const lightingColor = this.foundation!.getLightingColorIntelligenceEngine().getLightingColor(imageId);
    if (!lightingColor?.validated) {
      await this.foundation!.getLightingColorIntelligenceEngine().repairLightingColor(imageId);
    }

    this.logger.log("info", "validation", "Repairing brand visual intelligence", { imageId });
    return this.analyzeBrandVisual({
      imageId,
      relatedKnowledge: understanding.relationships.relatedKnowledge,
      relatedProjects: understanding.relationships.relatedProjects,
    });
  }

  buildStatusReport(): BrandVisualIntelligenceEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgConsistency =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.brandConsistencyScore, 0) / all.length)
        : 0;
    const avgLogo =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.logoQualityScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.foundation?.getImageAnalysisEngine().isStartupComplete()) readinessScore -= 7;
    if (!this.foundation?.getImageUnderstandingEngine().isStartupComplete()) readinessScore -= 7;
    if (!this.foundation?.getObjectDetectionIntelligenceEngine().isStartupComplete()) readinessScore -= 7;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      brandAnalysisStatus: "brand profile, identity, colors, typography and visual style analyzed",
      logoValidationStatus: "logo visibility, position, size, contrast, safe area and consistency validated",
      colorValidationStatus: "primary, secondary, accent, background, text and CTA colors prepared",
      typographyStatus: "primary, secondary fonts and heading, body, CTA styles prepared",
      relationshipStatus: `${all.length} brand visual records indexed`,
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      brandsAnalyzed: all.length,
      averageConsistencyScore: avgConsistency,
      averageLogoScore: avgLogo,
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
      throw new BrandVisualIntelligenceEngineError(
        "Brand Visual Intelligence Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
