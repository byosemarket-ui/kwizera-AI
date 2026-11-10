/**
 * Dynamic Spread Intelligence Engine — pure ACCEPT/REJECT evaluator.
 * Never mutates broker state. Never approves owner policies. Never submits orders.
 */
import { documentedPrecision, normalizeInstrumentSymbol } from "../risk-policy/validate.js";
import { lotsToFxcmAmount } from "../simulation-risk/fxcm-amount-lots.js";
import { computeRollingSpreadStats } from "./rolling-stats.js";
import {
  buildNetRewardResult,
  buildSpreadCostBreakdown,
  buildStopLossImpact,
} from "./spread-cost.js";
import {
  DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION,
  DYNAMIC_SPREAD_DEFAULT_QUOTE_MAX_AGE_MS,
  DYNAMIC_SPREAD_ENGINE_ID,
  DYNAMIC_SPREAD_ENGINE_VERSION,
  DYNAMIC_SPREAD_MODE,
  type DynamicSpreadEngineInput,
  type DynamicSpreadEvaluationResult,
  type DynamicSpreadReasonCode,
  type DynamicSpreadRollingStats,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function roundToPrecision(n: number, precision: number | null): number {
  if (precision == null || !Number.isInteger(precision) || precision < 0) return n;
  const f = 10 ** precision;
  return Math.round(n * f) / f;
}

function emptyRolling(note: string): DynamicSpreadRollingStats {
  return {
    sampleCount: 0,
    minRequiredSamples: 20,
    sufficient: false,
    currentSpread: null,
    median: null,
    p50: null,
    p75: null,
    p90: null,
    p95: null,
    volatility: null,
    recentWidening: null,
    abnormal: null,
    oldestObservationAtUtc: null,
    newestObservationAtUtc: null,
    note,
  };
}

function rejectBase(
  input: DynamicSpreadEngineInput,
  codes: DynamicSpreadReasonCode[],
  message: string,
  extras: Partial<DynamicSpreadEvaluationResult> = {},
): DynamicSpreadEvaluationResult {
  const primary = codes[0] ?? "QUOTE_INVALID";
  const nowMs = input.nowMs ?? Date.now();
  const base: DynamicSpreadEvaluationResult = {
    engineId: DYNAMIC_SPREAD_ENGINE_ID,
    engineVersion: DYNAMIC_SPREAD_ENGINE_VERSION,
    mode: DYNAMIC_SPREAD_MODE,
    decision: "REJECT",
    authorizesBrokerSubmission: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    instrument: normalizeInstrumentSymbol(String(input.instrument || "")) || input.instrument || null,
    proposalId: input.proposalId ?? null,
    allocationId: input.allocationId ?? null,
    quoteId: input.quoteId ?? null,
    quoteTimestampUtc: input.quoteTimestampUtc ?? null,
    quoteAgeMs: finiteNonNeg(input.quoteAgeMs) ? input.quoteAgeMs : null,
    bid: finitePositive(input.bid) ? input.bid : (typeof input.bid === "number" ? input.bid : null),
    ask: finitePositive(input.ask) ? input.ask : (typeof input.ask === "number" ? input.ask : null),
    currentSpread: null,
    pricePrecision: documentedPrecision(String(input.instrument || "")),
    provenance: input.provenance ?? null,
    feedConnected: input.feedConnected ?? null,
    marketStatus: input.marketStatus ?? null,
    rolling: emptyRolling("Not computed — rejected earlier."),
    costBreakdown: {
      spreadAbsolute: null,
      spreadCostAccount: null,
      commissionAccount: null,
      slippageEstimateAccount: null,
      totalEntryFrictionAccount: null,
      method: null,
      commissionStatus: "NOT_VERIFIED",
      slippageStatus: "UNAVAILABLE",
      currency: input.accountCurrency ?? null,
      note: "Not computed — rejected earlier.",
    },
    costAccountingConvention: DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION,
    stopLossImpact: {
      modeledStopLossRiskAccount: null,
      spreadIncludedInStopLossRisk: false,
      orderAllocationAccount: finitePositive(input.orderAllocationAccount)
        ? input.orderAllocationAccount
        : null,
      allowedRiskAmountAccount: finitePositive(input.orderAllocationAccount)
        ? input.orderAllocationAccount * 0.25
        : null,
      riskTargetFraction: 0.25,
      riskHardMaxFraction: 0.25,
      withinPerOrderRiskBudget: null,
      note: "Not computed — rejected earlier.",
    },
    netReward: {
      modeledStopLossRiskAccount: null,
      grossTakeProfitRewardAccount: null,
      netTakeProfitRewardAccount: null,
      rewardToRiskRatio: null,
      minimumRequiredRatio: 3,
      meetsMinimum: null,
      costsSubtractedFromReward: false,
      note: "Not computed — rejected earlier.",
    },
    quantityLots: finitePositive(input.quantityLots) ? input.quantityLots : null,
    brokerAmount: finitePositive(input.brokerAmount) ? input.brokerAmount : null,
    baseUnitSize: finitePositive(input.baseUnitSize) ? input.baseUnitSize : null,
    contractMetaVerified: input.contract?.verified === true,
    reasonCodes: codes,
    primaryReasonCode: primary,
    message,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    requiresFreshProposalOnReject: true,
    legacyEmergencyCeilingApplied: false,
    legacyMaxSpreadAbsolute: finitePositive(input.legacyMaxSpreadAbsolute)
      ? input.legacyMaxSpreadAbsolute
      : null,
  };
  return {
    ...base,
    ...extras,
    decision: "REJECT",
    authorizesBrokerSubmission: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    reasonCodes: codes,
    primaryReasonCode: primary,
    message,
  };
}

/**
 * Evaluate dynamic spread eligibility for one proposed order against LIVE quote + history.
 */
export function evaluateDynamicSpread(
  input: DynamicSpreadEngineInput,
): DynamicSpreadEvaluationResult {
  const nowMs = input.nowMs ?? Date.now();
  const instrument = normalizeInstrumentSymbol(String(input.instrument || "")) || null;
  const expected = input.expectedInstrument
    ? normalizeInstrumentSymbol(String(input.expectedInstrument)) || String(input.expectedInstrument)
    : null;
  const precision = instrument ? documentedPrecision(instrument) : null;
  const quoteMaxAge = finitePositive(input.quoteMaxAgeMs)
    ? input.quoteMaxAgeMs
    : DYNAMIC_SPREAD_DEFAULT_QUOTE_MAX_AGE_MS;

  if (input.feedConnected === false) {
    return rejectBase(input, ["FEED_DISCONNECTED"], "ForexConnect feed disconnected — REJECT.");
  }

  if (!instrument) {
    return rejectBase(input, ["QUOTE_MISSING"], "Instrument identity missing — REJECT.");
  }
  if (expected && expected !== instrument) {
    return rejectBase(
      input,
      ["INSTRUMENT_MISMATCH"],
      `Quote instrument ${instrument} does not match expected ${expected}.`,
    );
  }

  if (input.marketStatus === "CLOSED") {
    return rejectBase(input, ["MARKET_UNAVAILABLE"], "Market closed — REJECT.");
  }

  const bid = input.bid;
  const ask = input.ask;
  if (bid == null || ask == null) {
    return rejectBase(input, ["QUOTE_MISSING"], "Bid or ask missing — REJECT.");
  }
  if (typeof bid !== "number" || typeof ask !== "number" || !Number.isFinite(bid) || !Number.isFinite(ask)) {
    return rejectBase(input, ["QUOTE_INVALID"], "Bid/ask not finite numbers — REJECT.");
  }
  if (!(bid > 0) || !(ask > 0)) {
    return rejectBase(input, ["QUOTE_INVALID"], "Bid/ask must be positive — REJECT.");
  }
  if (ask < bid) {
    return rejectBase(input, ["QUOTE_INVALID"], "Ask is below bid — REJECT.");
  }

  const provenanceRaw = String(input.provenance || "").trim();
  const provenance = provenanceRaw.toUpperCase();
  if (!provenance) {
    return rejectBase(input, ["MARKET_DATA_NOT_LIVE"], "Quote provenance missing — REJECT.");
  }
  const nonLive =
    provenance.includes("CACHED")
    || provenance.includes("STALE")
    || provenance.includes("TEST")
    || provenance.includes("HISTORICAL")
    || provenance.includes("SYNTHETIC")
    || provenance.includes("FIXTURE");
  const liveOk =
    provenance === "LIVE"
    || provenance.includes("LIVE")
    || provenance === "FOREXCONNECT"
    || provenance.includes("FOREXCONNECT")
    || provenance.includes("OFFERS");
  if (nonLive || !liveOk) {
    return rejectBase(
      input,
      ["MARKET_DATA_NOT_LIVE"],
      `Non-LIVE provenance ${provenanceRaw} — REJECT (no silent historical substitution).`,
    );
  }

  if (!finiteNonNeg(input.quoteAgeMs)) {
    return rejectBase(input, ["QUOTE_STALE"], "Quote age unknown — REJECT.");
  }
  if (input.quoteAgeMs > quoteMaxAge) {
    return rejectBase(
      input,
      ["QUOTE_STALE"],
      `Quote age ${input.quoteAgeMs}ms exceeds ${quoteMaxAge}ms — REJECT.`,
    );
  }

  const rawSpread = ask - bid;
  if (!(rawSpread >= 0) || !Number.isFinite(rawSpread)) {
    return rejectBase(input, ["QUOTE_INVALID"], "Spread calculation invalid — REJECT.");
  }
  const currentSpread = roundToPrecision(rawSpread, precision);

  const rolling = computeRollingSpreadStats({
    currentSpread,
    historical: input.historicalSpreads,
    nowMs,
    pricePrecision: precision,
  });

  if (!rolling.sufficient) {
    return rejectBase(
      input,
      ["SPREAD_DATA_INSUFFICIENT"],
      rolling.note,
      { rolling, currentSpread },
    );
  }

  if (rolling.abnormal === true) {
    return rejectBase(
      input,
      ["SPREAD_ABNORMAL_WIDENING"],
      `Current spread ${currentSpread} exceeds rolling P95 ${rolling.p95} (abnormal widening) — REJECT.`,
      { rolling, currentSpread },
    );
  }

  // Optional legacy emergency ceiling (only when explicitly configured).
  let legacyEmergencyCeilingApplied = false;
  const legacyCeil = finitePositive(input.legacyMaxSpreadAbsolute)
    ? input.legacyMaxSpreadAbsolute
    : null;
  if (legacyCeil != null) {
    const curR = roundToPrecision(currentSpread, precision);
    const limR = roundToPrecision(legacyCeil, precision);
    if (curR > limR) {
      return rejectBase(
        input,
        ["LEGACY_EMERGENCY_SPREAD_CEILING"],
        `Current spread ${currentSpread} exceeds legacy emergency ceiling ${legacyCeil}.`,
        {
          rolling,
          currentSpread,
          legacyEmergencyCeilingApplied: true,
          legacyMaxSpreadAbsolute: legacyCeil,
        },
      );
    }
    legacyEmergencyCeilingApplied = true;
  }

  if (!input.contract || input.contract.verified !== true) {
    return rejectBase(
      input,
      ["INSTRUMENT_METADATA_UNVERIFIED"],
      "Verified contract metadata required for spread cost — REJECT.",
      { rolling, currentSpread },
    );
  }

  if (!finitePositive(input.quantityLots)) {
    return rejectBase(
      input,
      ["QUANTITY_INVALID"],
      "Order quantity lots missing — REJECT.",
      { rolling, currentSpread },
    );
  }

  // FXCM AMOUNT consistency when baseUnitSize provided.
  let brokerAmount = finitePositive(input.brokerAmount) ? input.brokerAmount : null;
  const baseUnit = finitePositive(input.baseUnitSize)
    ? input.baseUnitSize
    : (finitePositive(input.contract.baseUnitSize) ? input.contract.baseUnitSize : null);
  if (baseUnit != null) {
    const expectedAmount = lotsToFxcmAmount({
      lots: input.quantityLots,
      baseUnitSize: baseUnit,
    });
    if (!expectedAmount.ok || expectedAmount.amount == null) {
      return rejectBase(
        input,
        ["BROKER_CONSTRAINT_UNVERIFIED"],
        expectedAmount.message,
        { rolling, currentSpread, baseUnitSize: baseUnit },
      );
    }
    if (brokerAmount != null && brokerAmount !== expectedAmount.amount) {
      return rejectBase(
        input,
        ["BROKER_CONSTRAINT_UNVERIFIED"],
        `Broker AMOUNT ${brokerAmount} ≠ baseUnitSize×lots ${expectedAmount.amount}.`,
        { rolling, currentSpread, baseUnitSize: baseUnit, brokerAmount },
      );
    }
    brokerAmount = expectedAmount.amount;
  } else if (brokerAmount == null) {
    // baseUnit optional for cost calc; AMOUNT verification skipped when absent.
  }

  if (!finitePositive(input.orderAllocationAccount)) {
    return rejectBase(
      input,
      ["ALLOCATION_UNVERIFIED"],
      "Per-order allocation unverified — REJECT.",
      { rolling, currentSpread },
    );
  }

  const cost = buildSpreadCostBreakdown({
    spreadAbsolute: currentSpread,
    quantityLots: input.quantityLots,
    contract: input.contract,
    accountCurrency: input.accountCurrency,
    commissionAccount: input.commissionAccount,
    commissionVerified: input.commissionVerified,
    slippageEstimateAccount: input.slippageEstimateAccount,
    slippageEvidenceAvailable: input.slippageEvidenceAvailable,
  });
  if (!cost.verified) {
    return rejectBase(
      input,
      [cost.failCode ?? "SPREAD_COST_UNVERIFIED"],
      cost.breakdown.note,
      { rolling, currentSpread, costBreakdown: cost.breakdown },
    );
  }

  const slImpact = buildStopLossImpact({
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    quantityLots: input.quantityLots,
    contract: input.contract,
    orderAllocationAccount: input.orderAllocationAccount,
  });
  if (slImpact.modeledStopLossRiskAccount == null || slImpact.withinPerOrderRiskBudget == null) {
    return rejectBase(
      input,
      ["STOP_LOSS_RISK_EXCEEDED"],
      slImpact.note,
      { rolling, currentSpread, costBreakdown: cost.breakdown, stopLossImpact: slImpact },
    );
  }
  if (slImpact.withinPerOrderRiskBudget === false) {
    return rejectBase(
      input,
      ["STOP_LOSS_RISK_EXCEEDED"],
      `Modeled SL risk ${slImpact.modeledStopLossRiskAccount} exceeds 25% of allocation ${slImpact.allowedRiskAmountAccount}.`,
      { rolling, currentSpread, costBreakdown: cost.breakdown, stopLossImpact: slImpact },
    );
  }

  // Spread cost excessive vs this order's allowed risk budget (entry friction ≤ allowed risk).
  // Does NOT alter SL; separate from double-counting.
  if (
    finitePositive(cost.breakdown.spreadCostAccount)
    && finitePositive(slImpact.allowedRiskAmountAccount)
    && cost.breakdown.spreadCostAccount > slImpact.allowedRiskAmountAccount + 1e-9
  ) {
    return rejectBase(
      input,
      ["SPREAD_COST_EXCESSIVE"],
      `Spread cost ${cost.breakdown.spreadCostAccount} exceeds per-order allowed risk ${slImpact.allowedRiskAmountAccount}.`,
      { rolling, currentSpread, costBreakdown: cost.breakdown, stopLossImpact: slImpact },
    );
  }

  const net = buildNetRewardResult({
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    quantityLots: input.quantityLots,
    contract: input.contract,
    totalEntryFrictionAccount: cost.breakdown.totalEntryFrictionAccount,
    costsVerified: true,
  });
  if (net.meetsMinimum !== true) {
    return rejectBase(
      input,
      ["NET_REWARD_BELOW_3R", "NET_REWARD_BELOW_POLICY"],
      net.note + (net.rewardToRiskRatio != null
        ? ` ratio=${net.rewardToRiskRatio}`
        : ""),
      {
        rolling,
        currentSpread,
        costBreakdown: cost.breakdown,
        stopLossImpact: slImpact,
        netReward: net,
      },
    );
  }

  return {
    engineId: DYNAMIC_SPREAD_ENGINE_ID,
    engineVersion: DYNAMIC_SPREAD_ENGINE_VERSION,
    mode: DYNAMIC_SPREAD_MODE,
    decision: "ACCEPT",
    authorizesBrokerSubmission: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    instrument,
    proposalId: input.proposalId ?? null,
    allocationId: input.allocationId ?? null,
    quoteId: input.quoteId ?? null,
    quoteTimestampUtc: input.quoteTimestampUtc ?? null,
    quoteAgeMs: input.quoteAgeMs ?? null,
    bid,
    ask,
    currentSpread,
    pricePrecision: precision,
    provenance: input.provenance ?? null,
    feedConnected: input.feedConnected ?? null,
    marketStatus: input.marketStatus ?? "UNKNOWN",
    rolling,
    costBreakdown: cost.breakdown,
    costAccountingConvention: DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION,
    stopLossImpact: slImpact,
    netReward: net,
    quantityLots: input.quantityLots,
    brokerAmount,
    baseUnitSize: baseUnit,
    contractMetaVerified: true,
    reasonCodes: ["DYNAMIC_SPREAD_OK"],
    primaryReasonCode: "DYNAMIC_SPREAD_OK",
    message:
      "Dynamic Spread Intelligence ACCEPT — eligibility only; does not authorize broker submission.",
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    requiresFreshProposalOnReject: true,
    legacyEmergencyCeilingApplied,
    legacyMaxSpreadAbsolute: legacyCeil,
  };
}
