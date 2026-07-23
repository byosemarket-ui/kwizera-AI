import { ProductionVideoAssetInventory, ProductionVideoDependencyValidation, ProductionVideoPlanningScores } from "./types.js";
export declare class ProductionVideoScorer {
    computeScores(dependencies: ProductionVideoDependencyValidation, assets: ProductionVideoAssetInventory, enhancementReadiness: number, creativeScore: number): ProductionVideoPlanningScores;
    isPlanValid(dependencies: ProductionVideoDependencyValidation, scores: ProductionVideoPlanningScores, assets: ProductionVideoAssetInventory): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=production-video-scorer.d.ts.map