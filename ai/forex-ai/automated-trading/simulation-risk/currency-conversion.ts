/**
 * Phase 56.2.6 — Verified currency conversion for simulation risk/margin.
 * Never hardcodes FX rates. Never invents inverse rates without explicit direction.
 * Unavailable amounts must not be presented as zero by callers.
 */

export type ConversionDirection = "MULTIPLY" | "DIVIDE";

export interface ConversionRateSnapshot {
  /** ISO-like currency code of the amount being converted from. */
  fromCurrency: string;
  /** ISO-like currency code of the result. */
  toCurrency: string;
  /**
   * Positive finite rate.
   * MULTIPLY: amount_to = amount_from × rate
   * DIVIDE: amount_to = amount_from / rate
   * Direction must be stated by the rate provider — never guessed.
   */
  rate: number;
  direction: ConversionDirection;
  /** Where the rate came from (e.g. FOREXCONNECT_OFFERS EUR/USD mid). */
  source: string;
  /** UTC ISO timestamp when the rate was observed. */
  observedAtUtc: string;
  /** Max age allowed for this snapshot to remain usable. */
  maxAgeMs: number;
}

export type ConversionResult =
  | {
    ok: true;
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    rateUsed: number;
    direction: ConversionDirection;
    source: string;
    observedAtUtc: string;
    ageMs: number;
    identity: boolean;
  }
  | {
    ok: false;
    amount: null;
    code: string;
    message: string;
  };

function normCcy(c: string | null | undefined): string {
  return String(c ?? "").trim().toUpperCase();
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function parseObservedAtMs(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function conversionSnapshotAgeMs(
  snapshot: ConversionRateSnapshot,
  nowMs: number = Date.now(),
): number | null {
  const t = parseObservedAtMs(snapshot.observedAtUtc);
  if (t == null) return null;
  return Math.max(0, nowMs - t);
}

export function isConversionSnapshotFresh(
  snapshot: ConversionRateSnapshot,
  nowMs: number = Date.now(),
): { fresh: true; ageMs: number } | { fresh: false; code: string; message: string; ageMs: number | null } {
  if (!finitePositive(snapshot.rate)) {
    return {
      fresh: false,
      code: "FX_RATE_INVALID",
      message: "Conversion rate must be a finite positive number.",
      ageMs: null,
    };
  }
  if (snapshot.direction !== "MULTIPLY" && snapshot.direction !== "DIVIDE") {
    return {
      fresh: false,
      code: "FX_RATE_DIRECTION_INVALID",
      message: "Conversion direction must be MULTIPLY or DIVIDE — not invented.",
      ageMs: null,
    };
  }
  if (!normCcy(snapshot.fromCurrency) || !normCcy(snapshot.toCurrency)) {
    return {
      fresh: false,
      code: "FX_RATE_CURRENCY_MISSING",
      message: "fromCurrency and toCurrency are required.",
      ageMs: null,
    };
  }
  if (!snapshot.source || !String(snapshot.source).trim()) {
    return {
      fresh: false,
      code: "FX_RATE_SOURCE_MISSING",
      message: "Conversion rate source is required.",
      ageMs: null,
    };
  }
  if (!finitePositive(snapshot.maxAgeMs)) {
    return {
      fresh: false,
      code: "FX_RATE_MAX_AGE_INVALID",
      message: "maxAgeMs must be a finite positive number.",
      ageMs: null,
    };
  }
  const ageMs = conversionSnapshotAgeMs(snapshot, nowMs);
  if (ageMs == null) {
    return {
      fresh: false,
      code: "FX_RATE_TIMESTAMP_INVALID",
      message: "observedAtUtc is missing or not a valid ISO timestamp.",
      ageMs: null,
    };
  }
  if (ageMs > snapshot.maxAgeMs) {
    return {
      fresh: false,
      code: "FX_RATE_STALE",
      message:
        `Conversion rate age ${ageMs}ms exceeds maxAgeMs ${snapshot.maxAgeMs}.`,
      ageMs,
    };
  }
  return { fresh: true, ageMs };
}

/**
 * Convert a monetary amount using a verified rate snapshot, or identity when currencies match.
 */
export function convertCurrencyAmount(input: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  /** Required when from ≠ to. Ignored for identity. */
  rateSnapshot?: ConversionRateSnapshot | null;
  nowMs?: number;
}): ConversionResult {
  if (!Number.isFinite(input.amount)) {
    return {
      ok: false,
      amount: null,
      code: "FX_AMOUNT_NON_FINITE",
      message: "Amount must be a finite number.",
    };
  }
  const from = normCcy(input.fromCurrency);
  const to = normCcy(input.toCurrency);
  if (!from || !to) {
    return {
      ok: false,
      amount: null,
      code: "FX_CURRENCY_MISSING",
      message: "Source and target currencies are required.",
    };
  }

  if (from === to) {
    return {
      ok: true,
      amount: input.amount,
      fromCurrency: from,
      toCurrency: to,
      rateUsed: 1,
      direction: "MULTIPLY",
      source: "IDENTITY",
      observedAtUtc: new Date(input.nowMs ?? Date.now()).toISOString(),
      ageMs: 0,
      identity: true,
    };
  }

  const snap = input.rateSnapshot;
  if (!snap) {
    return {
      ok: false,
      amount: null,
      code: "FX_RATE_UNAVAILABLE",
      message:
        `No verified conversion rate for ${from}→${to} — monetary conversion blocked (not assumed).`,
    };
  }

  if (normCcy(snap.fromCurrency) !== from || normCcy(snap.toCurrency) !== to) {
    return {
      ok: false,
      amount: null,
      code: "FX_RATE_PAIR_MISMATCH",
      message:
        `Rate snapshot is ${normCcy(snap.fromCurrency)}→${normCcy(snap.toCurrency)}, `
        + `requested ${from}→${to}. Inverse not invented.`,
    };
  }

  const freshness = isConversionSnapshotFresh(snap, input.nowMs ?? Date.now());
  if (!freshness.fresh) {
    return {
      ok: false,
      amount: null,
      code: freshness.code,
      message: freshness.message,
    };
  }

  const converted =
    snap.direction === "MULTIPLY" ? input.amount * snap.rate : input.amount / snap.rate;
  if (!Number.isFinite(converted)) {
    return {
      ok: false,
      amount: null,
      code: "FX_CONVERSION_NON_FINITE",
      message: "Conversion produced a non-finite result.",
    };
  }

  return {
    ok: true,
    amount: converted,
    fromCurrency: from,
    toCurrency: to,
    rateUsed: snap.rate,
    direction: snap.direction,
    source: snap.source,
    observedAtUtc: snap.observedAtUtc,
    ageMs: freshness.ageMs,
    identity: false,
  };
}

/**
 * Gate for order-allocation / risk money that must be expressed in account currency.
 * Quote currency for XAU/USD is USD; pipCost/MMR from Offers are already account-ccy when verified.
 */
export function ensureAmountInAccountCurrency(input: {
  amount: number;
  amountCurrency: string;
  accountCurrency: string;
  rateSnapshot?: ConversionRateSnapshot | null;
  nowMs?: number;
}): ConversionResult {
  return convertCurrencyAmount({
    amount: input.amount,
    fromCurrency: input.amountCurrency,
    toCurrency: input.accountCurrency,
    rateSnapshot: input.rateSnapshot,
    nowMs: input.nowMs,
  });
}
