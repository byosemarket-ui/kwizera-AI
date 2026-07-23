import {
  AuthorizationValidation,
  ProductionCloningInstructions,
  VoiceAnalysis,
  VoiceCloningGenerationRecord,
  VoiceCloningPlan,
  VoiceCloningScores,
  VoiceConsistencyPlan,
} from "./types.js";
import type { CloningContext } from "./voice-cloning-generation-analyzer.js";

export class VoiceCloningGenerationScorer {
  computeScores(
    voiceAnalysis: VoiceAnalysis,
    cloningPlan: VoiceCloningPlan,
    consistencyPlan: VoiceConsistencyPlan,
    authValidation: AuthorizationValidation,
    productionInstructions: ProductionCloningInstructions,
    context: CloningContext
  ): VoiceCloningScores {
    const voiceSimilarityScore = this.computeVoiceSimilarity(voiceAnalysis, cloningPlan);
    const voiceStabilityScore = this.computeVoiceStability(consistencyPlan);
    const pronunciationScore = this.computePronunciationScore(voiceAnalysis, cloningPlan);
    const emotionPreservationScore = this.computeEmotionPreservation(voiceAnalysis, cloningPlan);
    const productionReadinessScore = this.computeProductionReadiness(
      voiceAnalysis,
      productionInstructions
    );
    const authorizationComplianceScore = this.computeAuthorizationCompliance(authValidation);
    const brandConsistencyScore = this.computeBrandConsistency(context, cloningPlan);

    const aiConfidenceScore = Math.round(
      (voiceSimilarityScore +
        voiceStabilityScore +
        pronunciationScore +
        emotionPreservationScore +
        productionReadinessScore +
        authorizationComplianceScore +
        brandConsistencyScore) /
        7
    );

    return {
      voiceSimilarityScore,
      voiceStabilityScore,
      pronunciationScore,
      emotionPreservationScore,
      productionReadinessScore,
      authorizationComplianceScore,
      brandConsistencyScore,
      aiConfidenceScore,
    };
  }

  isCloningPlanValid(
    scores: VoiceCloningScores,
    authValidation: AuthorizationValidation,
    record: Pick<
      VoiceCloningGenerationRecord,
      "voiceAnalysis" | "cloningPlan" | "consistencyPlan" | "authorizationValidation"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (!authValidation.overallAuthorized) {
      diagnostics.push("Authorization validation failed — cloning plan rejected");
      diagnostics.push(...authValidation.validationNotes);
    }
    if (scores.authorizationComplianceScore < 100) {
      diagnostics.push(`Authorization compliance score ${scores.authorizationComplianceScore} below required (100)`);
    }
    if (scores.voiceSimilarityScore < 55) {
      diagnostics.push(`Voice similarity score ${scores.voiceSimilarityScore} below threshold (55)`);
    }
    if (scores.voiceStabilityScore < 55) {
      diagnostics.push(`Voice stability score ${scores.voiceStabilityScore} below threshold (55)`);
    }
    if (scores.pronunciationScore < 55) {
      diagnostics.push(`Pronunciation score ${scores.pronunciationScore} below threshold (55)`);
    }
    if (scores.emotionPreservationScore < 50) {
      diagnostics.push(`Emotion preservation score ${scores.emotionPreservationScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    if (voiceAnalysisIncomplete(record.voiceAnalysis)) {
      diagnostics.push("Voice analysis incomplete");
    }
    if (Object.keys(record.cloningPlan.voiceIdentityMapping).length < 2) {
      diagnostics.push("Voice identity mapping incomplete");
    }
    if (record.consistencyPlan.consistencyScore < 50) {
      diagnostics.push("Voice consistency plan below minimum threshold");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: VoiceCloningScores, record: VoiceCloningGenerationRecord): boolean {
    return (
      record.authorizationValidation.overallAuthorized &&
      scores.productionReadinessScore >= 55 &&
      scores.voiceSimilarityScore >= 55 &&
      scores.voiceStabilityScore >= 55 &&
      record.productionInstructions.renderNotes.length >= 1
    );
  }

  isAuthorizationCompliant(authValidation: AuthorizationValidation): boolean {
    return authValidation.overallAuthorized && authValidation.authorizationStatus === "authorized";
  }

  isBrandConsistent(context: CloningContext, cloningPlan: VoiceCloningPlan): boolean {
    if (!context.brandName) return cloningPlan.brandVoiceAlignment.length >= 10;
    return cloningPlan.brandVoiceAlignment.toLowerCase().includes(context.brandName.toLowerCase());
  }

  private computeVoiceSimilarity(voiceAnalysis: VoiceAnalysis, plan: VoiceCloningPlan): number {
    let score = 45;
    if (voiceAnalysis.voiceQualityScore >= 80) score += 20;
    if (Object.keys(plan.voiceIdentityMapping).length >= 3) score += 15;
    if (plan.accentMapping.length >= 10) score += 10;
    if (voiceAnalysis.timbre.length >= 10) score += 10;
    return Math.min(100, score);
  }

  private computeVoiceStability(plan: VoiceConsistencyPlan): number {
    let score = 45;
    if (plan.consistencyScore >= 80) score += 25;
    if (plan.voiceStability.length >= 10) score += 15;
    if (plan.naturalRhythm.length >= 5) score += 15;
    return Math.min(100, score);
  }

  private computePronunciationScore(voiceAnalysis: VoiceAnalysis, plan: VoiceCloningPlan): number {
    let score = 45;
    if (Object.keys(plan.pronunciationMapping).length >= 1) score += 20;
    if (voiceAnalysis.pronunciation.length >= 10) score += 15;
    if (voiceAnalysis.properNames.length > 0 && Object.keys(plan.pronunciationMapping).length >= 1) score += 20;
    return Math.min(100, score);
  }

  private computeEmotionPreservation(voiceAnalysis: VoiceAnalysis, plan: VoiceCloningPlan): number {
    let score = 45;
    if (plan.emotionMapping.source === plan.emotionMapping.target) score += 25;
    if (voiceAnalysis.detectedEmotion) score += 20;
    if (plan.emotionMapping.source) score += 10;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    voiceAnalysis: VoiceAnalysis,
    instructions: ProductionCloningInstructions
  ): number {
    let score = 45;
    if (voiceAnalysis.durationMs > 0) score += 10;
    if (instructions.renderNotes.length >= 2) score += 15;
    if (instructions.identityGuidance.length >= 1) score += 15;
    if (instructions.qualityTargets.length >= 2) score += 15;
    return Math.min(100, score);
  }

  private computeAuthorizationCompliance(authValidation: AuthorizationValidation): number {
    if (!authValidation.overallAuthorized) return 0;
    let score = 70;
    if (authValidation.voiceConsentValid) score += 6;
    if (authValidation.usagePermissionValid) score += 6;
    if (authValidation.projectAuthorizationValid) score += 6;
    if (authValidation.licensingValid) score += 6;
    if (authValidation.expirationValid) score += 6;
    return Math.min(100, score);
  }

  private computeBrandConsistency(context: CloningContext, plan: VoiceCloningPlan): number {
    let score = 45;
    if (plan.brandVoiceAlignment.length >= 15) score += 20;
    if (context.brandGuidelines) score += 15;
    if (context.brandName && plan.brandVoiceAlignment.toLowerCase().includes(context.brandName.toLowerCase())) {
      score += 20;
    }
    return Math.min(100, score);
  }
}

function voiceAnalysisIncomplete(analysis: VoiceAnalysis): boolean {
  return !analysis.pitch || !analysis.timbre || analysis.voiceQualityScore < 50;
}
