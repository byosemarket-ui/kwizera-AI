import { PlanningType } from "../planning/types.js";
import { WorkflowType } from "./types.js";
export function mapPlanningTypeToWorkflowType(type) {
    const map = {
        [PlanningType.ProductAnalysis]: WorkflowType.ProductAnalysis,
        [PlanningType.ImageAnalysis]: WorkflowType.ImageAnalysis,
        [PlanningType.ImageEnhancement]: WorkflowType.ImageEnhancement,
        [PlanningType.VideoEnhancement]: WorkflowType.VideoEnhancement,
        [PlanningType.PromotionalVideoProduction]: WorkflowType.PromotionalVideoGeneration,
        [PlanningType.PosterGeneration]: WorkflowType.PosterGeneration,
        [PlanningType.MarketingCampaign]: WorkflowType.MarketingCampaignGeneration,
        [PlanningType.Translation]: WorkflowType.Translation,
        [PlanningType.Learning]: WorkflowType.LearningUpdate,
        [PlanningType.MemoryUpdates]: WorkflowType.MemoryUpdate,
        [PlanningType.Export]: WorkflowType.Export,
        [PlanningType.Backup]: WorkflowType.Backup,
        [PlanningType.Recovery]: WorkflowType.Recovery,
    };
    return map[type];
}
//# sourceMappingURL=planning-type-mapper.js.map