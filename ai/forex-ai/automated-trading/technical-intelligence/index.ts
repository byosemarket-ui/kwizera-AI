/**
 * Phase 4.18F.3 — Automatic trading technical intelligence (analysis only).
 */

export * from "./types.js";
export { computeIndicatorSuite, __indicatorTestUtils } from "./indicator-engine.js";
export { classifyMarketCondition } from "./market-condition.js";
export { validateStrategySignal } from "./signal-validation.js";
export { buildStructureIntel } from "./structure-intel.js";

import { computeIndicatorSuite } from "./indicator-engine.js";
import { classifyMarketCondition } from "./market-condition.js";
import { validateStrategySignal } from "./signal-validation.js";
import { buildStructureIntel } from "./structure-intel.js";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import type { StrategyDirection } from "../auto-engine/strategy/rules.js";
import type {
  IndicatorSuite,
  MarketConditionRecord,
  SignalValidationRecord,
  StructureIntelSummary,
} from "./types.js";

export interface TechnicalIntelligenceBundle {
  indicators: IndicatorSuite;
  structure: StructureIntelSummary;
  condition: MarketConditionRecord;
  signalValidation: SignalValidationRecord;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

export function buildTechnicalIntelligence(input: {
  instrument: string;
  timeframe: string;
  candles: readonly StrategyCandle[];
  strategyDirection: StrategyDirection | null;
  strategyCode: string | null;
  quoteFresh?: boolean | null;
  nowMs?: number;
}): TechnicalIntelligenceBundle {
  const indicators = computeIndicatorSuite({
    instrument: input.instrument,
    timeframe: input.timeframe,
    candles: input.candles,
    nowMs: input.nowMs,
  });
  const structure = buildStructureIntel({
    instrument: input.instrument,
    timeframe: input.timeframe,
    candles: input.candles,
  });
  const condition = classifyMarketCondition({
    suite: indicators,
    structure,
    nowMs: input.nowMs,
  });
  const signalValidation = validateStrategySignal({
    instrument: input.instrument,
    timeframe: input.timeframe,
    strategyDirection: input.strategyDirection,
    strategyCode: input.strategyCode,
    suite: indicators,
    condition,
    structure,
    quoteFresh: input.quoteFresh,
    nowMs: input.nowMs,
  });
  return {
    indicators,
    structure,
    condition,
    signalValidation,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}
