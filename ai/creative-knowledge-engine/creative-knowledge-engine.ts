import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
} from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { CreativeAnalyzer } from "./creative-analyzer.js";
import { CreativeLearner } from "./creative-learner.js";
import { CreativeKnowledgeLogger } from "./creative-logger.js";
import { CreativeProcessor } from "./creative-processor.js";
import { CreativeRelationshipLinker, CreativeRecommender } from "./creative-recommender.js";
import { CreativeScorer } from "./creative-scorer.js";
import { CreativePatternStore, CreativeRecordStore } from "./creative-stores.js";
import {
  CreativeAnalysisInput,
  CreativeAnalysisRecord,
  CreativeAnalysisResult,
  CreativeKnowledgeEngineError,
  CreativeKnowledgeLearningPattern,
  CreativeKnowledgeRecommendation,
  CreativeKnowledgeStatusReport,
  CreativeSearchQuery,
} from "./types.js";

/**
 * Creative Knowledge Engine — central creative intelligence for visual content design.
 */
export class AiCreativeKnowledgeEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new CreativeKnowledgeLogger();
  readonly patterns = new CreativePatternStore();
  readonly records = new CreativeRecordStore();

  private readonly analyzer = new CreativeAnalyzer();
  private readonly scorer = new CreativeScorer();
  private readonly recommender = new CreativeRecommender();
  private readonly linker = new CreativeRelationshipLinker();
  private processor: CreativeProcessor | null = null;
  private learner: CreativeLearner | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const creativeDir = path.join(storageRoot, "knowledge", "creative", "engine");
    this.logger.initialize(logDir);
    this.patterns.initialize(creativeDir);
    this.records.initialize(creativeDir);

    this.learner = new CreativeLearner(this.patterns, this.logger);
    this.processor = new CreativeProcessor(
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
    this.logger.log("info", "startup", "Creative Knowledge Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.knowledgeType === KnowledgeStorageType.Creative);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId);
      if (read.success && read.record?.payload) {
        const payload = read.record.payload as unknown as CreativeAnalysisRecord;
        if (payload.creativeId) this.records.upsert(payload);
      }
    }

    this.foundation!.registerKnowledgeModule({
      knowledgeId: "creative-knowledge",
      knowledgeName: "Creative Knowledge",
      category: KnowledgeCategory.Creative,
      version: "0.1.0",
      status: KnowledgeModuleStatus.Active,
      dependencies: ["knowledge-engine", "memory-engine"],
      source: KnowledgeSource.KnowledgeModule,
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.storageRoot, "knowledge", "creative"),
      accessPermissions: [
        KnowledgeAccessPermission.Read,
        KnowledgeAccessPermission.Write,
        KnowledgeAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Creative Knowledge Engine startup complete", {
      projectsLoaded: this.records.getCount(),
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async analyzeCreative(input: CreativeAnalysisInput): Promise<CreativeAnalysisResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getCreative(creativeId: string): CreativeAnalysisRecord | null {
    this.ensureReady();
    return this.records.get(creativeId) ?? null;
  }

  async searchCreatives(query: CreativeSearchQuery): Promise<CreativeAnalysisRecord[]> {
    this.ensureReady();
    const start = Date.now();
    const results = await this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  getRecommendations(creativeId: string): CreativeKnowledgeRecommendation[] {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(creativeId);
    if (!record) return [];
    const recs = this.recommender.recommend(record);
    this.recommendationTimes.push(Date.now() - start);
    return recs;
  }

  detectRelationships(creativeId: string) {
    this.ensureReady();
    const record = this.records.get(creativeId);
    if (!record) return null;
    return this.linker.detectSimilar(record, this.records.getAll());
  }

  getLearnedPatterns(): CreativeKnowledgeLearningPattern[] {
    this.ensureReady();
    return this.patterns.getAll();
  }

  buildStatusReport(): CreativeKnowledgeStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgQuality =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.creativeQualityScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      designKnowledgeStatus: "composition, layout, typography, color harmony and hierarchy tracked",
      storytellingStatus: "story structure, scene flow, emotional journey and visual rhythm analyzed",
      animationKnowledgeStatus: "motion principles, timing, easing and animation quality tracked",
      relationshipStatus: `${all.length} creative projects indexed for relationship detection`,
      projectsAnalyzed: all.length,
      patternsLearned: this.patterns.getCount(),
      averageCreativeQualityScore: avgQuality,
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
      throw new CreativeKnowledgeEngineError(
        "Creative Knowledge Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
