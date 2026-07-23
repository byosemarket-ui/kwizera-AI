import { AudioRenderRecord, AudioRenderScores, AudioRenderAssetValidationEntry, AudioRenderOutputProfileEntry, AudioRenderResourcePlanningPlan, AudioRenderSettingsPlan, AudioRenderTimelineValidationEntry, AudioRenderTrackValidationEntry, AudioRenderValidationEntry } from "./types.js";
import type { AudioRenderContext } from "./audio-render-analyzer.js";
export declare class AudioRenderScorer {
    computeScores(renderValidation: AudioRenderValidationEntry[], trackValidation: AudioRenderTrackValidationEntry[], timelineValidation: AudioRenderTimelineValidationEntry[], assetValidation: AudioRenderAssetValidationEntry[], renderSettings: AudioRenderSettingsPlan, outputProfiles: AudioRenderOutputProfileEntry[], resourcePlanning: AudioRenderResourcePlanningPlan, context: AudioRenderContext): AudioRenderScores;
    isRenderPlanValid(scores: AudioRenderScores, record: Pick<AudioRenderRecord, "renderValidation" | "trackValidation" | "timelineValidation" | "assetValidation" | "renderSettings" | "resourcePlanning">): {
        valid: boolean;
        diagnostics: string[];
    };
    isRenderReady(scores: AudioRenderScores, record: AudioRenderRecord): boolean;
    isProductionReady(context: AudioRenderContext): boolean;
    private computeRenderValidationScore;
    private computeTrackIntegrity;
    private computeTimelineIntegrity;
    private computeAssetQuality;
    private computePlatformCompatibility;
    private computePerformanceScore;
}
//# sourceMappingURL=audio-render-scorer.d.ts.map