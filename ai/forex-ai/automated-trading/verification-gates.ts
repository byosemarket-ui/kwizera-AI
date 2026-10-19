/**
 * Shared Phase 52 verification gates for monitoring (53.3) and decisions (54).
 * Reads the actual AutomatedTradingVerificationResult shape — never invents fields.
 */
import type { AutomatedTradingVerificationResult } from "./verification-types.js";

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
 * Live market-price evidence: LIVE feed with finite Bid/Ask.
 * Heartbeat alone is insufficient — Bid/Ask must be present.
 */
export function isVerificationMarketQuoteFresh(
  verification: AutomatedTradingVerificationResult | null | undefined,
): boolean {
  const market = verification?.market;
  if (!market) return false;
  return (
    market.feedStatus === "LIVE"
    && market.bid != null
    && Number.isFinite(market.bid)
    && market.ask != null
    && Number.isFinite(market.ask)
  );
}

/** Best-effort last quote observation time from Phase 52 market fields. */
export function verificationLastQuoteChangeAtUtc(
  verification: AutomatedTradingVerificationResult | null | undefined,
): string | null {
  const market = verification?.market;
  if (!market) return null;
  if (typeof market.receivedAtMs === "number" && Number.isFinite(market.receivedAtMs)) {
    return new Date(market.receivedAtMs).toISOString();
  }
  if (typeof market.sourceTimestampMs === "number" && Number.isFinite(market.sourceTimestampMs)) {
    return new Date(market.sourceTimestampMs).toISOString();
  }
  return verification?.verifiedAtUtc ?? null;
}
