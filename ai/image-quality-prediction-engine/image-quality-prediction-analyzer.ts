import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import {
  ImageQualityAnalysisSummary,
  ImageQualityChecks,
  ImageQualityPlatformEvaluation,
  ImageQualityPredictionPlatform,
  ImageQualityPredictionProfile,
  ImageQualityPredictions,
  ImageQualityRecommendation,
  ImageQualityRiskItem,
  ImageQualityRiskSeverity,
} from "./types.js";

export interface UpstreamQualityContext {
  analysis: ImageAnalysisIntelligenceRecord;
  understanding: ImageUnderstandingRecord;
  detection: ObjectDetectionRecord;
  background: BackgroundIntelligenceRecord;
  composition: CompositionIntelligenceRecord;
  lightingColor: LightingColorIntelligenceRecord;
  brandVisual: BrandVisualIntelligenceRecord;
  enhancementPlan: ImageEnhancementPlanningRecord;
  creativePlan: CreativeImageIntelligenceRecord;
  productionPlan: ProductionImagePlanningRecord;
}

export class ImageQualityPredictionAnalyzer {
  buildFromIntelligence(
    ctx: UpstreamQualityContext,
    projectId?: string,
    campaign?: string,
    platform?: ImageQualityPredictionPlatform
  ): {
    profile: ImageQualityPredictionProfile;
    analysisSummary: ImageQualityAnalysisSummary;
    checks: ImageQualityChecks;
    predictions: ImageQualityPredictions;
    risks: ImageQualityRiskItem[];
    platformQuality: ImageQualityPlatformEvaluation[];
    recommendations: ImageQualityRecommendation[];
    keywords: string[];
  } {
    const { analysis, understanding, productionPlan, creativePlan, brandVisual } = ctx;
    const product = analysis.content.products[0] ?? productionPlan.profile.product;
    const brand = brandVisual.profile.brandName ?? productionPlan.profile.brand;
    const campaignName =
      campaign ??
      productionPlan.profile.campaign ??
      understanding.relationships.relatedMarketingCampaigns[0] ??
      String(understanding.marketingGoal);
    const targetPlatform = platform ?? this.mapPlatform(productionPlan.profile.platform);

    const analysisSummary = this.buildAnalysisSummary(ctx);
    const checks = this.buildQualityChecks(ctx);
    const risks = this.detectRisks(ctx, checks);
    const predictions = this.buildPredictions(ctx, checks, risks);
    const platformQuality = this.buildPlatformQuality(ctx, targetPlatform);
    const recommendations = this.buildRecommendations(ctx, checks, risks, predictions);

    const profile: ImageQualityPredictionProfile = {
      predictionId: `quality-prediction-${analysis.imageId}`,
      projectId: projectId ?? productionPlan.profile.projectId,
      imageId: analysis.imageId,
      product,
      brand,
      campaign: campaignName,
      platform: targetPlatform,
      predictionVersion: "1.0",
    };

    const keywords = [
      ...analysis.keywords,
      product,
      brand,
      campaignName,
      targetPlatform,
      ...risks.map((r) => r.severity),
      ...recommendations.map((r) => r.category),
    ].filter(Boolean);

    return {
      profile,
      analysisSummary,
      checks,
      predictions,
      risks,
      platformQuality,
      recommendations,
      keywords,
    };
  }

  private mapPlatform(platform: string): ImageQualityPredictionPlatform {
    const map: Record<string, ImageQualityPredictionPlatform> = {
      instagram: ImageQualityPredictionPlatform.Instagram,
      facebook: ImageQualityPredictionPlatform.Facebook,
      tiktok: ImageQualityPredictionPlatform.TikTok,
      youtube: ImageQualityPredictionPlatform.YouTube,
      whatsapp: ImageQualityPredictionPlatform.WhatsApp,
      website: ImageQualityPredictionPlatform.Website,
      print: ImageQualityPredictionPlatform.Print,
    };
    return map[platform] ?? ImageQualityPredictionPlatform.Website;
  }

