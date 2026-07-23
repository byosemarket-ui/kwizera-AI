import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { ImageAnalysisAnalyzer } from "./image-analysis-analyzer.js";
import { ImageAnalysisCompletenessDetector } from "./image-analysis-completeness.js";
import { ImageAnalysisLinker } from "./image-analysis-linker.js";
import { ImageAnalysisLogger } from "./image-analysis-logger.js";
import { ImageAnalysisProcessor } from "./image-analysis-processor.js";
import { ImageAnalysisScorer } from "./image-analysis-scorer.js";
import { ImageAnalysisRecordStore } from "./image-analysis-stores.js";
import {
  ImageAnalysisEngineInput,
  ImageAnalysisEngineResult,
  ImageAnalysisEngineStatusReport,
  ImageAnalysisIntelligenceRecord,
  ImageAnalysisSearchQuery,
  ImageAnalysisEngineError,
  ImageFileFormat,
  ImageAnalysisType,
  ImageColorSpace,
  ImageCompressionType,
} from "./types.js";

/**
 * Image Analysis Engine — collects, organizes and analyzes technical and visual image information
 * before understanding, enhancement or generation begins.
 */
export class AiImageAnalysisEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private storageRoot = "";
  private engineDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageAnalysisLogger();
  readonly records = new ImageAnalysisRecordStore();

  private readonly analyzer = new ImageAnalysisAnalyzer();
  private readonly completeness = new ImageAnalysisCompletenessDetector();
  private readonly scorer = new ImageAnalysisScorer();
  private readonly linker = new ImageAnalysisLinker();
  private processor: ImageAnalysisProcessor | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private classificationTimes: number[] = [];

  initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.engineDir = path.join(foundation.getIntelligenceRoot(), "analysis", "engine");

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);
    this.records.initialize(this.engineDir);

    this.processor = new ImageAnalysisProcessor(
      foundation,
      this.analyzer,
      this.completeness,
      this.scorer,
      this.linker,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Image Analysis Engine initialized", { storageRoot, engineDir: this.engineDir });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "image-analysis-engine",
      moduleName: "Image Analysis Engine",
      category: ImageIntelligenceCategory.ImageAnalysis,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: ["image-engine", "knowledge-engine", "memory-engine"],
      qualityScore: 92,
      confidenceScore: 90,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "analysis"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Write,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Analysis Engine startup complete", {
      imagesLoaded: this.records.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async analyzeImage(input: ImageAnalysisEngineInput): Promise<ImageAnalysisEngineResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getImage(imageId: string): ImageAnalysisIntelligenceRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  searchImages(query: ImageAnalysisSearchQuery): ImageAnalysisIntelligenceRecord[] {
    this.ensureReady();
    const start = Date.now();
    const results = this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  detectRelationships(imageId: string): ImageAnalysisIntelligenceRecord["relationships"] | null {
    this.ensureReady();
    const record = this.records.get(imageId);
    if (!record) return null;
    return this.linker.detectRelationships(
      record,
      this.records.getAll(),
      record.relationships.relatedKnowledge,
      record.relationships.relatedMemory
    );
  }

  async repairImage(imageId: string): Promise<ImageAnalysisEngineResult | null> {
    this.ensureReady();
    const existing = this.records.get(imageId);
    if (!existing) return null;

    const repairedInput: ImageAnalysisEngineInput = {
      imageId,
      imageName: existing.technical.imageName,
      filePath: existing.technical.filePath,
      fileFormat: existing.technical.fileFormat,
      fileSizeBytes: existing.technical.fileSizeBytes > 0 ? existing.technical.fileSizeBytes : 512000,
      width: existing.technical.width,
      height: existing.technical.height,
      colorSpace: existing.technical.colorSpace,
      bitDepth: existing.technical.bitDepth,
      compressionType: existing.technical.compressionType,
      hasTransparency: existing.technical.hasTransparency,
      metadata: Object.keys(existing.technical.metadata).length
        ? existing.technical.metadata
        : { source: "repair-pipeline" },
      creationDate: existing.technical.creationDate ?? new Date().toISOString(),
      lastModifiedDate: existing.technical.lastModifiedDate ?? new Date().toISOString(),
      visual: existing.visual,
      content: existing.content,
      imageType: existing.classification.imageType,
      category: existing.classification.category,
      subcategory: existing.classification.subcategory,
      creativeStyle: existing.classification.creativeStyle,
      product: existing.content.products[0] ?? existing.relationships.relatedProducts[0],
      brand: existing.relationships.relatedBrands[0],
      tags: existing.tags.length ? existing.tags : ["repaired"],
      keywords: existing.keywords.length ? existing.keywords : [existing.technical.imageName],
      relatedKnowledge: existing.relationships.relatedKnowledge,
      relatedMemory: existing.relationships.relatedMemory,
      relatedProjects: existing.relationships.relatedProjects,
      relatedImages: existing.relationships.relatedImages,
    };

    this.logger.log("info", "validation", "Repairing image analysis record", { imageId });
    return this.analyzeImage(repairedInput);
  }

  buildStatusReport(): ImageAnalysisEngineStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgCompleteness =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.imageCompletenessScore, 0) / all.length)
        : 0;
    const avgConfidence =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.analysisConfidenceScore, 0) / all.length)
        : 0;

    const integration = this.foundation?.integration.getStatus();

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!integration?.knowledgeEngine) readinessScore -= 10;
    if (!integration?.memoryEngine) readinessScore -= 5;
    if (!integration?.productIntelligenceEngine) readinessScore -= 5;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      classificationStatus:
        "product, lifestyle, marketing, logo, banner, poster, screenshot, background classification active",
      relationshipStatus: `${all.length} images indexed for relationship detection`,
      completenessStatus:
        "image completeness, technical quality, visual quality, and confidence scoring active",
      knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
      memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
      productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
      imagesAnalyzed: all.length,
      averageCompletenessScore: avgCompleteness,
      averageConfidenceScore: avgConfidence,
      performance: {
        averageAnalysisMs: avg(this.analysisTimes),
        averageSearchMs: avg(this.searchTimes),
        averageClassificationMs: avg(this.classificationTimes),
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

  getEngineDir(): string {
    return this.engineDir;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation || !this.processor) {
      throw new ImageAnalysisEngineError("Image Analysis Engine not initialized", "NOT_INITIALIZED");
    }
  }
}

// Re-export enums used by validation samples
export { ImageFileFormat, ImageAnalysisType, ImageColorSpace, ImageCompressionType };
