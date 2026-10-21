/**
 * Phase 56.2 / 56.2.4 — Assemble simulation draft input from AT decision + verification.
 * Never invents contract ounces, min-stop, equity, or risk %.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { AtDecisionResult } from "../decision/types.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import { isInstrumentAllowlisted } from "./allowlist.js";
import type { ExposureReconciliationResult } from "./exposure-reconciliation.js";
import { resolveXauQuantitySemantics } from "./quantity-semantics.js";
import { resolveXauQuantityConstraints } from "./quantity-constraints.js";
import type {
  AtSimAccountMetaInput,
  AtSimContractMetaInput,
  AtSimDraftInput,
  AtSimEnvironmentMetaInput,
  AtSimQuoteMetaInput,
  AtSimRiskPolicy,
} from "./types.js";

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export interface AssembleSimDraftParams {
  environment: AutomatedTradingEnvironment;
  environmentEpoch: number;
  decision: AtDecisionResult | null;
  verification: AutomatedTradingVerificationResult | null;
  quoteFresh: boolean | null;
  freshnessReasonCode: string | null;
  quoteAgeMs: number | null;
  sessionEnvironment: AutomatedTradingEnvironment | null;
  sessionMatchesSelection: boolean | null;
  policy: AtSimRiskPolicy;
  /** Phase 56.2.3 — strategy capital % from AT controls. */
  capitalAllocationPercent?: number | null;
  /** Requested monetary per-order allocation from remaining strategy budget. */
  requestedPerOrderAllocation?: number | null;
  /** ACTIVE reservations total for this environment (excluding current draft). */
  reservedStrategyBudgetActive?: number;
  /** Phase 56.2.4 — reconciled Orders/Trades RO exposure (optional). */
  exposureReconciliation?: ExposureReconciliationResult | null;
  /** Optional CondDist from TradingSettings RO. */
  condDistStop?: number | null;
  condDistStopUnit?: string | null;
  condDistAvailable?: boolean;
  /** Optional override prices for pure API/tests (still validated). */
  overrides?: {
    instrument?: string;
    direction?: AtBinaryDirection | null;
    entryPrice?: number | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    requestedQuantity?: number | null;
  };
}

