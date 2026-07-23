import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceSource,
  ImageIntelligenceVerificationStatus,
} from "../image-intelligence-foundation/types.js";
import { BrandVisualAnalyzer } from "./brand-visual-analyzer.js";
import { BrandVisualLinker } from "./brand-visual-linker.js";
import { BrandVisualLogger } from "./brand-visual-logger.js";
import { BrandVisualScorer } from "./brand-visual-scorer.js";
import { BrandVisualIntelligenceRecordStore } from "./brand-visual-stores.js";
import {
  BrandVisualIntelligenceInput,
  BrandVisualIntelligenceRecord,
  BrandVisualIntelligenceResult,
  BrandVisualIntelligenceSearchQuery,
} from "./types.js";

export class BrandVisualProcessor {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly analyzer: BrandVisualAnalyzer,
    private readonly scorer: BrandVisualScorer,
    private readonly linker: BrandVisualLinker,
    private readonly records: BrandVisualIntelligenceRecordStore,
    private readonly logger: BrandVisualLogger
  ) {}

  async analyze(input: BrandVisualIntelligenceInput): Promise<BrandVisualIntelligenceResult> {
    const start = Date.now();
    const analysisEngine = this.foundation.getImageAnalysisEngine();
    const understandingEngine = this.foundation.getImageUnderstandingEngine();
    const detectionEngine = this.foundation.getObjectDetectionIntelligenceEngine();

    const analysis = analysisEngine.getImage(input.imageId);
    const understanding = understandingEngine.getUnderstanding(input.imageId);
    const detection = detectionEngine.getDetection(input.imageId);

    if (!analysis?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image analysis required before brand visual intelligence"],
        message: "Complete image analysis required before brand visual intelligence",
      };
    }

    if (!understanding?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image understanding required before brand visual intelligence"],
        message: "Complete image understanding required before brand visual intelligence",
      };
    }

    if (!detection?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated object detection required before brand visual intelligence"],
        message: "Complete object detection required before brand visual intelligence",
      };
    }

    const lightingColor = this.foundation.getLightingColorIntelligenceEngine().getLightingColor(input.imageId);

    const built = this.analyzer.buildFromIntelligence(
      analysis,
      understanding,
      detection,
      lightingColor,
      input.brandName,
      input.industry,
      input.visualStyle
    );
    const scores = this.scorer.computeScores(built.consistency, built.logoAnalysis);

    const validation = this.scorer.isAnalysisValid(scores, built.profile.brandName, built.consistency);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Brand visual analysis rejected", {
        imageId: input.imageId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Inconsistent brand identity rejected — validation required",
      };
    }

    const existing = this.records.get(input.imageId);
    const version = existing ? existing.version + 1 : 1;
    const brandVisualId = existing?.brandVisualId ?? `brand-visual-${input.imageId}`;

    const draft: BrandVisualIntelligenceRecord = {
      imageId: input.imageId,
      brandVisualId,
      analysisId: analysis.analysisId,
      understandingId: understanding.understandingId,
      detectionId: detection.detectionId,
      lightingColorId: lightingColor?.lightingColorId,
      profile: built.profile,
      logoAnalysis: built.logoAnalysis,
      colorAnalysis: built.colorAnalysis,
      typography: built.typography,
      visualStyle: built.visualStyle,
      consistency: built.consistency,
      planning: built.planning,
      scores,
      relationships: {
        relatedProducts: [],
        relatedImages: [],
        relatedCampaigns: [],
        relatedCreativeStyles: [],
        relatedStoryboards: [],
        relatedVisualPlans: [],
        relatedMarketingStrategies: [],
        relatedKnowledge: [],
        relatedProjects: input.relatedProjects ?? [],
      },
      recommendations: built.recommendations,
      keywords: [...new Set([...built.keywords, ...(input.keywords ?? [])])],
      validated: true,
      analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      analysis,
      understanding,
      detection,
      input.relatedProjects,
      input.relatedKnowledge
    );

    const intelligenceValidation = this.foundation.validateImageIntelligence({
      qualityScore: scores.brandConsistencyScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source: ImageIntelligenceSource.CreativeDirection,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Brand visual intelligence v${version}`,
          source: ImageIntelligenceSource.CreativeDirection,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.relatedKnowledge,
        ...draft.relationships.relatedImages,
        ...draft.relationships.relatedStoryboards,
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

    this.logger.log("info", "analysis", "Brand visual analysis complete", {
      imageId: input.imageId,
      brand: built.profile.brandName,
      style: built.visualStyle,
      consistencyScore: scores.brandConsistencyScore,
      version,
    });

    this.logger.log("info", "validation", "Brand visual validation passed", {
      imageId: input.imageId,
      logoQuality: scores.logoQualityScore,
      colorConsistency: scores.colorConsistencyScore,
    });

    if (built.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Brand visual recommendations generated", {
        imageId: input.imageId,
        count: built.recommendations.length,
      });
    }

    if (draft.relationships.relatedImages.length > 0) {
      this.logger.log("info", "relationship", "Brand visual relationships linked", {
        imageId: input.imageId,
        relatedImages: draft.relationships.relatedImages.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: BrandVisualIntelligenceSearchQuery): BrandVisualIntelligenceRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.imageId) {
      results = results.filter((r) => r.imageId === query.imageId);
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter((r) => r.profile.brandName.toLowerCase().includes(q));
    }
    if (query.industry) {
      const q = query.industry.toLowerCase();
      results = results.filter((r) => r.profile.industry.toLowerCase().includes(q));
    }
    if (query.visualStyle) {
      results = results.filter((r) => r.visualStyle === query.visualStyle);
    }
    if (query.logo) {
      const q = query.logo.toLowerCase();
      results = results.filter((r) => r.profile.logo.toLowerCase().includes(q));
    }
    if (query.color) {
      const q = query.color.toLowerCase();
      results = results.filter(
        (r) =>
          r.colorAnalysis.primaryBrandColors.some((c) => c.toLowerCase().includes(q)) ||
          r.profile.primaryColors.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (query.typography) {
      const q = query.typography.toLowerCase();
      results = results.filter(
        (r) =>
          r.typography.primaryFont.toLowerCase().includes(q) ||
          r.typography.secondaryFont.toLowerCase().includes(q)
      );
    }
    if (query.campaign) {
      const q = query.campaign.toLowerCase();
      results = results.filter((r) => r.relationships.relatedCampaigns.some((c) => c.toLowerCase().includes(q)));
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Brand visual intelligence search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }
}
