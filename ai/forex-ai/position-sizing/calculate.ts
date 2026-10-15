/**
 * Deterministic risk-budget-first and size-first position sizing.
 */
import { clampMinMax, floorToStep, isFiniteNumber, priceDistanceInPoints, roundTo } from "./decimal.js";
import { convertAmount, resolveConversionRate } from "./conversion.js";
import type {
  ConversionRateQuote,
  ForexRiskSettings,
  InstrumentContractSpec,
  PositionRiskCostBreakdown,
  PositionRiskMargin,
  PositionRiskResult,
  RiskCalculationMode,
} from "./types.js";
import { FOREX_POSITION_RISK_SCHEMA } from "./types.js";

export interface CalculatePositionRiskInput {
  settings: ForexRiskSettings;
  contract: InstrumentContractSpec;
  side: "BUY" | "SELL" | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  /** Size-first override; falls back to settings.proposedSize. */
  proposedSize?: number | null;
  calculationMode?: RiskCalculationMode;
  bid?: number | null;
  ask?: number | null;
  conversionQuotes?: Array<{
    base: string;
    quote: string;
    bid: number | null;
    ask: number | null;
    source: string;
    observedAt: string;
  }>;
  /** Optional known commission in account currency (verified). */
  commissionAccount?: number | null;
  nowMs?: number;
}

function emptyCosts(reason: string | null): PositionRiskCostBreakdown {
  return {
    spreadCostAccount: null,
    commissionAccount: null,
    otherCostsAccount: null,
    totalCostsAccount: null,
    unavailableReason: reason,
    isEstimate: true,
  };
}

function emptyMargin(reason: string): PositionRiskMargin {
  return {
    estimatedMarginAccount: null,
    unavailableReason: reason,
    isEstimate: true,
    note: "Estimated margin is not an exact broker quote.",
  };
}

function basisValue(settings: ForexRiskSettings): { value: number | null; reason: string | null } {
  if (settings.riskBasis === "manual_equity") {
    if (!isFiniteNumber(settings.manualEquity) || settings.manualEquity <= 0) {
      return { value: null, reason: "Manual equity is missing or invalid." };
    }
    return { value: settings.manualEquity, reason: null };
  }
  if (!isFiniteNumber(settings.manualBalance) || settings.manualBalance <= 0) {
    return { value: null, reason: "Manual balance is missing or invalid." };
  }
  return { value: settings.manualBalance, reason: null };
}

function riskBudget(
  settings: ForexRiskSettings,
  basis: number,
): { budget: number | null; reason: string | null } {
  if (settings.riskBudgetMode === "fixed") {
    if (!isFiniteNumber(settings.riskFixedAmount) || settings.riskFixedAmount <= 0) {
      return { budget: null, reason: "Fixed risk amount is missing or invalid." };
    }
    return { budget: settings.riskFixedAmount, reason: null };
  }
  if (!isFiniteNumber(settings.riskPercent) || settings.riskPercent <= 0 || settings.riskPercent > 100) {
    return { budget: null, reason: "Risk percent must be in (0, 100]." };
  }
  return { budget: (basis * settings.riskPercent) / 100, reason: null };
}

function validateSidePrices(input: CalculatePositionRiskInput): string[] {
  const issues: string[] = [];
  if (input.side !== "BUY" && input.side !== "SELL") {
    issues.push("Side must be BUY or SELL for monetary risk sizing.");
    return issues;
  }
  if (!isFiniteNumber(input.entryPrice) || input.entryPrice <= 0) {
    issues.push("Entry price is missing or invalid.");
  }
  if (!isFiniteNumber(input.stopLoss) || input.stopLoss <= 0) {
    issues.push("Stop loss is missing or invalid.");
  }
  if (input.side === "BUY" && isFiniteNumber(input.entryPrice) && isFiniteNumber(input.stopLoss)) {
    if (input.stopLoss >= input.entryPrice) issues.push("BUY stop loss must be below entry.");
    if (isFiniteNumber(input.takeProfit) && input.takeProfit <= input.entryPrice) {
      issues.push("BUY take profit must be above entry.");
    }
  }
  if (input.side === "SELL" && isFiniteNumber(input.entryPrice) && isFiniteNumber(input.stopLoss)) {
    if (input.stopLoss <= input.entryPrice) issues.push("SELL stop loss must be above entry.");
    if (isFiniteNumber(input.takeProfit) && input.takeProfit >= input.entryPrice) {
      issues.push("SELL take profit must be below entry.");
    }
  }
  return issues;
}