function buildContract(
  verification: AutomatedTradingVerificationResult | null,
  instrument: string,
  cond: {
    condDistStop?: number | null;
    condDistStopUnit?: string | null;
    condDistAvailable?: boolean;
  },
): AtSimContractMetaInput | null {
  const inst = verification?.instrument;
  if (!inst) {
    return {
      verified: false,
      pointSize: null,
      tickSize: null,
      digits: null,
      quantityMin: null,
      quantityStep: null,
      quantityUnit: null,
      quantityUnitAmbiguous: true,
      contractMultiplier: null,
      baseUnitSize: null,
      pipCostAccount: null,
      marginPerLotAccount: null,
      minStopDistance: null,
      minStopDistanceVerified: false,
      minStopNoPositiveMinimum: false,
      condDistStopPips: null,
      condDistUnit: null,
      source: null,
      unavailableReason: "No verification instrument metadata.",
    };
  }

  const pointSize = finiteOrNull(inst.pointSize);
  const quantityStep = finiteOrNull(inst.quantityStep);
  const quantityMin = finiteOrNull(inst.quantityMin);
  const contractVerified = Boolean(inst.contractVerified) && isInstrumentAllowlisted(instrument);

  const semantics = resolveXauQuantitySemantics({
    symbol: instrument || inst.symbol,
    instrumentType: inst.instrumentType,
    pointSize,
    pipCostAccount: finiteOrNull(inst.pipCostAccount),
    baseUnitSize: finiteOrNull(inst.baseUnitSize),
    contractMultiplier: finiteOrNull(inst.contractMultiplier),
    quantityStep,
    quantityMin,
    legacyQuantityUnitLabel: inst.quantityUnit,
    condDistStop: cond.condDistStop,
    condDistStopUnit: cond.condDistStopUnit,
    condDistAvailable: cond.condDistAvailable,
  });

  const constraints = resolveXauQuantityConstraints({
    quantityUnit: semantics.resolvedQuantityUnit,
    quantityUnitAmbiguous: semantics.quantityUnitAmbiguous,
    baseUnitSize: finiteOrNull(inst.baseUnitSize),
    sdkMinQuantity: quantityMin,
    legacyLotStep: quantityStep,
    reportedQuantityStep: quantityStep,
    reportedQuantityMin: quantityMin,
  });

  const verified = contractVerified && pointSize != null;
  const unavailableReason = !verified
    ? "Instrument contract not verified for sizing."
    : semantics.quantityUnitAmbiguous
      ? `Quantity unit ${semantics.quantityUnit.status}; monetary R blocked until VERIFIED contract binding.`
      : constraints.sizingBlocked
        ? (constraints.blockMessage
          ?? "Quantity min/step constraints unverified — sizing blocked.")
      : !semantics.minStopDistanceVerified
        ? `Quantity unit ${semantics.resolvedQuantityUnit} (${semantics.quantityUnit.status}); min-stop ${semantics.minStopDistance.status} (account Enhanced Execution not attested).`
        : null;

  return {
    verified,
    pointSize,
    tickSize: pointSize,
    digits: pointSize != null && pointSize > 0
      ? Math.max(0, Math.round(-Math.log10(pointSize)))
      : null,
    quantityMin: constraints.sizingBlocked ? null : constraints.quantityMin,
    quantityStep: constraints.sizingBlocked ? null : constraints.quantityStep,
    quantityUnit: semantics.resolvedQuantityUnit,
    quantityUnitAmbiguous:
      semantics.quantityUnitAmbiguous || constraints.sizingBlocked,
    contractMultiplier: finiteOrNull(inst.contractMultiplier),
    baseUnitSize: finiteOrNull(inst.baseUnitSize),
    pipCostAccount: finiteOrNull(inst.pipCostAccount),
    marginPerLotAccount: finiteOrNull(inst.marginPerLotAccount),
    minStopDistance: semantics.minStopDistanceValue,
    minStopDistanceVerified: semantics.minStopDistanceVerified,
    minStopNoPositiveMinimum: semantics.minStopNoPositiveMinimum,
    condDistStopPips: semantics.condDistStopPips,
    condDistUnit: semantics.condDistUnit,
    source: contractVerified
      ? `at-verification+phase-56.2.6-semantics:${semantics.summaryStatus}`
      : null,
    unavailableReason,
  };
}

function buildAccount(
  verification: AutomatedTradingVerificationResult | null,
  environment: AutomatedTradingEnvironment,
): AtSimAccountMetaInput | null {
  const acct = verification?.account;
  if (!acct) {
    return {
      verified: false,
      accountIdMasked: null,
      accountCurrency: null,
      equity: null,
      balance: null,
      usableMargin: null,
      usedMargin: null,
      fetchedAtUtc: null,
      environment,
      unavailableReason: "No verification account snapshot.",
    };
  }
  const identityOk = verification?.identityStatus === "ACCOUNT_VERIFIED";
  const hasMoney =
    finiteOrNull(acct.equity) != null || finiteOrNull(acct.balance) != null;
  const verified = Boolean(identityOk && hasMoney && acct.isFresh !== false);
  return {
    verified,
    accountIdMasked: acct.accountIdMasked ?? null,
    accountCurrency: acct.accountCurrency ?? null,
    equity: finiteOrNull(acct.equity),
    balance: finiteOrNull(acct.balance),
    usableMargin: finiteOrNull(acct.usableMargin),
    usedMargin: finiteOrNull(acct.usedMargin),
    fetchedAtUtc: acct.fetchedAtUtc ?? null,
    environment,
    unavailableReason: verified
      ? null
      : "Account snapshot missing identity, freshness, or monetary fields.",
  };
}

