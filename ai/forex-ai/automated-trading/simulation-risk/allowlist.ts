/**
 * Phase 56.2 — Central XAU/USD instrument allowlist for Automated Trading drafts.
 * Independent of DEMO/LIVE execution permissions. Reject unsupported instruments by default.
 */

/** Verified FXCM provider symbol (Phase 56.1 DEMO Offers). */
export const AT_ALLOWED_PROVIDER_SYMBOL = "XAU/USD";

/** Canonical form used alongside providerSymbol in FC normalization. */
export const AT_ALLOWED_CANONICAL_SYMBOL = "XAUUSD";

export const AT_INSTRUMENT_ALLOWLIST: readonly string[] = Object.freeze([
  AT_ALLOWED_PROVIDER_SYMBOL,
  AT_ALLOWED_CANONICAL_SYMBOL,
]);

/**
 * Normalize an instrument id for allowlist comparison.
 * Does not invent broker identity — only folds separators for matching
 * against the known XAU forms (provider `XAU/USD` and canonical `XAUUSD`).
 */
export function normalizeInstrumentForAllowlist(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_\-/\\.]/g, "");
}

export function isInstrumentAllowlisted(raw: string | null | undefined): boolean {
  const n = normalizeInstrumentForAllowlist(raw);
  if (!n) return false;
  return (
    n === normalizeInstrumentForAllowlist(AT_ALLOWED_PROVIDER_SYMBOL)
    || n === AT_ALLOWED_CANONICAL_SYMBOL
  );
}

export function allowlistRejectionMessage(raw: string | null | undefined): string {
  const shown = String(raw ?? "").trim() || "(empty)";
  return (
    `Instrument "${shown}" is not on the Phase 56.2 Automated Trading allowlist `
    + `(only ${AT_ALLOWED_PROVIDER_SYMBOL} / ${AT_ALLOWED_CANONICAL_SYMBOL}). `
    + "Allowlisted does not mean execution-ready."
  );
}