/**
 * Gross P/L in quote (or account when pipCost path) for a given size.
 * Returns null when contract convention cannot support the calc.
 */
function grossMoveValue(input: {
  contract: InstrumentContractSpec;
  entry: number;
  exit: number;
  size: number;
  accountCurrency: string;
  conversion: ConversionRateQuote | null;
}): { account: number | null; quote: number | null; reason: string | null } {
  const { contract } = input;
  const move = Math.abs(input.exit - input.entry);
  if (!(move > 0) || !(input.size > 0)) {
    return { account: null, quote: null, reason: "Non-positive price move or size." };
  }

  if (contract.convention === "fx_pip_cost_lot") {
    if (!isFiniteNumber(contract.pointSize) || contract.pointSize <= 0
      || !isFiniteNumber(contract.pipCostAccount) || contract.pipCostAccount <= 0) {
      return { account: null, quote: null, reason: "PipCost/PointSize incomplete." };
    }
    const points = priceDistanceInPoints(move, contract.pointSize);
    if (points == null || !(points > 0)) {
      return { account: null, quote: null, reason: "Stop distance in points is invalid." };
    }
    const account = points * contract.pipCostAccount * input.size;
    return { account, quote: null, reason: null };
  }

  if (contract.convention === "fx_base_unit") {
    if (!isFiniteNumber(contract.baseUnitSize) || contract.baseUnitSize <= 0) {
      return { account: null, quote: null, reason: "BaseUnitSize missing." };
    }
    const mult = isFiniteNumber(contract.contractMultiplier) ? contract.contractMultiplier : 1;
    const quote = move * contract.baseUnitSize * mult * input.size;
    const account = convertAmount(quote, input.conversion);
    if (account == null) {
      return { account: null, quote, reason: "Quote→account conversion unavailable." };
    }
    return { account, quote, reason: null };
  }

  if (contract.convention === "crypto_base_qty" || contract.convention === "cfd_multiplier"
    || contract.convention === "ounce_contract") {
    const mult = isFiniteNumber(contract.contractMultiplier) ? contract.contractMultiplier : 1;
    const quote = move * mult * input.size;
    const account = convertAmount(quote, input.conversion);
    if (account == null) {
      return { account: null, quote, reason: "Quote→account conversion unavailable." };
    }
    return { account, quote, reason: null };
  }

  return { account: null, quote: null, reason: "Unsupported or unverified contract convention." };
}

function estimateSpreadCost(input: {
  contract: InstrumentContractSpec;
  size: number;
  bid: number | null | undefined;
  ask: number | null | undefined;
  conversion: ConversionRateQuote | null;
  accountCurrency: string;
}): number | null {
  if (!isFiniteNumber(input.bid) || !isFiniteNumber(input.ask) || input.ask < input.bid) return null;
  const spread = input.ask - input.bid;
  if (!(spread > 0) || !(input.size > 0)) return null;
  // Approximate round-turn cost ≈ 1 spread width at size (estimate).
  const fake = grossMoveValue({
    contract: input.contract,
    entry: input.bid,
    exit: input.ask,
    size: input.size,
    accountCurrency: input.accountCurrency,
    conversion: input.conversion,
  });
  return fake.account;
}

function resolveInstrumentConversion(
  contract: InstrumentContractSpec,
  settings: ForexRiskSettings,
  quotes: CalculatePositionRiskInput["conversionQuotes"],
  nowMs: number,
): { conversion: ConversionRateQuote | null; reason: string | null } {
  const account = settings.accountCurrency.trim().toUpperCase();
  if (!account) return { conversion: null, reason: "Account currency is not configured." };

  // PipCost path already yields account currency — conversion identity.
  if (contract.convention === "fx_pip_cost_lot") {
    return {
      conversion: {
        fromCurrency: account,
        toCurrency: account,
        rate: 1,
        source: "pipCost-account-native",
        observedAt: new Date(nowMs).toISOString(),
        inverted: false,
      },
      reason: null,
    };
  }

  const from = (contract.quoteCurrency ?? contract.contractCurrency ?? "").trim().toUpperCase();
  if (!from) return { conversion: null, reason: "Instrument quote/contract currency unknown." };
  if (from === account) {
    return {
      conversion: {
        fromCurrency: from,
        toCurrency: account,
        rate: 1,
        source: "identity",
        observedAt: new Date(nowMs).toISOString(),
        inverted: false,
      },
      reason: null,
    };
  }
  const resolved = resolveConversionRate({
    fromCurrency: from,
    toCurrency: account,
    quotes: quotes ?? [],
    maxAgeMs: settings.conversionMaxAgeMs,
    nowMs,
  });
  if (!resolved.ok) return { conversion: null, reason: resolved.reason };
  return { conversion: resolved.quote, reason: null };
}

