import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { QualityValidationUpstreamAssets, QualityValidationRecordDraft } from "./video-quality-validation-analyzer.js";
import { QualityValidationScores } from "./types.js";
export declare class VideoQualityValidationScorer {
    computeScores(draft: QualityValidationRecordDraft, storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets): QualityValidationScores;
    isValidationValid(scores: QualityValidationScores, draft: QualityValidationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isApproved(scores: QualityValidationScores, draft: QualityValidationRecordDraft): boolean;
    isBrandConsistent(storyboard: StoryboardGenerationRecord, upstream: QualityValidationUpstreamAssets): boolean;
    hasCriticalIssues(draft: QualityValidationRecordDraft): boolean;
    private computeVisualQuality;
    private computeAudioQuality;
    private computeMotionScore;
    private computeAnimationScore;
    private computeCameraScore;
    private computeBrandConsistency;
    private computePlatformCompatibility;
    private computeRenderReadiness;
}
//# sourceMappingURL=video-quality-validation-scorer.d.ts.map