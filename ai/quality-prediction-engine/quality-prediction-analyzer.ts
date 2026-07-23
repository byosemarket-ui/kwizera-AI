import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import type { ProductionPlanningRecord } from "../production-planning-engine/types.js";
import { ProductionPlanningAnalyzer } from "../production-planning-engine/production-planning-analyzer.js";
import {
  PlatformQualityEvaluation,
  QualityAnalysisSummary,
  QualityChecks,
  QualityPredictionInput,
  QualityPredictionProfile,
  QualityPredictions,
  QualityRecommendations,
  QualityScores,
  RiskItem,
  RiskSeverity,
} from "./types.js";

const PLATFORM_QUALITY: Record<CreativePlatform, { pacing: string; format: string; engagement: string; baseScore: number }> = {
  [CreativePlatform.TikTok]: { pacing: "fast hook-driven", format: "9:16 vertical", engagement: "high scroll-stop potential", baseScore: 85 },
  [CreativePlatform.InstagramReels]: { pacing: "visual-first concise", format: "9:16 vertical", engagement: "strong discovery reach", baseScore: 82 },
  [CreativePlatform.Facebook]: { pacing: "value-first clear", format: "1:1 or 16:9", engagement: "sound-off caption friendly", baseScore: 78 },
  [CreativePlatform.YouTubeShorts]: { pacing: "skip-proof hook", format: "9:16 vertical", engagement: "loop and subscribe CTA", baseScore: 84 },
  [CreativePlatform.YouTube]: { pacing: "narrative chapters", format: "16:9 horizontal", engagement: "deep storytelling", baseScore: 80 },
  [CreativePlatform.WhatsAppStatus]: { pacing: "conversational brief", format: "9:16 vertical", engagement: "personal direct CTA", baseScore: 76 },
  [CreativePlatform.Website]: { pacing: "scannable sections", format: "16:9 flexible", engagement: "conversion-focused", baseScore: 79 },
};

const assetAnalyzer = new ProductionPlanningAnalyzer();

export class QualityPredictionAnalyzer {
  buildProfile(
    input: QualityPredictionInput,
    productionPlan: ProductionPlanningRecord,
    version: number
  ): QualityPredictionProfile {
    const predictionId = input.predictionId ?? `quality-prediction-${input.productId}-${productionPlan.profile.platform}`;

    return {
      predictionId,
      projectId: input.projectId ?? productionPlan.projectId,
      productionPlanId: productionPlan.productionPlanId,
      product: productionPlan.profile.product,
      brand: productionPlan.profile.brand,
      campaign: productionPlan.profile.campaignGoal,
      platform: productionPlan.profile.platform,
      predictionVersion: version,
    };
  }

  buildAnalysisSummary(
    understanding: ProductUnderstandingRecord,
    audience: AudienceIntelligenceRecord | null,
    strategy: MarketingStrategyRecord,
    creative: CreativeDirectionRecord,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    productionPlan: ProductionPlanningRecord
  ): QualityAnalysisSummary {
    return {
      productUnderstanding: `Analyzed — ${understanding.identity.valueProposition} (score ${understanding.scores.understandingScore})`,
      audienceAlignment: audience
        ? `Analyzed — ${audience.profile.audienceName} (score ${audience.scores.audienceRelevanceScore})`
        : "Analyzed — audience profile from strategy context",
      marketingStrategy: `Analyzed — ${strategy.marketingObjective} (readiness ${strategy.scores.marketingReadinessScore})`,
      creativeDirection: `Analyzed — ${creative.profile.creativeStyle} on ${creative.profile.platform} (score ${creative.scores.creativeQualityScore})`,
      storyboard: `Analyzed — ${storyboard.scenes.length} scenes, ${storyboard.profile.estimatedDuration} (score ${storyboard.scores.storyboardQualityScore})`,
      scriptPlan: `Analyzed — ${scriptPlan.scenePlans.length} scene plans (score ${scriptPlan.scores.scriptPlanningScore})`,
      visualPlan: `Analyzed — ${visualPlan.scenePlans.length} visual plans (score ${visualPlan.scores.visualPlanningScore})`,
      audioPlan: `Analyzed — ${audioPlan.sceneAudioPlans.length} audio plans (score ${audioPlan.scores.audioPlanningScore})`,
      productionPlan: `Analyzed — ${productionPlan.sceneProductionPlans.length} production scenes (readiness ${productionPlan.scores.productionReadinessScore})`,
    };
  }

