import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";

import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";

import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";

import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";

import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";

import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";

import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";

import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";

import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";

import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";

import {

  VideoQualityAnalysisSummary,

  VideoQualityChecks,

  VideoQualityPlatformEvaluation,

  VideoQualityPredictionPlatform,

  VideoQualityPredictionProfile,

  VideoQualityPredictions,

  VideoQualityRecommendation,

  VideoQualityRiskItem,

  VideoQualityRiskSeverity,

} from "./types.js";



export interface UpstreamVideoQualityContext {

  analysis: VideoAnalysisIntelligenceRecord;

  understanding: VideoUnderstandingRecord;

  sceneDetection: SceneDetectionRecord;

  timeline: TimelineIntelligenceRecord;

  camera: CameraMovementRecord;

  motion: MotionIntelligenceRecord;

  style: VideoStyleIntelligenceRecord;

  enhancementPlan: VideoEnhancementPlanRecord;

  creativePlan: CreativeVideoIntelligenceRecord;

  productionPlan: ProductionVideoPlanningRecord;

}



export class VideoQualityPredictionAnalyzer {

  buildFromIntelligence(

    ctx: UpstreamVideoQualityContext,

    projectId?: string,

    campaign?: string,

    platform?: VideoQualityPredictionPlatform

  ): {

    profile: VideoQualityPredictionProfile;

    analysisSummary: VideoQualityAnalysisSummary;

    checks: VideoQualityChecks;

    predictions: VideoQualityPredictions;

    risks: VideoQualityRiskItem[];

    platformQuality: VideoQualityPlatformEvaluation[];

    recommendations: VideoQualityRecommendation[];

    keywords: string[];

  } {

    const { analysis, creativePlan, productionPlan } = ctx;

    const product = analysis.relationships.relatedProducts[0] ?? creativePlan.profile.product;

    const brand = analysis.relationships.relatedBrands[0] ?? creativePlan.profile.brand;

    const campaignName =

      campaign ??

      productionPlan.profile.campaign ??

      creativePlan.profile.campaign ??

      analysis.relationships.relatedCampaigns[0] ??

      "default-campaign";

    const targetPlatform = platform ?? this.mapPlatform(productionPlan.profile.platform);



    const analysisSummary = this.buildAnalysisSummary(ctx);

    const checks = this.buildQualityChecks(ctx);

    const risks = this.detectRisks(ctx, checks);

    const predictions = this.buildPredictions(ctx, checks, risks);

    const platformQuality = this.buildPlatformQuality(ctx, targetPlatform);

    const recommendations = this.buildRecommendations(ctx, checks, risks, predictions);



    const profile: VideoQualityPredictionProfile = {

      predictionId: `video-quality-prediction-${analysis.videoId}`,

      projectId: projectId ?? productionPlan.profile.projectId,

      videoId: analysis.videoId,

      product,

      brand,

      campaign: campaignName,

      platform: targetPlatform,

      predictionVersion: 1,

    };



    const keywords = [

      ...analysis.keywords,

      ...creativePlan.keywords,

      product,

      brand,

      campaignName,

      targetPlatform,

      "video-quality-prediction",

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



  private mapPlatform(platform: string): VideoQualityPredictionPlatform {

    const map: Record<string, VideoQualityPredictionPlatform> = {

      tiktok: VideoQualityPredictionPlatform.TikTok,

      instagram: VideoQualityPredictionPlatform.Instagram,

      "instagram-reels": VideoQualityPredictionPlatform.Instagram,

      facebook: VideoQualityPredictionPlatform.Facebook,

      youtube: VideoQualityPredictionPlatform.YouTube,

      whatsapp: VideoQualityPredictionPlatform.WhatsApp,

      website: VideoQualityPredictionPlatform.Website,

      television: VideoQualityPredictionPlatform.Television,

      tv: VideoQualityPredictionPlatform.Television,

      "digital-signage": VideoQualityPredictionPlatform.DigitalSignage,

      signage: VideoQualityPredictionPlatform.DigitalSignage,

    };

    return map[platform] ?? VideoQualityPredictionPlatform.Website;

  }



  private buildAnalysisSummary(ctx: UpstreamVideoQualityContext): VideoQualityAnalysisSummary {

    return {

      videoAnalysis: `Analysis ${ctx.analysis.analysisId} — completeness ${ctx.analysis.scores.videoCompletenessScore}%`,

      videoUnderstanding: `Understanding ${ctx.understanding.understandingId} — storytelling ${ctx.understanding.scores.storytellingScore}%`,

      sceneDetection: `Scene detection ${ctx.sceneDetection.detectionId} — ${ctx.sceneDetection.sceneCount} scenes`,

      timelineIntelligence: `Timeline ${ctx.timeline.timelineId} — sync ${ctx.timeline.scores.synchronizationScore}%`,

      cameraMovement: `Camera ${ctx.camera.intelligenceId} — cinematic ${ctx.camera.scores.cinematicScore}%`,

      motionIntelligence: `Motion ${ctx.motion.intelligenceId} — quality ${ctx.motion.scores.motionQualityScore}%`,

      videoStyle: `Style ${ctx.style.intelligenceId} — consistency ${ctx.style.scores.styleConsistencyScore}%`,

      enhancementPlanning: `Enhancement ${ctx.enhancementPlan.intelligenceId} — readiness ${ctx.enhancementPlan.scores.enhancementReadinessScore}%`,

      creativePlanning: `Creative ${ctx.creativePlan.profile.creativeVideoId} — score ${ctx.creativePlan.scores.creativeScore}%`,

      productionPlanning: `Production ${ctx.productionPlan.profile.productionPlanId} — readiness ${ctx.productionPlan.scores.productionReadinessScore}%`,

    };

  }



  private buildQualityChecks(ctx: UpstreamVideoQualityContext): VideoQualityChecks {

    const { understanding, sceneDetection, timeline, camera, motion, style, creativePlan, productionPlan } = ctx;



    return {

      storyConsistency: understanding.scores.storytellingScore >= 55,

      sceneConsistency: sceneDetection.scores.sceneDetectionScore >= 55,

      timelineConsistency: timeline.scores.timelineQualityScore >= 55,

      audioSynchronization:

        timeline.scores.synchronizationScore >= 55 &&

        Boolean(creativePlan.audioPlan.audioSynchronization),

      motionContinuity: motion.motionPlan.motionContinuity >= 55,

      cameraContinuity: camera.scores.stabilityScore >= 55,

      brandConsistency:

        style.scores.brandStyleScore >= 55 && creativePlan.scores.brandConsistencyScore >= 55,

      assetCompleteness: productionPlan.assets.sourceVideos.every((a) => a.status !== "missing"),

      dependencyValidation: productionPlan.dependencies.allRequiredPassed,

    };

  }



  private detectRisks(ctx: UpstreamVideoQualityContext, checks: VideoQualityChecks): VideoQualityRiskItem[] {

    const risks: VideoQualityRiskItem[] = [];

    const { analysis, understanding, motion, camera, style, productionPlan } = ctx;



    if (understanding.scores.storytellingScore < 55) {

      risks.push({

        category: "storytelling",

        description: `Weak storytelling detected (${understanding.scores.storytellingScore}%)`,

        severity: understanding.scores.storytellingScore < 40 ? "critical" : "high",

        resolved: false,

      });

    }



    if (analysis.scores.visualQualityScore < 55 || analysis.visual.sharpness < 55) {

      risks.push({

        category: "visual",

        description: `Poor visual quality — sharpness ${analysis.visual.sharpness}%, visual ${analysis.scores.visualQualityScore}%`,

        severity: analysis.visual.sharpness < 45 ? "critical" : "high",

        resolved: false,

      });

    }



    if (analysis.scores.audioQualityScore < 55 || !analysis.technical.audioCodec) {

      risks.push({

        category: "audio",

        description: `Audio problems detected — quality ${analysis.scores.audioQualityScore}%`,

        severity: analysis.scores.audioQualityScore < 40 ? "critical" : "medium",

        resolved: false,

      });

    }



    if (!checks.motionContinuity || motion.scores.motionStabilityScore < 55) {

      risks.push({

        category: "motion",

        description: `Motion problems — continuity ${motion.motionPlan.motionContinuity}%, stability ${motion.scores.motionStabilityScore}%`,

        severity: motion.scores.motionStabilityScore < 40 ? "high" : "medium",

        resolved: false,

      });

    }



    if (!checks.cameraContinuity || camera.scores.cameraMovementScore < 55) {

      risks.push({

        category: "camera",

        description: `Camera problems — movement ${camera.scores.cameraMovementScore}%, stability ${camera.scores.stabilityScore}%`,

        severity: camera.scores.stabilityScore < 40 ? "high" : "medium",

        resolved: false,

      });

    }



    if (style.scores.styleConsistencyScore < 55) {

      risks.push({

        category: "style",

        description: `Style inconsistency detected (${style.scores.styleConsistencyScore}%)`,

        severity: style.scores.styleConsistencyScore < 40 ? "high" : "medium",

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



    if (productionPlan.renderPreparation.renderPriority === "hero-quality" && analysis.technical.width! < 1920) {

      risks.push({

        category: "rendering",

        description: `Rendering risk — resolution ${analysis.technical.width}x${analysis.technical.height} below hero-quality target`,

        severity: "medium",

        resolved: false,

      });

    }



    if (!checks.timelineConsistency) {

      risks.push({

        category: "timeline",

        description: `Timeline consistency below threshold (${ctx.timeline.scores.timelineQualityScore}%)`,

        severity: "medium",

        resolved: false,

      });

    }



    if (!checks.audioSynchronization) {

      risks.push({

        category: "audio-sync",

        description: "Audio synchronization below threshold",

        severity: "medium",

        resolved: false,

      });

    }



    if (!checks.brandConsistency) {

      risks.push({

        category: "brand",

        description: "Brand consistency below threshold",

        severity: ctx.creativePlan.scores.brandConsistencyScore < 40 ? "high" : "medium",

        resolved: false,

      });

    }



    if (analysis.visual.noise > 35) {

      risks.push({

        category: "technical",

        description: `High visual noise (${analysis.visual.noise}%)`,

        severity: "low",

        resolved: false,

      });

    }



    return risks;

  }



  private buildPredictions(

    ctx: UpstreamVideoQualityContext,

    checks: VideoQualityChecks,

    risks: VideoQualityRiskItem[]

  ): VideoQualityPredictions {

    const passedChecks = Object.values(checks).filter(Boolean).length;

    const checkRatio = passedChecks / Object.keys(checks).length;

    const criticalCount = risks.filter((r) => r.severity === "critical" && !r.resolved).length;

    const highCount = risks.filter((r) => r.severity === "high" && !r.resolved).length;



    const productionSuccessProbability = Math.max(

      0,

      Math.min(

        100,

        Math.round(

          ctx.productionPlan.scores.productionReadinessScore * 0.35 +

            checkRatio * 100 * 0.25 +

            ctx.creativePlan.scores.creativeScore * 0.2 +

            ctx.enhancementPlan.scores.enhancementReadinessScore * 0.1 +

            ctx.understanding.scores.storytellingScore * 0.1 -

            criticalCount * 25 -

            highCount * 8

        )

      )

    );



    const opportunities: string[] = [];

    if (!checks.storyConsistency) opportunities.push("Strengthen storytelling flow before production");

    if (!checks.motionContinuity) opportunities.push("Improve motion continuity across scenes");

    if (!checks.cameraContinuity) opportunities.push("Stabilize camera movement for smoother delivery");

    if (!checks.audioSynchronization) opportunities.push("Align audio synchronization with scene timing");

    if (!checks.brandConsistency) opportunities.push("Align visual style with brand guidelines");

    if (ctx.enhancementPlan.scores.enhancementReadinessScore < 80) {

      opportunities.push("Apply planned enhancement improvements");

    }

    if (opportunities.length === 0) {

      opportunities.push("Quality metrics strong — maintain current production plan");

    }



    const viewerEngagement = Math.round(

      (ctx.creativePlan.scores.visualImpactScore +

        ctx.understanding.scores.marketingScore +

        ctx.style.scores.marketingReadinessScore) /

        3

    );



    const viewerRetention = Math.round(

      (ctx.understanding.scores.storytellingScore +

        ctx.timeline.scores.storyFlowScore +

        ctx.creativePlan.scores.storytellingScore) /

        3

    );



    return {

      productionSuccessProbability,

      viewerEngagement,

      viewerRetention,

      marketingImpact: Math.round(

        (ctx.understanding.scores.marketingScore +

          ctx.creativePlan.scores.marketingScore +

          ctx.style.scores.marketingReadinessScore) /

          3

      ),

      conversionPotential: Math.round(

        (ctx.creativePlan.scores.marketingScore +

          ctx.understanding.scores.audienceAlignmentScore +

          productionSuccessProbability) /

          3

      ),

      renderingComplexity: Math.min(

        100,

        Math.round(25 + criticalCount * 20 + highCount * 10 + risks.length * 3)

      ),

      improvementOpportunities: opportunities,

    };

  }



  private buildPlatformQuality(

    ctx: UpstreamVideoQualityContext,

    targetPlatform: VideoQualityPredictionPlatform

  ): VideoQualityPlatformEvaluation[] {

    const base = ctx.productionPlan.scores.productionReadinessScore;

    const width = ctx.analysis.technical.width ?? 1920;

    const height = ctx.analysis.technical.height ?? 1080;

    const isVertical = height > width;

    const platforms = Object.values(VideoQualityPredictionPlatform);



    return platforms.map((platform) => {

      let readiness = base;

      if (

        (platform === VideoQualityPredictionPlatform.TikTok ||

          platform === VideoQualityPredictionPlatform.Instagram) &&

        !isVertical

      ) {

        readiness -= 10;

      }

      if (platform === VideoQualityPredictionPlatform.Television && width < 1920) {

        readiness -= 15;

      }

      if (platform === VideoQualityPredictionPlatform.WhatsApp && (ctx.analysis.technical.durationMs ?? 0) > 60_000) {

        readiness -= 10;

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

    productionPlan: UpstreamVideoQualityContext["productionPlan"],

    platform: VideoQualityPredictionPlatform

  ): string {

    const rules = productionPlan.platformRules;

    const map: Record<VideoQualityPredictionPlatform, string> = {

      [VideoQualityPredictionPlatform.TikTok]: rules.tiktok,

      [VideoQualityPredictionPlatform.Instagram]: rules.instagram,

      [VideoQualityPredictionPlatform.Facebook]: rules.facebook,

      [VideoQualityPredictionPlatform.YouTube]: rules.youtube,

      [VideoQualityPredictionPlatform.WhatsApp]: rules.whatsapp,

      [VideoQualityPredictionPlatform.Website]: rules.website,

      [VideoQualityPredictionPlatform.Television]: rules.television,

      [VideoQualityPredictionPlatform.DigitalSignage]: rules.digitalSignage,

    };

    return map[platform];

  }



  private buildRecommendations(

    ctx: UpstreamVideoQualityContext,

    checks: VideoQualityChecks,

    risks: VideoQualityRiskItem[],

    predictions: VideoQualityPredictions

  ): VideoQualityRecommendation[] {

    const recs: VideoQualityRecommendation[] = [];



    for (const risk of risks.filter((r) => !r.resolved && (r.severity === "high" || r.severity === "critical"))) {

      recs.push({

        category: "risk",

        suggestion: `Resolve ${risk.category} risk: ${risk.description}`,

        priority: risk.severity === "critical" ? "high" : "medium",

        reason: `${risk.severity} severity`,

      });

    }



    if (!checks.storyConsistency) {

      recs.push({

        category: "storytelling",

        suggestion: "Strengthen narrative structure and story flow",

        priority: "high",

        reason: `Storytelling ${ctx.understanding.scores.storytellingScore}%`,

      });

    }



    if (!checks.motionContinuity) {

      recs.push({

        category: "motion",

        suggestion: "Improve motion continuity across scenes",

        priority: "medium",

        reason: `Motion continuity ${ctx.motion.motionPlan.motionContinuity}%`,

      });

    }



    if (!checks.cameraContinuity) {

      recs.push({

        category: "camera",

        suggestion: "Stabilize camera movement for production readiness",

        priority: "medium",

        reason: `Camera stability ${ctx.camera.scores.stabilityScore}%`,

      });

    }



    if (!checks.brandConsistency) {

      recs.push({

        category: "brand",

        suggestion: "Align visual style with brand guidelines",

        priority: "high",

        reason: `Brand consistency ${ctx.creativePlan.scores.brandConsistencyScore}%`,

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

      reason: `Viewer engagement ${predictions.viewerEngagement}%`,

    });



    recs.push({

      category: "marketing",

      suggestion: `Marketing impact predicted at ${predictions.marketingImpact}% with conversion potential ${predictions.conversionPotential}%`,

      priority: "low",

      reason: "Marketing effectiveness forecast from creative and understanding intelligence",

    });



    recs.push({

      category: "visual",

      suggestion: `Visual quality score ${ctx.analysis.scores.visualQualityScore}% — maintain sharpness and color consistency`,

      priority: "low",

      reason: "Visual quality baseline from video analysis",

    });



    recs.push({

      category: "audio",

      suggestion: `Audio quality ${ctx.analysis.scores.audioQualityScore}% — verify synchronization before render`,

      priority: "low",

      reason: "Audio readiness from analysis and timeline intelligence",

    });



    recs.push({

      category: "quality",

      suggestion: `Rendering complexity estimated at ${predictions.renderingComplexity}% — plan resource allocation`,

      priority: "low",

      reason: "Rendering complexity forecast from risk and dependency analysis",

    });



    return recs;

  }



  highestRiskLevel(risks: VideoQualityRiskItem[]): VideoQualityRiskSeverity {

    const order: VideoQualityRiskSeverity[] = ["critical", "high", "medium", "low"];

    for (const level of order) {

      if (risks.some((r) => !r.resolved && r.severity === level)) return level;

    }

    return "low";

  }

}


