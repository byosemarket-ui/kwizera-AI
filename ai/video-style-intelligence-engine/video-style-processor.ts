import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceHealthLevel,
  VideoIntelligenceSource,
  VideoIntelligenceVerificationStatus,
} from "../video-intelligence-foundation/types.js";
import { VideoStyleAnalyzer } from "./video-style-analyzer.js";
import { VideoStyleLinker } from "./video-style-linker.js";
import { VideoStyleLogger } from "./video-style-logger.js";
import { VideoStyleScorer } from "./video-style-scorer.js";
import { VideoStyleRecordStore } from "./video-style-stores.js";
import { VideoStyleTemplateLibrary } from "./video-style-template-library.js";
import {
  CinematicStyleClass,
  StyleTemplatePlatform,
  VideoStyleIntelligenceInput,
  VideoStyleIntelligenceRecord,
  VideoStyleIntelligenceResult,
  VideoStyleSearchQuery,
} from "./types.js";

export class VideoStyleProcessor {
  private readonly templateLibrary = new VideoStyleTemplateLibrary();

  constructor(
    private readonly foundation: AiVideoIntelligenceFoundation,
    private readonly analyzer: VideoStyleAnalyzer,
    private readonly scorer: VideoStyleScorer,
    private readonly linker: VideoStyleLinker,
    private readonly records: VideoStyleRecordStore,
    private readonly logger: VideoStyleLogger
  ) {}

  async analyze(input: VideoStyleIntelligenceInput): Promise<VideoStyleIntelligenceResult> {
    const start = Date.now();
    const analysis = this.foundation.getVideoAnalysisEngine().getVideo(input.videoId);
    const sceneDetection = this.foundation.getSceneDetectionEngine().getDetection(input.videoId);

    if (!analysis?.validated) {
      return this.reject(start, input.videoId, "Video must be analyzed and validated before style analysis");
    }
    if (!sceneDetection?.validated) {
      return this.reject(start, input.videoId, "Scene detection must be completed before style analysis");
    }

    const timeline = this.foundation.getTimelineIntelligenceEngine().getTimeline(input.videoId);
    const camera = this.foundation.getCameraMovementEngine().getCameraAnalysis(input.videoId);
    const motion = this.foundation.getMotionIntelligenceEngine().getMotionAnalysis(input.videoId);
    const understanding = this.foundation.getVideoUnderstandingEngine().getUnderstanding(input.videoId);

    const built = this.analyzer.analyze(
      analysis,
      sceneDetection,
      timeline,
      camera,
      motion,
      understanding,
      input.industry
    );

    const cinematicBase =
      camera?.scores.cinematicScore ??
      motion?.scores.cinematicMotionScore ??
      understanding?.scores.storytellingScore ??
      65;
    const marketingBase =
      understanding?.scores.marketingScore ?? analysis.scores.productionReadinessScore;
    const templateMatch = built.templates[0]?.matchScore ?? 60;

    const scores = this.scorer.computeScores(
      built.visualStyle,
      built.editingStyle,
      built.brandStyle,
      cinematicBase,
      marketingBase,
      templateMatch
    );

    const validation = this.scorer.isAnalysisValid(
      scores,
      built.cinematicStyles.length,
      built.templates.length
    );
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Style analysis rejected", {
        videoId: input.videoId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Incomplete style analysis rejected — validation required",
      };
    }

    const existing = this.records.get(input.videoId);
    const version = existing ? existing.version + 1 : 1;
    const intelligenceId = existing?.intelligenceId ?? `video-style-${input.videoId}`;

    const draft: VideoStyleIntelligenceRecord = {
      videoId: input.videoId,
      intelligenceId,
      analysisId: analysis.analysisId,
      detectionId: sceneDetection.detectionId,
      motionIntelligenceId: motion?.intelligenceId,
      cameraIntelligenceId: camera?.intelligenceId,
      timelineId: timeline?.timelineId,
      profile: { ...built.profile, styleVersion: version },
      visualStyle: built.visualStyle,
      editingStyle: built.editingStyle,
      cinematicStyles: built.cinematicStyles,
      dominantCinematicStyle: built.dominantCinematicStyle,
      brandStyle: built.brandStyle,
      templates: built.templates,
      scores,
      relationships: {
        relatedBrands: [],
        relatedProducts: [],
        relatedCampaigns: [],
        relatedStoryboards: input.relatedStoryboards ?? [],
        relatedCreativePlans: input.relatedCreativePlans ?? [],
        relatedMotionPlans: [],
        relatedCameraPlans: [],
        relatedTimelines: [],
        relatedKnowledge: input.relatedKnowledge ?? [],
        relatedVideos: analysis.relationships.relatedVideos,
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
      timeline,
      camera,
      motion,
      input.relatedProjects,
      input.relatedKnowledge,
      input.relatedStoryboards,
      input.relatedCreativePlans
    );

    const intelligenceValidation = this.foundation.validateVideoIntelligence({
      qualityScore: scores.styleConsistencyScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? VideoIntelligenceVerificationStatus.Verified
          : VideoIntelligenceVerificationStatus.Pending,
      source: VideoIntelligenceSource.CreativeDirection,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Video style intelligence v${version}`,
          source: VideoIntelligenceSource.CreativeDirection,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.relatedBrands,
        ...draft.relationships.relatedMotionPlans,
        ...draft.relationships.relatedCameraPlans,
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

    this.logger.log("info", "analysis", "Video style analysis complete", {
      videoId: input.videoId,
      style: draft.dominantCinematicStyle,
      score: scores.styleConsistencyScore,
    });

    this.logger.log("info", "classification", "Cinematic styles classified", {
      videoId: input.videoId,
      styles: draft.cinematicStyles,
    });

    this.logger.log("info", "template", "Style templates matched", {
      videoId: input.videoId,
      templates: draft.templates.length,
      top: draft.templates[0]?.templateId,
    });

    if (draft.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Style recommendations generated", {
        videoId: input.videoId,
        count: draft.recommendations.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: VideoStyleSearchQuery): VideoStyleIntelligenceRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.videoId) results = results.filter((r) => r.videoId === query.videoId);
    if (query.style) {
      results = results.filter(
        (r) =>
          r.dominantCinematicStyle === query.style || r.cinematicStyles.includes(query.style!)
      );
    }
    if (query.industry) {
      const q = query.industry.toLowerCase();
      results = results.filter((r) => r.profile.industry.toLowerCase().includes(q));
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.brand.toLowerCase().includes(q) ||
          r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q))
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
    if (query.platform) {
      results = results.filter((r) => r.templates.some((t) => t.platform === query.platform));
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter((r) =>
        r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q))
      );
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.styleName.toLowerCase().includes(q) ||
          r.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Video style search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }

  getTemplateCount(): number {
    return this.templateLibrary.getAllTemplates().length;
  }

  private reject(start: number, videoId: string, message: string): VideoStyleIntelligenceResult {
    this.logger.log("warn", "validation", message, { videoId });
    return {
      success: false,
      durationMs: Date.now() - start,
      diagnostics: [message],
      message,
    };
  }
}

export { CinematicStyleClass, StyleTemplatePlatform };
