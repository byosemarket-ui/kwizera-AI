import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
} from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { LanguageAnalyzer } from "./language-analyzer.js";
import { LanguageLearner } from "./language-learner.js";
import { LanguageKnowledgeLogger } from "./language-logger.js";
import { LanguageProcessor } from "./language-processor.js";
import { LanguageRelationshipLinker, LanguageRecommender } from "./language-recommender.js";
import { LanguageScorer } from "./language-scorer.js";
import { LanguagePatternStore, LanguageRecordStore } from "./language-stores.js";
import {
  KnowledgeSupportedLanguage,
  LanguageAnalysisInput,
  LanguageAnalysisRecord,
  LanguageAnalysisResult,
  LanguageKnowledgeEngineError,
  LanguageKnowledgeLearningPattern,
  LanguageKnowledgeRecommendation,
  LanguageKnowledgeStatusReport,
  LanguageSearchQuery,
} from "./types.js";

/**
 * Language Knowledge Engine — understands and improves language, writing and marketing communication.
 */
export class AiLanguageKnowledgeEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new LanguageKnowledgeLogger();
  readonly patterns = new LanguagePatternStore();
  readonly records = new LanguageRecordStore();

  private readonly analyzer = new LanguageAnalyzer();
  private readonly scorer = new LanguageScorer();
  private readonly recommender = new LanguageRecommender();
  private readonly linker = new LanguageRelationshipLinker();
  private processor: LanguageProcessor | null = null;
  private learner: LanguageLearner | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const languageDir = path.join(storageRoot, "knowledge", "language", "engine");
    this.logger.initialize(logDir);
    this.patterns.initialize(languageDir);
    this.records.initialize(languageDir);

    this.learner = new LanguageLearner(this.patterns, this.logger);
    this.processor = new LanguageProcessor(
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
    this.logger.log("info", "startup", "Language Knowledge Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.knowledgeType === KnowledgeStorageType.Language);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId);
      if (read.success && read.record?.payload) {
        const payload = read.record.payload as unknown as LanguageAnalysisRecord;
        if (payload.languageId) this.records.upsert(payload);
      }
    }

    this.foundation!.registerKnowledgeModule({
      knowledgeId: "language-knowledge",
      knowledgeName: "Language Knowledge",
      category: KnowledgeCategory.Language,
      version: "0.1.0",
      status: KnowledgeModuleStatus.Active,
      dependencies: ["knowledge-engine", "memory-engine"],
      source: KnowledgeSource.KnowledgeModule,
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.storageRoot, "knowledge", "language"),
      accessPermissions: [
        KnowledgeAccessPermission.Read,
        KnowledgeAccessPermission.Write,
        KnowledgeAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Language Knowledge Engine startup complete", {
      recordsLoaded: this.records.getCount(),
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async analyzeLanguage(input: LanguageAnalysisInput): Promise<LanguageAnalysisResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  detectLanguage(text: string, hint?: KnowledgeSupportedLanguage): KnowledgeSupportedLanguage {
    this.ensureReady();
    return this.analyzer.detectLanguage(text, hint);
  }

  getLanguageRecord(languageId: string): LanguageAnalysisRecord | null {
    this.ensureReady();
    return this.records.get(languageId) ?? null;
  }

  async searchLanguages(query: LanguageSearchQuery): Promise<LanguageAnalysisRecord[]> {
    this.ensureReady();
    const start = Date.now();
    const results = await this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  getRecommendations(languageId: string): LanguageKnowledgeRecommendation[] {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(languageId);
    if (!record) return [];
    const recs = this.recommender.recommend(record);
    this.recommendationTimes.push(Date.now() - start);
    return recs;
  }

  detectRelationships(languageId: string) {
    this.ensureReady();
    const record = this.records.get(languageId);
    if (!record) return null;
    return this.linker.detectSimilar(record, this.records.getAll());
  }

  getLearnedPatterns(): LanguageKnowledgeLearningPattern[] {
    this.ensureReady();
    return this.patterns.getAll();
  }

  buildStatusReport(): LanguageKnowledgeStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgGrammar =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.grammarScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      grammarStatus: "grammar, vocabulary, sentence structure and tone analyzed",
      marketingLanguageStatus: "headlines, hooks, CTA, scripts and captions tracked",
      relationshipStatus: `${all.length} language records indexed for relationship detection`,
      recordsAnalyzed: all.length,
      patternsLearned: this.patterns.getCount(),
      averageGrammarScore: avgGrammar,
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
      throw new LanguageKnowledgeEngineError(
        "Language Knowledge Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
