import { AudioBrandValidationEntry, AudioPlatformValidationEntry, AudioQualityIssue, AudioQualityValidationEntry, AudioQualityValidationRecord, AudioQualityValidationScores, AudioQualityTimelineValidationEntry, AudioQualityTrackValidationEntry, AudioSyncValidationEntry, AudioTechnicalValidationEntry } from "./types.js";
export declare class AudioQualityValidationScorer {
    computeScores(audioQuality: AudioQualityValidationEntry[], trackValidation: AudioQualityTrackValidationEntry[], timelineValidation: AudioQualityTimelineValidationEntry[], syncValidation: AudioSyncValidationEntry[], brandValidation: AudioBrandValidationEntry[], platformValidation: AudioPlatformValidationEntry[], technicalValidation: AudioTechnicalValidationEntry[], issues: AudioQualityIssue[]): AudioQualityValidationScores;
    isValidationComplete(scores: AudioQualityValidationScores, issues: AudioQualityIssue[], record: Pick<AudioQualityValidationRecord, "audioQuality" | "trackValidation" | "brandValidation" | "technicalValidation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isApproved(scores: AudioQualityValidationScores, issues: AudioQualityIssue[]): boolean;
    private averageScore;
    private computeLoudnessScore;
    private computeFrequencyScore;
    private computePassRate;
    private computePlatformScore;
}
//# sourceMappingURL=audio-quality-validation-scorer.d.ts.map