function buildQuote(
  verification: AutomatedTradingVerificationResult | null,
  entryPrice: number | null,
  quoteFresh: boolean | null,
  freshnessReasonCode: string | null,
  quoteAgeMs: number | null,
): AtSimQuoteMetaInput {
  const market = verification?.market;
  const bid = finiteOrNull(market?.bid);
  const ask = finiteOrNull(market?.ask);
  const mid =
    bid != null && ask != null ? (bid + ask) / 2 : bid ?? ask ?? null;
  return {
    bid,
    ask,
    entryPrice: entryPrice ?? mid,
    entrySource: entryPrice != null ? "draft-input" : mid != null ? "verification-mid" : null,
    fresh: quoteFresh,
    freshnessReasonCode,
    quoteAgeMs,
    observedAtUtc: verification?.verifiedAtUtc ?? null,
  };
}

function buildEnvironmentMeta(
  params: AssembleSimDraftParams,
): AtSimEnvironmentMetaInput {
  return {
    requested: params.environment,
    actualSession: params.sessionEnvironment,
    matches: params.sessionMatchesSelection,
    environmentEpoch: params.environmentEpoch,
    identityVerified: params.verification?.identityStatus === "ACCOUNT_VERIFIED",
    liveExecutionAuthorized: false,
  };
}

/**
 * Prefer explicit overrides, else decision direction + verification mid as entry.
 * SL/TP must be supplied via overrides in Phase 56.2 (decision engine has no SL/TP).
 */
export function assembleSimDraftInput(params: AssembleSimDraftParams): AtSimDraftInput {
  const o = params.overrides ?? {};
  const decision = params.decision;
  const instrument = String(
    o.instrument
      ?? decision?.instrument
      ?? params.verification?.instrument?.symbol
      ?? "",
  ).trim();
  const direction =
    o.direction !== undefined
      ? o.direction
      : decision?.direction ?? null;
  const entryPrice =
    o.entryPrice !== undefined
      ? o.entryPrice
      : null;
  const stopLoss = o.stopLoss !== undefined ? o.stopLoss : null;
  const takeProfit = o.takeProfit !== undefined ? o.takeProfit : null;

  // If entry not overridden, derive mid from verification for convenience.
  const quote = buildQuote(
    params.verification,
    entryPrice,
    params.quoteFresh,
    params.freshnessReasonCode,
    params.quoteAgeMs,
  );
  const resolvedEntry = entryPrice ?? quote.entryPrice;
  const exposure = params.exposureReconciliation ?? null;

  return {
    environment: params.environment,
    environmentMeta: buildEnvironmentMeta(params),
    instrument,
    direction,
    entryPrice: resolvedEntry,
    stopLoss,
    takeProfit,
    requestedQuantity: o.requestedQuantity ?? null,
    quote: { ...quote, entryPrice: resolvedEntry },
    contract: buildContract(params.verification, instrument, {
      condDistStop: params.condDistStop,
      condDistStopUnit: params.condDistStopUnit,
      condDistAvailable: params.condDistAvailable,
    }),
    account: buildAccount(params.verification, params.environment),
    sourceDecisionId: decision?.decisionId ?? null,
    sourceAnalysisId: decision?.sourceAnalysisId ?? null,
    sourceEvidenceFingerprint: decision?.sourceEvidenceFingerprint ?? null,
    sourceDecidedAtUtc: decision?.decidedAtUtc ?? null,
    policy: params.policy,
    openPositionsCount: exposure?.openPositionsCount ?? null,
    pendingOrdersCount: exposure?.pendingOrdersCount ?? null,
    exposureDataAuthoritative: Boolean(exposure?.authoritative),
    allocationPercentage: null,
    marketEvidenceStrength: null,
    profitProtection: null,
    capitalAllocationPercent:
      params.capitalAllocationPercent !== undefined ? params.capitalAllocationPercent : null,
    requestedPerOrderAllocation:
      params.requestedPerOrderAllocation !== undefined
        ? params.requestedPerOrderAllocation
        : null,
    reservedStrategyBudgetActive:
      typeof params.reservedStrategyBudgetActive === "number"
      && Number.isFinite(params.reservedStrategyBudgetActive)
        ? Math.max(0, params.reservedStrategyBudgetActive)
        : 0,
  };
}
