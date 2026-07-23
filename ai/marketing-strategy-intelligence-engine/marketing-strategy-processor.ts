import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceSource,
  ProductIntelligenceVerificationStatus,
} from "../product-intelligence-foundation/types.js";
import { MarketingStrategyAnalyzer } from "./marketing-strategy-analyzer.js";
import { MarketingStrategyLinker } from "./marketing-strategy-linker.js";
import { MarketingStrategyLogger } from "./marketing-strategy-logger.js";
import { MarketingStrategyScorer } from "./marketing-strategy-scorer.js";
import { MarketingStrategyRecordStore } from "./marketing-strategy-stores.js";
import {
  BusinessGoalType,
  MarketingStrategyInput,
  MarketingStrategyRecord,
  MarketingStrategyResult,
  MarketingStrategySearchQuery,
} from "./types.js";

export class MarketingStrategyProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: MarketingStrategyAnalyzer,
    private readonly scorer: MarketingStrategyScorer,
    private readonly linker: MarketingStrategyLinker,
    private readonly records: MarketingStrategyRecordStore,
    private readonly logger: MarketingStrategyLogger
  ) {}

  async strategize(input: MarketingStrategyInput): Promise<MarketingStrategyResult> {
    const start = Date.now();
    const analysisEngine = this.foundation.getProductAnalysisEngine();
    const understandingEngine = this.foundation.getProductUnderstandingEngine();
    const audienceEngine = this.foundation.getTargetAudienceIntelligenceEngine();

    const analysis = analysisEngine.getProduct(input.productId);
    if (!analysis || !analysis.validated) {
      this.logger.log("warn", "validation", "Strategy rejected — validated analysis required", {
        productId: input.productId,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Product must be analyzed and validated before marketing strategy"],
        message: "Complete product analysis required before strategy preparation",
      };
    }

    const understanding = understandingEngine.getUnderstanding(input.productId);
    if (!understanding || !understanding.validated) {
      this.logger.log("warn", "validation", "Strategy rejected — validated understanding required", {
        productId: input.productId,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: ["Product must be understood and validated before marketing strategy"],
        message: "Complete product understanding required before strategy preparation",
      };
    }

    let audienceIntelligence = input.audienceId
      ? audienceEngine.getAudience(input.audienceId)
      : audienceEngine.getAudiencesByProduct(input.productId)[0];

    if (!audienceIntelligence?.validated) {
      const audienceResult = await audienceEngine.analyzeAudience({
        productId: input.productId,
        audienceId: input.audienceId,
        preferredPlatforms: undefined,
      });
      if (!audienceResult.success || !audienceResult.record) {
        this.logger.log("warn", "validation", "Strategy rejected — validated audience intelligence required", {
          productId: input.productId,
        });
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: audienceResult.diagnostics.length > 0
            ? audienceResult.diagnostics
            : ["Target audience must be analyzed and validated before marketing strategy"],
          message: audienceResult.message ?? "Complete audience intelligence required before strategy preparation",
        };
      }
      audienceIntelligence = audienceResult.record;
    }

    const businessGoals = this.analyzer.analyzeBusinessGoals(input, understanding, analysis);
    const audienceAlignment = this.analyzer.buildAudienceAlignment(
      understanding,
      analysis,
      audienceIntelligence,
      input.preferredPlatforms
    );
    const selectedStrategies = this.analyzer.selectStrategies(
      input.marketingObjective,
      understanding,
      analysis
    );
    const creativePreparation = this.analyzer.prepareCreativeDirection(
      selectedStrategies,
      understanding,
      audienceAlignment
    );
    const campaignDirection = this.analyzer.prepareCampaignDirection(
      input.marketingObjective,
      selectedStrategies,
      audienceAlignment,
      understanding,
      input.campaignId
    );
    const scores = this.scorer.computeScores(
      businessGoals,
      audienceAlignment,
      selectedStrategies,
      creativePreparation,
      campaignDirection,
      input.marketingObjective
    );

    const validation = this.scorer.isStrategyValid(scores, selectedStrategies, audienceAlignment);
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Marketing strategy rejected", {
        productId: input.productId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Strategy validation failed — alignment with product and audience required",
      };
    }

    const existingList = this.records.getByProduct(input.productId);
    const existing = input.strategyId
      ? this.records.get(input.strategyId)
      : existingList.find((r) => r.marketingObjective === input.marketingObjective);
    const version = existing ? existing.version + 1 : 1;
    const strategyId =
      input.strategyId ?? existing?.strategyId ?? `marketing-strategy-${input.productId}-${input.marketingObjective}`;

    const draft: MarketingStrategyRecord = {
      strategyId,
      productId: input.productId,
      audienceId: audienceIntelligence.audienceId,
      understandingId: understanding.understandingId,
      analysisId: analysis.analysisId,
      marketingObjective: input.marketingObjective,
      businessGoals,
      audienceAlignment,
      selectedStrategies,
      creativePreparation,
      campaignDirection,
      scores,
      relationships: {
        products: [input.productId],
        brands: [input.brandName ?? understanding.identity.brand],
        audiences: [audienceIntelligence.audienceId, audienceIntelligence.profile.audienceName],
        campaigns: input.campaignId ? [input.campaignId] : [],
        creativeStyles: [],
        businessGoals: [],
        knowledgeRecords: [
          ...understanding.relationships.knowledgeRecords,
          ...audienceIntelligence.relationships.knowledgeRecords,
        ],
      },
      validated: true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      this.records.getAll(),
      understanding,
      analysis,
      audienceIntelligence,
      input.campaignId
    );

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.strategyQualityScore,
      confidenceScore: scores.confidenceScore,
      verificationStatus:
        scores.confidenceScore >= 75
          ? ProductIntelligenceVerificationStatus.Verified
          : ProductIntelligenceVerificationStatus.Pending,
      source: ProductIntelligenceSource.KnowledgeEngine,
      sourceRef: understanding.analysisId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Marketing strategy v${version} for ${input.marketingObjective}`,
          source: ProductIntelligenceSource.KnowledgeEngine,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.knowledgeRecords,
        ...draft.relationships.products,
        ...draft.relationships.campaigns,
      ],
      healthStatus: ProductIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Product intelligence validation failed for marketing strategy",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "strategy-analysis", "Marketing strategy prepared", {
      strategyId: draft.strategyId,
      productId: input.productId,
      objective: input.marketingObjective,
      strategyQualityScore: scores.strategyQualityScore,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "recommendation", "Strategy recommendations recorded", {
      strategies: selectedStrategies.map((s) => s.strategyType),
      primary: selectedStrategies.find((s) => s.priority === "primary")?.strategyType,
    });

    this.logger.log("info", "relationship", "Strategy relationships updated", {
      strategyId: draft.strategyId,
      relationshipCount:
        draft.relationships.products.length +
        draft.relationships.brands.length +
        draft.relationships.audiences.length +
        draft.relationships.knowledgeRecords.length,
    });

    return {
      success: true,
      record: draft,
      durationMs: Date.now() - start,
      diagnostics: [],
    };
  }

  search(query: MarketingStrategySearchQuery): MarketingStrategyRecord[] {
    let results = this.records.getAll();

    if (query.productId) {
      results = results.filter((r) => r.productId === query.productId);
    }
    if (query.marketingGoal) {
      results = results.filter((r) => r.marketingObjective === query.marketingGoal);
    }
    if (query.brand) {
      const brandLower = query.brand.toLowerCase();
      results = results.filter((r) =>
        r.relationships.brands.some((b) => b.toLowerCase().includes(brandLower))
      );
    }
    if (query.audience) {
      const audienceLower = query.audience.toLowerCase();
      results = results.filter(
        (r) =>
          r.audienceAlignment.targetAudience.toLowerCase().includes(audienceLower) ||
          r.relationships.audiences.some((a) => a.toLowerCase().includes(audienceLower))
      );
    }
    if (query.industry) {
      const industryLower = query.industry.toLowerCase();
      results = results.filter((r) =>
        r.audienceAlignment.customerNeeds.some((n) => n.toLowerCase().includes(industryLower)) ||
        r.businessGoals.growthObjectives.some((g) => g.toLowerCase().includes(industryLower))
      );
    }
    if (query.strategyType) {
      results = results.filter((r) =>
        r.selectedStrategies.some((s) => s.strategyType === query.strategyType)
      );
    }
    if (query.platform) {
      results = results.filter((r) =>
        r.audienceAlignment.preferredPlatforms.includes(query.platform!)
      );
    }
    if (query.businessGoal) {
      const prefix = this.businessGoalPrefix(query.businessGoal);
      results = results.filter((r) =>
        r.relationships.businessGoals.some((g) => g.startsWith(prefix))
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.strategyId.toLowerCase().includes(textLower) ||
          r.selectedStrategies.some(
            (s) =>
              s.strategyType.includes(textLower) ||
              s.rationale.toLowerCase().includes(textLower)
          ) ||
          r.creativePreparation.storyboardDirection.toLowerCase().includes(textLower)
      );
    }

    const limit = query.limit ?? 50;
    return results.slice(0, limit);
  }

  private businessGoalPrefix(goal: BusinessGoalType): string {
    const map: Record<BusinessGoalType, string> = {
      [BusinessGoalType.Sales]: "sales:",
      [BusinessGoalType.Marketing]: "marketing:",
      [BusinessGoalType.Brand]: "brand:",
      [BusinessGoalType.Customer]: "customer:",
      [BusinessGoalType.Growth]: "growth:",
      [BusinessGoalType.Communication]: "communication:",
    };
    return map[goal];
  }
}
