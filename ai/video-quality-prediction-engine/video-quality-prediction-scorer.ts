import {

  VideoQualityCategoryScores,

  VideoQualityChecks,

  VideoQualityRiskItem,

  VideoQualityRiskSeverity,

} from "./types.js";

import type { UpstreamVideoQualityContext } from "./video-quality-prediction-analyzer.js";



export class VideoQualityPredictionScorer {

  computeScores(ctx: UpstreamVideoQualityContext, checks: VideoQualityChecks): VideoQualityCategoryScores {

    const { analysis, understanding, motion, camera, style, creativePlan, productionPlan } = ctx;



    const visualQualityScore = Math.round(

      (analysis.scores.visualQualityScore +

        analysis.scores.frameQualityScore +

        analysis.visual.sharpness +

        style.scores.cinematicScore) /

        4

    );



    const audioQualityScore = analysis.scores.audioQualityScore;



    const storytellingScore = Math.round(

      (understanding.scores.storytellingScore +

        creativePlan.scores.storytellingScore +

        ctx.timeline.scores.storyFlowScore) /

        3

    );



    const motionScore = Math.round(

      (motion.scores.motionQualityScore +

        motion.scores.motionStabilityScore +

        motion.motionPlan.motionContinuity) /

        3

    );



    const cameraScore = Math.round(

      (camera.scores.cameraMovementScore +

        camera.scores.cinematicScore +

        camera.scores.stabilityScore) /

        3

    );



    const styleScore = Math.round(

      (style.scores.styleConsistencyScore +

        style.scores.editingQualityScore +

        style.scores.brandStyleScore) /

        3

    );



    const brandConsistencyScore = Math.round(

      (understanding.scores.brandConsistencyScore +

        creativePlan.scores.brandConsistencyScore +

        style.scores.brandStyleScore) /

        3

    );



    const marketingEffectivenessScore = Math.round(

      (understanding.scores.marketingScore +

        creativePlan.scores.marketingScore +

        style.scores.marketingReadinessScore) /

        3

    );



    const platformReadinessScore = productionPlan.scores.productionReadinessScore;

    const productionReadinessScore = productionPlan.scores.productionReadinessScore;



    const overallVideoQualityScore = Math.round(

      (visualQualityScore +

        audioQualityScore +

        storytellingScore +

        motionScore +

        cameraScore +

        styleScore +

        brandConsistencyScore) /

        7

    );



    const checkBonus = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;



    const aiConfidenceScore = Math.round(

      (overallVideoQualityScore +

        marketingEffectivenessScore +

        platformReadinessScore +

        productionReadinessScore +

        creativePlan.scores.aiConfidenceScore +

        checkBonus * 100) /

        6

    );



    return {

      overallVideoQualityScore,

      visualQualityScore,

      audioQualityScore,

      storytellingScore,

      motionScore,

      cameraScore,

      styleScore,

      brandConsistencyScore,

      marketingEffectivenessScore,

      platformReadinessScore,

      productionReadinessScore,

      aiConfidenceScore,

    };

  }



  isPredictionValid(

    scores: VideoQualityCategoryScores,

    risks: VideoQualityRiskItem[],

    checks: VideoQualityChecks

  ): { valid: boolean; diagnostics: string[] } {

    const diagnostics: string[] = [];



    const unresolvedCritical = risks.filter((r) => !r.resolved && r.severity === "critical");

    if (unresolvedCritical.length > 0) {

      diagnostics.push(

        `Unresolved critical risk(s): ${unresolvedCritical.map((r) => r.category).join(", ")}`

      );

    }



    if (!checks.dependencyValidation) {

      diagnostics.push("Dependency validation must pass before quality prediction approval");

    }



    if (scores.overallVideoQualityScore < 45) {

      diagnostics.push(`Overall quality score ${scores.overallVideoQualityScore} below threshold (45)`);

    }



    if (scores.productionReadinessScore < 50) {

      diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (50)`);

    }



    if (scores.aiConfidenceScore < 55) {

      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);

    }



    return { valid: diagnostics.length === 0, diagnostics };

  }



  severityRank(severity: VideoQualityRiskSeverity): number {

    const ranks: Record<VideoQualityRiskSeverity, number> = {

      critical: 4,

      high: 3,

      medium: 2,

      low: 1,

    };

    return ranks[severity];

  }

}


