export { AiRecommendationEngine, RecommendationEngineError } from "./recommendation-engine.js";
export { createRecommendationEnginePlugin } from "./recommendation-engine-plugin.js";
export { ProfessionalRecommendationMemoryStore } from "./professional-recommendation-memory.js";
export {
  applyRecommendationFeedback,
  buildProfessionalRecommendation,
  recommendationFingerprint,
} from "./professional-recommendation.js";
export type {
  AiMeProfessionalRecommendationAwareness,
  ProfessionalRecommendationAlternative,
  ProfessionalRecommendationExplanation,
  ProfessionalRecommendationFramework,
  ProfessionalRecommendationHealthReport,
  ProfessionalRecommendationMemoryRecord,
  ProfessionalRecommendationRepairResult,
  ProfessionalRecommendationRequest,
  ProfessionalRecommendationResult,
} from "./professional-recommendation-types.js";