  private buildAnalysisSummary(ctx: UpstreamQualityContext): ImageQualityAnalysisSummary {
    return {
      imageAnalysis: `Analysis ${ctx.analysis.analysisId} — completeness ${ctx.analysis.scores.imageCompletenessScore}%`,
      imageUnderstanding: `Understanding ${ctx.understanding.understandingId} — marketing ${ctx.understanding.scores.marketingReadinessScore}%`,
      objectDetection: `Detection ${ctx.detection.detectionId} — product visibility tracked`,
      backgroundIntelligence: `Background ${ctx.background.backgroundId} — quality ${ctx.background.scores.backgroundQualityScore}%`,
      compositionIntelligence: `Composition ${ctx.composition.compositionId} — balance ${ctx.composition.compositionAnalysis.balance}%`,
      lightingColorIntelligence: `Lighting/color ${ctx.lightingColor.lightingColorId} analyzed`,
      brandVisualIntelligence: `Brand visual ${ctx.brandVisual.brandVisualId} — consistency ${ctx.brandVisual.scores.brandConsistencyScore}%`,
      enhancementPlanning: `Enhancement ${ctx.enhancementPlan.profile.enhancementPlanId} — readiness ${ctx.enhancementPlan.scores.enhancementReadinessScore}%`,
      creativeIntelligence: `Creative ${ctx.creativePlan.profile.creativeImageId} — layout ${ctx.creativePlan.scores.creativeLayoutScore}%`,
      productionPlanning: `Production ${ctx.productionPlan.profile.productionImagePlanId} — readiness ${ctx.productionPlan.scores.productionReadinessScore}%`,
    };
  }

  private buildQualityChecks(ctx: UpstreamQualityContext): ImageQualityChecks {
    const { analysis, composition, background, brandVisual, productionPlan, detection } = ctx;

    return {
      brandConsistency: brandVisual.scores.brandConsistencyScore >= 60,
      compositionConsistency: composition.compositionAnalysis.balance >= 55,
      backgroundSuitability: background.scores.backgroundSuitabilityScore >= 55,
      productVisibility: composition.visualHierarchy.productPriority >= 50,
      objectVisibility: detection.productDetection.productVisibility >= 50,
      lightingConsistency: ctx.lightingColor.scores.lightingQualityScore >= 55,
      colorConsistency: ctx.lightingColor.scores.colorQualityScore >= 55,
      typographyReadiness: brandVisual.scores.typographyScore >= 50,
      assetCompleteness: productionPlan.assets.originalImages.every((a) => a.status !== "missing"),
      dependencyValidation: productionPlan.dependencies.allRequiredPassed,
    };
  }

  private detectRisks(ctx: UpstreamQualityContext, checks: ImageQualityChecks): ImageQualityRiskItem[] {
    const risks: ImageQualityRiskItem[] = [];
    const width = ctx.analysis.technical.width;

    if (width < 1280) {
      risks.push({
        category: "resolution",
        description: `Low resolution detected (${width}px width)`,
        severity: width < 800 ? "critical" : "high",
        resolved: false,
      });
    }

    if (!checks.compositionConsistency) {
      risks.push({
        category: "composition",
        description: "Poor composition balance detected",
        severity: "medium",
        resolved: false,
      });
    }

    if (!checks.lightingConsistency) {
      risks.push({
        category: "lighting",
        description: "Weak lighting consistency",
        severity: "medium",
        resolved: false,
      });
    }

    if (!checks.colorConsistency) {
      risks.push({
        category: "color",
        description: "Poor color harmony",
        severity: "medium",
        resolved: false,
      });
    }

    if (!checks.brandConsistency) {
      risks.push({
        category: "brand",
        description: "Brand inconsistency detected",
        severity: ctx.brandVisual.scores.brandConsistencyScore < 40 ? "critical" : "high",
        resolved: false,
      });
    }

    if (!checks.assetCompleteness) {
      risks.push({
        category: "assets",
        description: "Missing required production assets",
        severity: "critical",
        resolved: false,
      });
    }

    if (!checks.dependencyValidation) {
      risks.push({
        category: "dependencies",
        description: "Production dependency validation incomplete",
        severity: "critical",
        resolved: false,
      });
    }

    if (ctx.analysis.visual.noiseLevel > 35) {
      risks.push({
        category: "technical",
        description: `High noise level (${ctx.analysis.visual.noiseLevel}%)`,
        severity: "medium",
        resolved: false,
      });
    }

    if (ctx.analysis.visual.sharpness < 55) {
      risks.push({
        category: "technical",
        description: `Low sharpness (${ctx.analysis.visual.sharpness}%)`,
        severity: "high",
        resolved: false,
      });
    }

    if (!checks.backgroundSuitability) {
      risks.push({
        category: "background",
        description: "Background suitability below threshold",
        severity: "low",
        resolved: false,
      });
    }

    if (!checks.productVisibility) {
      risks.push({
        category: "visibility",
        description: "Product visibility below optimal level",
        severity: "medium",
        resolved: false,
      });
    }

    return risks;
  }

