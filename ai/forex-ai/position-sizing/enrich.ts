/**
 * Enrich a snapshot analysis planBundle with Phase 45 position-risk results.
 */
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import { getMarketDataService } from "../../market-data/providers/market-data-service.js";
import type { SnapshotPlanBundle } from "../snapshot-plans/types.js";
import {
  applyAccountSnapshotToRiskSettings,
  fetchForexConnectAccountSnapshot,
} from "./account-snapshot.js";
import {
  attachPositionRiskToBundle,
  resolveContractForSnapshotInstrument,
  type SnapshotPlanBundleWithRisk,
} from "./attach-risk.js";
import { getForexRiskSettingsService } from "./settings.js";
import type { ForexRiskSettings, InstrumentContractSpec } from "./types.js";

async function resolveRiskSettingsForEnrich(
  base: ForexRiskSettings,
  storageRoot?: string,
): Promise<ForexRiskSettings> {
  if (base.accountDataSource !== "forexconnect") return base;
  try {
    const snapshot = await fetchForexConnectAccountSnapshot({
      selectedAccountId: base.selectedForexConnectAccountId,
      maxAgeMs: Math.min(base.conversionMaxAgeMs, 120_000),
    });
    const applied = applyAccountSnapshotToRiskSettings(base, snapshot);
    if (applied.applied) return applied.settings;
    // Prefer explicit FXCM incompleteness over stale manual numbers when source is forexconnect.
    return {
      ...base,
      accountCurrency: snapshot.accountCurrency ?? "",
      manualBalance: base.riskBasis === "manual_balance" ? null : base.manualBalance,
      manualEquity: base.riskBasis === "manual_equity" ? null : base.manualEquity,
    };
  } catch {
    return base;
  }
}

/** Phase 47A — load Offers-normalized metadata when caller did not supply it. */
async function resolveForexConnectMetadata(
  snapshot: AnalysisMarketSnapshot,
  override?: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (override && Object.keys(override).length > 0) return override;
  const provider = String(snapshot.provider ?? "").toUpperCase();
  if (provider !== "FOREXCONNECT" && provider !== "FXCM") return null;
  try {
    const symbol =
      snapshot.instrument.providerSymbol
      || snapshot.instrument.displaySymbol
      || snapshot.instrument.canonicalSymbol;
    const inst = await getMarketDataService().getInstrument({
      provider: snapshot.provider,
      symbol,
      marketType: snapshot.instrument.marketType,
    });
    const md = inst?.metadata;
    if (!md || typeof md !== "object") return null;
    return md as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
  tradeAllocation?: { amount: number; currency: string } | null;
  storageRoot?: string;
}): Promise<SnapshotPlanBundleWithRisk> {
  const stored = await getForexRiskSettingsService(input.storageRoot).getSettings();
  const settings = await resolveRiskSettingsForEnrich(stored, input.storageRoot);
  const instrumentId =
    input.snapshot.instrument.displaySymbol
    || input.snapshot.instrument.providerSymbol
    || input.snapshot.instrument.canonicalSymbol;
  const forexConnectMetadata = await resolveForexConnectMetadata(
    input.snapshot,
    input.forexConnectMetadata,
  );
  const contract = input.contractOverride
    ?? resolveContractForSnapshotInstrument({
      provider: String(input.snapshot.provider),
      instrument: instrumentId,
      forexConnectMetadata,
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
    tradeAllocation: input.tradeAllocation,
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
    tradeAllocation?: { amount: number; currency: string } | null;
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
