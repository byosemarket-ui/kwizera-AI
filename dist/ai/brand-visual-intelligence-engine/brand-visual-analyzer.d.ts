import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { BrandColorAnalysis, BrandVisualConsistencyCheck, BrandTypography, BrandVisualIntelligenceRecommendation, BrandVisualPlanning, BrandVisualProfile, BrandVisualStyle, LogoAnalysis } from "./types.js";
export declare class BrandVisualAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord, lightingColor: LightingColorIntelligenceRecord | null, brandName?: string, industry?: string, styleOverride?: BrandVisualStyle): {
        profile: BrandVisualProfile;
        logoAnalysis: LogoAnalysis;
        colorAnalysis: BrandColorAnalysis;
        typography: BrandTypography;
        visualStyle: BrandVisualStyle;
        consistency: BrandVisualConsistencyCheck;
        planning: BrandVisualPlanning;
        recommendations: BrandVisualIntelligenceRecommendation[];
        keywords: string[];
    };
    private inferVisualStyle;
    private buildTypography;
    private inferIconStyle;
    private buildPlanning;
    private buildRecommendations;
}
//# sourceMappingURL=brand-visual-analyzer.d.ts.map