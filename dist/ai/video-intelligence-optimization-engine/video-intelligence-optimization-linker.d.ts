import type { VideoQualityPredictionRecord } from "../video-quality-prediction-engine/types.js";
import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";
import { VideoIntelligenceOptimizationRecord, VideoIntelligenceOptimizationRelationships } from "./types.js";
export declare class VideoIntelligenceOptimizationLinker {
    detectRelationships(record: VideoIntelligenceOptimizationRecord, qualityPrediction: VideoQualityPredictionRecord, productionPlan: ProductionVideoPlanningRecord): VideoIntelligenceOptimizationRelationships;
}
//# sourceMappingURL=video-intelligence-optimization-linker.d.ts.map