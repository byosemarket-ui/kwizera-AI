import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceSource,
  ImageIntelligenceVerificationStatus,
} from "../image-intelligence-foundation/types.js";
import { EnhancementPlanningAnalyzer } from "./enhancement-planning-analyzer.js";
import { EnhancementPlanningLinker } from "./enhancement-planning-linker.js";
import { EnhancementPlanningLogger } from "./enhancement-planning-logger.js";
import { EnhancementPlanningScorer } from "./enhancement-planning-scorer.js";
import { ImageEnhancementPlanningRecordStore } from "./enhancement-planning-stores.js";
import {
  ImageEnhancementPlanningInput,
  ImageEnhancementPlanningRecord,
  ImageEnhancementPlanningResult,
  ImageEnhancementPlanningSearchQuery,
} from "./types.js";

export class EnhancementPlanningProcessor {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly analyzer: EnhancementPlanningAnalyzer,
    private readonly scorer: EnhancementPlanningScorer,
    private readonly linker: EnhancementPlanningLinker,
    private readonly records: ImageEnhancementPlanningRecordStore,
    private readonly logger: EnhancementPlanningLogger
  ) {}

  async plan(input: ImageEnhancementPlanningInput): Promise<ImageEnhancementPlanningResult> {
    const start = Date.now();
    const analysis = this.foundation.getImageAnalysisEngine().getImage(input.imageId);
    const understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(input.imageId);

    if (!analysis?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image analysis required before enhancement planning"],
        message: "Complete image analysis required before enhancement planning",
      };
    }

    if (!understanding?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image understanding required before enhancement planning"],
        message: "Complete image understanding required before enhancement planning",
      };
    }

    const detection = this.foundation.getObjectDetectionIntelligenceEngine().getDetection(input.imageId) ?? null;
    const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(input.imageId);
    const composition = this.foundation.getCompositionIntelligenceEngine().getComposition(input.imageId);
    const lightingColor = this.foundation.getLightingColorIntelligenceEngine().getLightingColor(input.imageId);
    const brandVisual = this.foundation.getBrandVisualIntelligenceEngine().getBrandVisual(input.imageId);

    const built = this.analyzer.buildFromIntelligence(
      analysis,
      understanding,
      detection,
      background,
      composition,
      lightingColor,
      brandVisual,
      input.projectId,
      input.platform
    );

    const platformReadiness = this.scorer.computePlatformReadiness(
      built.qualityAnalysis,
      built.profile.platform
    );
    const hasRestorationNeed =
      built.restorationPlan.qualityRecovery.includes("multi-pass") ||
      built.qualityAnalysis.compressionArtifacts > 25;
    const scores = this.scorer.computeScores(built.qualityAnalysis, platformReadiness, hasRestorationNeed);

    const validation = this.scorer.isPlanValid(scores, built.qualityAnalysis);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Enhancement plan rejected", {
        imageId: input.imageId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Enhancement plan rejected — image quality validation required",
      };
    }

    const existing = this.records.get(input.imageId);
    const version = existing ? existing.version + 1 : 1;

    const draft: ImageEnhancementPlanningRecord = {
      imageId: input.imageId,
      profile: { ...built.profile, enhancementPlanId: existing?.profile.enhancementPlanId ?? built.profile.enhancementPlanId },
      analysisId: analysis.analysisId,
      understandingId: understanding.understandingId,
      qualityAnalysis: built.qualityAnalysis,
      enhancementPlan: built.enhancementPlan,
      restorationPlan: built.restorationPlan,
      backgroundPlan: built.backgroundPlan,
      platformOptimization: built.platformOptimization,
      scores,
      relationships: {
        relatedImages: [],
        relatedProducts: [],
        relatedBrands: [],
        relatedBackgroundIntelligence: [],
        relatedCompositionIntelligence: [],
        relatedLightingIntelligence: [],
        relatedCreativeStyles: [],
        relatedProjects: input.relatedProjects ?? [],
        relatedKnowledge: [],
      },
      recommendations: built.recommendations,
      keywords: [...new Set([...built.keywords, ...(input.keywords ?? []), ...(input.enhancementTypes ?? [])])],
      nonDestructive: true,
      validated: true,
      plannedAt: existing?.plannedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      analysis,
      understanding,
      background,
      composition,
      lightingColor,
      input.relatedProjects,
      input.relatedKnowledge
    );

    const intelligenceValidation = this.foundation.validateImageIntelligence({
      qualityScore: scores.enhancementReadinessScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source: ImageIntelligenceSource.System,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Image enhancement plan v${version} (non-destructive)`,
          source: ImageIntelligenceSource.System,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.relatedKnowledge,
        ...draft.relationships.relatedImages,
        ...draft.relationships.relatedBackgroundIntelligence,
      ],
      healthStatus: ImageIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Image intelligence validation failed",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "planning", "Enhancement plan created", {
      imageId: input.imageId,
      platform: built.profile.platform,
      readiness: scores.enhancementReadinessScore,
      version,
    });

    this.logger.log("info", "quality", "Image quality analyzed for planning", {
      imageId: input.imageId,
      qualityScore: scores.imageQualityScore,
      clarity: built.qualityAnalysis.visualClarity,
    });

    if (built.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Enhancement recommendations generated", {
        imageId: input.imageId,
        count: built.recommendations.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: ImageEnhancementPlanningSearchQuery): ImageEnhancementPlanningRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.imageId) results = results.filter((r) => r.imageId === query.imageId);
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter((r) => r.profile.brand.toLowerCase().includes(q));
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter((r) => r.profile.product.toLowerCase().includes(q));
    }
    if (query.platform) {
      results = results.filter((r) => r.profile.platform === query.platform);
    }
    if (query.minQualityScore !== undefined) {
      results = results.filter((r) => r.scores.imageQualityScore >= query.minQualityScore!);
    }
    if (query.enhancementType) {
      const q = query.enhancementType;
      results = results.filter((r) => r.keywords.includes(q));
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Enhancement planning search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }
}
