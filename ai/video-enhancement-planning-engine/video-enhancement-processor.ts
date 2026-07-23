import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceHealthLevel,
  VideoIntelligenceSource,
  VideoIntelligenceVerificationStatus,
} from "../video-intelligence-foundation/types.js";
import { VideoEnhancementAnalyzer } from "./video-enhancement-analyzer.js";
import { VideoEnhancementLinker } from "./video-enhancement-linker.js";
import { VideoEnhancementLogger } from "./video-enhancement-logger.js";
import { VideoEnhancementScorer } from "./video-enhancement-scorer.js";
import { VideoEnhancementRecordStore } from "./video-enhancement-stores.js";
import {
  VideoEnhancementPlatform,
  EnhancementType,
  VideoEnhancementPlanningInput,
  VideoEnhancementPlanRecord,
  VideoEnhancementPlanningResult,
  VideoEnhancementSearchQuery,
} from "./types.js";

export class VideoEnhancementProcessor {
  constructor(
    private readonly foundation: AiVideoIntelligenceFoundation,
    private readonly analyzer: VideoEnhancementAnalyzer,
    private readonly scorer: VideoEnhancementScorer,
    private readonly linker: VideoEnhancementLinker,
    private readonly records: VideoEnhancementRecordStore,
    private readonly logger: VideoEnhancementLogger
  ) {}

  async planEnhancement(input: VideoEnhancementPlanningInput): Promise<VideoEnhancementPlanningResult> {
    const start = Date.now();
    const analysis = this.foundation.getVideoAnalysisEngine().getVideo(input.videoId);
    const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(input.videoId);

    if (!analysis?.validated) {
      return this.reject(start, input.videoId, "Video must be analyzed and validated before enhancement planning");
    }
    if (!sceneDetection?.validated) {
      return this.reject(start, input.videoId, "Scene detection must be completed before enhancement planning");
    }

    const timeline = this.foundation.getTimelineIntelligenceEngine().getTimeline(input.videoId);
    const camera = this.foundation.getCameraMovementEngine().getCameraAnalysis(input.videoId);
    const motion = this.foundation.getMotionIntelligenceEngine().getMotionAnalysis(input.videoId);
    const style = this.foundation.getVideoStyleIntelligenceEngine().getStyleAnalysis(input.videoId);
    const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);

    const built = this.analyzer.analyze(
      analysis,
      sceneDetection,
      timeline,
      camera,
      motion,
      style,
      understanding,
      input.projectId,
      input.platform
    );

    const productionBase =
      timeline?.scores.productionReadinessScore ?? analysis.scores.productionReadinessScore;
    const styleConsistency = style?.scores.styleConsistencyScore ?? 70;

    const scores = this.scorer.computeScores(
      built.qualityAnalysis,
      built.recommendations.length,
      built.platformOptimizations.length,
      productionBase,
      styleConsistency
    );

    const nonDestructiveValid =
      built.nonDestructive.preserveOriginal &&
      built.nonDestructive.supportsUndo &&
      built.nonDestructive.supportsRedo &&
      built.nonDestructive.supportsRecovery;

