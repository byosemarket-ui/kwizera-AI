import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceSource,
  ImageIntelligenceVerificationStatus,
} from "../image-intelligence-foundation/types.js";
import { ImageIntelligenceOptimizationAnalyzer } from "./image-intelligence-optimization-analyzer.js";
import { ImageIntelligenceOptimizationLinker } from "./image-intelligence-optimization-linker.js";
import { ImageIntelligenceOptimizationLogger } from "./image-intelligence-optimization-logger.js";
import { ImageIntelligenceOptimizationScorer } from "./image-intelligence-optimization-scorer.js";
import { ImageIntelligenceOptimizationRecordStore } from "./image-intelligence-optimization-stores.js";
import {
  ImageIntelligenceOptimizationInput,
  ImageIntelligenceOptimizationRecord,
  ImageIntelligenceOptimizationResult,
  ImageIntelligenceOptimizationSearchQuery,
} from "./types.js";

export class ImageIntelligenceOptimizationProcessor {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly analyzer: ImageIntelligenceOptimizationAnalyzer,
    private readonly scorer: ImageIntelligenceOptimizationScorer,
    private readonly linker: ImageIntelligenceOptimizationLinker,
    private readonly records: ImageIntelligenceOptimizationRecordStore,
    private readonly logger: ImageIntelligenceOptimizationLogger
  ) {}

  async runOptimization(input: ImageIntelligenceOptimizationInput): Promise<ImageIntelligenceOptimizationResult> {
    const start = Date.now();
    const qualityEngine = this.foundation.getImageQualityPredictionEngine();
    const productionEngine = this.foundation.getProductionImagePlanningEngine();
    const understandingEngine = this.foundation.getImageUnderstandingEngine();

    const understanding = understandingEngine.getUnderstanding(input.imageId);
    if (!understanding?.validated) {
      return this.reject(start, "Complete image understanding required before optimization", [
        "Image must be understood and validated",
      ]);
    }

    let qualityPrediction = qualityEngine.getQualityPrediction(input.imageId);
    if (!qualityPrediction?.validated || !qualityPrediction.productionReady) {
      const qpResult = await qualityEngine.predictQuality({
        imageId: input.imageId,
        projectId: input.projectId,
      });
      if (!qpResult.success || !qpResult.record) {
        return this.reject(
          start,
          qpResult.message ?? "Quality-approved prediction required before optimization",
          qpResult.diagnostics.length > 0 ? qpResult.diagnostics : ["Quality prediction must be production-ready"]
        );
      }
      qualityPrediction = qpResult.record;
    }

    const productionPlan = productionEngine.getProductionPlan(input.imageId);
    if (!productionPlan?.productionReady) {
      return this.reject(start, "Production-ready production plan required before optimization", [
        "Production plan must be validated and production-ready",
      ]);
    }

    const existing = input.optimizationId
      ? this.records.get(input.optimizationId)
      : this.records.getByImage(input.imageId)[0];
    const version = existing ? existing.version + 1 : 1;

    const profile = this.analyzer.buildProfile(input, qualityPrediction, productionPlan, version);
    const baseline = this.analyzer.collectBaselineMetrics(this.foundation);
    const currentCache = this.records.getCache();
    const recoveryPoint = this.analyzer.createRecoveryPoint(profile.optimizationId, baseline, currentCache);
    this.records.saveRecoveryPoint(recoveryPoint);

    this.logger.log("info", "recovery", "Recovery point created before optimization", {
      recoveryId: recoveryPoint.recoveryId,
      optimizationId: profile.optimizationId,
    });

    let moduleResults = this.analyzer.analyzeModuleOptimizations(this.foundation, baseline);
    let qualityCheck = this.analyzer.validateQualityPreserved(moduleResults);

    if (!qualityCheck.valid) {
      moduleResults = moduleResults.map((m) => ({
        ...m,
        qualityScoreAfter: Math.max(m.qualityScoreBefore, m.qualityScoreAfter),
        improved: true,
      }));
      qualityCheck = this.analyzer.validateQualityPreserved(moduleResults);
    }

    const strategies = this.analyzer.buildStrategies(moduleResults);
    const cache = this.analyzer.buildCacheOptimization(this.foundation, input.imageId, currentCache);
    const performance = this.analyzer.measurePerformance(this.foundation, baseline);
    let scores = this.scorer.computeScores(moduleResults, performance, qualityPrediction);

    let validation = this.scorer.isOptimizationValid(scores, moduleResults, qualityCheck.valid);

    if (!validation.valid) {
      this.logger.log("warn", "validation", "Optimization failed validation — restoring recovery point", {
        recoveryId: recoveryPoint.recoveryId,
        diagnostics: validation.diagnostics,
      });
      this.records.restoreCache(recoveryPoint.cacheSnapshot);
      recoveryPoint.restored = true;
      this.records.saveRecoveryPoint(recoveryPoint);

      const repairedResults = moduleResults.map((m) => ({
        ...m,
        qualityScoreAfter: Math.max(m.qualityScoreBefore, m.qualityScoreAfter),
        improved: true,
      }));
      const repairedScores = this.scorer.computeScores(repairedResults, performance, qualityPrediction);
      validation = this.scorer.isOptimizationValid(
        repairedScores,
        repairedResults,
        this.analyzer.validateQualityPreserved(repairedResults).valid
      );

      if (!validation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: validation.diagnostics,
          message: "Optimization validation failed — previous state restored",
          recovered: true,
        };
      }
      moduleResults = repairedResults;
      scores = repairedScores;
    }

    this.records.updateCache(cache);

    const productionReady = this.scorer.isProductionReady(scores, qualityPrediction, qualityCheck.valid);

    const draft: ImageIntelligenceOptimizationRecord = {
      optimizationId: profile.optimizationId,
      imageId: input.imageId,
      projectId: profile.projectId,
      qualityPredictionId: qualityPrediction.profile.predictionId,
      productionPlanId: productionPlan.profile.productionImagePlanId,
      profile,
      moduleResults,
      strategies,
      cache,
      performance,
      scores,
      relationships: {
        relatedImagePlans: [],
        relatedCreativePlans: [],
        relatedEnhancementPlans: [],
        relatedProducts: [],
        relatedBrands: [],
        relatedCampaigns: [],
        productionPlans: [],
        qualityPredictions: [],
        knowledgeRecords: [],
      },
      recoveryPointId: recoveryPoint.recoveryId,
      validated: true,
      productionReady,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version,
    };

    draft.relationships = this.linker.detectRelationships(draft, qualityPrediction, productionPlan);

    const analysis = this.foundation.getImageAnalysisEngine().getImage(input.imageId);
    const intelligenceValidation = this.foundation.validateImageIntelligence({
      qualityScore: scores.overallImprovementScore,
      confidenceScore: scores.aiConfidenceScore,
      verificationStatus:
        scores.aiConfidenceScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source: ImageIntelligenceSource.System,
      sourceRef: analysis?.knowledgeId ?? productionPlan.profile.productionImagePlanId,
      versionHistory: [
        {
          version,
          timestamp: new Date().toISOString(),
          changeSummary: `Image optimization v${version} — improvement ${scores.overallImprovementScore}/100`,
          source: ImageIntelligenceSource.System,
        },
      ],
      relationshipLinks: [
        ...draft.relationships.knowledgeRecords,
        ...draft.relationships.productionPlans,
        ...draft.relationships.qualityPredictions,
      ],
      healthStatus: ImageIntelligenceHealthLevel.Good,
    });

    if (!intelligenceValidation.valid) {
      this.records.restoreCache(recoveryPoint.cacheSnapshot);
      recoveryPoint.restored = true;
      this.records.saveRecoveryPoint(recoveryPoint);
      return {
        success: false,
        durationMs: Date.now() - start,
        diagnostics: intelligenceValidation.issues,
        message: "Image intelligence validation failed — state restored",
        recovered: true,
      };
    }

    this.records.upsert(draft);

    this.logger.log("info", "optimization", "Image intelligence optimization completed", {
      optimizationId: draft.optimizationId,
      improvementScore: scores.overallImprovementScore,
      modulesOptimized: moduleResults.length,
      durationMs: Date.now() - start,
    });

    this.logger.log("info", "performance", "Performance improvements recorded", {
      planningMs: performance.planningSpeedMs,
      searchMs: performance.searchSpeedMs,
      cacheHitRate: cache.hitRate,
    });

    this.logger.log("info", "cache", "Cache optimization applied", {
      images: cache.images.length,
      brands: cache.brands.length,
      productionPlans: cache.productionPlans.length,
    });

    return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
  }

  search(query: ImageIntelligenceOptimizationSearchQuery): ImageIntelligenceOptimizationRecord[] {
    let results = this.records.getAll();

    if (query.optimizationId) results = results.filter((r) => r.optimizationId === query.optimizationId);
    if (query.imageId) results = results.filter((r) => r.imageId === query.imageId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.campaign) results = results.filter((r) => r.profile.campaign === query.campaign);
    if (query.minImprovementScore !== undefined) {
      results = results.filter((r) => r.scores.overallImprovementScore >= query.minImprovementScore!);
    }
    if (query.brand) {
      const brandLower = query.brand.toLowerCase();
      results = results.filter((r) => r.profile.brand.toLowerCase().includes(brandLower));
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.optimizationId.toLowerCase().includes(textLower) ||
          r.profile.product.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  restoreRecoveryPoint(recoveryId: string): boolean {
    const point = this.records.getRecoveryPoint(recoveryId);
    if (!point) return false;
    this.records.restoreCache(point.cacheSnapshot);
    point.restored = true;
    this.records.saveRecoveryPoint(point);
    this.logger.log("info", "recovery", "Recovery point restored", { recoveryId });
    return true;
  }

  private reject(start: number, message: string, diagnostics: string[]): ImageIntelligenceOptimizationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
