import crypto from "node:crypto";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { BrandAnalyzer } from "./brand-analyzer.js";
import { BrandLearner } from "./brand-learner.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";
import { BrandRelationshipLinker, BrandRecommender } from "./brand-recommender.js";
import { BrandScorer } from "./brand-scorer.js";
import { BrandPatternStore, BrandRecordStore } from "./brand-stores.js";
import {
  BrandAnalysisInput,
  BrandAnalysisRecord,
  BrandAnalysisResult,
  BrandSearchQuery,
} from "./types.js";

export class BrandProcessor {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly analyzer: BrandAnalyzer,
    private readonly scorer: BrandScorer,
    private readonly recommender: BrandRecommender,
    private readonly linker: BrandRelationshipLinker,
    private readonly learner: BrandLearner,
    private readonly records: BrandRecordStore,
    private readonly logger: BrandKnowledgeLogger
  ) {}

  async analyze(input: BrandAnalysisInput): Promise<BrandAnalysisResult> {
    const start = Date.now();

    const analysis = this.analyzer.analyze(input);
    const scores = this.scorer.computeScores(
      analysis.profile,
      analysis.visual,
      analysis.communication,
      analysis.consistency
    );

    const validation = this.scorer.isAnalysisValid(
      analysis.profile,
      scores,
      analysis.consistency
    );
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Brand analysis rejected", {
        brandName: analysis.profile.brandName,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Inconsistent or incomplete brand knowledge rejected",
      };
    }

    const brandId =
      input.brandId ?? analysis.profile.brandId ?? `brand-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const knowledgeId = `brand-knowledge-${brandId}`;
    analysis.profile.brandId = brandId;

    const existing = this.records.get(brandId);
    const version = existing ? existing.version + 1 : 1;

    const draft: BrandAnalysisRecord = {
      brandId,
      knowledgeId,
      profile: analysis.profile,
      visual: analysis.visual,
      communication: analysis.communication,
      marketingStyle: analysis.marketingStyle,
      history: analysis.history,
      consistency: analysis.consistency,
      scores,
      relationships: {
        relatedProducts: [],
        relatedCampaigns: [],
        relatedVideos: [],
        relatedImages: [],
        relatedMarketingStrategies: [],
        relatedCreativeStyles: [],
        relatedCustomerSegments: [],
        relatedProjects: [],
      },
      recommendations: [],
      tags: input.tags ?? [],
      keywords: input.keywords ?? [
        analysis.profile.brandName,
        analysis.profile.industry,
        analysis.profile.brandPositioning,
      ],
      language: input.language ?? "en",
      analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.recommendations = this.recommender.recommend(draft);
    draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());

    this.logger.log("info", "consistency", "Brand consistency verified", {
      brandId,
      overall: analysis.consistency.overallConsistency,
      issues: analysis.consistency.inconsistencies.length,
    });

    const storage = this.foundation.getStorageEngine();
    const stored = await storage.storeRecord({
      knowledgeId,
      knowledgeType: KnowledgeStorageType.Brand,
      category: "brand",
      title: analysis.profile.brandName,
      description: this.buildKnowledgeDescription(draft),
      summary: `Brand analysis: ${analysis.profile.industry} — consistency ${scores.brandConsistencyScore}`,
      source: "brand-knowledge-engine",
      tags: [
        ...(input.tags ?? []),
        analysis.profile.industry,
        analysis.marketingStyle,
      ],
      keywords: [
        ...draft.keywords,
        ...analysis.visual.brandColors,
        analysis.visual.typography,
      ].filter(Boolean),
      relatedKnowledge: input.relatedKnowledge ?? [],
      relatedMemory: input.relatedMemory ?? [],
      qualityScore: scores.brandConsistencyScore,
      confidenceScore: scores.aiConfidenceScore,
      sourceReliability: 85,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? KnowledgeVerificationStatus.Verified
          : KnowledgeVerificationStatus.Pending,
      payload: draft as unknown as Record<string, unknown>,
    });

    if (!stored.success) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: stored.validation?.diagnostics ?? ["Knowledge storage failed"],
        message: stored.validation?.message,
      };
    }

    const graph = this.foundation.getGraphEngine();
    this.ensureGraphNode(graph, knowledgeId, draft.profile.brandName, this.buildKnowledgeDescription(draft));

    for (const relatedBrandId of [
      ...draft.relationships.relatedCreativeStyles,
      ...draft.relationships.relatedMarketingStrategies,
    ]) {
      const related = this.records.get(relatedBrandId);
      if (!related) continue;
      this.ensureGraphNode(
        graph,
        related.knowledgeId,
        related.profile.brandName,
        this.buildKnowledgeDescription(related)
      );
      graph.createRelationship({
        sourceId: knowledgeId,
        targetId: related.knowledgeId,
        relationshipType: KnowledgeRelationType.SimilarTo,
        evidence: `Similar brand detected during analysis of ${brandId}`,
        strengthScore: 72,
        confidenceScore: 78,
      });
    }

    for (const relatedId of input.relatedKnowledge ?? []) {
      const indexEntry = storage.findIndexEntry(relatedId);
      if (!indexEntry) continue;
      graph.createNode(relatedId, KnowledgeNodeType.Brand, indexEntry.title, indexEntry.searchableText);
      graph.createRelationship({
        sourceId: knowledgeId,
        targetId: relatedId,
        relationshipType: KnowledgeRelationType.RelatedTo,
        evidence: `Knowledge link from brand analysis ${brandId}`,
        strengthScore: 80,
        confidenceScore: 85,
      });
    }

    await graph.evolveGraph(knowledgeId);
    this.learner.learnFromAnalysis(draft);
    this.records.upsert(draft);

    this.logger.log("info", "analysis", "Brand analyzed and stored", {
      brandId,
      knowledgeId,
      consistency: scores.brandConsistencyScore,
      version,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  async search(query: BrandSearchQuery): Promise<BrandAnalysisRecord[]> {
    const retrieval = this.foundation.getRetrievalEngine();
    const search = await retrieval.search({
      mode: KnowledgeSearchMode.Hybrid,
      knowledgeType: KnowledgeStorageType.Brand,
      text: query.text ?? query.brandName,
      keywords: query.colors ?? (query.typography ? [query.typography] : undefined),
      limit: query.limit ?? 20,
    });

    let results = search.results
      .map((r) =>
        r.record?.payload ? (r.record.payload as unknown as BrandAnalysisRecord) : undefined
      )
      .filter((r): r is BrandAnalysisRecord => Boolean(r));

    if (results.length === 0) {
      results = this.filterLocal(this.records.getAll(), query);
    }

    return results;
  }

  private filterLocal(records: BrandAnalysisRecord[], query: BrandSearchQuery): BrandAnalysisRecord[] {
    return records.filter((r) => {
      if (query.brandName && !r.profile.brandName.toLowerCase().includes(query.brandName.toLowerCase())) {
        return false;
      }
      if (query.industry && r.profile.industry !== query.industry) return false;
      if (query.typography && !r.visual.typography.toLowerCase().includes(query.typography.toLowerCase())) {
        return false;
      }
      if (query.logo && !r.visual.logo.toLowerCase().includes(query.logo.toLowerCase())) return false;
      if (query.marketingStyle && r.marketingStyle !== query.marketingStyle) return false;
      if (query.audience && !r.profile.brandTargetAudience.toLowerCase().includes(query.audience.toLowerCase())) {
        return false;
      }
      if (query.language && r.language !== query.language) return false;
      if (query.minConsistency && r.consistency.overallConsistency < query.minConsistency) return false;
      if (query.colors?.length) {
        if (!query.colors.some((c) => r.visual.brandColors.includes(c))) return false;
      }
      return true;
    });
  }

  private ensureGraphNode(
    graph: ReturnType<AiKnowledgeFoundation["getGraphEngine"]>,
    nodeId: string,
    title: string,
    searchableText: string
  ): void {
    if (!graph.getGraph().nodes[nodeId]) {
      graph.createNode(nodeId, KnowledgeNodeType.Brand, title, searchableText);
    }
  }

  private buildKnowledgeDescription(record: BrandAnalysisRecord): string {
    return [
      `Brand analysis for ${record.profile.brandName}`,
      `Industry: ${record.profile.industry}`,
      `Positioning: ${record.profile.brandPositioning}`,
      `Audience: ${record.profile.brandTargetAudience}`,
      `Consistency: ${record.consistency.overallConsistency}`,
      `Visual: ${record.visual.designLanguage}`,
      `Voice: ${record.communication.brandVoice}`,
      `Colors: ${record.visual.brandColors.join(", ")}`,
    ].join(". ");
  }
}
