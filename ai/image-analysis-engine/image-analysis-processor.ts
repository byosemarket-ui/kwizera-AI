import crypto from "node:crypto";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceSource,
  ImageIntelligenceVerificationStatus,
} from "../image-intelligence-foundation/types.js";
import { ImageType } from "../image-knowledge-engine/types.js";
import { ImageAnalysisAnalyzer } from "./image-analysis-analyzer.js";
import { ImageAnalysisCompletenessDetector } from "./image-analysis-completeness.js";
import { ImageAnalysisLinker } from "./image-analysis-linker.js";
import { ImageAnalysisLogger } from "./image-analysis-logger.js";
import { ImageAnalysisScorer } from "./image-analysis-scorer.js";
import { ImageAnalysisRecordStore } from "./image-analysis-stores.js";
import {
  ImageAnalysisEngineInput,
  ImageAnalysisEngineResult,
  ImageAnalysisIntelligenceRecord,
  ImageAnalysisSearchQuery,
  ImageAnalysisType,
} from "./types.js";

const TYPE_TO_KNOWLEDGE: Record<ImageAnalysisType, ImageType> = {
  [ImageAnalysisType.ProductImage]: ImageType.Product,
  [ImageAnalysisType.LifestyleImage]: ImageType.Lifestyle,
  [ImageAnalysisType.MarketingImage]: ImageType.Marketing,
  [ImageAnalysisType.Logo]: ImageType.Brand,
  [ImageAnalysisType.Banner]: ImageType.Banner,
  [ImageAnalysisType.Poster]: ImageType.Marketing,
  [ImageAnalysisType.Screenshot]: ImageType.Other,
  [ImageAnalysisType.Background]: ImageType.Other,
  [ImageAnalysisType.Other]: ImageType.Other,
};

