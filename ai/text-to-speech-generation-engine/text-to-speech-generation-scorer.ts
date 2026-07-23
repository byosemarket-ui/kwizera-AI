import {
  EmotionPlan,
  NaturalnessPlan,
  PlatformSpeechOptimization,
  PronunciationPlan,
  TextAnalysis,
  TextToSpeechGenerationRecord,
  TextToSpeechScores,
  VoicePlan,
} from "./types.js";
import type { SpeechContext } from "./text-to-speech-generation-analyzer.js";

export class TextToSpeechGenerationScorer {
  computeScores(
    textAnalysis: TextAnalysis,
    voicePlan: VoicePlan,
    pronunciationPlan: PronunciationPlan,
    emotionPlan: EmotionPlan,
    naturalnessPlan: NaturalnessPlan,
    platformOptimizations: PlatformSpeechOptimization[],
    context: SpeechContext
  ): TextToSpeechScores {
    const pronunciationScore = this.computePronunciationScore(textAnalysis, pronunciationPlan);
    const naturalnessScore = this.computeNaturalnessScore(naturalnessPlan, textAnalysis);
    const emotionScore = this.computeEmotionScore(emotionPlan, voicePlan);
    const brandConsistencyScore = this.computeBrandConsistency(context, voicePlan);
    const productionReadinessScore = this.computeProductionReadiness(
      textAnalysis,
      pronunciationPlan,
      naturalnessPlan,
      platformOptimizations
    );
    const aiConfidenceScore = Math.round(
      (pronunciationScore + naturalnessScore + emotionScore + brandConsistencyScore + productionReadinessScore) / 5
    );

    return {
      pronunciationScore,
      naturalnessScore,
      emotionScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isSpeechPlanValid(
    scores: TextToSpeechScores,
    record: Pick<
      TextToSpeechGenerationRecord,
      "textAnalysis" | "pronunciationPlan" | "emotionPlan" | "naturalnessPlan"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.pronunciationScore < 55) diagnostics.push(`Pronunciation score ${scores.pronunciationScore} below threshold (55)`);
    if (scores.naturalnessScore < 55) diagnostics.push(`Naturalness score ${scores.naturalnessScore} below threshold (55)`);
    if (scores.emotionScore < 50) diagnostics.push(`Emotion score ${scores.emotionScore} below threshold (50)`);
    if (scores.brandConsistencyScore < 50) diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    if (scores.productionReadinessScore < 55) diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    if (scores.aiConfidenceScore < 55) diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);

    if (record.textAnalysis.wordCount < 3) diagnostics.push("Text analysis incomplete — insufficient word count");
    if (Object.keys(record.pronunciationPlan.pronunciationDictionary).length === 0 && record.textAnalysis.properNames.length > 0) {
      diagnostics.push("Pronunciation dictionary missing for detected proper names");
    }
    if (record.emotionPlan.emotionalArc.length < 2) diagnostics.push("Emotion plan arc incomplete");
    if (record.naturalnessPlan.pauses.length < 2) diagnostics.push("Naturalness pause planning incomplete");

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: TextToSpeechScores, record: TextToSpeechGenerationRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.pronunciationScore >= 55 &&
      scores.naturalnessScore >= 55 &&
      record.platformOptimizations.length >= 1 &&
      record.productionInstructions.renderNotes.length >= 1
    );
  }

  isBrandConsistent(context: SpeechContext, voicePlan: VoicePlan): boolean {
    if (!context.brandName) return voicePlan.brandVoiceAlignment.length >= 10;
    return voicePlan.brandVoiceAlignment.toLowerCase().includes(context.brandName.toLowerCase());
  }

  private computePronunciationScore(textAnalysis: TextAnalysis, plan: PronunciationPlan): number {
    let score = 45;
    if (plan.numberReadingRules.length >= 2) score += 10;
    if (plan.dateReadingRules.length >= 1) score += 10;
    if (plan.currencyReadingRules.length >= 1) score += 10;
    if (Object.keys(plan.pronunciationDictionary).length >= 1) score += 15;
    if (Object.keys(plan.acronymExpansions).length >= 1) score += 10;
    if (textAnalysis.properNames.length > 0 && Object.keys(plan.namePronunciations).length >= 1) score += 10;
    return Math.min(100, score);
  }

  private computeNaturalnessScore(plan: NaturalnessPlan, textAnalysis: TextAnalysis): number {
    let score = 45;
    if (plan.pauses.length >= 3) score += 15;
    if (plan.stressPatterns.length >= 1) score += 10;
    if (plan.emphasisPoints.length >= 1) score += 10;
    if (plan.breathPlanning.length >= 2) score += 10;
    if (plan.intonation && plan.rhythm) score += 10;
    if (textAnalysis.sentenceCount >= 1) score += 10;
    return Math.min(100, score);
  }

  private computeEmotionScore(plan: EmotionPlan, voicePlan: VoicePlan): number {
    let score = 45;
    if (plan.emotionalArc.length >= 2) score += 20;
    if (plan.sceneEmotionNotes.length >= 1) score += 15;
    if (plan.emotionIntensity >= 40 && plan.emotionIntensity <= 90) score += 10;
    if (voicePlan.toneGuidance.length >= 10) score += 10;
    return Math.min(100, score);
  }

  private computeBrandConsistency(context: SpeechContext, voicePlan: VoicePlan): number {
    let score = 45;
    if (voicePlan.brandVoiceAlignment.length >= 15) score += 20;
    if (context.brandGuidelines) score += 15;
    if (context.brandName && voicePlan.brandVoiceAlignment.toLowerCase().includes(context.brandName.toLowerCase())) {
      score += 20;
    }
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    textAnalysis: TextAnalysis,
    pronunciationPlan: PronunciationPlan,
    naturalnessPlan: NaturalnessPlan,
    platformOptimizations: PlatformSpeechOptimization[]
  ): number {
    let score = 45;
    if (textAnalysis.wordCount >= 5) score += 10;
    if (Object.keys(pronunciationPlan.phonemeMapping).length >= 1) score += 10;
    if (naturalnessPlan.speakingRate) score += 10;
    if (platformOptimizations.length >= 1) score += 15;
    if (naturalnessPlan.breathPlanning.length >= 2) score += 10;
    return Math.min(100, score);
  }
}
