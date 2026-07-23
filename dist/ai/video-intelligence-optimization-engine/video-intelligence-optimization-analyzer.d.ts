import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import type { VideoQualityPredictionRecord } from "../video-quality-prediction-engine/types.js";
import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";
import { VideoCacheOptimization, VideoIntelligenceOptimizationInput, VideoIntelligenceRecoveryPoint, VideoModuleOptimizationResult, VideoOptimizationPerformanceMetrics, VideoOptimizationProfile, VideoOptimizationStrategies } from "./types.js";
export declare class VideoIntelligenceOptimizationAnalyzer {
    buildProfile(input: VideoIntelligenceOptimizationInput, qualityPrediction: VideoQualityPredictionRecord, productionPlan: ProductionVideoPlanningRecord, version: number): VideoOptimizationProfile;
    collectBaselineMetrics(foundation: AiVideoIntelligenceFoundation): Record<string, number>;
    createRecoveryPoint(optimizationId: string, baseline: Record<string, number>, cache: VideoCacheOptimization): VideoIntelligenceRecoveryPoint;
    analyzeModuleOptimizations(foundation: AiVideoIntelligenceFoundation, baseline: Record<string, number>): VideoModuleOptimizationResult[];
    buildStrategies(moduleResults: VideoModuleOptimizationResult[]): VideoOptimizationStrategies;
    buildCacheOptimization(foundation: AiVideoIntelligenceFoundation, videoId: string, existingCache: VideoCacheOptimization): VideoCacheOptimization;
    measurePerformance(foundation: AiVideoIntelligenceFoundation, baseline: Record<string, number>): VideoOptimizationPerformanceMetrics;
    validateQualityPreserved(moduleResults: VideoModuleOptimizationResult[]): {
        valid: boolean;
        issues: string[];
    };
}
//# sourceMappingURL=video-intelligence-optimization-analyzer.d.ts.map