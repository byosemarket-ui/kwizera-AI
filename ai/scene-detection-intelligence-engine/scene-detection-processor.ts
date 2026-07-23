import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceHealthLevel,
  VideoIntelligenceSource,
  VideoIntelligenceVerificationStatus,
} from "../video-intelligence-foundation/types.js";
import { SceneDetectionAnalyzer } from "./scene-detection-analyzer.js";
import { SceneDetectionIndexer } from "./scene-detection-indexer.js";
import { SceneDetectionLinker } from "./scene-detection-linker.js";
import { SceneDetectionLogger } from "./scene-detection-logger.js";
import { SceneDetectionScorer } from "./scene-detection-scorer.js";
import { SceneDetectionRecordStore } from "./scene-detection-stores.js";
import {
  SceneClassification,
  SceneDetectionInput,
  SceneDetectionRecord,
  SceneDetectionResult,
  SceneDetectionSearchQuery,
  ShotType,
  TransitionType,
} from "./types.js";

export class SceneDetectionProcessor {
  private readonly indexer: SceneDetectionIndexer;

  constructor(
    private readonly foundation: AiVideoIntelligenceFoundation,
    private readonly analyzer: SceneDetectionAnalyzer,
    private readonly scorer: SceneDetectionScorer,
    private readonly linker: SceneDetectionLinker,
    private readonly records: SceneDetectionRecordStore,
    private readonly logger: SceneDetectionLogger
  ) {
    this.indexer = new SceneDetectionIndexer(foundation);
  }

  async detect(input: SceneDetectionInput): Promise<SceneDetectionResult> {
    const start = Date.now();
    const analysisEngine = this.foundation.getVideoAnalysisEngine();
    const analysis = analysisEngine.getVideo(input.videoId);

    if (!analysis || !analysis.validated) {
      this.logger.log("warn", "validation", "Scene detection rejected — analysis required", {
        videoId: input.videoId,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Video must be analyzed and validated before scene detection"],
        message: "Complete video analysis required before scene detection",
      };
    }

    const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);

    const detected = this.analyzer.detect(analysis, understanding);
    const scores = this.scorer.computeScores(
      detected.scenes,
      detected.shots,
      detected.transitions,
      analysis.technical.durationMs,
      analysis.timeline.sceneCount,
      analysis.timeline.shotCount,
      analysis.frame.frameConsistencyScore
    );

    const validation = this.scorer.isDetectionValid(
      scores,
      detected.scenes.length,
      detected.shots.length
    );
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Scene detection rejected", {
        videoId: input.videoId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Incomplete scene detection rejected — validation required",
      };
    }

    const existing = this.records.get(input.videoId);
    const version = existing ? existing.version + 1 : 1;
    const detectionId = existing?.detectionId ?? `scene-detection-${input.videoId}`;

    const draft: SceneDetectionRecord = {
      videoId: input.videoId,
      detectionId,
      analysisId: analysis.analysisId,
      understandingId: understanding?.understandingId,
      scenes: detected.scenes,
      shots: detected.shots,
      transitions: detected.transitions,
      sceneRelationships: detected.sceneRelationships,
      indexes: {
        sceneIndexIds: [],
        shotIndexIds: [],
        transitionIndexIds: [],
        timelineIndexIds: [],
        keyframeIndexIds: [],
      },
      scores,
      relationships: {
        relatedProducts: analysis.relationships.relatedProducts,
        relatedBrands: analysis.relationships.relatedBrands,
        relatedCampaigns: analysis.relationships.relatedCampaigns,
        relatedStoryboards: input.relatedStoryboards ?? [],
        relatedScripts: input.relatedScripts ?? [],
        relatedKnowledge: input.relatedKnowledge ?? [],
        relatedVideos: analysis.relationships.relatedVideos,
        relatedMemory: analysis.relationships.relatedMemory,
        relatedProjects: input.relatedProjects ?? [],
      },
      recommendations: detected.recommendations,
      timelineLengthMs: analysis.technical.durationMs,
      sceneCount: detected.scenes.length,
      shotCount: detected.shots.length,
      transitionCount: detected.transitions.length,
      keywords: detected.keywords,
      validated: true,
      detectedAt: existing?.detectedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      analysis,
      input.relatedProjects,
      input.relatedKnowledge,
      input.relatedStoryboards,
      input.relatedScripts
    );

    const indexStart = Date.now();
    draft.indexes = this.indexer.createIndexes(draft, input.projectId);
    const indexMs = Date.now() - indexStart;

    const intelligenceValidation = this.foundation.validateVideoIntelligence({
      qualityScore: scores.sceneDetectionScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? VideoIntelligenceVerificationStatus.Verified
          : VideoIntelligenceVerificationStatus.Pending,
      source: VideoIntelligenceSource.VideoKnowledge,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Scene detection v${version}`,
          source: VideoIntelligenceSource.VideoKnowledge,
        },
      ],
      relationshipLinks: [
        ...draft.indexes.sceneIndexIds,
        ...draft.indexes.shotIndexIds,
        ...draft.relationships.relatedKnowledge,
      ],
      healthStatus: VideoIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Video intelligence validation failed",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "scene", "Scene detection complete", {
      videoId: input.videoId,
      scenes: draft.sceneCount,
      score: scores.sceneDetectionScore,
      version,
    });

    this.logger.log("info", "shot", "Shot detection complete", {
      videoId: input.videoId,
      shots: draft.shotCount,
      score: scores.shotDetectionScore,
    });

    this.logger.log("info", "transition", "Transition detection complete", {
      videoId: input.videoId,
      transitions: draft.transitionCount,
      score: scores.transitionScore,
    });

    this.logger.log("info", "indexing", "Scene indexes created", {
      videoId: input.videoId,
      scenes: draft.indexes.sceneIndexIds.length,
      shots: draft.indexes.shotIndexIds.length,
      transitions: draft.indexes.transitionIndexIds.length,
      durationMs: indexMs,
    });

    if (draft.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Scene detection recommendations generated", {
        videoId: input.videoId,
        count: draft.recommendations.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: SceneDetectionSearchQuery): SceneDetectionRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.videoId) {
      results = results.filter((r) => r.videoId === query.videoId);
    }
    if (query.sceneId) {
      results = results.filter((r) => r.scenes.some((s) => s.sceneId === query.sceneId));
    }
    if (query.shotId) {
      results = results.filter((r) => r.shots.some((s) => s.shotId === query.shotId));
    }
    if (query.sceneType) {
      results = results.filter((r) => r.scenes.some((s) => s.classification === query.sceneType));
    }
    if (query.shotType) {
      results = results.filter((r) => r.shots.some((s) => s.shotType === query.shotType));
    }
    if (query.transitionType) {
      results = results.filter((r) => r.transitions.some((t) => t.type === query.transitionType));
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter((r) =>
        r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q))
      );
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter((r) =>
        r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q))
      );
    }
    if (query.campaign) {
      const q = query.campaign.toLowerCase();
      results = results.filter((r) =>
        r.relationships.relatedCampaigns.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (query.timelineId) {
      results = results.filter((r) =>
        r.sceneRelationships.some((sr) => sr.timelineId === query.timelineId)
      );
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.scenes.some((s) => s.purpose.toLowerCase().includes(q)) ||
          r.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Scene detection search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }
}

export { SceneClassification, ShotType, TransitionType };
