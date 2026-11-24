export { buildUnifiedEvidence, mapBuySellToDirection } from "./common.js";
export type { BuildEvidenceInput } from "./common.js";

export { adaptDataIntegrityToEvidence, adaptUnifiedQualityToEvidence } from "./from-quality.js";

export {
  adaptFibonacciToEvidence,
  adaptChartPatternsToEvidence,
  adaptHarmonicsToEvidence,
  adaptRegimeToEvidence,
  adaptMtfRelationshipsToEvidence,
} from "./from-technical.js";

export {
  adaptMarketStructureToEvidence,
  adaptSupportResistanceToEvidence,
  adaptLiquidityReferenceToEvidence,
  adaptMomentumToEvidence,
  adaptPriceDisplacementToEvidence,
  adaptBuyerSellerPressureToEvidence,
  adaptDeepTechnicalIntelligenceToEvidence,
  adaptCandlestickPatternsToEvidence,
  adaptExternalMarketIntelligenceToEvidence,
  adaptStrategyResearchToEvidence,
} from "./from-structure.js";

export {
  adaptStrategyEligibilityToEvidence,
  adaptOpportunityCandidateToEvidence,
  adaptProductionResultToEvidence,
  adaptRankingRunToEvidence,
  adaptProbabilityBundleToEvidence,
  adaptDetectionEvidenceRefToEvidence,
} from "./from-opportunity.js";

export {
  adaptUnifiedDialectLimitationsToEvidence,
  type MifUnifiedDialectLimitations,
} from "./dialect-notes.js";