import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceSource,
  ProductIntelligenceVerificationStatus,
} from "../product-intelligence-foundation/types.js";
import { QualityPredictionAnalyzer } from "./quality-prediction-analyzer.js";
import { QualityPredictionLinker } from "./quality-prediction-linker.js";
import { QualityPredictionLogger } from "./quality-prediction-logger.js";
import { QualityPredictionScorer } from "./quality-prediction-scorer.js";
import { QualityPredictionRecordStore } from "./quality-prediction-stores.js";
import {
  QualityPredictionInput,
  QualityPredictionRecord,
  QualityPredictionResult,
  QualityPredictionSearchQuery,
} from "./types.js";

export class QualityPredictionProcessor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly analyzer: QualityPredictionAnalyzer,
    private readonly scorer: QualityPredictionScorer,
    private readonly linker: QualityPredictionLinker,
    private readonly records: QualityPredictionRecordStore,
    private readonly logger: QualityPredictionLogger
  ) {}

  async predictQuality(input: QualityPredictionInput): Promise<QualityPredictionResult> {
    const start = Date.now();
    const productionEngine = this.foundation.getProductionPlanningEngine();
    const storyboardEngine = this.foundation.getStoryboardIntelligenceEngine();
    const scriptEngine = this.foundation.getScriptPlanningEngine();
    const visualEngine = this.foundation.getVisualPlanningEngine();
    const audioEngine = this.foundation.getAudioPlanningEngine();
    const creativeEngine = this.foundation.getCreativeDirectionEngine();
    const strategyEngine = this.foundation.getMarketingStrategyIntelligenceEngine();
    const understandingEngine = this.foundation.getProductUnderstandingEngine();
    const audienceEngine = this.foundation.getTargetAudienceIntelligenceEngine();

    const understanding = understandingEngine.getUnderstanding(input.productId);
    if (!understanding?.validated) {
      return this.reject(start, "Complete product understanding required before quality prediction", [
        "Product must be understood and validated",
      ]);
    }

    let productionPlan = input.productionPlanId
      ? productionEngine.getProductionPlan(input.productionPlanId)
      : productionEngine.getProductionPlansByProduct(input.productId)[0];

    if (!productionPlan?.validated || !productionPlan.productionReady) {
      const productionResult = await productionEngine.createProductionPlan({
        productId: input.productId,
        productionPlanId: input.productionPlanId,
        projectId: input.projectId,
      });
      if (!productionResult.success || !productionResult.record) {
        return this.reject(
          start,
          productionResult.message ?? "Production-ready production plan required before quality prediction",
          productionResult.diagnostics.length > 0
            ? productionResult.diagnostics
            : ["Production plan must be validated and production-ready"]
        );
      }
      productionPlan = productionResult.record;
    }

    const storyboard = storyboardEngine.getStoryboard(productionPlan.storyboardId);
    const scriptPlan = scriptEngine.getScriptPlan(productionPlan.scriptPlanId);
    const visualPlan = visualEngine.getVisualPlan(productionPlan.visualPlanId);
    const audioPlan = audioEngine.getAudioPlan(productionPlan.audioPlanId);
    const creative = creativeEngine.getCreativeDirection(productionPlan.creativeId);
    const strategy = strategyEngine.getStrategy(productionPlan.strategyId);

    if (!storyboard || !scriptPlan || !visualPlan || !audioPlan || !creative || !strategy) {
      return this.reject(start, "All upstream planning records required for quality prediction", [
        "Missing storyboard, script, visual, audio, creative or strategy record",
      ]);
    }

    const audience = audienceEngine.getAudiencesByProduct(input.productId)[0] ?? null;

    const existing = input.predictionId
      ? this.records.get(input.predictionId)
      : this.records
          .getByProduct(input.productId)
          .find((r) => r.productionPlanId === productionPlan!.productionPlanId);
    const version = existing ? existing.version + 1 : 1;

    const profile = this.analyzer.buildProfile(input, productionPlan, version);
    const analysis = this.analyzer.buildAnalysisSummary(
      understanding,
      audience,
      strategy,
      creative,
      storyboard,
      scriptPlan,
      visualPlan,
      audioPlan,
      productionPlan
    );

    let checks = this.analyzer.runQualityChecks(
      storyboard,
      scriptPlan,
      visualPlan,
      audioPlan,
      productionPlan,
      creative
    );

    let scores = this.analyzer.computeScores(
      understanding,
      audience,
      strategy,
      creative,
      storyboard,
      scriptPlan,
      visualPlan,
      audioPlan,
      productionPlan,
      checks
    );

    let risks = this.analyzer.detectRisks(checks, productionPlan, storyboard, scriptPlan, scores, audience);

    if (this.analyzer.hasUnresolvedCriticalRisks(risks)) {
      const repairedPlan = await productionEngine.repairProductionPlan(input.productId);
      if (repairedPlan?.success && repairedPlan.record) {
        productionPlan = repairedPlan.record;
        checks = this.analyzer.runQualityChecks(
          storyboard,
          scriptPlan,
          visualPlan,
          audioPlan,
          productionPlan,
          creative
        );
        scores = this.analyzer.computeScores(
          understanding,
          audience,
          strategy,
          creative,
          storyboard,
          scriptPlan,
          visualPlan,
          audioPlan,
          productionPlan,
          checks
        );
        risks = this.analyzer.applySafeRiskRepairs(
          this.analyzer.detectRisks(checks, productionPlan, storyboard, scriptPlan, scores, audience),
          checks
        );
      }
    }

    const predictions = this.analyzer.buildPredictions(scores, risks, storyboard);
    const recommendations = this.analyzer.buildRecommendations(
      scores,
      risks,
      storyboard,
      storyboard.profile.platform
    );
    const platformQuality = this.analyzer.buildPlatformQuality(storyboard, scores);

    let validation = this.scorer.isPredictionValid(
      scores,
      checks,
      risks,
      productionPlan.productionReady
    );

    if (!validation.valid && checks.dependencyValidation && !this.analyzer.hasUnresolvedCriticalRisks(risks)) {
      risks = this.analyzer.applySafeRiskRepairs(risks, checks);
      validation = this.scorer.isPredictionValid(scores, checks, risks, productionPlan.productionReady);
    }

    if (!validation.valid) {
      this.logger.log("warn", "validation", "Quality prediction rejected", {
        productId: input.productId,
        diagnostics: validation.diagnostics,
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: validation.diagnostics,
        message: "Quality prediction validation failed — unresolved critical risks or quality below threshold",
      };
    }

    const productionReady = this.scorer.isProductionReady(
      scores,
      risks,
      productionPlan.productionReady,
      checks
    );

    const draft: QualityPredictionRecord = {
      predictionId: profile.predictionId,
      productId: input.productId,
      projectId: profile.projectId,
      productionPlanId: productionPlan.productionPlanId,
      storyboardId: storyboard.storyboardId,
      scriptPlanId: scriptPlan.scriptPlanId,
      visualPlanId: visualPlan.visualPlanId,
      audioPlanId: audioPlan.audioPlanId,
      creativeId: creative.creativeId,
      strategyId: strategy.strategyId,
      profile,
      analysis,
      scores,
      checks,
      predictions,
      recommendations,
      risks,
      platformQuality,
      relationships: {
        storyboards: [storyboard.storyboardId],
        scriptPlans: [scriptPlan.scriptPlanId],
        visualPlans: [visualPlan.visualPlanId],
        audioPlans: [audioPlan.audioPlanId],
        productionPlans: [productionPlan.productionPlanId],
        marketingStrategies: [strategy.strategyId],
        creativeDirections: [creative.creativeId],
        knowledgeRecords: [],
      },
      validated: true,
      productionReady,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(
      draft,
      storyboard,
      scriptPlan,
      visualPlan,
      audioPlan,
      productionPlan,
      creative,
      strategy,
      understanding
    );

    const intelligenceValidation = this.foundation.validateProductIntelligence({
      qualityScore: scores.overallQualityScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ProductIntelligenceVerificationStatus.Verified
          : ProductIntelligenceVerificationStatus.Pending,
      source: ProductIntelligenceSource.System,
      sourceRef: productionPlan.productionPlanId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Quality prediction v${version} — overall ${scores.overallQualityScore}/100`,
          source: ProductIntelligenceSource.System,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.knowledgeRecords,
        ...draft.relationships.productionPlans,
        ...draft.relationships.storyboards,
      ],
      healthStatus: ProductIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Product intelligence validation failed for quality prediction",
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "quality-analysis", "Quality analysis completed", {
      predictionId: draft.predictionId,
      overallScore: scores.overallQualityScore,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "prediction", "Quality predictions generated", {
      predictionId: draft.predictionId,
      successProbability: predictions.successProbability,
      productionRisk: predictions.productionRisk,
    });

    this.logger.log("info", "risk", "Risk analysis complete", {
      predictionId: draft.predictionId,
      riskCount: risks.length,
      criticalCount: risks.filter((r) => r.severity === "critical" && !r.resolved).length,
    });

    this.logger.log("info", "recommendation", "Recommendations generated", {
      predictionId: draft.predictionId,
      recommendationCategories: 7,
    });

    this.logger.log("info", "performance", "Quality prediction completed", {
      predictionId: draft.predictionId,
      durationMs: Date.now() - start,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: QualityPredictionSearchQuery): QualityPredictionRecord[] {
    let results = this.records.getAll();

    if (query.predictionId) results = results.filter((r) => r.predictionId === query.predictionId);
    if (query.projectId) results = results.filter((r) => r.projectId === query.projectId);
    if (query.productionPlanId) results = results.filter((r) => r.productionPlanId === query.productionPlanId);
    if (query.productId) results = results.filter((r) => r.productId === query.productId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.campaign) results = results.filter((r) => r.profile.campaign === query.campaign);
    if (query.minQualityScore !== undefined) {
      results = results.filter((r) => r.scores.overallQualityScore >= query.minQualityScore!);
    }
    if (query.riskLevel) {
      results = results.filter((r) => r.predictions.productionRisk === query.riskLevel);
    }
    if (query.brand) {
      const brandLower = query.brand.toLowerCase();
      results = results.filter((r) => r.profile.brand.toLowerCase().includes(brandLower));
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.predictionId.toLowerCase().includes(textLower) ||
          r.profile.product.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private reject(start: number, message: string, diagnostics: string[]): QualityPredictionResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
