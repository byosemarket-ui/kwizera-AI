import { EmotionPreservationPlan, PlatformSpeechOptimization, PronunciationAdaptationPlan, SpeechAnalysis, SpeechToSpeechGenerationRecord, SpeechToSpeechScores, TimingPreservationPlan, VoiceTransformationPlan } from "./types.js";
import type { TransformationContext } from "./speech-to-speech-generation-analyzer.js";
export declare class SpeechToSpeechGenerationScorer {
    computeScores(speechAnalysis: SpeechAnalysis, voiceTransformation: VoiceTransformationPlan, emotionPreservation: EmotionPreservationPlan, pronunciationAdaptation: PronunciationAdaptationPlan, timingPreservation: TimingPreservationPlan, platformOptimizations: PlatformSpeechOptimization[], context: TransformationContext): SpeechToSpeechScores;
    isTransformationValid(scores: SpeechToSpeechScores, record: Pick<SpeechToSpeechGenerationRecord, "speechAnalysis" | "voiceTransformation" | "emotionPreservation" | "timingPreservation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: SpeechToSpeechScores, record: SpeechToSpeechGenerationRecord): boolean;
    isBrandConsistent(context: TransformationContext, voicePlan: VoiceTransformationPlan): boolean;
    private computeTransformationQuality;
    private computePronunciationScore;
    private computeEmotionPreservation;
    private computeTimingPreservation;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=speech-to-speech-generation-scorer.d.ts.map