    const validation = this.scorer.isPlanValid(
      scores,
      built.recommendations.length,
      built.platformOptimizations.length,
      nonDestructiveValid
    );
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Enhancement plan rejected", {
        videoId: input.videoId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Incomplete enhancement plan rejected — validation required",
      };
    }

    const existing = this.records.get(input.videoId);
    const version = existing ? existing.version + 1 : 1;
    const intelligenceId = existing?.intelligenceId ?? `video-enhancement-${input.videoId}`;

    const versionHistory = [
      ...(existing?.versionHistory ?? []),
      {
        version,
        timestamp: new Date().toISOString(),
        changeSummary: `Enhancement plan v${version} (non-destructive)`,
        reversible: true,
      },
    ];

    const draft: VideoEnhancementPlanRecord = {
      videoId: input.videoId,
      intelligenceId,
      analysisId: analysis.analysisId,
      detectionId: sceneDetection.detectionId,
      styleIntelligenceId: style?.intelligenceId,
      motionIntelligenceId: motion?.intelligenceId,
      cameraIntelligenceId: camera?.intelligenceId,
      timelineId: timeline?.timelineId,
      profile: { ...built.profile, enhancementVersion: version },
      qualityAnalysis: built.qualityAnalysis,
      visualPlan: built.visualPlan,
      audioPlan: built.audioPlan,
      motionPlan: built.motionPlan,
      cinematicPlan: built.cinematicPlan,
      platformOptimizations: built.platformOptimizations,
      nonDestructive: built.nonDestructive,
      versionHistory,
      scores,
      relationships: {
        relatedVideos: [],
        relatedScenes: [],
        relatedTimelines: [],
        relatedMotionPlans: [],
        relatedCameraPlans: [],
        relatedStylePlans: [],
        relatedProducts: analysis.relationships.relatedProducts,
        relatedBrands: analysis.relationships.relatedBrands,
        relatedCampaigns: analysis.relationships.relatedCampaigns,
        relatedKnowledge: input.relatedKnowledge ?? [],
        relatedMemory: analysis.relationships.relatedMemory,
        relatedProjects: input.relatedProjects ?? [],
      },
      recommendations: built.recommendations,
      keywords: built.keywords,
      validated: true,
      analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      analysis,
      sceneDetection,
      timeline,
      camera,
      motion,
      style,
      input.relatedProjects,
      input.relatedKnowledge
    );

    this.foundation.getWorkflow().initializeVideo(draft.profile.projectId, draft.videoId);

    const intelligenceValidation = this.foundation.validateVideoIntelligence({
      qualityScore: scores.enhancementReadinessScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? VideoIntelligenceVerificationStatus.Verified
          : VideoIntelligenceVerificationStatus.Pending,
      source: VideoIntelligenceSource.System,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Video enhancement planning v${version}`,
          source: VideoIntelligenceSource.System,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.relatedTimelines,
        ...draft.relationships.relatedStylePlans,
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

    this.logger.log("info", "planning", "Enhancement plan complete", {
      videoId: input.videoId,
      platform: draft.profile.platform,
      readiness: scores.enhancementReadinessScore,
    });

    this.logger.log("info", "quality", "Quality analysis recorded", {
      videoId: input.videoId,
      visual: scores.visualQualityScore,
      audio: scores.audioQualityScore,
    });

    this.logger.log("info", "platform", "Platform optimizations prepared", {
      videoId: input.videoId,
      platforms: draft.platformOptimizations.length,
    });

    if (draft.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Enhancement recommendations generated", {
        videoId: input.videoId,
        count: draft.recommendations.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: VideoEnhancementSearchQuery): VideoEnhancementPlanRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.videoId) results = results.filter((r) => r.videoId === query.videoId);
    if (query.enhancementType) {
      results = results.filter((r) =>
        r.recommendations.some((rec) => rec.category === query.enhancementType)
      );
    }
    if (query.platform) {
      results = results.filter(
        (r) =>
          r.profile.platform === query.platform ||
          r.platformOptimizations.some((p) => p.platform === query.platform)
      );
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.brand.toLowerCase().includes(q) ||
          r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q))
      );
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.product.toLowerCase().includes(q) ||
          r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q))
      );
    }
    if (query.campaign) {
      const q = query.campaign.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.campaign.toLowerCase().includes(q) ||
          r.relationships.relatedCampaigns.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.enhancementPlanId.toLowerCase().includes(q) ||
          r.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Enhancement plan search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }

  private reject(start: number, videoId: string, message: string): VideoEnhancementPlanningResult {
    this.logger.log("warn", "validation", message, { videoId });
    return {
      success: false,
      durationMs: Date.now() - start,
      diagnostics: [message],
      message,
    };
  }
}

export { VideoEnhancementPlatform, EnhancementType };
