export {
  PATTERN_FAMILY,
  PATTERN_SCHEMA_VERSION,
  type CandlestickPatternDetection,
  type PatternAnalysisResult,
  type PatternCandle,
  type PatternDetectionInput,
  type PatternDirection,
  type PatternProviderId,
  type PatternRuleParams,
  type PatternStatus,
  type PatternValidationInfo,
  type UnifiedCandleLike,
} from "./types.js";

export {
  DEFAULT_PATTERN_PARAMS,
  RULE_VERSION,
  mergePatternParams,
  paramsRecord,
} from "./params.js";

export {
  bodyEngulfs,
  bodyMidpoint,
  bodyRatio,
  bodySize,
  isCandleClosed,
  isZeroRange,
  lowerWick,
  measureCandle,
  priceScale,
  rangeSize,
  upperWick,
} from "./geometry.js";

export { isValidPatternCandle, validatePatternCandles } from "./validate.js";

export {
  matchBearishEngulfing,
  matchBullishEngulfing,
  matchDoji,
  matchEveningStar,
  matchHammer,
  matchMorningStar,
  matchPatternsAtEnd,
  matchShootingStar,
} from "./rules.js";

export { detectCandlestickPatterns, fromUnifiedCandles } from "./detect.js";
export { detectCandlestickPatterns as runCandlestickPatternEngine } from "./engine.js";
