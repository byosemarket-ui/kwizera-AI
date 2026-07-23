import crypto from "node:crypto";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceCategory,
  ProductIntelligenceHealthLevel,
  ProductIntelligenceSource,
  ProductIntelligenceVerificationStatus,
} from "../product-intelligence-foundation/types.js";
import { KnowledgeProductCategory } from "../product-knowledge-engine/types.js";
import { ProductAnalysisAnalyzer } from "./product-analysis-analyzer.js";
import { ProductAnalysisCompletenessDetector } from "./product-analysis-completeness.js";
import { ProductAnalysisLinker } from "./product-analysis-linker.js";
import { ProductAnalysisLogger } from "./product-analysis-logger.js";
import { ProductAnalysisScorer } from "./product-analysis-scorer.js";
import { ProductAnalysisRecordStore } from "./product-analysis-stores.js";
import {
  ProductAnalysisCategory,
  ProductAnalysisEngineInput,
  ProductAnalysisEngineResult,
  ProductAnalysisIntelligenceRecord,
  ProductAnalysisSearchQuery,
} from "./types.js";

const CATEGORY_MAP: Record<ProductAnalysisCategory, KnowledgeProductCategory> = {
  [ProductAnalysisCategory.Electronics]: KnowledgeProductCategory.Electronics,
  [ProductAnalysisCategory.Software]: KnowledgeProductCategory.Electronics,
  [ProductAnalysisCategory.Fashion]: KnowledgeProductCategory.Fashion,
  [ProductAnalysisCategory.Shoes]: KnowledgeProductCategory.Shoes,
  [ProductAnalysisCategory.Bags]: KnowledgeProductCategory.Bags,
  [ProductAnalysisCategory.Beauty]: KnowledgeProductCategory.Beauty,
  [ProductAnalysisCategory.Food]: KnowledgeProductCategory.Food,
  [ProductAnalysisCategory.Restaurant]: KnowledgeProductCategory.Restaurant,
  [ProductAnalysisCategory.Hotel]: KnowledgeProductCategory.Hotel,
  [ProductAnalysisCategory.Furniture]: KnowledgeProductCategory.Furniture,
  [ProductAnalysisCategory.HomeAppliances]: KnowledgeProductCategory.HomeAppliances,
  [ProductAnalysisCategory.Vehicles]: KnowledgeProductCategory.Vehicles,
  [ProductAnalysisCategory.RealEstate]: KnowledgeProductCategory.RealEstate,
  [ProductAnalysisCategory.Education]: KnowledgeProductCategory.Education,
  [ProductAnalysisCategory.Health]: KnowledgeProductCategory.Health,
  [ProductAnalysisCategory.Services]: KnowledgeProductCategory.Future,
};

