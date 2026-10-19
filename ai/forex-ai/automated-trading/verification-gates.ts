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

/**
 * Last genuine Bid/Ask *price change* time from Phase 52 market fields.
 * Heartbeat receipts and seeded Offers snapshots must not appear as quote changes —
 * that mislabels SUBSCRIBING / FEED_NOT_LIVE as if prices were still moving.
 */
export function verificationLastQuoteChangeAtUtc(
  verification: AutomatedTradingVerificationResult | null | undefined,
): string | null {
  const market = verification?.market;
  if (!market) return null;
  const verifiedAtMs = Date.parse(String(verification?.verifiedAtUtc ?? ""));
  const priceChangeAgeMs = market.priceChangeAgeMs;
  if (
    Number.isFinite(verifiedAtMs)
    && verifiedAtMs > 0
    && typeof priceChangeAgeMs === "number"
    && Number.isFinite(priceChangeAgeMs)
    && priceChangeAgeMs >= 0
  ) {
    return new Date(verifiedAtMs - priceChangeAgeMs).toISOString();
  }
  // No genuine price-change clock — do not fall back to receipt/source heartbeats.
  return null;
}
