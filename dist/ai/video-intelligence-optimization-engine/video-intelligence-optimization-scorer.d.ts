import type { VideoQualityPredictionRecord } from "../video-quality-prediction-engine/types.js";
import { VideoModuleOptimizationResult, VideoOptimizationPerformanceMetrics, VideoOptimizationScores } from "./types.js";
export declare class VideoIntelligenceOptimizationScorer {
    computeScores(moduleResults: VideoModuleOptimizationResult[], performance: VideoOptimizationPerformanceMetrics, qualityPrediction: VideoQualityPredictionRecord): VideoOptimizationScores;
    isOptimizationValid(scores: VideoOptimizationScores, moduleResults: VideoModuleOptimizationResult[], qualityPreserved: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: VideoOptimizationScores, qualityPrediction: VideoQualityPredictionRecord, qualityPreserved: boolean): boolean;
}
//# sourceMappingURL=video-intelligence-optimization-scorer.d.ts.map