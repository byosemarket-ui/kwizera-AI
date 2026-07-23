import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";
import { ProductionVideoAssetInventory, ProductionVideoDependencyValidation, ProductionVideoDeliveryInstructions, ProductionVideoExportPreparation, ProductionVideoPlatform, ProductionVideoPlanningRecommendation, ProductionVideoProfile, ProductionVideoPlatformRules, ProductionVideoRecoveryPlan, ProductionVideoRenderPreparation, ProductionVideoWorkflowPlanning } from "./types.js";
export interface UpstreamVideoProductionContext {
    analysis: VideoAnalysisIntelligenceRecord;
    understanding: VideoUnderstandingRecord;
    sceneDetection: SceneDetectionRecord;
    timeline: TimelineIntelligenceRecord;
    camera: CameraMovementRecord;
    motion: MotionIntelligenceRecord;
    style: VideoStyleIntelligenceRecord;
    enhancementPlan: VideoEnhancementPlanRecord;
    creativePlan: CreativeVideoIntelligenceRecord;
    foundationReady: boolean;
    knowledgeConnected: boolean;
    memoryConnected: boolean;
    productIntelligenceConnected: boolean;
    imageIntelligenceConnected: boolean;
}
export declare class ProductionVideoAnalyzer {
    buildFromIntelligence(ctx: UpstreamVideoProductionContext, projectId?: string, campaign?: string, platform?: ProductionVideoPlatform): {
        profile: ProductionVideoProfile;
        workflow: ProductionVideoWorkflowPlanning;
        assets: ProductionVideoAssetInventory;
        dependencies: ProductionVideoDependencyValidation;
        renderPreparation: ProductionVideoRenderPreparation;
        exportPreparation: ProductionVideoExportPreparation;
        deliveryInstructions: ProductionVideoDeliveryInstructions;
        platformRules: ProductionVideoPlatformRules;
        recoveryPlan: ProductionVideoRecoveryPlan;
        recommendations: ProductionVideoPlanningRecommendation[];
        keywords: string[];
    };
    validateDependencies(ctx: UpstreamVideoProductionContext): ProductionVideoDependencyValidation;
    private check;
    private inferPlatform;
    private buildWorkflow;
    private assetItem;
    private buildAssetInventory;
    private buildRenderPreparation;
    private buildExportPreparation;
    private buildDeliveryInstructions;
    private buildPlatformRules;
    private buildRecoveryPlan;
    private countMissingAssets;
    private buildRecommendations;
}
//# sourceMappingURL=production-video-analyzer.d.ts.map