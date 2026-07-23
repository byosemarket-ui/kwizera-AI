import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
} from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { ImageAnalyzer } from "./image-analyzer.js";
import { ImageLearner } from "./image-learner.js";
import { ImageKnowledgeLogger } from "./image-logger.js";
import { ImageProcessor } from "./image-processor.js";
import { ImageRelationshipLinker, ImageRecommender } from "./image-recommender.js";
import { ImageScorer } from "./image-scorer.js";
import { ImagePatternStore, ImageRecordStore } from "./image-stores.js";
import {
  ImageAnalysisInput,
  ImageAnalysisRecord,
  ImageAnalysisResult,
  ImageKnowledgeEngineError,
  ImageKnowledgeStatusReport,
  ImageLearningPattern,
  ImageSearchQuery,
  VisualRecommendation,
} from "./types.js";

/**
 * Image Knowledge Engine — understands, analyzes and learns from visual knowledge.
 */
export class AiImageKnowledgeEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageKnowledgeLogger();
  readonly patterns = new ImagePatternStore();
  readonly records = new ImageRecordStore();

  private readonly analyzer = new ImageAnalyzer();
  private readonly scorer = new ImageScorer();
  private readonly recommender = new ImageRecommender();
  private readonly linker = new ImageRelationshipLinker();
  private processor: ImageProcessor | null = null;
  private learner: ImageLearner | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const imageDir = path.join(storageRoot, "knowledge", "images", "engine");
    this.logger.initialize(logDir);
    this.patterns.initialize(imageDir);
    this.records.initialize(imageDir);

    this.learner = new ImageLearner(this.patterns, this.logger);
    this.processor = new ImageProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.recommender,
      this.linker,
      this.learner,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Image Knowledge Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.knowledgeType === KnowledgeStorageType.Image);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId);
      if (read.success && read.record?.payload) {
        const payload = read.record.payload as unknown as ImageAnalysisRecord;
        if (payload.imageId) {
          this.records.upsert(payload);
        }
      }
    }

    this.foundation!.registerKnowledgeModule({
      knowledgeId: "image-knowledge",
      knowledgeName: "Image Knowledge",
      category: KnowledgeCategory.Image,
      version: "0.1.0",
      status: KnowledgeModuleStatus.Active,
      dependencies: ["knowledge-engine"],
      source: KnowledgeSource.KnowledgeModule,
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.storageRoot, "knowledge", "images"),
      accessPermissions: [
        KnowledgeAccessPermission.Read,
        KnowledgeAccessPermission.Write,
        KnowledgeAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Knowledge Engine startup complete", {
      imagesLoaded: this.records.getCount(),
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async analyzeImage(input: ImageAnalysisInput): Promise<ImageAnalysisResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getImage(imageId: string): ImageAnalysisRecord | null {
    this.ensureReady();
    return this.records.get(imageId) ?? null;
  }

  async searchImages(query: ImageSearchQuery): Promise<ImageAnalysisRecord[]> {
    this.ensureReady();
    const start = Date.now();
    const results = await this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  getRecommendations(imageId: string): VisualRecommendation[] {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(imageId);
    if (!record) return [];
    const recs = this.recommender.recommend(record);
    this.recommendationTimes.push(Date.now() - start);
    return recs;
  }

  detectRelationships(imageId: string) {
    this.ensureReady();
    const record = this.records.get(imageId);
    if (!record) return null;
    return this.linker.detectSimilar(record, this.records.getAll());
  }

  getLearnedPatterns(): ImageLearningPattern[] {
    this.ensureReady();
    return this.patterns.getAll();
  }

  buildStatusReport(): ImageKnowledgeStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.imageQualityScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      visualAnalysisStatus: "rule-based visual understanding active",
      relationshipStatus: `${all.length} images indexed for relationship detection`,
      imagesAnalyzed: all.length,
      patternsLearned: this.patterns.getCount(),
      averageQualityScore: avgQuality,
      performance: {
        averageAnalysisMs: avg(this.analysisTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRecommendationMs: avg(this.recommendationTimes),
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
    if (!this.initialized || !this.foundation) {
      throw new ImageKnowledgeEngineError("Image Knowledge Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
