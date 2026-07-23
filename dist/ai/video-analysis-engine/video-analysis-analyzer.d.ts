import { VideoAnalysisEngineInput, VideoAudioAnalysis, VideoClassification, VideoFrameAnalysis, VideoTechnicalProfile, VideoTimelineAnalysis, VideoVisualAnalysis } from "./types.js";
export declare class VideoAnalysisAnalyzer {
    analyze(input: VideoAnalysisEngineInput): {
        technical: VideoTechnicalProfile;
        frame: VideoFrameAnalysis;
        timeline: VideoTimelineAnalysis;
        audio: VideoAudioAnalysis;
        visual: VideoVisualAnalysis;
        classification: VideoClassification;
    };
    private inferFormat;
    private inferContainer;
    private estimateBitrate;
    private computeAspectRatio;
    private computeOrientation;
    private classifyVideoType;
    private inferDominantColors;
    private buildTimelineSegments;
    private distributeScenes;
    private distributeShots;
}
//# sourceMappingURL=video-analysis-analyzer.d.ts.map