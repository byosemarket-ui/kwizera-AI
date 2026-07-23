import { AuthorizationValidation, ProductionCloningInstructions, VoiceAnalysis, VoiceCloningGenerationRecord, VoiceCloningPlan, VoiceCloningScores, VoiceConsistencyPlan } from "./types.js";
import type { CloningContext } from "./voice-cloning-generation-analyzer.js";
export declare class VoiceCloningGenerationScorer {
    computeScores(voiceAnalysis: VoiceAnalysis, cloningPlan: VoiceCloningPlan, consistencyPlan: VoiceConsistencyPlan, authValidation: AuthorizationValidation, productionInstructions: ProductionCloningInstructions, context: CloningContext): VoiceCloningScores;
    isCloningPlanValid(scores: VoiceCloningScores, authValidation: AuthorizationValidation, record: Pick<VoiceCloningGenerationRecord, "voiceAnalysis" | "cloningPlan" | "consistencyPlan" | "authorizationValidation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: VoiceCloningScores, record: VoiceCloningGenerationRecord): boolean;
    isAuthorizationCompliant(authValidation: AuthorizationValidation): boolean;
    isBrandConsistent(context: CloningContext, cloningPlan: VoiceCloningPlan): boolean;
    private computeVoiceSimilarity;
    private computeVoiceStability;
    private computePronunciationScore;
    private computeEmotionPreservation;
    private computeProductionReadiness;
    private computeAuthorizationCompliance;
    private computeBrandConsistency;
}
//# sourceMappingURL=voice-cloning-generation-scorer.d.ts.map