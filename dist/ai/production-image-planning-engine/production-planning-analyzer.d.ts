import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { ProductionExportPreparation, ProductionPlatformRules, ProductionAssetInventory, ProductionDependencyValidation, ProductionImagePlatform, ProductionImagePlanningRecommendation, ProductionImageProfile, ProductionRecoveryPlan, ProductionWorkflowPlanning, ProductionRenderPreparation } from "./types.js";
export interface UpstreamProductionContext {
    analysis: ImageAnalysisIntelligenceRecord;
    understanding: ImageUnderstandingRecord;
    detection: ObjectDetectionRecord;
    background: BackgroundIntelligenceRecord;
    composition: CompositionIntelligenceRecord;
    lightingColor: LightingColorIntelligenceRecord;
    brandVisual: BrandVisualIntelligenceRecord;
    enhancementPlan: ImageEnhancementPlanningRecord;
    creativePlan: CreativeImageIntelligenceRecord;
    knowledgeConnected: boolean;
    memoryConnected: boolean;
    productIntelligenceConnected: boolean;
}
export declare class ProductionPlanningAnalyzer {
    buildFromIntelligence(ctx: UpstreamProductionContext, projectId?: string, campaign?: string, platform?: ProductionImagePlatform): {
        profile: ProductionImageProfile;
        workflow: ProductionWorkflowPlanning;
        assets: ProductionAssetInventory;
        dependencies: ProductionDependencyValidation;
        renderPreparation: ProductionRenderPreparation;
        exportPreparation: ProductionExportPreparation;
        platformRules: ProductionPlatformRules;
        recoveryPlan: ProductionRecoveryPlan;
        recommendations: ProductionImagePlanningRecommendation[];
        keywords: string[];
    };
    validateDependencies(ctx: UpstreamProductionContext): ProductionDependencyValidation;
    private check;
    private inferPlatform;
    private buildWorkflow;
    private assetItem;
    private buildAssetInventory;
    private buildRenderPreparation;
    private buildExportPreparation;
    private buildPlatformRules;
    private buildRecoveryPlan;
    private countMissingAssets;
    private buildRecommendations;
}
//# sourceMappingURL=production-planning-analyzer.d.ts.map