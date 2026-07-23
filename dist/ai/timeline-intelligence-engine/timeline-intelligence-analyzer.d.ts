import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { SceneSequenceEntry, ShotSequenceEntry, SynchronizationState, TimelineDependency, TimelineHierarchy, TimelineIntelligenceInput, TimelineOptimization, TimelineRecommendation, TimelineSection, TimelineTrack, VariantTimeline } from "./types.js";
export declare class TimelineIntelligenceAnalyzer {
    analyze(analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, understanding: VideoUnderstandingRecord | null | undefined, input: TimelineIntelligenceInput): {
        timelineId: string;
        sections: TimelineSection[];
        hierarchy: TimelineHierarchy;
        dependencies: TimelineDependency[];
        sceneSequence: SceneSequenceEntry[];
        shotSequence: ShotSequenceEntry[];
        tracks: TimelineTrack[];
        synchronization: SynchronizationState;
        optimization: TimelineOptimization;
        variants: VariantTimeline[];
        recommendations: TimelineRecommendation[];
        keywords: string[];
        editingReadiness: number;
        renderingReadiness: number;
    };
    private buildSections;
    private buildSceneSequence;
    private buildShotSequence;
    private buildTracks;
    private buildDependencies;
    private buildSynchronization;
    private buildOptimization;
    private buildVariants;
    private buildRecommendations;
}
//# sourceMappingURL=timeline-intelligence-analyzer.d.ts.map