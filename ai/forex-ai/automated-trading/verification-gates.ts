/**
 * Shared Phase 52 verification gates for monitoring (53.3) and decisions (54).
 * Quote freshness is evaluated through the canonical quote-freshness contract.
 */
import type { AutomatedTradingVerificationResult } from "./verification-types.js";
import {
  evaluateVerificationQuoteFreshness,
  type AtQuoteFreshnessEvaluation,
} from "./quote-freshness.js";

export function isVerificationAccountIdentityOk(
  verification: AutomatedTradingVerificationResult | null | undefined,
): boolean {
  if (!verification) return false;
  return (
    verification.identityStatus === "ACCOUNT_VERIFIED"
    && verification.account?.isFresh === true
  );
}

/**
 * Live market-price evidence: LIVE feed with finite Bid/Ask and recent genuine price change.
 * Heartbeat alone is insufficient. Cached LIVE snapshots age out via verifiedAtUtc.
 */
export function isVerificationMarketQuoteFresh(
  verification: AutomatedTradingVerificationResult | null | undefined,
  options?: {
    nowMs?: number;
    expectedInstrument?: string | null;
    staleMs?: number;
  },
): boolean {
  return evaluateVerificationQuoteFreshness(verification, options).fresh;
}

/** Full freshness evaluation (diagnostics + gating). */
export function evaluateVerificationMarketQuoteFreshness(
  verification: AutomatedTradingVerificationResult | null | undefined,
  options?: {
    nowMs?: number;
    expectedInstrument?: string | null;
    staleMs?: number;
  },
): AtQuoteFreshnessEvaluation {
  return evaluateVerificationQuoteFreshness(verification, options);
}

/** Best-effort last genuine quote observation time from Phase 52 market fields. */
export function verificationLastQuoteChangeAtUtc(
  verification: AutomatedTradingVerificationResult | null | undefined,
): string | null {
  const market = verification?.market;
  if (!market) return null;
  // Prefer broker/source timestamp when present — do not substitute receipt for source silently.
  if (typeof market.sourceTimestampMs === "number" && Number.isFinite(market.sourceTimestampMs)) {
    return new Date(market.sourceTimestampMs).toISOString();
  }
  if (typeof market.receivedAtMs === "number" && Number.isFinite(market.receivedAtMs)) {
    return new Date(market.receivedAtMs).toISOString();
  }
  return verification?.verifiedAtUtc ?? null;
}