  computeScores(
    understanding: ProductUnderstandingRecord,
    audience: AudienceIntelligenceRecord | null,
    strategy: MarketingStrategyRecord,
    creative: CreativeDirectionRecord,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    productionPlan: ProductionPlanningRecord,
    checks: QualityChecks
  ): QualityScores {
    const visualQualityScore = Math.round(
      (visualPlan.scores.visualPlanningScore + visualPlan.scores.compositionScore + visualPlan.scores.brandConsistencyScore) / 3
    );
    const storytellingScore = Math.round(
      (storyboard.scores.storytellingScore + scriptPlan.scores.storytellingScore + scriptPlan.scores.readabilityScore) / 3
    );
    const marketingEffectivenessScore = Math.round(
      (strategy.scores.marketingReadinessScore + scriptPlan.scores.marketingScore + creative.scores.marketingAlignmentScore) / 3
    );
    const brandConsistencyScore = Math.round(
      (creative.scores.brandConsistencyScore +
        visualPlan.scores.brandConsistencyScore +
        scriptPlan.scores.brandConsistencyScore +
        audioPlan.scores.brandConsistencyScore) /
        4
    );
    const audienceAlignmentScore = audience
      ? Math.min(100, audience.scores.audienceRelevanceScore)
      : Math.min(100, Math.round((strategy.scores.audienceAlignmentScore + creative.scores.audienceAlignmentScore) / 2));
    const technicalReadinessScore = Math.round(
      (productionPlan.scores.assetReadinessScore + productionPlan.scores.dependencyScore + audioPlan.scores.synchronizationScore) / 3
    );
    const productionReadinessScore = productionPlan.scores.productionReadinessScore;

    const checkBonus = checks.issues.length === 0 ? 5 : 0;
    const overallQualityScore = Math.min(
      100,
      Math.round(
        (visualQualityScore +
          storytellingScore +
          marketingEffectivenessScore +
          brandConsistencyScore +
          audienceAlignmentScore +
          technicalReadinessScore +
          productionReadinessScore) /
          7 +
          checkBonus
      )
    );

    const aiConfidenceScore = Math.round(
      (overallQualityScore +
        understanding.scores.aiConfidenceScore +
        storyboard.scores.aiConfidenceScore +
        productionPlan.scores.aiConfidenceScore) /
        4
    );

    return {
      overallQualityScore,
      visualQualityScore,
      storytellingScore,
      marketingEffectivenessScore,
      brandConsistencyScore,
      audienceAlignmentScore,
      technicalReadinessScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  runQualityChecks(
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    productionPlan: ProductionPlanningRecord,
    creative: CreativeDirectionRecord
  ): QualityChecks {
    const issues: string[] = [];

    const brandConsistency =
      visualPlan.brandConsistency.brandColors &&
      visualPlan.brandConsistency.logoPlacement &&
      creative.validated;
    const storyConsistency =
      storyboard.scenes.length === scriptPlan.scenePlans.length &&
      scriptPlan.scenePlans.length === storyboard.scenes.length;
    const visualConsistency =
      visualPlan.scenePlans.length === storyboard.scenes.length &&
      visualPlan.validated;
    const audioConsistency =
      audioPlan.sceneAudioPlans.length === storyboard.scenes.length &&
      audioPlan.validated;
    const platformReadiness = productionPlan.platformRules.platform === storyboard.profile.platform;
    const requiredAssets = assetAnalyzer.getAllRequiredAssets(productionPlan.assets);
    const assetCompleteness =
      requiredAssets.length > 0 &&
      requiredAssets.every((a) => a.status === "planned" || a.status === "validated");
    const dependencyValidation =
      productionPlan.dependencies.issues.length === 0 &&
      productionPlan.dependencies.storyboard &&
      productionPlan.dependencies.scriptPlan &&
      productionPlan.dependencies.visualPlan &&
      productionPlan.dependencies.audioPlan;
    const workflowReadiness = productionPlan.workflow.renderingPreparation.startsWith("Plan rendering");

    if (!brandConsistency) issues.push("Brand consistency check failed");
    if (!storyConsistency) issues.push("Story consistency across storyboard and script");
    if (!visualConsistency) issues.push("Visual plan scene alignment issue");
    if (!audioConsistency) issues.push("Audio plan scene alignment issue");
    if (!assetCompleteness) issues.push("Required assets incomplete");
    if (!dependencyValidation) issues.push("Production dependencies not fully validated");

    return {
      brandConsistency,
      storyConsistency,
      visualConsistency,
      audioConsistency,
      platformReadiness,
      assetCompleteness,
      dependencyValidation,
      workflowReadiness,
      issues,
    };
  }

  detectRisks(
    checks: QualityChecks,
    productionPlan: ProductionPlanningRecord,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    scores: QualityScores,
    audience: AudienceIntelligenceRecord | null
  ): RiskItem[] {
    const risks: RiskItem[] = [];

    if (!checks.assetCompleteness) {
      risks.push({
        category: "missing-assets",
        description: "Required production assets not fully planned",
        severity: "high",
        resolved: false,
      });
    }
    if (!checks.storyConsistency) {
      risks.push({
        category: "weak-story-flow",
        description: "Scene count mismatch between storyboard and script plan",
        severity: "high",
        resolved: false,
      });
    }
    if (!checks.brandConsistency) {
      risks.push({
        category: "brand-inconsistency",
        description: "Brand visual or identity consistency below threshold",
        severity: "medium",
        resolved: false,
      });
    }
    if (scores.audienceAlignmentScore < 55) {
      risks.push({
        category: "poor-audience-alignment",
        description: `Audience alignment score ${scores.audienceAlignmentScore} below recommended threshold`,
        severity: audience ? "medium" : "low",
        resolved: false,
      });
    }
    if (!checks.dependencyValidation) {
      risks.push({
        category: "production-risk",
        description: "Production dependency validation incomplete",
        severity: "critical",
        resolved: false,
      });
    }
    if (scores.technicalReadinessScore < 50) {
      risks.push({
        category: "technical-problems",
        description: `Technical readiness ${scores.technicalReadinessScore} indicates production complexity`,
        severity: "medium",
        resolved: false,
      });
    }
    if (!storyboard.scenes.some((s) => s.scenePurpose === "hook")) {
      risks.push({
        category: "weak-story-flow",
        description: "Hook scene missing from storyboard",
        severity: "high",
        resolved: false,
      });
    }
    if (productionPlan.dependencies.issues.length > 0) {
      for (const issue of productionPlan.dependencies.issues) {
        risks.push({
          category: "production-risk",
          description: issue,
          severity: "critical",
          resolved: false,
        });
      }
    }

    const missingAssets = assetAnalyzer
      .getAllRequiredAssets(productionPlan.assets)
      .filter((a) => a.status === "missing");
    for (const asset of missingAssets) {
      risks.push({
        category: "missing-assets",
        description: `Missing asset: ${asset.assetId}`,
        severity: "critical",
        resolved: false,
      });
    }

    if (risks.length === 0) {
      risks.push({
        category: "production-risk",
        description: "No significant risks detected — project ready for quality-approved production",
        severity: "low",
        resolved: true,
      });
    }

    return risks;
  }

  buildPredictions(scores: QualityScores, risks: RiskItem[], storyboard: StoryboardIntelligenceRecord): QualityPredictions {
    const unresolvedCritical = risks.filter((r) => r.severity === "critical" && !r.resolved).length;
    const unresolvedHigh = risks.filter((r) => r.severity === "high" && !r.resolved).length;

    let productionRisk: RiskSeverity = "low";
    if (unresolvedCritical > 0) productionRisk = "critical";
    else if (unresolvedHigh > 1) productionRisk = "high";
    else if (unresolvedHigh === 1) productionRisk = "medium";

    let productionComplexity: RiskSeverity = "low";
    if (storyboard.scenes.length > 8) productionComplexity = "medium";
    if (storyboard.scenes.length > 12) productionComplexity = "high";

    const successProbability = Math.max(
      0,
      Math.min(100, scores.overallQualityScore - unresolvedCritical * 25 - unresolvedHigh * 10)
    );

    const opportunities: string[] = [];
    if (scores.storytellingScore < 80) opportunities.push("Strengthen hook and narrative arc");
    if (scores.visualQualityScore < 80) opportunities.push("Enhance visual composition consistency");
    if (scores.marketingEffectivenessScore < 80) opportunities.push("Sharpen CTA and offer presentation");
    if (scores.brandConsistencyScore < 85) opportunities.push("Tighten brand color and logo placement");
    if (opportunities.length === 0) opportunities.push("Maintain current quality — minor platform optimizations available");

    return {
      successProbability,
      productionRisk,
      marketingEffectiveness: scores.marketingEffectivenessScore,
      viewerEngagementPotential: Math.round((scores.storytellingScore + scores.audienceAlignmentScore) / 2),
      productionComplexity,
      improvementOpportunities: opportunities,
    };
  }

  buildRecommendations(
    scores: QualityScores,
    risks: RiskItem[],
    storyboard: StoryboardIntelligenceRecord,
    platform: CreativePlatform
  ): QualityRecommendations {
    const platformConfig = PLATFORM_QUALITY[platform];

    return {
      storyImprovements:
        scores.storytellingScore < 85
          ? ["Strengthen opening hook scene", "Ensure CTA scene aligns with campaign goal", "Verify story flow continuity across scenes"]
          : ["Story structure validated — consider A/B hook variants"],
      visualImprovements:
        scores.visualQualityScore < 85
          ? ["Align color palette across all scenes", "Verify hero product shots in feature scenes", "Check composition safe zones for platform"]
          : ["Visual plan quality strong — maintain composition standards"],
      audioImprovements:
        scores.technicalReadinessScore < 85
          ? ["Verify voice-over timing matches scene duration", "Balance music volume under narration", "Sync subtitles to narration pacing"]
          : ["Audio synchronization validated"],
      brandingImprovements:
        scores.brandConsistencyScore < 85
          ? ["Ensure logo placement in CTA and closing scenes", "Apply brand typography consistently", "Validate brand color usage per scene"]
          : ["Brand consistency meets production standards"],
      marketingImprovements:
        scores.marketingEffectivenessScore < 85
          ? ["Emphasize key product benefits in benefit scenes", "Place CTA with urgency messaging", "Align offer with campaign objective"]
          : ["Marketing messaging aligned with strategy"],
      platformOptimization: [
        `Optimize for ${platform} — ${platformConfig.format}`,
        `Apply ${platformConfig.pacing} pacing guidance`,
        `Target ${platformConfig.engagement} engagement pattern`,
      ],
      productionOptimization:
        risks.some((r) => r.severity === "high" || r.severity === "critical")
          ? ["Resolve high-severity risks before render queue", "Re-validate dependencies", "Complete asset planning checklist"]
          : ["Production workflow ready — proceed to render preparation queue"],
    };
  }

  buildPlatformQuality(storyboard: StoryboardIntelligenceRecord, scores: QualityScores): PlatformQualityEvaluation {
    const config = PLATFORM_QUALITY[storyboard.profile.platform];
    const readinessScore = Math.min(100, Math.round((config.baseScore + scores.productionReadinessScore) / 2));

    return {
      platform: storyboard.profile.platform,
      readinessScore,
      pacingFit: `Predicted ${config.pacing} fit for ${storyboard.scenes.length} scenes`,
      formatFit: `Predicted ${config.format} production readiness`,
      engagementFit: `Predicted ${config.engagement} — engagement potential ${scores.audienceAlignmentScore}/100`,
    };
  }

  hasUnresolvedCriticalRisks(risks: RiskItem[]): boolean {
    return risks.some((r) => r.severity === "critical" && !r.resolved);
  }

  applySafeRiskRepairs(risks: RiskItem[], checks: QualityChecks): RiskItem[] {
    return risks.map((risk) => {
      if (risk.severity === "critical" && risk.category === "production-risk" && checks.dependencyValidation) {
        return { ...risk, resolved: true, severity: "low" as RiskSeverity };
      }
      if (risk.category === "missing-assets" && checks.assetCompleteness) {
        return { ...risk, resolved: true, severity: "low" as RiskSeverity };
      }
      return risk;
    });
  }
}
