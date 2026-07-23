import crypto from "node:crypto";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeRelationType, KnowledgeNodeType } from "../knowledge-graph-engine/types.js";
import { KnowledgeSearchMode } from "../knowledge-retrieval-engine/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { VideoAnalyzer } from "./video-analyzer.js";
import { VideoLearner } from "./video-learner.js";
import { VideoKnowledgeLogger } from "./video-logger.js";
import { VideoRelationshipLinker, VideoRecommender } from "./video-recommender.js";
import { VideoScorer } from "./video-scorer.js";
import { VideoPatternStore, VideoRecordStore } from "./video-stores.js";
import {
  VideoAnalysisInput,
  VideoAnalysisRecord,
  VideoAnalysisResult,
  VideoSearchQuery,
} from "./types.js";

export class VideoProcessor {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly analyzer: VideoAnalyzer,
    private readonly scorer: VideoScorer,
    private readonly recommender: VideoRecommender,
    private readonly linker: VideoRelationshipLinker,
    private readonly learner: VideoLearner,
    private readonly records: VideoRecordStore,
    private readonly logger: VideoKnowledgeLogger
  ) {}

  async analyze(input: VideoAnalysisInput): Promise<VideoAnalysisResult> {
    const start = Date.now();

    if (!input.videoPath || !input.videoName) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["videoPath and videoName are required"],
        message: "Invalid video input",
      };
    }

    const videoId = input.videoId ?? `vid-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const knowledgeId = `video-knowledge-${videoId}`;

    const analysis = this.analyzer.analyze(input);
    const scores = this.scorer.computeScores(
      analysis.structure,
      analysis.editing,
      analysis.audio,
      analysis.marketing,
      analysis.visual
    );

    const validation = this.scorer.isAnalysisValid(scores);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Video analysis rejected", {
        videoId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Low-quality analysis rejected",
      };
    }

    const draft: VideoAnalysisRecord = {
      videoId,
      knowledgeId,
      videoPath: input.videoPath,
      videoName: input.videoName,
      videoType: analysis.videoType,
      productName: input.product ?? "",
      brandName: input.brandName ?? "unknown",
      structure: analysis.structure,
      camera: analysis.camera,
      editing: analysis.editing,
      audio: analysis.audio,
      marketing: analysis.marketing,
      visual: analysis.visual,
      scores,
      relationships: {
        similarVideos: [],
        similarProducts: [],
        similarCampaigns: [],
        similarStyles: [],
        similarEditing: [],
        similarMusic: [],
        similarStorytelling: [],
      },
      recommendations: [],
      tags: input.tags ?? [],
      keywords: input.keywords ?? [],
      language: input.language ?? "en",
      analyzedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: 1,
    };

    draft.recommendations = this.recommender.recommend(draft);
    draft.relationships = this.linker.detectSimilar(draft, this.records.getAll());

    for (const scene of draft.structure.sceneSequence) {
      this.logger.log("info", "scene", "Scene analyzed", {
        videoId,
        sceneOrder: scene.sceneOrder,
        purpose: scene.scenePurpose,
        productVisibility: scene.productVisibility,
      });
    }

    const storage = this.foundation.getStorageEngine();
    const stored = await storage.storeRecord({
      knowledgeId,
      knowledgeType: KnowledgeStorageType.Video,
      category: "video",
      title: input.videoName,
      description: this.buildKnowledgeDescription(draft),
      summary: `Video analysis: ${analysis.videoType} — storytelling ${scores.storytellingScore}`,
      source: "video-knowledge-engine",
      tags: [...(input.tags ?? []), analysis.videoType, analysis.editing.editingStyle],
      keywords: [
        ...(input.keywords ?? []),
        input.product ?? "",
        input.brandName ?? "",
        analysis.editing.editingStyle,
        analysis.marketing.marketingGoal,
      ].filter(Boolean),
      relatedKnowledge: input.relatedKnowledge ?? [],
      relatedMemory: input.relatedMemory ?? [],
      qualityScore: scores.visualScore,
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
    this.ensureGraphNode(graph, knowledgeId, draft.videoName, this.buildKnowledgeDescription(draft));

    for (const relatedVideoId of draft.relationships.similarVideos) {
      const related = this.records.get(relatedVideoId);
      if (!related) continue;
      this.ensureGraphNode(
        graph,
        related.knowledgeId,
        related.videoName,
        this.buildKnowledgeDescription(related)
      );
      graph.createRelationship({
        sourceId: knowledgeId,
        targetId: related.knowledgeId,
        relationshipType: KnowledgeRelationType.SimilarTo,
        evidence: `Similar video detected during analysis of ${videoId}`,
        strengthScore: 72,
        confidenceScore: 78,
      });
    }

    for (const relatedId of input.relatedKnowledge ?? []) {
      const indexEntry = storage.findIndexEntry(relatedId);
      if (!indexEntry) continue;
      graph.createNode(relatedId, KnowledgeNodeType.Product, indexEntry.title, indexEntry.searchableText);
      graph.createRelationship({
        sourceId: knowledgeId,
        targetId: relatedId,
        relationshipType: KnowledgeRelationType.RelatedTo,
        evidence: `Knowledge link from video analysis ${videoId}`,
        strengthScore: 80,
        confidenceScore: 85,
      });
    }

    await graph.evolveGraph(knowledgeId);
    this.learner.learnFromAnalysis(draft);
    this.records.upsert(draft);

    this.logger.log("info", "analysis", "Video analyzed and stored", {
      videoId,
      knowledgeId,
      storytelling: scores.storytellingScore,
      scenes: draft.structure.sceneSequence.length,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  async search(query: VideoSearchQuery): Promise<VideoAnalysisRecord[]> {
    const retrieval = this.foundation.getRetrievalEngine();
    const search = await retrieval.search({
      mode: KnowledgeSearchMode.Hybrid,
      knowledgeType: KnowledgeStorageType.Video,
      text: query.text,
      keywords: query.product ? [query.product] : undefined,
      limit: query.limit ?? 20,
    });

    let results = search.results
      .map((r) => (r.record?.payload ? (r.record.payload as unknown as VideoAnalysisRecord) : undefined))
      .filter((r): r is VideoAnalysisRecord => Boolean(r));

    if (results.length === 0) {
      results = this.filterLocal(this.records.getAll(), query);
    }

    return results;
  }

  private filterLocal(records: VideoAnalysisRecord[], query: VideoSearchQuery): VideoAnalysisRecord[] {
    return records.filter((r) => {
      if (query.videoType && r.videoType !== query.videoType) return false;
      if (query.product && !r.productName.toLowerCase().includes(query.product.toLowerCase())) return false;
      if (query.brand && !r.brandName.toLowerCase().includes(query.brand.toLowerCase())) return false;
      if (query.editingStyle && r.editing.editingStyle !== query.editingStyle) return false;
      if (query.cameraStyle && !r.camera.primaryShots.includes(query.cameraStyle)) return false;
      if (query.music && r.audio.backgroundMusic !== query.music) return false;
      if (query.language && r.language !== query.language) return false;
      if (query.marketingGoal && r.marketing.marketingGoal !== query.marketingGoal) return false;
      if (query.minStorytelling && r.scores.storytellingScore < query.minStorytelling) return false;
      if (query.sceneType && !r.structure.sceneSequence.some((s) => s.scenePurpose === query.sceneType)) {
        return false;
      }
      if (query.transition && !r.editing.transitionTechniques.includes(query.transition)) return false;
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
      graph.createNode(nodeId, KnowledgeNodeType.Video, title, searchableText);
    }
  }

  private buildKnowledgeDescription(record: VideoAnalysisRecord): string {
    return [
      `Video analysis for ${record.videoName}`,
      `Type: ${record.videoType}`,
      `Scenes: ${record.structure.sceneSequence.length}`,
      `Story: ${record.structure.storyFlow}`,
      `Editing: ${record.editing.editingStyle}`,
      `Product: ${record.productName}`,
      `Brand: ${record.brandName}`,
      `Storytelling: ${record.scores.storytellingScore}`,
      `Marketing: ${record.scores.marketingScore}`,
    ].join(". ");
  }
}