export function calculatePositionRisk(input: CalculatePositionRiskInput): PositionRiskResult {
  const nowMs = input.nowMs ?? Date.now();
  const computedAt = new Date(nowMs).toISOString();
  const mode = input.calculationMode ?? input.settings.calculationMode;
  const notes: string[] = [];
  const blocking: string[] = [];
  const accountCurrency = input.settings.accountCurrency.trim().toUpperCase() || null;

  const base: PositionRiskResult = {
    schemaVersion: FOREX_POSITION_RISK_SCHEMA,
    calculationMode: mode,
    side: input.side,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    accountCurrency,
    riskBudgetAccount: null,
    riskBasisValue: null,
    positionSize: null,
    positionSizeUnit: input.contract.quantityUnit,
    maxPermissibleSize: null,
    proposedSize: input.proposedSize ?? input.settings.proposedSize,
    stopDistancePrice: null,
    stopDistancePoints: null,
    grossLossAccount: null,
    netLossAccount: null,
    grossProfitAccount: null,
    netProfitAccount: null,
    riskPercentOfBasis: null,
    rewardRiskRatio: null,
    minRewardRiskRatio: input.settings.minRewardRiskRatio,
    excessRiskAccount: null,
    excessRiskPercent: null,
    costs: emptyCosts("Costs not yet established."),
    margin: emptyMargin("Margin parameters not verified for this instrument."),
    contract: input.contract,
    conversion: { used: null, unavailableReason: null },
    riskEligible: false,
    blockingReasons: [],
    notes,
    computedAt,
  };

  if (!input.contract.verified || input.contract.unavailableReason) {
    blocking.push(input.contract.unavailableReason ?? "Contract specification is not verified.");
    return { ...base, blockingReasons: blocking };
  }
  if (!accountCurrency) {
    blocking.push("Account currency is not configured in Forex Admin risk settings.");
    return { ...base, blockingReasons: blocking };
  }

  const priceIssues = validateSidePrices(input);
  if (priceIssues.length) {
    return { ...base, blockingReasons: priceIssues };
  }

  const entry = input.entryPrice as number;
  const stop = input.stopLoss as number;
  const tp = isFiniteNumber(input.takeProfit) ? input.takeProfit : null;
  const stopDistancePrice = Math.abs(entry - stop);
  const stopDistancePoints =
    isFiniteNumber(input.contract.pointSize) && input.contract.pointSize > 0
      ? priceDistanceInPoints(stopDistancePrice, input.contract.pointSize)
      : null;

  const basis = basisValue(input.settings);
  if (basis.value == null) {
    return { ...base, stopDistancePrice, stopDistancePoints, blockingReasons: [basis.reason!] };
  }
  const budget = riskBudget(input.settings, basis.value);
  if (budget.budget == null) {
    return {
      ...base,
      riskBasisValue: basis.value,
      stopDistancePrice,
      stopDistancePoints,
      blockingReasons: [budget.reason!],
    };
  }

  const conv = resolveInstrumentConversion(input.contract, input.settings, input.conversionQuotes, nowMs);
  base.conversion = { used: conv.conversion, unavailableReason: conv.reason };
  if (conv.conversion == null && input.contract.convention !== "fx_pip_cost_lot") {
    blocking.push(conv.reason ?? "Currency conversion unavailable.");
    return {
      ...base,
      riskBasisValue: basis.value,
      riskBudgetAccount: budget.budget,
      stopDistancePrice,
      stopDistancePoints,
      blockingReasons: blocking,
    };
  }

  const step = input.contract.quantityStep;
  if (!isFiniteNumber(step) || step <= 0) {
    return {
      ...base,
      riskBasisValue: basis.value,
      riskBudgetAccount: budget.budget,
      stopDistancePrice,
      stopDistancePoints,
      blockingReasons: ["Quantity step is missing — cannot normalize a tradable size."],
    };
  }

  // Unit loss at size=1
  const unitLoss = grossMoveValue({
    contract: input.contract,
    entry,
    exit: stop,
    size: 1,
    accountCurrency,
    conversion: conv.conversion,
  });
  if (unitLoss.account == null || !(unitLoss.account > 0)) {
    return {
      ...base,
      riskBasisValue: basis.value,
      riskBudgetAccount: budget.budget,
      stopDistancePrice,
      stopDistancePoints,
      blockingReasons: [unitLoss.reason ?? "Cannot compute per-unit stop loss value."],
    };
  }

  const rawMax = budget.budget / unitLoss.account;
  let maxPermissible = floorToStep(rawMax, step);
  maxPermissible = clampMinMax(maxPermissible, input.contract.quantityMin, input.contract.quantityMax);
  if (isFiniteNumber(input.contract.quantityMin) && maxPermissible > 0
    && maxPermissible < input.contract.quantityMin) {
    maxPermissible = 0;
  }

  let positionSize: number | null = null;
  let proposed = input.proposedSize ?? input.settings.proposedSize ?? null;

  if (mode === "risk_budget_first") {
    positionSize = maxPermissible > 0 ? maxPermissible : 0;
    if (!(positionSize > 0)) {
      blocking.push("Risk budget cannot fund the instrument minimum quantity step.");
    }
  } else {
    if (!isFiniteNumber(proposed) || proposed <= 0) {
      blocking.push("Size-first mode requires a proposed position size.");
      proposed = null;
    } else {
      const normalized = floorToStep(proposed, step);
      positionSize = clampMinMax(normalized, input.contract.quantityMin, input.contract.quantityMax);
      if (normalized !== proposed) {
        notes.push(`Proposed size rounded down to quantity step ${step}.`);
      }
      if (!(positionSize > 0)) {
        blocking.push("Proposed size is below the instrument minimum after step normalization.");
      }
    }
  }

  let grossLoss: number | null = null;
  let grossProfit: number | null = null;
  if (positionSize != null && positionSize > 0) {
    grossLoss = grossMoveValue({
      contract: input.contract,
      entry,
      exit: stop,
      size: positionSize,
      accountCurrency,
      conversion: conv.conversion,
    }).account;
    if (tp != null) {
      grossProfit = grossMoveValue({
        contract: input.contract,
        entry,
        exit: tp,
        size: positionSize,
        accountCurrency,
        conversion: conv.conversion,
      }).account;
    }
  }

  const spreadCost = positionSize && positionSize > 0
    ? estimateSpreadCost({
      contract: input.contract,
      size: positionSize,
      bid: input.bid,
      ask: input.ask,
      conversion: conv.conversion,
      accountCurrency,
    })
    : null;
  const commission = isFiniteNumber(input.commissionAccount) ? input.commissionAccount : null;
  const costParts = [spreadCost, commission].filter((n): n is number => isFiniteNumber(n));
  const totalCosts = costParts.length ? costParts.reduce((a, b) => a + b, 0) : null;
  const costs: PositionRiskCostBreakdown = {
    spreadCostAccount: spreadCost,
    commissionAccount: commission,
    otherCostsAccount: null,
    totalCostsAccount: totalCosts,
    unavailableReason: totalCosts == null
      ? "Spread/commission incomplete — net figures omit unavailable costs."
      : null,
    isEstimate: true,
  };

  const netLoss = grossLoss != null
    ? grossLoss + (totalCosts ?? 0)
    : null;
  const netProfit = grossProfit != null
    ? Math.max(0, grossProfit - (totalCosts ?? 0))
    : null;

  let rewardRiskRatio: number | null = null;
  if (isFiniteNumber(netProfit) && isFiniteNumber(netLoss) && netLoss > 0) {
    rewardRiskRatio = netProfit / netLoss;
  } else if (isFiniteNumber(grossProfit) && isFiniteNumber(grossLoss) && grossLoss > 0) {
    rewardRiskRatio = grossProfit / grossLoss;
    notes.push("R:R uses gross P/L because net costs are incomplete.");
  }

  let excessRiskAccount: number | null = null;
  let excessRiskPercent: number | null = null;
  if (mode === "size_first" && isFiniteNumber(netLoss) && netLoss > budget.budget) {
    excessRiskAccount = netLoss - budget.budget;
    excessRiskPercent = (excessRiskAccount / basis.value) * 100;
    blocking.push(
      `Proposed size exceeds risk budget by ${roundTo(excessRiskAccount, 2)} ${accountCurrency}`
        + ` (${roundTo(excessRiskPercent, 4)}% of basis).`,
    );
  }

  if (isFiniteNumber(input.settings.minRewardRiskRatio) && input.settings.minRewardRiskRatio > 0) {
    if (rewardRiskRatio == null) {
      blocking.push("Reward-to-risk ratio unavailable — cannot satisfy minimum R:R.");
    } else if (rewardRiskRatio + 1e-12 < input.settings.minRewardRiskRatio) {
      blocking.push(
        `Reward-to-risk ${roundTo(rewardRiskRatio, 4)} is below minimum `
          + `${input.settings.minRewardRiskRatio}.`,
      );
    }
  }

  // Margin estimate: prefer verified decimal rate; else FXCM absolute MMR × lots.
  let margin = emptyMargin("Margin parameters not verified for this instrument.");
  if (positionSize != null && positionSize > 0 && isFiniteNumber(entry)) {
    if (isFiniteNumber(input.contract.marginPerLotAccount) && input.contract.marginPerLotAccount > 0) {
      margin = {
        estimatedMarginAccount: input.contract.marginPerLotAccount * positionSize,
        unavailableReason: null,
        isEstimate: true,
        note: "Estimated from verified FXCM MMR (absolute margin per 1 lot) × size — not an exact broker quote.",
      };
    } else if (isFiniteNumber(input.contract.marginRate) && input.contract.marginRate > 0) {
      let notionalQuote: number | null = null;
      if (input.contract.convention === "fx_base_unit" && isFiniteNumber(input.contract.baseUnitSize)) {
        notionalQuote = entry * input.contract.baseUnitSize * positionSize
          * (input.contract.contractMultiplier ?? 1);
      } else if (input.contract.convention === "fx_pip_cost_lot" && isFiniteNumber(input.contract.baseUnitSize)) {
        notionalQuote = entry * input.contract.baseUnitSize * positionSize
          * (input.contract.contractMultiplier ?? 1);
      } else if (input.contract.convention === "crypto_base_qty"
        || input.contract.convention === "ounce_contract"
        || input.contract.convention === "cfd_multiplier") {
        notionalQuote = entry * positionSize * (input.contract.contractMultiplier ?? 1);
      }
      const notionalAccount = notionalQuote != null
        ? convertAmount(notionalQuote, conv.conversion)
        : null;
      if (notionalAccount != null) {
        margin = {
          estimatedMarginAccount: notionalAccount * input.contract.marginRate,
          unavailableReason: null,
          isEstimate: true,
          note: "Estimated from verified margin rate × notional — not an exact broker quote.",
        };
      }
    }
  }
  if (input.settings.requireMarginForEligibility && margin.estimatedMarginAccount == null) {
    blocking.push(margin.unavailableReason ?? "Margin required for eligibility but unavailable.");
  }

  if (positionSize != null && !(positionSize > 0) && mode === "risk_budget_first") {
    // already blocked
  }

  const riskPercentOfBasis =
    isFiniteNumber(netLoss) && basis.value > 0 ? (netLoss / basis.value) * 100 : null;

  const riskEligible = blocking.length === 0
    && positionSize != null
    && positionSize > 0
    && isFiniteNumber(netLoss);

  return {
    ...base,
    riskBudgetAccount: budget.budget,
    riskBasisValue: basis.value,
    positionSize,
    maxPermissibleSize: maxPermissible > 0 ? maxPermissible : 0,
    proposedSize: proposed,
    stopDistancePrice,
    stopDistancePoints,
    grossLossAccount: grossLoss,
    netLossAccount: netLoss,
    grossProfitAccount: grossProfit,
    netProfitAccount: netProfit,
    riskPercentOfBasis,
    rewardRiskRatio,
    excessRiskAccount,
    excessRiskPercent,
    costs,
    margin,
    conversion: { used: conv.conversion, unavailableReason: conv.reason },
    riskEligible,
    blockingReasons: blocking,
    notes,
    computedAt,
  };
}
