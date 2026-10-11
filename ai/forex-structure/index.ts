export {
  STRUCTURE_SCHEMA_VERSION,
  type ClassificationLabel,
  type MarketStructureAnalysisResult,
  type StructureCandle,
  type StructureDetectionInput,
  type StructureEvent,
  type StructureEventDirection,
  type StructureEventStatus,
  type StructureEventType,
  type StructureProviderId,
  type StructureRuleParams,
  type StructureSwing,
  type StructureValidationInfo,
  type StructureZone,
  type SwingClassification,
  type SwingKind,
  type SwingStatus,
  type TrendState,
  type UnifiedCandleLike,
  type ZoneKind,
  type ZoneStatus,
} from "./types.js";

export {
  DEFAULT_STRUCTURE_PARAMS,
  RULE_VERSION,
  mergeStructureParams,
  paramsRecord,
} from "./params.js";

export {
  isStructureCandleClosed,
  isValidStructureCandle,
  priceScale,
  pricesEqualRel,
  validateStructureCandles,
} from "./validate.js";

export { detectSwings } from "./swings.js";
export { classifyConfirmedSwings, resolveTrendState } from "./classify.js";
export { detectStructureEvents } from "./events.js";
export { buildStructureZones } from "./zones.js";

export { detectMarketStructure, fromUnifiedCandles } from "./detect.js";
export { detectMarketStructure as runMarketStructureEngine } from "./engine.js";
