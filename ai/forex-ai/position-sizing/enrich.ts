/**
 * Enrich a snapshot analysis planBundle with Phase 45 position-risk results.
 */
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import type { SnapshotPlanBundle } from "../snapshot-plans/types.js";
import {
  attachPositionRiskToBundle,
  resolveContractForSnapshotInstrument,
  type SnapshotPlanBundleWithRisk,
} from "./attach-risk.js";
import { getForexRiskSettingsService } from "./settings.js";
import type { InstrumentContractSpec } from "./types.js";

export async function enrichPlanBundleWithPositionRisk(input: {
  bundle: SnapshotPlanBundle;
  snapshot: AnalysisMarketSnapshot;
  contractOverride?: InstrumentContractSpec | null;
  forexConnectMetadata?: Record<string, unknown> | null;
  binanceFilters?: {
    stepSize: number;
    minQty: number;
    maxQty?: number | null;
    tickSize?: number | null;
    quoteCurrency: string;
  } | null;
  conversionQuotes?: Array<{
    base: string;
    quote: string;
    bid: number | null;
    ask: number | null;
    source: string;
    observedAt: string;
  }>;
  storageRoot?: string;
}): Promise<SnapshotPlanBundleWithRisk> {
  const settings = await getForexRiskSettingsService(input.storageRoot).getSettings();
  const instrumentId =
    input.snapshot.instrument.displaySymbol
    || input.snapshot.instrument.providerSymbol
    || input.snapshot.instrument.canonicalSymbol;
  const contract = input.contractOverride
    ?? resolveContractForSnapshotInstrument({
      provider: String(input.snapshot.provider),
      instrument: instrumentId,
      forexConnectMetadata: input.forexConnectMetadata,
      binanceFilters: input.binanceFilters,
      observedAt: input.snapshot.createdAt,
    });

  const quote = input.snapshot.latestQuote;

  return attachPositionRiskToBundle(input.bundle, {
    settings,
    contract,
    conversionQuotes: input.conversionQuotes,
    bid: quote?.bid ?? null,
    ask: quote?.ask ?? null,
  });
}

export async function enrichAnalysisWithPositionRisk<
  T extends { planBundle?: SnapshotPlanBundle | null },
>(
  analysis: T,
  snapshot: AnalysisMarketSnapshot,
  options?: {
    contractOverride?: InstrumentContractSpec | null;
    forexConnectMetadata?: Record<string, unknown> | null;
    binanceFilters?: {
      stepSize: number;
      minQty: number;
      maxQty?: number | null;
      tickSize?: number | null;
      quoteCurrency: string;
    } | null;
    conversionQuotes?: Array<{
      base: string;
      quote: string;
      bid: number | null;
      ask: number | null;
      source: string;
      observedAt: string;
    }>;
    storageRoot?: string;
  },
): Promise<T> {
  if (!analysis.planBundle) return analysis;
  try {
    const planBundle = await enrichPlanBundleWithPositionRisk({
      bundle: analysis.planBundle,
      snapshot,
      ...options,
    });
    return { ...analysis, planBundle };
  } catch {
    return analysis;
  }
}
