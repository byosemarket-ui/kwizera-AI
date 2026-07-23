import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceSource,
  ImageIntelligenceVerificationStatus,
} from "../image-intelligence-foundation/types.js";
import { CompositionAnalyzer } from "./composition-analyzer.js";
import { CompositionLinker } from "./composition-linker.js";
import { CompositionLogger } from "./composition-logger.js";
import { CompositionScorer } from "./composition-scorer.js";
import { CompositionIntelligenceRecordStore } from "./composition-stores.js";
import {
  CompositionIntelligenceInput,
  CompositionIntelligenceRecord,
  CompositionIntelligenceResult,
  CompositionIntelligenceSearchQuery,
} from "./types.js";

export class CompositionProcessor {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly analyzer: CompositionAnalyzer,
    private readonly scorer: CompositionScorer,
    private readonly linker: CompositionLinker,
    private readonly records: CompositionIntelligenceRecordStore,
    private readonly logger: CompositionLogger
  ) {}

  async analyze(input: CompositionIntelligenceInput): Promise<CompositionIntelligenceResult> {
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
        diagnostics: ["Validated image analysis required before composition intelligence"],
        message: "Complete image analysis required before composition intelligence",
      };
    }

    if (!understanding?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image understanding required before composition intelligence"],
        message: "Complete image understanding required before composition intelligence",
      };
    }

    if (!detection?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated object detection required before composition intelligence"],
        message: "Complete object detection required before composition intelligence",
      };
    }

    const background = this.foundation.getBackgroundIntelligenceEngine().getBackground(input.imageId);

    const built = this.analyzer.buildFromIntelligence(
      analysis,
      understanding,
      detection,
      background,
      input.industry
    );
    const scores = this.scorer.computeScores(
      built.compositionAnalysis,
      built.visualHierarchy,
      built.productPlacement,
      built.suitability
    );

    const validation = this.scorer.isAnalysisValid(scores, built.compositionAnalysis);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Composition analysis rejected", {
        imageId: input.imageId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Incomplete composition analysis rejected — validation required",
      };
    }

    const existing = this.records.get(input.imageId);
    const version = existing ? existing.version + 1 : 1;
    const compositionId = existing?.compositionId ?? `composition-${input.imageId}`;

    const draft: CompositionIntelligenceRecord = {
      imageId: input.imageId,
      compositionId,
      analysisId: analysis.analysisId,
      understandingId: understanding.understandingId,
      detectionId: detection.detectionId,
      backgroundId: background?.backgroundId,
      compositionAnalysis: built.compositionAnalysis,
      visualHierarchy: built.visualHierarchy,
      productPlacement: built.productPlacement,
      suitability: built.suitability,
      improvementPlan: built.improvementPlan,
      scores,
      relationships: {
        relatedProducts: [],
        relatedBrands: [],
        relatedCreativeStyles: [],
        relatedBackgrounds: [],
        relatedStoryboards: [],
        relatedMarketingCampaigns: [],
        relatedKnowledge: [],
        relatedImages: [],
        relatedProjects: input.relatedProjects ?? [],
      },
      recommendations: built.recommendations,
      keywords: [...new Set([...built.keywords, ...(input.keywords ?? []), ...(input.marketingGoal ? [input.marketingGoal] : []), ...(input.platform ? [input.platform] : [])])],
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
      background,
      input.relatedProjects,
      input.relatedKnowledge
    );

    const intelligenceValidation = this.foundation.validateImageIntelligence({
      qualityScore: scores.compositionQualityScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source: ImageIntelligenceSource.VisualPlanning,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Composition intelligence v${version}`,
          source: ImageIntelligenceSource.VisualPlanning,
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

    this.logger.log("info", "analysis", "Composition analysis complete", {
      imageId: input.imageId,
      compositionType: built.compositionAnalysis.compositionType,
      qualityScore: scores.compositionQualityScore,
      version,
    });

    this.logger.log("info", "hierarchy", "Visual hierarchy evaluated", {
      imageId: input.imageId,
      mainSubject: built.visualHierarchy.mainSubjectVisibility,
      readingFlow: built.visualHierarchy.readingFlow,
    });

    if (built.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Composition recommendations generated", {
        imageId: input.imageId,
        count: built.recommendations.length,
      });
    }

    if (draft.relationships.relatedImages.length > 0) {
      this.logger.log("info", "relationship", "Composition relationships linked", {
        imageId: input.imageId,
        relatedImages: draft.relationships.relatedImages.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: CompositionIntelligenceSearchQuery): CompositionIntelligenceRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.imageId) {
      results = results.filter((r) => r.imageId === query.imageId);
    }
    if (query.compositionType) {
      results = results.filter((r) => r.compositionAnalysis.compositionType === query.compositionType);
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter((r) => r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q)));
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter((r) => r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q)));
    }
    if (query.creativeStyle) {
      const q = query.creativeStyle.toLowerCase();
      results = results.filter((r) =>
        r.relationships.relatedCreativeStyles.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (query.industry) {
      const q = query.industry.toLowerCase();
      results = results.filter((r) => r.keywords.some((k) => k.toLowerCase().includes(q)));
    }
    if (query.marketingGoal) {
      results = results.filter((r) => r.keywords.includes(query.marketingGoal!));
    }
    if (query.platform) {
      results = results.filter((r) => r.keywords.includes(query.platform!));
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Composition intelligence search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }
}
