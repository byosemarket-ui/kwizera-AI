import { ProductionAssetInventory, ProductionDependencyValidation, ProductionImagePlanningScores } from "./types.js";
export declare class ProductionPlanningScorer {
    computeScores(dependencies: ProductionDependencyValidation, assets: ProductionAssetInventory, enhancementReadiness: number, creativeLayoutScore: number): ProductionImagePlanningScores;
    isPlanValid(dependencies: ProductionDependencyValidation, scores: ProductionImagePlanningScores, assets: ProductionAssetInventory): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=production-planning-scorer.d.ts.map