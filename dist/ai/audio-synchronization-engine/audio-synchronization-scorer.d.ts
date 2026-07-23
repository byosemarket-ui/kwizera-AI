import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { AudioSynchronizationRecordDraft } from "./audio-synchronization-analyzer.js";
import { AudioSynchronizationScores } from "./types.js";
export declare class AudioSynchronizationScorer {
    computeScores(draft: AudioSynchronizationRecordDraft, scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord, animationPlan: AnimationGenerationRecord, vfxPlan: VisualEffectsGenerationRecord): AudioSynchronizationScores;
    isPlanValid(scores: AudioSynchronizationScores, draft: AudioSynchronizationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: AudioSynchronizationScores, draft: AudioSynchronizationRecordDraft): boolean;
    isBrandConsistent(scene: SceneGenerationRecord): boolean;
    isAudioContinuityMaintained(draft: AudioSynchronizationRecordDraft): boolean;
    private computeAudioSync;
    private computeLipSync;
    private computeMusicAlignment;
    private computeSubtitleQuality;
    private computeProductionReadiness;
}
//# sourceMappingURL=audio-synchronization-scorer.d.ts.map