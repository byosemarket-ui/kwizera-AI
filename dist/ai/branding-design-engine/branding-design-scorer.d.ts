import { BrandConsistencyPlan, BrandingDesignRecord, BrandingDesignScores, ColorManagementPlan, DesignPlanningPlan, LogoPlanningPlan, MarketingMaterialsPlan, PrintDesignPlan, SocialMediaDesignPlan } from "./types.js";
import type { BrandingDesignContext } from "./branding-design-analyzer.js";
export declare class BrandingDesignScorer {
    computeScores(designPlanning: DesignPlanningPlan, logoPlanning: LogoPlanningPlan, marketingMaterials: MarketingMaterialsPlan, socialMediaDesign: SocialMediaDesignPlan, printDesign: PrintDesignPlan, brandConsistency: BrandConsistencyPlan, colorManagement: ColorManagementPlan, platformOptimizations: BrandingDesignRecord["platformOptimizations"], context: BrandingDesignContext): BrandingDesignScores;
    isBrandingPlanValid(scores: BrandingDesignScores, record: Pick<BrandingDesignRecord, "designPlanning" | "logoPlanning" | "brandConsistency" | "colorManagement" | "printDesign" | "socialMediaDesign">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: BrandingDesignScores, record: BrandingDesignRecord): boolean;
    isPrintReady(scores: BrandingDesignScores, record: BrandingDesignRecord): boolean;
    isBrandConsistent(context: BrandingDesignContext, brandConsistency: BrandConsistencyPlan): boolean;
    private computeBrandingScore;
    private computeGraphicDesignScore;
    private computeLayoutScore;
    private computeTypographyScore;
    private computeBrandConsistencyScore;
    private computePrintReadiness;
}
//# sourceMappingURL=branding-design-scorer.d.ts.map