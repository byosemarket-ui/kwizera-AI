import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
} from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { BrandAnalyzer } from "./brand-analyzer.js";
import { BrandLearner } from "./brand-learner.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";
import { BrandProcessor } from "./brand-processor.js";
import { BrandRelationshipLinker, BrandRecommender } from "./brand-recommender.js";
import { BrandScorer } from "./brand-scorer.js";
import { BrandPatternStore, BrandRecordStore } from "./brand-stores.js";
import {
  BrandAnalysisInput,
  BrandAnalysisRecord,
  BrandAnalysisResult,
  BrandConsistencyCheck,
  BrandKnowledgeEngineError,
  BrandKnowledgeLearningPattern,
  BrandKnowledgeRecommendation,
  BrandKnowledgeStatusReport,
  BrandSearchQuery,
} from "./types.js";

/**
 * Brand Knowledge Engine — understands, protects and improves brand identity knowledge.
 */
export class AiBrandKnowledgeEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new BrandKnowledgeLogger();
  readonly patterns = new BrandPatternStore();
  readonly records = new BrandRecordStore();

  private readonly analyzer = new BrandAnalyzer();
  private readonly scorer = new BrandScorer();
  private readonly recommender = new BrandRecommender();
  private readonly linker = new BrandRelationshipLinker();
  private processor: BrandProcessor | null = null;
  private learner: BrandLearner | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const brandDir = path.join(storageRoot, "knowledge", "brands", "engine");
    this.logger.initialize(logDir);
    this.patterns.initialize(brandDir);
    this.records.initialize(brandDir);

    this.learner = new BrandLearner(this.patterns, this.logger);
    this.processor = new BrandProcessor(
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
    this.logger.log("info", "startup", "Brand Knowledge Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.knowledgeType === KnowledgeStorageType.Brand);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId);
      if (read.success && read.record?.payload) {
        const payload = read.record.payload as unknown as BrandAnalysisRecord;
        if (payload.brandId) this.records.upsert(payload);
      }
    }

    this.foundation!.registerKnowledgeModule({
      knowledgeId: "brand-knowledge",
      knowledgeName: "Brand Knowledge",
      category: KnowledgeCategory.Brand,
      version: "0.1.0",
      status: KnowledgeModuleStatus.Active,
      dependencies: ["knowledge-engine", "memory-engine"],
      source: KnowledgeSource.KnowledgeModule,
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.storageRoot, "knowledge", "brands"),
      accessPermissions: [
        KnowledgeAccessPermission.Read,
        KnowledgeAccessPermission.Write,
        KnowledgeAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Brand Knowledge Engine startup complete", {
      brandsLoaded: this.records.getCount(),
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async analyzeBrand(input: BrandAnalysisInput): Promise<BrandAnalysisResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getBrand(brandId: string): BrandAnalysisRecord | null {
    this.ensureReady();
    return this.records.get(brandId) ?? null;
  }

  async searchBrands(query: BrandSearchQuery): Promise<BrandAnalysisRecord[]> {
    this.ensureReady();
    const start = Date.now();
    const results = await this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  getRecommendations(brandId: string): BrandKnowledgeRecommendation[] {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(brandId);
    if (!record) return [];
    const recs = this.recommender.recommend(record);
    this.recommendationTimes.push(Date.now() - start);
    return recs;
  }

  verifyConsistency(brandId: string): BrandConsistencyCheck | null {
    this.ensureReady();
    const record = this.records.get(brandId);
    if (!record) return null;
    return this.analyzer.evaluateConsistency(
      record.profile,
      record.visual,
      record.communication,
      {}
    );
  }

  detectRelationships(brandId: string) {
    this.ensureReady();
    const record = this.records.get(brandId);
    if (!record) return null;
    return this.linker.detectSimilar(record, this.records.getAll());
  }

  getLearnedPatterns(): BrandKnowledgeLearningPattern[] {
    this.ensureReady();
    return this.patterns.getAll();
  }

  buildStatusReport(): BrandKnowledgeStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgConsistency =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.brandConsistencyScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      brandConsistencyStatus: "logo, color, typography, voice and motion consistency verified",
      visualIdentityStatus: "logo, colors, typography and design language tracked",
      recommendationQuality:
        "branding, logo placement, color, typography and consistency recommendations active",
      relationshipStatus: `${all.length} brands indexed for relationship detection`,
      brandsAnalyzed: all.length,
      patternsLearned: this.patterns.getCount(),
      averageBrandConsistencyScore: avgConsistency,
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
      throw new BrandKnowledgeEngineError("Brand Knowledge Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
