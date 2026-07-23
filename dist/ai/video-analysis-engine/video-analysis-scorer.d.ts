import { VideoAudioAnalysis, VideoFrameAnalysis, VideoProductionReadiness, VideoQualityScores, VideoTechnicalProfile, VideoTimelineAnalysis, VideoVisualAnalysis } from "./types.js";
export declare class VideoAnalysisScorer {
    computeScores(technical: VideoTechnicalProfile, frame: VideoFrameAnalysis, timeline: VideoTimelineAnalysis, audio: VideoAudioAnalysis, visual: VideoVisualAnalysis, missingFields: string[]): {
        scores: VideoQualityScores;
        productionReadiness: VideoProductionReadiness;
    };
    isAnalysisValid(scores: VideoQualityScores, missingFields: string[], criticallyIncomplete: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
    buildRecommendations(scores: VideoQualityScores, frame: VideoFrameAnalysis, audio: VideoAudioAnalysis): import("./types.js").VideoAnalysisRecommendation[];
}
//# sourceMappingURL=video-analysis-scorer.d.ts.map