import {
  EmotionPreservationPlan,
  PlatformSpeechOptimization,
  PronunciationAdaptationPlan,
  SpeechAnalysis,
  SpeechToSpeechGenerationRecord,
  SpeechToSpeechScores,
  TimingPreservationPlan,
  VoiceTransformationPlan,
} from "./types.js";
import type { TransformationContext } from "./speech-to-speech-generation-analyzer.js";

export class SpeechToSpeechGenerationScorer {
  computeScores(
    speechAnalysis: SpeechAnalysis,
    voiceTransformation: VoiceTransformationPlan,
    emotionPreservation: EmotionPreservationPlan,
    pronunciationAdaptation: PronunciationAdaptationPlan,
    timingPreservation: TimingPreservationPlan,
    platformOptimizations: PlatformSpeechOptimization[],
    context: TransformationContext
  ): SpeechToSpeechScores {
    const transformationQualityScore = this.computeTransformationQuality(speechAnalysis, voiceTransformation);
    const pronunciationScore = this.computePronunciationScore(speechAnalysis, pronunciationAdaptation);
    const emotionPreservationScore = this.computeEmotionPreservation(emotionPreservation);
    const timingPreservationScore = this.computeTimingPreservation(timingPreservation, speechAnalysis);
    const brandConsistencyScore = this.computeBrandConsistency(context, voiceTransformation);
    const productionReadinessScore = this.computeProductionReadiness(
      speechAnalysis,
      pronunciationAdaptation,
      timingPreservation,
      platformOptimizations
    );
    const aiConfidenceScore = Math.round(
      (transformationQualityScore +
        pronunciationScore +
        emotionPreservationScore +
        timingPreservationScore +
        brandConsistencyScore +
        productionReadinessScore) /
        6
    );

    return {
      transformationQualityScore,
      pronunciationScore,
      emotionPreservationScore,
      timingPreservationScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isTransformationValid(
    scores: SpeechToSpeechScores,
    record: Pick<
      SpeechToSpeechGenerationRecord,
      "speechAnalysis" | "voiceTransformation" | "emotionPreservation" | "timingPreservation"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.transformationQualityScore < 55) {
      diagnostics.push(`Transformation quality score ${scores.transformationQualityScore} below threshold (55)`);
    }
    if (scores.pronunciationScore < 55) {
      diagnostics.push(`Pronunciation score ${scores.pronunciationScore} below threshold (55)`);
    }
    if (scores.emotionPreservationScore < 50) {
      diagnostics.push(`Emotion preservation score ${scores.emotionPreservationScore} below threshold (50)`);
    }
    if (scores.timingPreservationScore < 55) {
      diagnostics.push(`Timing preservation score ${scores.timingPreservationScore} below threshold (55)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    if (record.speechAnalysis.speakerSegments.length < 1) {
      diagnostics.push("Speech analysis incomplete — no speaker segments");
    }
    if (!record.voiceTransformation.voiceMapping || Object.keys(record.voiceTransformation.voiceMapping).length < 1) {
      diagnostics.push("Voice transformation mapping incomplete");
    }
    if (record.emotionPreservation.emotionalArc.length < 1) {
      diagnostics.push("Emotion preservation arc incomplete");
    }
    if (record.timingPreservation.segmentTiming.length < 1) {
      diagnostics.push("Timing preservation segment mapping incomplete");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: SpeechToSpeechScores, record: SpeechToSpeechGenerationRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.transformationQualityScore >= 55 &&
      scores.timingPreservationScore >= 55 &&
      record.platformOptimizations.length >= 1 &&
      record.productionInstructions.renderNotes.length >= 1
    );
  }

  isBrandConsistent(context: TransformationContext, voicePlan: VoiceTransformationPlan): boolean {
    if (!context.brandName) return voicePlan.brandVoiceAlignment.length >= 10;
    return voicePlan.brandVoiceAlignment.toLowerCase().includes(context.brandName.toLowerCase());
  }

  private computeTransformationQuality(
    speechAnalysis: SpeechAnalysis,
    voiceTransformation: VoiceTransformationPlan
  ): number {
    let score = 45;
    if (speechAnalysis.audioQualityScore >= 70) score += 15;
    if (speechAnalysis.speakerSegments.length >= 1) score += 15;
    if (voiceTransformation.accentAdaptation.length >= 10) score += 10;
    if (voiceTransformation.pitchAdaptation.length >= 10) score += 10;
    if (voiceTransformation.speakingRateAdaptation.length >= 10) score += 5;
    return Math.min(100, score);
  }

  private computePronunciationScore(
    speechAnalysis: SpeechAnalysis,
    plan: PronunciationAdaptationPlan
  ): number {
    let score = 45;
    if (plan.numberReadingRules.length >= 2) score += 10;
    if (plan.dateReadingRules.length >= 1) score += 10;
    if (Object.keys(plan.pronunciationDictionary).length >= 1) score += 15;
    if (Object.keys(plan.namePreservation).length >= 1) score += 10;
    if (speechAnalysis.properNames.length > 0 && Object.keys(plan.namePreservation).length >= 1) score += 10;
    return Math.min(100, score);
  }

  private computeEmotionPreservation(plan: EmotionPreservationPlan): number {
    let score = 45;
    if (plan.emotionalArc.length >= 1) score += 20;
    if (plan.sceneEmotionNotes.length >= 1) score += 15;
    if (plan.preservationScore >= 80) score += 15;
    if (plan.intensityPreservation >= 50) score += 5;
    return Math.min(100, score);
  }

  private computeTimingPreservation(plan: TimingPreservationPlan, speechAnalysis: SpeechAnalysis): number {
    let score = 45;
    if (plan.naturalPauses.length >= 3) score += 15;
    if (plan.segmentTiming.length >= speechAnalysis.speakerSegments.length) score += 20;
    if (plan.breathPlanning.length >= 2) score += 10;
    if (plan.speechTiming.length >= 10) score += 10;
    return Math.min(100, score);
  }

  private computeBrandConsistency(
    context: TransformationContext,
    voicePlan: VoiceTransformationPlan
  ): number {
    let score = 45;
    if (voicePlan.brandVoiceAlignment.length >= 15) score += 20;
    if (context.brandGuidelines) score += 15;
    if (context.brandName && voicePlan.brandVoiceAlignment.toLowerCase().includes(context.brandName.toLowerCase())) {
      score += 20;
    }
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    speechAnalysis: SpeechAnalysis,
    pronunciationPlan: PronunciationAdaptationPlan,
    timingPlan: TimingPreservationPlan,
    platformOptimizations: PlatformSpeechOptimization[]
  ): number {
    let score = 45;
    if (speechAnalysis.durationMs > 0) score += 10;
    if (Object.keys(pronunciationPlan.phonemeMapping).length >= 0) score += 10;
    if (timingPlan.segmentTiming.length >= 1) score += 15;
    if (platformOptimizations.length >= 1) score += 15;
    if (timingPlan.breathPlanning.length >= 2) score += 15;
    return Math.min(100, score);
  }
}
