import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceSource,
  ProductIntelligenceVerificationStatus,
} from "../product-intelligence-foundation/types.js";
import { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";
import { CreativeDirectionAnalyzer } from "./creative-direction-analyzer.js";
import { CreativeDirectionLinker } from "./creative-direction-linker.js";
import { CreativeDirectionLogger } from "./creative-direction-logger.js";
import { CreativeDirectionScorer } from "./creative-direction-scorer.js";
import { CreativeDirectionRecordStore } from "./creative-direction-stores.js";
import {
  CreativeDirectionInput,
  CreativeDirectionRecord,
  CreativeDirectionResult,
  CreativeDirectionSearchQuery,
} from "./types.js";

export class CreativeDirectionProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: CreativeDirectionAnalyzer,
    private readonly scorer: CreativeDirectionScorer,
    private readonly linker: CreativeDirectionLinker,
    private readonly records: CreativeDirectionRecordStore,
    private readonly logger: CreativeDirectionLogger
  ) {}

  async plan(input: CreativeDirectionInput): Promise<CreativeDirectionResult> {
    const start = Date.now();
    const analysisEngine = this.foundation.getProductAnalysisEngine();
    const understandingEngine = this.foundation.getProductUnderstandingEngine();
    const audienceEngine = this.foundation.getTargetAudienceIntelligenceEngine();
    const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();

    const analysis = analysisEngine.getProduct(input.productId);
    if (!analysis?.validated) {
      return this.reject(start, "Complete product analysis required before creative direction", [
        "Product must be analyzed and validated",
      ]);
    }

    const understanding = understandingEngine.getUnderstanding(input.productId);
    if (!understanding?.validated) {
      return this.reject(start, "Complete product understanding required before creative direction", [
        "Product must be understood and validated",
      ]);
    }

    let audience = audienceEngine.getAudiencesByProduct(input.productId)[0];
    if (!audience?.validated) {
      const audienceResult = await audienceEngine.analyzeAudience({ productId: input.productId });
      if (!audienceResult.success || !audienceResult.record) {
        return this.reject(
          start,
          audienceResult.message ?? "Complete audience intelligence required before creative direction",
          audienceResult.diagnostics.length > 0
            ? audienceResult.diagnostics
            : ["Target audience must be analyzed and validated"]
        );
      }
      audience = audienceResult.record;
    }

    let strategy = input.strategyId
      ? strategyEngine.getStrategy(input.strategyId)
      : strategyEngine.getStrategiesByProduct(input.productId).find(
          (s) => s.marketingObjective === (input.campaignGoal ?? s.marketingObjective)
        ) ?? strategyEngine.getStrategiesByProduct(input.productId)[0];

    if (!strategy?.validated) {
      const strategyResult = await strategyEngine.prepareMarketingStrategy({
        productId: input.productId,
        marketingObjective: input.campaignGoal ?? MarketingObjective.ProductPromotion,
        audienceId: audience.audienceId,
      });
      if (!strategyResult.success || !strategyResult.record) {
        return this.reject(
          start,
          strategyResult.message ?? "Complete marketing strategy required before creative direction",
          strategyResult.diagnostics.length > 0
            ? strategyResult.diagnostics
            : ["Marketing strategy must be prepared and validated"]
        );
      }
      strategy = strategyResult.record;
    }

    const profile = this.analyzer.buildProfile(
      input,
      strategy,
      audience,
      understanding,
      analysis
    );
    const visualDirection = this.analyzer.buildVisualDirection(
      profile,
      understanding,
      analysis,
      strategy
    );
    const cinematicDirection = this.analyzer.buildCinematicDirection(
      profile,
      strategy,
      understanding
    );
    const brandDirection = this.analyzer.buildBrandDirection(
      profile,
      understanding,
      analysis
    );
    const marketingDirection = this.analyzer.buildMarketingDirection(
      profile,
      strategy,
      understanding,
      audience
    );
    const platformDirections = this.analyzer.buildPlatformDirections(
      profile,
      strategy,
      understanding
    );

    const scores = this.scorer.computeScores(
      profile,
      visualDirection,
      brandDirection,
      marketingDirection,
      platformDirections,
      strategy,
      audience
    );

    const validation = this.scorer.isCreativeDirectionValid(
      scores,
      profile,
      brandDirection,
      marketingDirection,
      platformDirections
    );
    if (!validation.valid) {
      this.logger.log("warn", "validation", "Creative direction rejected", {
        productId: input.productId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Creative direction validation failed — product, audience, and strategy alignment required",
      };
    }

    const existing = input.creativeId
      ? this.records.get(input.creativeId)
      : this.records.getByProduct(input.productId).find((r) => r.profile.platform === profile.platform);
    const version = existing ? existing.version + 1 : 1;

    const draft: CreativeDirectionRecord = {
      creativeId: profile.creativeId,
      productId: input.productId,
      projectId: profile.projectId,
      strategyId: strategy.strategyId,
      audienceId: audience.audienceId,
      understandingId: understanding.understandingId,
      analysisId: analysis.analysisId,
      profile,
      visualDirection,
      cinematicDirection,
      brandDirection,
      marketingDirection,
      platformDirections,
      scores,
      relationships: {
        products: [input.productId],
        brands: [understanding.identity.brand],
        creativeStyles: [profile.creativeStyle],
        campaigns: strategy.relationships.campaigns,
        storyboards: [],
        scripts: [],
        visualPlans: [],
        audioPlans: [],
        knowledgeRecords: [],
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
      strategy,
      audience
    );

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.creativeQualityScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ProductIntelligenceVerificationStatus.Verified
          : ProductIntelligenceVerificationStatus.Pending,
      source: ProductIntelligenceSource.KnowledgeEngine,
      sourceRef: strategy.strategyId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Creative direction v${version} for ${profile.platform}`,
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
        message: "Product intelligence validation failed for creative direction",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "creative-planning", "Creative direction prepared", {
      creativeId: draft.creativeId,
      productId: input.productId,
      platform: profile.platform,
      creativeQualityScore: scores.creativeQualityScore,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "creative-direction", "Creative vision defined", {
      style: profile.creativeStyle,
      theme: profile.creativeTheme.slice(0, 80),
      mood: profile.mood,
    });

    this.logger.log("info", "relationship", "Creative relationships updated", {
      creativeId: draft.creativeId,
      relationshipCount:
        draft.relationships.products.length +
        draft.relationships.creativeStyles.length +
        draft.relationships.knowledgeRecords.length,
    });

    return {
      success: true,
      record: draft,
      durationMs: Date.now() - start,
      diagnostics: [],
    };
  }

  search(query: CreativeDirectionSearchQuery): CreativeDirectionRecord[] {
    let results = this.records.getAll();

    if (query.productId) results = results.filter((r) => r.productId === query.productId);
    if (query.creativeStyle) results = results.filter((r) => r.profile.creativeStyle === query.creativeStyle);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.brand) {
      const brandLower = query.brand.toLowerCase();
      results = results.filter(
        (r) =>
          r.profile.brand.toLowerCase().includes(brandLower) ||
          r.relationships.brands.some((b) => b.toLowerCase().includes(brandLower))
      );
    }
    if (query.industry) {
      const industryLower = query.industry.toLowerCase();
      results = results.filter((r) =>
        r.visualDirection.designStyle.toLowerCase().includes(industryLower) ||
        r.brandDirection.brandIdentity.toLowerCase().includes(industryLower)
      );
    }
    if (query.theme) {
      const themeLower = query.theme.toLowerCase();
      results = results.filter((r) => r.profile.creativeTheme.toLowerCase().includes(themeLower));
    }
    if (query.mood) {
      const moodLower = query.mood.toLowerCase();
      results = results.filter((r) => r.profile.mood.toLowerCase().includes(moodLower));
    }
    if (query.campaignGoal) {
      results = results.filter((r) => r.profile.campaignGoal === query.campaignGoal);
    }
    if (query.audience) {
      const audienceLower = query.audience.toLowerCase();
      results = results.filter((r) => r.profile.targetAudience.toLowerCase().includes(audienceLower));
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.creativeId.toLowerCase().includes(textLower) ||
          r.profile.creativeTheme.toLowerCase().includes(textLower) ||
          r.marketingDirection.hookDirection.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private reject(start: number, message: string, diagnostics: string[]): CreativeDirectionResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