export class ImageAnalysisProcessor {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly analyzer: ImageAnalysisAnalyzer,
    private readonly completeness: ImageAnalysisCompletenessDetector,
    private readonly scorer: ImageAnalysisScorer,
    private readonly linker: ImageAnalysisLinker,
    private readonly records: ImageAnalysisRecordStore,
    private readonly logger: ImageAnalysisLogger
  ) {}

  async analyze(input: ImageAnalysisEngineInput): Promise<ImageAnalysisEngineResult> {
    const start = Date.now();

    const analysis = this.analyzer.analyze(input);
    const missingFields = this.completeness.detect(input, analysis.technical);
    const criticallyIncomplete = this.completeness.isCriticallyIncomplete(missingFields);

    const scores = this.scorer.computeScores(
      analysis.technical,
      analysis.visual,
      analysis.content,
      missingFields
    );

    const validation = this.scorer.isAnalysisValid(scores, missingFields, criticallyIncomplete);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Image analysis rejected — incomplete or low quality", {
        imageName: analysis.technical.imageName,
        missingFields,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        missingFields,
        message: "Incomplete image analysis rejected — validation required before approval",
      };
    }

    const imageId = input.imageId ?? `iai-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const analysisId = `image-analysis-${imageId}`;
    const existing = this.records.get(imageId);
    const version = existing ? existing.version + 1 : 1;

    analysis.technical.imageId = imageId;

    let knowledgeId: string | undefined;
    const knowledgeFoundation = this.foundation.integration.getKnowledgeFoundation();
    if (knowledgeFoundation) {
      const knowledgeResult = await knowledgeFoundation.getImageKnowledgeEngine().analyzeImage({
        imageId,
        imagePath: analysis.technical.filePath,
        imageName: analysis.technical.imageName,
        imageType: TYPE_TO_KNOWLEDGE[analysis.classification.imageType],
        width: analysis.technical.width,
        height: analysis.technical.height,
        product: input.product,
        brandName: input.brand,
        category: analysis.classification.category,
        visual: {
          dominantColors: analysis.visual.dominantColors,
          colors: analysis.visual.dominantColors,
          background: analysis.content.background,
          objects: analysis.content.objects,
          logos: analysis.content.logos,
          textInImage: analysis.content.text,
          products: analysis.content.products,
        },
        metrics: {
          brightness: analysis.visual.brightness,
          contrast: analysis.visual.contrast,
          saturation: analysis.visual.saturation,
          sharpness: analysis.visual.sharpness,
          noise: analysis.visual.noiseLevel,
          whiteBalance: analysis.visual.whiteBalance,
          resolution: analysis.technical.resolution,
          aspectRatio: analysis.technical.aspectRatio,
        },
        tags: input.tags,
        keywords: input.keywords,
        relatedKnowledge: input.relatedKnowledge,
        relatedMemory: input.relatedMemory,
      });
      if (knowledgeResult.success && knowledgeResult.record) {
        knowledgeId = knowledgeResult.record.knowledgeId;
      }
    }

    const draft: ImageAnalysisIntelligenceRecord = {
      imageId,
      analysisId,
      knowledgeId,
      technical: analysis.technical,
      visual: analysis.visual,
      content: analysis.content,
      classification: analysis.classification,
      scores,
      relationships: {
        relatedProducts: input.product ? [input.product] : [],
        relatedBrands: input.brand ? [input.brand] : [],
        relatedProjects: input.relatedProjects ?? (input.projectId ? [input.projectId] : []),
        relatedMarketingCampaigns: input.campaign ? [input.campaign] : [],
        relatedCreativeStyles: [analysis.classification.creativeStyle],
        relatedKnowledge: input.relatedKnowledge ?? [],
        relatedImages: input.relatedImages ?? [],
        relatedMemory: input.relatedMemory ?? [],
      },
      missingFields,
      tags: input.tags ?? [],
      keywords: input.keywords ?? [
        analysis.technical.imageName,
        analysis.classification.imageType,
        input.product ?? "",
        input.brand ?? "",
        analysis.technical.resolution,
      ].filter(Boolean),
      validated: true,
      analyzedAt: existing?.analyzedAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      knowledgeId ? [knowledgeId, ...(input.relatedKnowledge ?? [])] : input.relatedKnowledge ?? [],
      input.relatedMemory ?? []
    );

    const intelligenceValidation = this.foundation.validateImageIntelligence({
      qualityScore: scores.technicalQualityScore,
      confidenceScore: scores.analysisConfidenceScore,
      verificationStatus:
        scores.analysisConfidenceScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source: ImageIntelligenceSource.ImageKnowledge,
      sourceRef: knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Image analysis v${version}`,
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
        missingFields,
        message: "Image intelligence validation failed",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "classification", "Image classified", {
      imageId,
      imageType: analysis.classification.imageType,
      category: analysis.classification.category,
    });

    this.logger.log("info", "analysis", "Image analysis complete", {
      imageId,
      analysisId,
      completeness: scores.imageCompletenessScore,
      confidence: scores.analysisConfidenceScore,
      knowledgeId,
      version,
    });

    if (draft.relationships.relatedImages.length > 0) {
      this.logger.log("info", "relationship", "Image relationships detected", {
        imageId,
        relatedImages: draft.relationships.relatedImages.length,
        relatedBrands: draft.relationships.relatedBrands.length,
      });
    }

    return {
      success: true,
      record: draft,
      durationMs: Date.now() - start,
      diagnostics: [],
      missingFields,
    };
  }

  search(query: ImageAnalysisSearchQuery): ImageAnalysisIntelligenceRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.imageName) {
      const q = query.imageName.toLowerCase();
      results = results.filter((r) => r.technical.imageName.toLowerCase().includes(q));
    }
    if (query.imageType) {
      results = results.filter((r) => r.classification.imageType === query.imageType);
    }
    if (query.product) {
      const q = query.product.toLowerCase();
      results = results.filter(
        (r) =>
          r.content.products.some((p) => p.toLowerCase().includes(q)) ||
          r.relationships.relatedProducts.some((p) => p.toLowerCase().includes(q))
      );
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter(
        (r) =>
          r.relationships.relatedBrands.some((b) => b.toLowerCase().includes(q)) ||
          r.content.logos.some((l) => l.toLowerCase().includes(q))
      );
    }
    if (query.resolution) {
      results = results.filter((r) => r.technical.resolution === query.resolution);
    }
    if (query.aspectRatio) {
      results = results.filter((r) => r.technical.aspectRatio === query.aspectRatio);
    }
    if (query.dominantColor) {
      const q = query.dominantColor.toLowerCase();
      results = results.filter((r) =>
        r.visual.dominantColors.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (query.tags?.length) {
      results = results.filter((r) => query.tags!.some((t) => r.tags.includes(t)));
    }
    if (query.keywords?.length) {
      results = results.filter((r) =>
        query.keywords!.some((k) => r.keywords.some((rk) => rk.toLowerCase().includes(k.toLowerCase())))
      );
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.technical.imageName.toLowerCase().includes(q) ||
          r.keywords.some((k) => k.toLowerCase().includes(q)) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    const limit = query.limit ?? 20;
    const sliced = results.slice(0, limit);

    this.logger.log("debug", "search", "Image analysis search complete", {
      query: query.text ?? query.imageName ?? "filter",
      results: sliced.length,
      durationMs: Date.now() - start,
    });

    return sliced;
  }
}
