import { DecisionType } from "../decision/types.js";
import { ReasoningType } from "./types.js";

export function mapDecisionTypeToReasoningType(type: DecisionType): ReasoningType {
  const map: Record<DecisionType, ReasoningType> = {
    [DecisionType.ProductAnalysis]: ReasoningType.ProductAnalysis,
    [DecisionType.ImageAnalysis]: ReasoningType.ImageAnalysis,
    [DecisionType.VideoGeneration]: ReasoningType.VideoPlanning,
    [DecisionType.Marketing]: ReasoningType.MarketingStrategy,
    [DecisionType.Translation]: ReasoningType.Translation,
    [DecisionType.Memory]: ReasoningType.WorkflowPlanning,
    [DecisionType.Learning]: ReasoningType.Learning,
    [DecisionType.Export]: ReasoningType.ExportDecisions,
    [DecisionType.Recovery]: ReasoningType.ErrorRecovery,
    [DecisionType.General]: ReasoningType.WorkflowPlanning,
  };
  return map[type];
}
