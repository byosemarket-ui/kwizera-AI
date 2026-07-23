import { EmotionPlan, NaturalnessPlan, PlatformSpeechOptimization, PronunciationPlan, TextAnalysis, TextToSpeechGenerationRecord, TextToSpeechScores, VoicePlan } from "./types.js";
import type { SpeechContext } from "./text-to-speech-generation-analyzer.js";
export declare class TextToSpeechGenerationScorer {
    computeScores(textAnalysis: TextAnalysis, voicePlan: VoicePlan, pronunciationPlan: PronunciationPlan, emotionPlan: EmotionPlan, naturalnessPlan: NaturalnessPlan, platformOptimizations: PlatformSpeechOptimization[], context: SpeechContext): TextToSpeechScores;
    isSpeechPlanValid(scores: TextToSpeechScores, record: Pick<TextToSpeechGenerationRecord, "textAnalysis" | "pronunciationPlan" | "emotionPlan" | "naturalnessPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: TextToSpeechScores, record: TextToSpeechGenerationRecord): boolean;
    isBrandConsistent(context: SpeechContext, voicePlan: VoicePlan): boolean;
    private computePronunciationScore;
    private computeNaturalnessScore;
    private computeEmotionScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=text-to-speech-generation-scorer.d.ts.map