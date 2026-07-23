import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { AiKnowledgeStorageEngine } from "../knowledge-storage-engine/knowledge-storage-engine.js";
import { KnowledgeSearchQueryBuilder } from "./search-query-builder.js";
import { KnowledgeResultRanker } from "./result-ranker.js";
import { RelatedKnowledgeFinder } from "./related-knowledge-finder.js";
import { KnowledgeRetrievalValidator } from "./retrieval-validator.js";
import { KnowledgeRetrievalCache } from "./retrieval-cache.js";
import { KnowledgeUsageTracker } from "./usage-tracker.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";
import {
  KnowledgeRetrievalEngineError,
  KnowledgeRetrievalResponse,
  KnowledgeRetrievalStatusReport,
  KnowledgeSearchMode,
  KnowledgeSearchQuery,
  KnowledgeSearchResponse,
  RankedKnowledgeResult,
  RelatedKnowledgeGroups,
} from "./types.js";

const EMPTY_GROUPS: RelatedKnowledgeGroups = {
  relatedKnowledge: [],
  relatedMemory: [],
  relatedProjects: [],
  relatedProducts: [],
  relatedVideos: [],
  relatedMarketing: [],
  relatedDecisions: [],
  relatedLearning: [],
  relatedWorkflows: [],
};

/**
 * Knowledge Retrieval Engine — intelligently finds, ranks and delivers stored knowledge.
 */
export class AiKnowledgeRetrievalEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageEngine: AiKnowledgeStorageEngine | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new KnowledgeRetrievalLogger();
  private readonly queryBuilder = new KnowledgeSearchQueryBuilder();
  private readonly usageTracker = new KnowledgeUsageTracker(this.logger);
  private readonly cache = new KnowledgeRetrievalCache(this.logger);
  private ranker: KnowledgeResultRanker | null = null;
  private relatedFinder: RelatedKnowledgeFinder | null = null;
  private validator: KnowledgeRetrievalValidator | null = null;

  private searchTimes: number[] = [];
  private retrievalTimes: number[] = [];
  private totalSearches = 0;
  private totalRetrievals = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageEngine = foundation.getStorageEngine();
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const retrievalDir = path.join(storageRoot, "knowledge", "retrieval");
    this.logger.initialize(logDir);
    this.usageTracker.initialize(retrievalDir);

    this.ranker = new KnowledgeResultRanker(this.usageTracker);
    this.relatedFinder = new RelatedKnowledgeFinder(this.ranker, this.logger);
    this.validator = new KnowledgeRetrievalValidator(this.logger, this.storageEngine);

    this.initialized = true;
    this.logger.log("info", "startup", "Knowledge Retrieval Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    this.startupComplete = true;
    this.logger.log("info", "startup", "Knowledge Retrieval Engine startup complete", {
      indexedRecords: this.storageEngine!.getRecordCount(),
    });
  }

  async search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResponse> {
    this.ensureReady();
    const searchStart = Date.now();
    this.totalSearches++;

    const mode = query.mode ?? KnowledgeSearchMode.Hybrid;
    const requesterId = query.requesterId ?? "knowledge-retrieval-engine";
    const diagnostics: string[] = [];

    const allEntries = this.storageEngine!.getIndexEntries();
    let candidates = this.queryBuilder.filterCandidates(allEntries, query);

    if (query.minQualityScore !== undefined || query.minConfidenceScore !== undefined) {
      candidates = await this.filterByScores(candidates, query, requesterId);
    }

    const ranked = this.ranker!.rank(candidates, query, query.relatedTo);

    const retrievalStart = Date.now();
    const results: RankedKnowledgeResult[] = [];
    let fromCache = false;

    for (const rankedResult of ranked) {
      const hydrated = await this.hydrateResult(rankedResult, requesterId);
      if (hydrated) {
        results.push(hydrated);
        if (hydrated.record) fromCache = fromCache || this.wasFromCache(rankedResult.knowledgeId);
      } else {
        diagnostics.push(`Failed to retrieve: ${rankedResult.knowledgeId}`);
      }
    }

    const retrievalMs = Date.now() - retrievalStart;
    this.retrievalTimes.push(retrievalMs);
    const searchMs = Date.now() - searchStart;
    this.searchTimes.push(searchMs);

    const relatedKnowledge: RankedKnowledgeResult[] = [];
    const recommendations: RankedKnowledgeResult[] = [];
    let relatedGroups = EMPTY_GROUPS;

    if (results.length > 0 && results[0].record) {
      relatedKnowledge.push(...this.relatedFinder!.findRelated(results[0].record, allEntries, 5));
      recommendations.push(
        ...this.relatedFinder!.recommend(
          {
            text: query.text,
            objective: query.context?.objective,
            domain: query.context?.domain,
            workflow: query.context?.workflowId,
          },
          allEntries,
          results.map((r) => r.knowledgeId),
          5
        )
      );
      relatedGroups = this.relatedFinder!.categorizeRelated(results[0].record, [
        ...relatedKnowledge,
        ...recommendations,
      ]);
    }

    this.logger.log("info", "search", "Knowledge search complete", {
      mode,
      candidates: candidates.length,
      results: results.length,
      searchMs,
      retrievalMs,
    });

    this.logger.log("info", "ranking", "Knowledge ranking complete", {
      topScore: results[0]?.ranking.compositeScore ?? 0,
      resultCount: results.length,
    });

    return {
      success: results.length > 0 || candidates.length === 0,
      mode,
      results,
      relatedKnowledge,
      recommendations,
      relatedGroups,
      searchMs,
      retrievalMs,
      totalCandidates: candidates.length,
      fromCache,
      diagnostics,
    };
  }

  async retrieve(
    knowledgeId: string,
    requesterId = "knowledge-retrieval-engine"
  ): Promise<KnowledgeRetrievalResponse> {
    this.ensureReady();
    const start = Date.now();
    this.totalRetrievals++;

    const validation = await this.validator!.validateForRetrieval(knowledgeId, requesterId);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Retrieval validation failed", {
        knowledgeId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        knowledgeId,
        retrievalMs: Date.now() - start,
        fromCache: false,
        diagnostics: validation.diagnostics,
        recoverySuggestion: validation.recoverySuggestion,
        relatedKnowledge: [],
        recommendations: [],
        relatedGroups: EMPTY_GROUPS,
      };
    }

    const indexEntry = this.storageEngine!.findIndexEntry(knowledgeId)!;
    let fromCache = false;
    let record = this.cache.get(knowledgeId, indexEntry);

    if (record) {
      fromCache = true;
    } else {
      const read = await this.storageEngine!.getRecord(knowledgeId, requesterId);
      record = read.record!;
      this.cache.set(knowledgeId, record, indexEntry);
    }

    this.usageTracker.recordAccess(knowledgeId);

    const allEntries = this.storageEngine!.getIndexEntries();
    const relatedKnowledge = this.relatedFinder!.findRelated(record, allEntries, 8);
    const recommendations = this.relatedFinder!.recommend(
      {
        text: record.title,
        objective: record.classification.topic,
        domain: record.classification.businessDomain,
        workflow: record.category,
      },
      allEntries,
      [knowledgeId, ...relatedKnowledge.map((r) => r.knowledgeId)],
      5
    );
    const relatedGroups = this.relatedFinder!.categorizeRelated(record, [
      ...relatedKnowledge,
      ...recommendations,
    ]);

    const retrievalMs = Date.now() - start;
    this.retrievalTimes.push(retrievalMs);

    this.logger.log("info", "retrieve", "Knowledge retrieved", {
      knowledgeId,
      retrievalMs,
      fromCache,
      related: relatedKnowledge.length,
    });

    return {
      success: true,
      knowledgeId,
      record,
      relatedKnowledge,
      recommendations,
      relatedGroups,
      retrievalMs,
      fromCache,
      diagnostics: [],
    };
  }

  invalidateCache(knowledgeId?: string): void {
    if (knowledgeId) {
      this.cache.invalidate(knowledgeId);
    } else {
      this.cache.clear();
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  buildStatusReport(): KnowledgeRetrievalStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const cacheStats = this.cache.getStats();
    const knownIssues: string[] = [];

    if (!this.storageEngine?.isStorageAvailable()) {
      knownIssues.push("Storage unavailable for retrieval");
    }

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (!this.storageEngine?.isStorageAvailable()) readinessScore -= 20;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      searchPerformance: {
        averageSearchMs: avg(this.searchTimes),
        averageRetrievalMs: avg(this.retrievalTimes),
        lastSearchMs: this.searchTimes[this.searchTimes.length - 1] ?? 0,
        lastRetrievalMs: this.retrievalTimes[this.retrievalTimes.length - 1] ?? 0,
      },
      rankingQuality: "multi-factor composite scoring with quality-first ordering",
      recommendationQuality: "relationship and context-aware recommendations active",
      cacheStatus: cacheStats,
      validationStatus: "pre-retrieval integrity and relationship validation active",
      totalSearches: this.totalSearches,
      totalRetrievals: this.totalRetrievals,
      knownIssues,
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  private async filterByScores(
    candidates: ReturnType<AiKnowledgeStorageEngine["getIndexEntries"]>,
    query: KnowledgeSearchQuery,
    requesterId: string
  ) {
    const filtered = [];
    for (const entry of candidates) {
      const read = await this.storageEngine!.getRecord(entry.knowledgeId, requesterId);
      if (!read.record) continue;
      if (query.minQualityScore !== undefined && read.record.qualityScore < query.minQualityScore) continue;
      if (query.minConfidenceScore !== undefined && read.record.confidenceScore < query.minConfidenceScore) {
        continue;
      }
      filtered.push(entry);
    }
    return filtered;
  }

  private async hydrateResult(
    ranked: RankedKnowledgeResult,
    requesterId: string
  ): Promise<RankedKnowledgeResult | null> {
    const validation = await this.validator!.validateForRetrieval(ranked.knowledgeId, requesterId);
    if (!validation.valid) return null;

    const indexEntry = this.storageEngine!.findIndexEntry(ranked.knowledgeId)!;
    let record = this.cache.get(ranked.knowledgeId, indexEntry);

    if (!record) {
      const read = await this.storageEngine!.getRecord(ranked.knowledgeId, requesterId);
      if (!read.success || !read.record) return null;
      record = read.record;
      this.cache.set(ranked.knowledgeId, record, indexEntry);
    }

    this.usageTracker.recordAccess(ranked.knowledgeId);

    const enrichedRanking = this.ranker!.rank([indexEntry], {}, undefined)[0]?.ranking ?? ranked.ranking;
    if (record) {
      enrichedRanking.qualityScore = record.qualityScore;
      enrichedRanking.confidenceScore = record.confidenceScore;
      enrichedRanking.sourceReliability = record.sourceReliability;
      enrichedRanking.compositeScore = Math.min(
        100,
        Math.round(
          enrichedRanking.compositeScore * 0.6 +
            record.qualityScore * 0.2 +
            record.confidenceScore * 0.15 +
            record.sourceReliability * 0.05
        )
      );
    }

    return { ...ranked, record, ranking: enrichedRanking };
  }

  private wasFromCache(knowledgeId: string): boolean {
    const indexEntry = this.storageEngine!.findIndexEntry(knowledgeId);
    return Boolean(indexEntry && this.cache.get(knowledgeId, indexEntry));
  }

  private ensureReady(): void {
    if (!this.initialized || !this.storageEngine || !this.foundation) {
      throw new KnowledgeRetrievalEngineError(
        "Knowledge Retrieval Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