  private buildPredictions(
    ctx: UpstreamQualityContext,
    checks: ImageQualityChecks,
    risks: ImageQualityRiskItem[]
  ): ImageQualityPredictions {
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const checkRatio = passedChecks / Object.keys(checks).length;
    const criticalCount = risks.filter((r) => r.severity === "critical" && !r.resolved).length;
    const highCount = risks.filter((r) => r.severity === "high" && !r.resolved).length;

    const productionSuccessProbability = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          ctx.productionPlan.scores.productionReadinessScore * 0.4 +
            checkRatio * 100 * 0.3 +
            ctx.creativePlan.scores.creativeLayoutScore * 0.2 +
            ctx.enhancementPlan.scores.enhancementReadinessScore * 0.1 -
            criticalCount * 25 -
            highCount * 8
        )
      )
    );

    const opportunities: string[] = [];
    if (!checks.lightingConsistency) opportunities.push("Improve lighting consistency before production");
    if (!checks.colorConsistency) opportunities.push("Harmonize color palette with brand guidelines");
    if (!checks.compositionConsistency) opportunities.push("Refine composition balance and hierarchy");
    if (!checks.typographyReadiness) opportunities.push("Strengthen typography readiness for overlays");
    if (ctx.enhancementPlan.scores.enhancementReadinessScore < 80) {
      opportunities.push("Apply planned enhancement improvements");
    }
    if (opportunities.length === 0) {
      opportunities.push("Quality metrics strong — maintain current production plan");
    }

    return {
      productionSuccessProbability,
      marketingImpact: Math.round(
        (ctx.understanding.scores.marketingReadinessScore +
          ctx.creativePlan.scores.marketingScore +
          ctx.brandVisual.scores.marketingReadinessScore) /
          3
      ),
      viewerAttentionPotential: Math.round(
        (ctx.composition.visualHierarchy.mainSubjectVisibility +
          ctx.composition.visualHierarchy.ctaVisibility +
          ctx.creativePlan.scores.visualImpactScore) /
          3
      ),
      readability: Math.round(
        (ctx.creativePlan.scores.readabilityScore +
          ctx.composition.compositionAnalysis.negativeSpace +
          ctx.brandVisual.logoAnalysis.logoContrast) /
          3
      ),
      platformPerformance: ctx.productionPlan.scores.productionReadinessScore,
      productionComplexity: Math.min(
        100,
        Math.round(30 + criticalCount * 20 + highCount * 10 + risks.length * 3)
      ),
      improvementOpportunities: opportunities,
    };
  }

  private buildPlatformQuality(
    ctx: UpstreamQualityContext,
    targetPlatform: ImageQualityPredictionPlatform
  ): ImageQualityPlatformEvaluation[] {
    const base = ctx.productionPlan.scores.productionReadinessScore;
    const platforms = Object.values(ImageQualityPredictionPlatform);

    return platforms.map((platform) => {
      let readiness = base;
      if (platform === ImageQualityPredictionPlatform.TikTok || platform === ImageQualityPredictionPlatform.Instagram) {
        readiness -= ctx.analysis.technical.width < 1080 ? 10 : 0;
      }
      if (platform === ImageQualityPredictionPlatform.Print) {
        readiness -= ctx.analysis.technical.width < 2400 ? 15 : 5;
      }
      if (platform === targetPlatform) readiness += 5;

      return {
        platform,
        readinessScore: Math.max(0, Math.min(100, readiness)),
        formatFit: platform === targetPlatform ? "Primary target platform" : "Secondary platform variant",
        engagementFit: `Engagement potential ${ctx.creativePlan.scores.visualImpactScore}%`,
        deliveryNotes: this.platformRuleNote(ctx.productionPlan, platform),
      };
    });
  }

  private platformRuleNote(
    productionPlan: UpstreamQualityContext["productionPlan"],
    platform: ImageQualityPredictionPlatform
  ): string {
    const rules = productionPlan.platformRules;
    const map: Record<ImageQualityPredictionPlatform, string> = {
      [ImageQualityPredictionPlatform.Instagram]: rules.instagram,
      [ImageQualityPredictionPlatform.Facebook]: rules.facebook,
      [ImageQualityPredictionPlatform.TikTok]: rules.tiktok,
      [ImageQualityPredictionPlatform.YouTube]: rules.youtube,
      [ImageQualityPredictionPlatform.WhatsApp]: rules.whatsapp,
      [ImageQualityPredictionPlatform.Website]: rules.website,
      [ImageQualityPredictionPlatform.Print]: rules.print,
    };
    return map[platform];
  }

  private buildRecommendations(
    ctx: UpstreamQualityContext,
    checks: ImageQualityChecks,
    risks: ImageQualityRiskItem[],
    predictions: ImageQualityPredictions
  ): ImageQualityRecommendation[] {
    const recs: ImageQualityRecommendation[] = [];

    for (const risk of risks.filter((r) => !r.resolved && (r.severity === "high" || r.severity === "critical"))) {
      recs.push({
        category: "risk",
        suggestion: `Resolve ${risk.category} risk: ${risk.description}`,
        priority: risk.severity === "critical" ? "high" : "medium",
        reason: `${risk.severity} severity`,
      });
    }

    if (!checks.brandConsistency) {
      recs.push({
        category: "brand",
        suggestion: "Align visual elements with brand visual intelligence guidelines",
        priority: "high",
        reason: `Brand consistency ${ctx.brandVisual.scores.brandConsistencyScore}%`,
      });
    }

    if (!checks.compositionConsistency) {
      recs.push({
        category: "composition",
        suggestion: "Improve composition balance before production",
        priority: "medium",
        reason: `Balance ${ctx.composition.compositionAnalysis.balance}%`,
      });
    }

    for (const opp of predictions.improvementOpportunities.slice(0, 2)) {
      recs.push({
        category: "quality",
        suggestion: opp,
        priority: "medium",
        reason: "Improvement opportunity identified",
      });
    }

    recs.push({
      category: "production",
      suggestion: `Production success probability ${predictions.productionSuccessProbability}%`,
      priority: "low",
      reason: "Quality prediction complete — no rendering performed",
    });

    recs.push({
      category: "platform",
      suggestion: `Platform readiness evaluated for ${ctx.productionPlan.profile.platform}`,
      priority: "low",
      reason: `Platform performance ${predictions.platformPerformance}%`,
    });

    return recs;
  }

  highestRiskLevel(risks: ImageQualityRiskItem[]): ImageQualityRiskSeverity {
    const order: ImageQualityRiskSeverity[] = ["critical", "high", "medium", "low"];
    for (const level of order) {
      if (risks.some((r) => !r.resolved && r.severity === level)) return level;
    }
    return "low";
  }
}
