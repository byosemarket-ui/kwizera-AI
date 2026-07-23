import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import { MarketingVideoInput, MarketingVideoRecord, MarketingVideoRelationships } from "./types.js";
export interface UpstreamMarketingAssets {
    scenes: SceneGenerationRecord[];
    cameraPlans: CameraDirectorRecord[];
    motionPlans: MotionGenerationRecord[];
    animationPlans: AnimationGenerationRecord[];
    visualEffectPlans: VisualEffectsGenerationRecord[];
    audioPlans: AudioSynchronizationRecord[];
}
export declare class MarketingVideoLinker {
    detectRelationships(record: MarketingVideoRecord, storyboard: StoryboardGenerationRecord, upstream: UpstreamMarketingAssets, input: MarketingVideoInput): MarketingVideoRelationships;
}
//# sourceMappingURL=marketing-video-linker.d.ts.map