import { DecisionType } from "../decision/types.js";
import { PlanningType } from "./types.js";
export function mapDecisionTypeToPlanningType(type) {
    const map = {
        [DecisionType.ProductAnalysis]: PlanningType.ProductAnalysis,
        [DecisionType.ImageAnalysis]: PlanningType.ImageAnalysis,
        [DecisionType.VideoGeneration]: PlanningType.PromotionalVideoProduction,
        [DecisionType.Marketing]: PlanningType.MarketingCampaign,
        [DecisionType.Translation]: PlanningType.Translation,
        [DecisionType.Memory]: PlanningType.MemoryUpdates,
        [DecisionType.Learning]: PlanningType.Learning,
        [DecisionType.Export]: PlanningType.Export,
        [DecisionType.Recovery]: PlanningType.Recovery,
        [DecisionType.General]: PlanningType.Backup,
    };
    return map[type];
}
const MODULES_BY_TYPE = {
    "product-analysis": ["product-engine", "decision-engine"],
    "image-analysis": ["image-engine", "decision-engine"],
    "image-enhancement": ["image-engine"],
    "video-enhancement": ["video-engine"],
    "promotional-video-production": ["video-engine", "product-engine", "marketing-engine"],
    "poster-generation": ["image-engine", "marketing-engine"],
    "marketing-campaign": ["marketing-engine", "product-engine"],
    translation: ["translation-engine"],
    learning: ["learning-engine"],
    "memory-updates": ["memory-engine"],
    export: ["video-engine", "marketing-engine"],
    backup: ["decision-engine"],
    recovery: ["decision-engine", "reasoning-engine"],
};
export function getRequiredModules(type, workflowModules) {
    const defaults = MODULES_BY_TYPE[type] ?? ["decision-engine"];
    return [...new Set([...defaults, ...workflowModules])];
}
//# sourceMappingURL=decision-type-mapper.js.map