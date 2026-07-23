import { BrandValidationEntry, ImageQualityValidationEntry, ImageQualityValidationRecord, PlatformValidationEntry, PrintValidationEntry, QualityIssue, QualityLayerValidationEntry, QualityMaskValidationEntry, QualityValidationScores, TechnicalValidationEntry, TypographyValidationEntry } from "./types.js";
export declare class ImageQualityValidationScorer {
    computeScores(imageQuality: ImageQualityValidationEntry[], layerValidation: QualityLayerValidationEntry[], maskValidation: QualityMaskValidationEntry[], typographyValidation: TypographyValidationEntry[], brandValidation: BrandValidationEntry[], printValidation: PrintValidationEntry[], platformValidation: PlatformValidationEntry[], technicalValidation: TechnicalValidationEntry[], issues: QualityIssue[]): QualityValidationScores;
    isValidationComplete(scores: QualityValidationScores, issues: QualityIssue[], record: Pick<ImageQualityValidationRecord, "imageQuality" | "layerValidation" | "brandValidation" | "technicalValidation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isApproved(scores: QualityValidationScores, issues: QualityIssue[]): boolean;
    private averageScore;
    private computeColorScore;
    private computePassRate;
    private computePlatformScore;
    private computeTechnicalScore;
}
//# sourceMappingURL=image-quality-validation-scorer.d.ts.map