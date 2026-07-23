import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceSource,
  ImageIntelligenceVerificationStatus,
} from "../image-intelligence-foundation/types.js";
import { ObjectDetectionAnalyzer } from "./object-detection-analyzer.js";
import { ObjectDetectionLinker } from "./object-detection-linker.js";
import { ObjectDetectionLogger } from "./object-detection-logger.js";
import { ObjectDetectionScorer } from "./object-detection-scorer.js";
import { ObjectDetectionRecordStore } from "./object-detection-stores.js";
import {
  ObjectDetectionInput,
  ObjectDetectionRecord,
  ObjectDetectionResult,
  ObjectDetectionSearchQuery,
} from "./types.js";

export class ObjectDetectionProcessor {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly analyzer: ObjectDetectionAnalyzer,
    private readonly scorer: ObjectDetectionScorer,
    private readonly linker: ObjectDetectionLinker,
    private readonly records: ObjectDetectionRecordStore,
    private readonly logger: ObjectDetectionLogger
  ) {}

  async detect(input: ObjectDetectionInput): Promise<ObjectDetectionResult> {
    const start = Date.now();
    const analysisEngine = this.foundation.getImageAnalysisEngine();
    const understandingEngine = this.foundation.getImageUnderstandingEngine();

    const analysis = analysisEngine.getImage(input.imageId);
    const understanding = understandingEngine.getUnderstanding(input.imageId);

    if (!analysis?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image analysis required before object detection"],
        message: "Complete image analysis required before object detection",
      };
    }

    if (!understanding?.validated) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Validated image understanding required before object detection"],
        message: "Complete image understanding required before object detection",
      };
    }

    const built = this.analyzer.buildFromIntelligence(analysis, understanding);
    const scores = this.scorer.computeScores(
      built.objects,
      built.productDetection,
      built.textDetection,
      built.logoDetection
    );

    const validation = this.scorer.isDetectionValid(scores, built.objects);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Object detection rejected", {
        imageId: input.imageId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Incomplete object detection rejected — validation required",
      };
    }

    const existing = this.records.get(input.imageId);
    const version = existing ? existing.version + 1 : 1;
    const detectionId = existing?.detectionId ?? `object-detection-${input.imageId}`;

    const draft: ObjectDetectionRecord = {
      imageId: input.imageId,
      detectionId,
      analysisId: analysis.analysisId,
      understandingId: understanding.understandingId,
      objects: built.objects,
      productDetection: built.productDetection,
      textDetection: built.textDetection,
      logoDetection: built.logoDetection,
      scores,
      relationships: {
        relatedProducts: [],
        relatedBrands: [],
        relatedScenes: [],
        relatedBackgrounds: [],
        relatedCreativeStyles: [],
        relatedMarketingCampaigns: [],
        relatedKnowledge: [],
        relatedImages: [],
        relatedProjects: input.relatedProjects ?? [],
      },
      recommendations: built.recommendations,
      keywords: [...new Set([...built.keywords, ...(input.keywords ?? [])])],
      validated: true,
      detectedAt: existing?.detectedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      analysis,
      understanding,
      input.relatedProjects,
      input.relatedKnowledge
    );

    const intelligenceValidation = this.foundation.validateImageIntelligence({
      qualityScore: scores.objectDetectionScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source: ImageIntelligenceSource.ImageKnowledge,
      sourceRef: analysis.knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Object detection v${version}`,
          source: ImageIntelligenceSource.ImageKnowledge,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.relatedKnowledge,
        ...draft.relationships.relatedImages,
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

    this.logger.log("info", "detection", "Object detection complete", {
      imageId: input.imageId,
      objects: built.objects.length,
      detectionScore: scores.objectDetectionScore,
      version,
    });

    if (built.productDetection.mainProduct) {
      this.logger.log("info", "detection", "Product detection recorded", {
        imageId: input.imageId,
        mainProduct: built.productDetection.mainProduct,
        visibility: built.productDetection.productVisibility,
      });
    }

    if (built.logoDetection.logoPresent) {
      this.logger.log("info", "detection", "Logo detection recorded", {
        imageId: input.imageId,
        brand: built.logoDetection.brandAssociation,
      });
    }

    if (built.recommendations.length > 0) {
      this.logger.log("info", "recommendation", "Object detection recommendations generated", {
        imageId: input.imageId,
        count: built.recommendations.length,
      });
    }

    if (draft.relationships.relatedImages.length > 0) {
      this.logger.log("info", "relationship", "Object relationships linked", {
        imageId: input.imageId,
        relatedImages: draft.relationships.relatedImages.length,
      });
    }

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: ObjectDetectionSearchQuery): ObjectDetectionRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.imageId) {
      results = results.filter((r) => r.imageId === query.imageId);
    }
    if (query.objectType) {
      results = results.filter((r) => r.objects.some((o) => o.objectType === query.objectType));
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter(
        (r) =>
          r.productDetection.mainProduct?.toLowerCase().includes(q) ||
          r.productDetection.secondaryProducts.some((p) => p.toLowerCase().includes(q))
      );
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter((r) => r.logoDetection.brandAssociation.toLowerCase().includes(q));
    }
    if (query.category) {
      const q = query.category.toLowerCase();
      results = results.filter((r) =>
        r.objects.some((o) => o.objectName.toLowerCase().includes(q) || o.objectType.includes(q))
      );
    }
    if (query.project) {
      results = results.filter((r) => r.relationships.relatedProjects.includes(query.project!));
    }
    if (query.campaign) {
      results = results.filter((r) =>
        r.relationships.relatedMarketingCampaigns.some((c) => c.includes(query.campaign!))
      );
    }
    if (query.keywords?.length) {
      results = results.filter((r) => query.keywords!.some((k) => r.keywords.includes(k)));
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.keywords.some((k) => k.toLowerCase().includes(q)) ||
          r.objects.some((o) => o.objectName.toLowerCase().includes(q))
      );
    }

    const sliced = results.slice(0, query.limit ?? 20);
    this.logger.log("debug", "search", "Object detection search complete", {
      results: sliced.length,
      durationMs: Date.now() - start,
    });
    return sliced;
  }
}
