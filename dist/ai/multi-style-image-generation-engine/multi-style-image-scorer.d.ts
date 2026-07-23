import { MultiStyleIdentityPreservationPlan, MultiStyleImageRecord, MultiStyleImageScores, MultiStylePlatformOptimization, MultiStyleVariationPlan, StyleTransformationPlan } from "./types.js";
import type { MultiStyleImageContext } from "./multi-style-image-analyzer.js";
export declare class MultiStyleImageScorer {
    computeScores(transformation: StyleTransformationPlan, variations: MultiStyleVariationPlan, preservation: MultiStyleIdentityPreservationPlan, platformOptimizations: MultiStylePlatformOptimization[], context: MultiStyleImageContext): MultiStyleImageScores;
    isStylePlanValid(scores: MultiStyleImageScores, record: Pick<MultiStyleImageRecord, "styleTransformation" | "styleVariations" | "identityPreservation" | "platformOptimizations">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: MultiStyleImageScores, record: MultiStyleImageRecord): boolean;
    isBrandConsistent(context: MultiStyleImageContext, transformation: StyleTransformationPlan): boolean;
    private computeStyleQuality;
    private computeStyleAccuracy;
    private computeIdentityPreservation;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=multi-style-image-scorer.d.ts.map