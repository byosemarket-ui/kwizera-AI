/**
 * Phase 56.2 — Assemble simulation draft input from AT decision + verification.
 * Never invents contract ounces, min-stop, equity, or risk %.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { AtDecisionResult } from "../decision/types.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import { isInstrumentAllowlisted } from "./allowlist.js";
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
      source: null,
      unavailableReason: "No verification instrument metadata.",
    };
  }

  const pointSize = finiteOrNull(inst.pointSize);
  const quantityStep = finiteOrNull(inst.quantityStep);
  // Phase 56.1: do not treat bullion contractMultiplier as proven ounces.
  // Mark unit ambiguous unless we have an explicit non-invented unit from verification.
  const contractVerified = Boolean(inst.contractVerified) && isInstrumentAllowlisted(instrument);
  // XAU ounce semantics remain unproven (Phase 56.1) — never invent units here.
  const quantityUnitAmbiguous = true;

  return {
    verified: contractVerified && pointSize != null,
    pointSize,
    tickSize: pointSize,
    digits: pointSize != null && pointSize > 0
      ? Math.max(0, Math.round(-Math.log10(pointSize)))
      : null,
    quantityMin: quantityStep,
    quantityStep,
    quantityUnit: "unknown",
    quantityUnitAmbiguous,
    contractMultiplier: null,
    baseUnitSize: null,
    pipCostAccount: null,
    marginPerLotAccount: null,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: contractVerified ? "at-verification-instrument" : null,
    unavailableReason: contractVerified
      ? "Quantity unit / ounce semantics and min-stop remain unverified (Phase 56.1)."
      : "Instrument contract not verified for sizing.",
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
    contract: buildContract(params.verification, instrument),
    account: buildAccount(params.verification, params.environment),
    sourceDecisionId: decision?.decisionId ?? null,
    sourceAnalysisId: decision?.sourceAnalysisId ?? null,
    sourceEvidenceFingerprint: decision?.sourceEvidenceFingerprint ?? null,
    sourceDecidedAtUtc: decision?.decidedAtUtc ?? null,
    policy: params.policy,
    openPositionsCount: null,
    pendingOrdersCount: null,
    exposureDataAuthoritative: false,
    allocationPercentage: null,
    marketEvidenceStrength: null,
    profitProtection: null,
  };
}
