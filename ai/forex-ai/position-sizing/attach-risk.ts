/**
 * Attach Phase 45 position-risk results to each Pullback/Breakout plan.
 */
import type { SnapshotPlanBundle, SnapshotTradePlan } from "../snapshot-plans/types.js";
import { calculatePositionRisk } from "./calculate.js";
import {
  contractSpecFromCryptoFilters,
  contractSpecFromForexConnectMetadata,
  unavailableContractSpec,
} from "./contract-spec.js";
import type {
  ForexRiskSettings,
  InstrumentContractSpec,
  PositionRiskResult,
} from "./types.js";

export type SnapshotTradePlanWithRisk = SnapshotTradePlan & {
  positionRisk: PositionRiskResult | null;
};

export type SnapshotPlanBundleWithRisk = Omit<SnapshotPlanBundle, "pullback" | "breakout"> & {
  pullback: SnapshotTradePlanWithRisk;
  breakout: SnapshotTradePlanWithRisk;
};

function sideFromPlan(plan: SnapshotTradePlan): "BUY" | "SELL" | null {
  if (plan.intent === "BUY" || plan.intent === "SELL") return plan.intent;
  // Informational sizing for WAIT/UNSUITABLE when prices imply a side.
  const entry = plan.entryZone.reference ?? plan.entryZone.lower ?? plan.entryZone.upper;
  const stop = plan.stopLoss.price;
  if (typeof entry === "number" && typeof stop === "number" && Number.isFinite(entry) && Number.isFinite(stop)) {
    if (stop < entry) return "BUY";
    if (stop > entry) return "SELL";
  }
  return null;
}

function applyPlanIntentGates(
  plan: SnapshotTradePlan,
  risk: PositionRiskResult,
): PositionRiskResult {
  const blocking = [...risk.blockingReasons];
  if (plan.intent === "UNSUITABLE") {
    blocking.push("Plan is UNSUITABLE — risk sizing cannot make it eligible.");
  } else if (plan.intent === "WAIT") {
    blocking.push("Plan intent is WAIT — not risk-eligible for execution sizing.");
  }
  if (plan.lifecycle === "WAIT_CONFLICT" || plan.lifecycle === "INVALIDATED" || plan.lifecycle === "EXPIRED") {
    blocking.push(`Plan lifecycle ${plan.lifecycle} blocks risk eligibility.`);
  }
  const unique = [...new Set(blocking)];
  return {
    ...risk,
    blockingReasons: unique,
    riskEligible: unique.length === 0 && risk.riskEligible && plan.intent !== "UNSUITABLE" && plan.intent !== "WAIT",
  };
}

export function resolveContractForSnapshotInstrument(input: {
  provider: string;
  instrument: string;
  forexConnectMetadata?: Record<string, unknown> | null;
  binanceFilters?: {
    stepSize: number;
    minQty: number;
    maxQty?: number | null;
    tickSize?: number | null;
    quoteCurrency: string;
  } | null;
  observedAt?: string | null;
}): InstrumentContractSpec {
  const provider = String(input.provider ?? "").toUpperCase();
  if (provider === "FOREXCONNECT" || provider === "FXCM") {
    return contractSpecFromForexConnectMetadata({
      instrumentId: input.instrument,
      metadata: input.forexConnectMetadata,
      quoteCurrency: (input.forexConnectMetadata?.quoteAsset as string | undefined) ?? null,
      contractCurrency: (input.forexConnectMetadata?.contractCurrency as string | undefined) ?? null,
      instrumentTypeLabel: (input.forexConnectMetadata?.instrumentTypeLabel as string | undefined) ?? null,
      observedAt: input.observedAt ?? null,
    });
  }
  if (provider === "BINANCE" && input.binanceFilters) {
    return contractSpecFromCryptoFilters({
      instrumentId: input.instrument,
      quoteCurrency: input.binanceFilters.quoteCurrency,
      stepSize: input.binanceFilters.stepSize,
      minQty: input.binanceFilters.minQty,
      maxQty: input.binanceFilters.maxQty,
      tickSize: input.binanceFilters.tickSize,
      observedAt: input.observedAt ?? null,
    });
  }
  return unavailableContractSpec(
    input.instrument,
    provider || "UNKNOWN",
    `No verified contract metadata for provider ${provider || "UNKNOWN"} / ${input.instrument}.`,
  );
}

function applyTradeAllocationGate(
  risk: PositionRiskResult,
  allocation: { amount: number; currency: string } | null | undefined,
): PositionRiskResult {
  if (!allocation) return risk;
  const notes = [
    ...risk.notes,
    `Trade allocation ${allocation.amount} ${allocation.currency} is capital set aside — not the risk budget / acceptable loss.`,
  ];
  const blocking = [...risk.blockingReasons];
  const acct = (risk.accountCurrency ?? "").toUpperCase();
  const allocCcy = allocation.currency.toUpperCase();
  if (acct && allocCcy && acct !== allocCcy) {
    blocking.push(
      `Trade allocation currency ${allocCcy} differs from account currency ${acct}.`,
    );
  }
  const margin = risk.margin.estimatedMarginAccount;
  if (typeof margin === "number" && Number.isFinite(margin) && margin > allocation.amount) {
    blocking.push(
      `Estimated margin ${margin.toFixed(2)} exceeds allocated trade capital ${allocation.amount} ${allocation.currency}.`,
    );
  }
  const unique = [...new Set(blocking)];
  return {
    ...risk,
    tradeAllocationAmount: allocation.amount,
    tradeAllocationCurrency: allocation.currency,
    notes,
    blockingReasons: unique,
    riskEligible: unique.length === 0 && risk.riskEligible,
  };
}

export function attachPositionRiskToPlan(
  plan: SnapshotTradePlan,
  input: {
    settings: ForexRiskSettings;
    contract: InstrumentContractSpec;
    conversionQuotes?: Array<{
      base: string;
      quote: string;
      bid: number | null;
      ask: number | null;
      source: string;
      observedAt: string;
    }>;
    bid?: number | null;
    ask?: number | null;
    proposedSize?: number | null;
    tradeAllocation?: { amount: number; currency: string } | null;
  },
): SnapshotTradePlanWithRisk {
  const entry = plan.entryZone.reference ?? plan.entryZone.lower ?? plan.entryZone.upper;
  const raw = calculatePositionRisk({
    settings: input.settings,
    contract: input.contract,
    side: sideFromPlan(plan),
    entryPrice: entry,
    stopLoss: plan.stopLoss.price,
    takeProfit: plan.takeProfit.prices[0] ?? null,
    proposedSize: input.proposedSize,
    bid: input.bid,
    ask: input.ask,
    conversionQuotes: input.conversionQuotes,
  });
  const withIntent = applyPlanIntentGates(plan, raw);
  const positionRisk = applyTradeAllocationGate(withIntent, input.tradeAllocation);
  return { ...plan, positionRisk };
}

export function attachPositionRiskToBundle(
  bundle: SnapshotPlanBundle,
  input: {
    settings: ForexRiskSettings;
    contract: InstrumentContractSpec;
    conversionQuotes?: Array<{
      base: string;
      quote: string;
      bid: number | null;
      ask: number | null;
      source: string;
      observedAt: string;
    }>;
    bid?: number | null;
    ask?: number | null;
    proposedSize?: number | null;
    tradeAllocation?: { amount: number; currency: string } | null;
  },
): SnapshotPlanBundleWithRisk {
  return {
    ...bundle,
    pullback: attachPositionRiskToPlan(bundle.pullback, input),
    breakout: attachPositionRiskToPlan(bundle.breakout, input),
  };
}