export class ProductAnalysisProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: ProductAnalysisAnalyzer,
    private readonly completeness: ProductAnalysisCompletenessDetector,
    private readonly scorer: ProductAnalysisScorer,
    private readonly linker: ProductAnalysisLinker,
    private readonly records: ProductAnalysisRecordStore,
    private readonly logger: ProductAnalysisLogger
  ) {}

  async analyze(input: ProductAnalysisEngineInput): Promise<ProductAnalysisEngineResult> {
    const start = Date.now();
    const classStart = Date.now();

    const analysis = this.analyzer.analyze(input);
    const missingFields = this.completeness.detect(input, analysis.profile);
    const criticallyIncomplete = this.completeness.isCriticallyIncomplete(missingFields);

    const scores = this.scorer.computeScores(
      analysis.profile,
      analysis.visual,
      analysis.classification,
      analysis.marketingPreparation,
      missingFields
    );

    const validation = this.scorer.isAnalysisValid(scores, missingFields, criticallyIncomplete);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Product analysis rejected — incomplete or low quality", {
        productName: analysis.profile.productName,
        missingFields,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        missingFields,
        message: "Incomplete product analysis rejected — validation required before approval",
      };
    }

    const productId = input.productId ?? `pai-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const analysisId = `product-analysis-${productId}`;
    const existing = this.records.get(productId);
    const version = existing ? existing.version + 1 : 1;

    let knowledgeId: string | undefined;
    const knowledgeFoundation = this.foundation.integration.getKnowledgeFoundation();
    if (knowledgeFoundation) {
      const knowledgeResult = await knowledgeFoundation.getProductKnowledgeEngine().analyzeProduct({
        productId,
        productName: analysis.profile.productName,
        category: CATEGORY_MAP[analysis.profile.category],
        subcategory: analysis.profile.subcategory,
        brand: analysis.profile.brand,
        description: analysis.profile.description,
        features: analysis.profile.features,
        specifications: analysis.profile.specifications,
        materials: analysis.profile.materials,
        dimensions: analysis.profile.dimensions,
        colors: analysis.profile.colors,
        sizes: analysis.profile.sizes,
        price: analysis.profile.price,
        currency: analysis.profile.currency,
        supplier: analysis.profile.supplier,
        tags: input.tags,
        keywords: input.keywords,
        relatedKnowledge: input.relatedKnowledge,
        relatedMemory: input.relatedMemory,
      });
      if (knowledgeResult.success && knowledgeResult.record) {
        knowledgeId = knowledgeResult.record.knowledgeId;
      }
    }

    const draft: ProductAnalysisIntelligenceRecord = {
      productId,
      analysisId,
      knowledgeId,
      profile: analysis.profile,
      visual: analysis.visual,
      classification: analysis.classification,
      marketingPreparation: analysis.marketingPreparation,
      scores,
      relationships: {
        relatedProducts: [],
        relatedBrands: [],
        relatedCategories: [],
        relatedProjects: input.relatedProjects ?? [],
        relatedMarketingCampaigns: [],
        relatedKnowledge: input.relatedKnowledge ?? [],
        relatedMemory: input.relatedMemory ?? [],
      },
      missingFields,
      tags: input.tags ?? [],
      keywords: input.keywords ?? [
        analysis.profile.productName,
        analysis.profile.brand,
        analysis.profile.category,
        analysis.profile.subcategory,
        analysis.profile.sku ?? "",
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

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.dataQualityScore,
      confidenceScore: scores.analysisConfidenceScore,
      verificationStatus:
        scores.analysisConfidenceScore >= 75
          ? ProductIntelligenceVerificationStatus.Verified
          : ProductIntelligenceVerificationStatus.Pending,
      source: ProductIntelligenceSource.ProductKnowledge,
      sourceRef: knowledgeId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Product analysis v${version}`,
          source: ProductIntelligenceSource.ProductKnowledge,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.relatedKnowledge,
        ...draft.relationships.relatedProducts,
      ],
      healthStatus: ProductIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        missingFields,
        message: "Product intelligence validation failed",
      };
    }

    this.records.upsert(draft);

    const classMs = Date.now() - classStart;
    this.logger.log("info", "classification", "Product classified", {
      productId,
      industry: analysis.classification.industry,
      category: analysis.classification.category,
      durationMs: classMs,
    });

    this.logger.log("info", "analysis", "Product analysis complete", {
      productId,
      analysisId,
      completeness: scores.completenessScore,
      confidence: scores.analysisConfidenceScore,
      knowledgeId,
      version,
    });

    if (draft.relationships.relatedProducts.length > 0) {
      this.logger.log("info", "relationship", "Product relationships detected", {
        productId,
        relatedProducts: draft.relationships.relatedProducts.length,
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

  search(query: ProductAnalysisSearchQuery): ProductAnalysisIntelligenceRecord[] {
    const start = Date.now();
    let results = this.records.getAll();

    if (query.productName) {
      const q = query.productName.toLowerCase();
      results = results.filter((r) => r.profile.productName.toLowerCase().includes(q));
    }
    if (query.brand) {
      const q = query.brand.toLowerCase();
      results = results.filter((r) => r.profile.brand.toLowerCase().includes(q));
    }
    if (query.category) {
      results = results.filter((r) => r.profile.category === query.category);
    }
    if (query.subcategory) {
      results = results.filter((r) => r.profile.subcategory === query.subcategory);
    }
    if (query.sku) {
      results = results.filter((r) => r.profile.sku?.toLowerCase() === query.sku!.toLowerCase());
    }
    if (query.industry) {
      results = results.filter((r) => r.classification.industry === query.industry);
    }
    if (query.supplier) {
      results = results.filter((r) => r.profile.supplier?.toLowerCase().includes(query.supplier!.toLowerCase()));
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
          r.profile.productName.toLowerCase().includes(q) ||
          r.profile.description.toLowerCase().includes(q) ||
          r.profile.brand.toLowerCase().includes(q) ||
          r.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    const limit = query.limit ?? 20;
    const sliced = results.slice(0, limit);

    this.logger.log("debug", "search", "Product analysis search complete", {
      query: query.text ?? query.productName ?? "filter",
      results: sliced.length,
      durationMs: Date.now() - start,
    });

    return sliced;
  }
}
