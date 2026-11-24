/**
 * Phase 09 historical candle reliability — reuses Phase 08 validateResearchDataset.
 * Never fabricates or interpolates missing OHLC.
 */
import { validateResearchDataset } from "../strategy-research/dataset-validate.js";
import type { HfmResearchBarInput, HfmResearchSourceMode } from "../strategy-research/types.js";
import type { HfmCandleReliabilityReport } from "./types.js";

export function assessCandleReliability(input: {
  datasetId: string;
  symbol: string;
  timeframe: string;
  bars: readonly HfmResearchBarInput[];
  sourceMode: HfmResearchSourceMode;
  retrievalTimestamp: string;
  providerId?: string;
  expectedTimeframeSeconds?: number | null;
}): HfmCandleReliabilityReport {
  const dataset = validateResearchDataset({
    datasetId: input.datasetId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    bars: input.bars,
    sourceMode: input.sourceMode,
    retrievalTimestamp: input.retrievalTimestamp,
    providerId: input.providerId,
    expectedTimeframeSeconds: input.expectedTimeframeSeconds,
  });
  return {
    dataset,
    reusedPhase08Validator: true,
  };
}
