import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { BackgroundAnalysis, BackgroundClassification, BackgroundIntelligenceRecommendation, BackgroundQuality, BackgroundReplacementPlan, BackgroundSuitability } from "./types.js";
export declare class BackgroundAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord, industry?: string): {
        backgroundLabel: string;
        analysis: BackgroundAnalysis;
        classification: BackgroundClassification;
        quality: BackgroundQuality;
        suitability: BackgroundSuitability;
        replacementPlan: BackgroundReplacementPlan;
        recommendations: BackgroundIntelligenceRecommendation[];
        keywords: string[];
    };
    private classifyBackgroundType;
    private assessComplexity;
    private inferTexture;
    private inferPattern;
    private inferDepth;
    private computeCleanliness;
    private computeDistraction;
    private computeColorHarmony;
    private buildClassificationTags;
    private buildSuitability;
    private buildReplacementPlan;
    private buildRecommendations;
}
//# sourceMappingURL=background-analyzer.d.ts.map