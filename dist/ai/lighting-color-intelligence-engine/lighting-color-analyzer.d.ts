import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { ColorAnalysis, ColorImprovementPlan, ColorSuitability, LightingAnalysis, LightingColorIntelligenceRecommendation, LightingImprovementPlan, LightingSuitability } from "./types.js";
export declare class LightingColorAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, composition?: CompositionIntelligenceRecord | null, background?: BackgroundIntelligenceRecord | null, industry?: string): {
        lighting: LightingAnalysis;
        color: ColorAnalysis;
        lightingSuitability: LightingSuitability;
        colorSuitability: ColorSuitability;
        lightingPlan: LightingImprovementPlan;
        colorPlan: ColorImprovementPlan;
        recommendations: LightingColorIntelligenceRecommendation[];
        keywords: string[];
    };
    private inferLightingType;
    private inferLightingDirection;
    private inferReflections;
    private computeColorHarmony;
    private inferHueDistribution;
    private inferColorTemperature;
    private buildLightingSuitability;
    private buildColorSuitability;
    private buildLightingPlan;
    private buildColorPlan;
    private buildRecommendations;
}
//# sourceMappingURL=lighting-color-analyzer.d.ts.map