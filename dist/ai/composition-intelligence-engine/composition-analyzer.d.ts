import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { CompositionAnalysis, CompositionImprovementPlan, CompositionIntelligenceRecommendation, CompositionSuitability, ProductPlacement, VisualHierarchy } from "./types.js";
export declare class CompositionAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord, background?: BackgroundIntelligenceRecord | null, industry?: string): {
        compositionAnalysis: CompositionAnalysis;
        visualHierarchy: VisualHierarchy;
        productPlacement: ProductPlacement;
        suitability: CompositionSuitability;
        improvementPlan: CompositionImprovementPlan;
        recommendations: CompositionIntelligenceRecommendation[];
        keywords: string[];
    };
    private inferCompositionType;
    private computeSymmetry;
    private computeNegativeSpace;
    private computeBalance;
    private inferLeadingLines;
    private inferFraming;
    private inferCropping;
    private buildSuitability;
    private buildImprovementPlan;
    private buildRecommendations;
}
//# sourceMappingURL=composition-analyzer.d.ts.map