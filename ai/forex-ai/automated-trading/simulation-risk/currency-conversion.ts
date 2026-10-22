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

export type OffersConversionQuoteInput = {
  baseAsset?: string | null;
  quoteAsset?: string | null;
  providerSymbol?: string | null;
  bid?: number | null;
  ask?: number | null;
  /** ISO timestamp when this offer row was observed; required for freshness. */
  observedAtUtc?: string | null;
};

/**
 * Phase 56.4.0 — Build a ConversionRateSnapshot from ForexConnect Offers bid/ask.
 * Supports direct, inverse, and one-hop USD cross. Never invents rates or directions.
 * Synthetic rates must not be passed here — unit tests use explicitly labeled fixtures.
 */
export function buildOffersConversionRateSnapshot(input: {
  fromCurrency: string;
  toCurrency: string;
  offers: OffersConversionQuoteInput[];
  observedAtUtc: string;
  maxAgeMs?: number;
  nowMs?: number;
}):
  | { ok: true; snapshot: ConversionRateSnapshot; path: "IDENTITY" | "DIRECT" | "INVERSE" | "CROSS_USD" }
  | { ok: false; code: string; message: string } {
  const from = normCcy(input.fromCurrency);
  const to = normCcy(input.toCurrency);
  if (!from || !to) {
    return {
      ok: false,
      code: "FX_CURRENCY_MISSING",
      message: "fromCurrency and toCurrency are required.",
    };
  }
  const maxAgeMs = input.maxAgeMs ?? 30_000;
  if (!finitePositive(maxAgeMs)) {
    return {
      ok: false,
      code: "FX_RATE_MAX_AGE_INVALID",
      message: "maxAgeMs must be a finite positive number.",
    };
  }
  const observedAtUtc = String(input.observedAtUtc ?? "").trim();
  if (!observedAtUtc || parseObservedAtMs(observedAtUtc) == null) {
    return {
      ok: false,
      code: "FX_RATE_TIMESTAMP_INVALID",
      message: "observedAtUtc is missing or not a valid ISO timestamp.",
    };
  }
  if (from === to) {
    return {
      ok: true,
      path: "IDENTITY",
      snapshot: {
        fromCurrency: from,
        toCurrency: to,
        rate: 1,
        direction: "MULTIPLY",
        source: "IDENTITY",
        observedAtUtc,
        maxAgeMs,
      },
    };
  }

  const mid = (bid: number | null | undefined, ask: number | null | undefined): number | null => {
    if (finitePositive(bid) && finitePositive(ask)) return (bid + ask) / 2;
    if (finitePositive(bid)) return bid;
    if (finitePositive(ask)) return ask;
    return null;
  };

  type Leg = { base: string; quote: string; mid: number; source: string; observedAtUtc: string };
  const legs: Leg[] = [];
  for (const o of input.offers) {
    let base = normCcy(o.baseAsset);
    let quote = normCcy(o.quoteAsset);
    if ((!base || !quote) && o.providerSymbol) {
      const parts = String(o.providerSymbol).split(/[/\s_-]+/).filter(Boolean);
      if (parts.length >= 2) {
        base = normCcy(parts[0]);
        quote = normCcy(parts[1]);
      }
    }
    const m = mid(o.bid, o.ask);
    if (!base || !quote || m == null) continue;
    const rowObs = o.observedAtUtc && parseObservedAtMs(o.observedAtUtc) != null
      ? String(o.observedAtUtc)
      : observedAtUtc;
    legs.push({
      base,
      quote,
      mid: m,
      source: `FOREXCONNECT_OFFERS ${base}/${quote} mid`,
      observedAtUtc: rowObs,
    });
  }

  const nowMs = input.nowMs ?? Date.now();
  const freshLegs = legs.filter((leg) => {
    const t = parseObservedAtMs(leg.observedAtUtc);
    if (t == null) return false;
    return nowMs - t <= maxAgeMs;
  });
  if (!freshLegs.length) {
    return {
      ok: false,
      code: "FX_RATE_STALE",
      message: `No fresh Offers mid within maxAgeMs=${maxAgeMs} for ${from}→${to}.`,
    };
  }

  const find = (b: string, q: string): Leg | null =>
    freshLegs.find((l) => l.base === b && l.quote === q) ?? null;

  const direct = find(from, to);
  if (direct) {
    return {
      ok: true,
      path: "DIRECT",
      snapshot: {
        fromCurrency: from,
        toCurrency: to,
        rate: direct.mid,
        direction: "MULTIPLY",
        source: direct.source,
        observedAtUtc: direct.observedAtUtc,
        maxAgeMs,
      },
    };
  }

  const inverse = find(to, from);
  if (inverse) {
    // Explicit DIVIDE by the inverse-pair mid — do not silently invent an inverse MULTIPLY without stating it.
    return {
      ok: true,
      path: "INVERSE",
      snapshot: {
        fromCurrency: from,
        toCurrency: to,
        rate: inverse.mid,
        direction: "DIVIDE",
        source: `${inverse.source} (inverse DIVIDE)`,
        observedAtUtc: inverse.observedAtUtc,
        maxAgeMs,
      },
    };
  }

  // One-hop cross via USD only when both legs are fresh.
  if (from !== "USD" && to !== "USD") {
    const a = buildOffersConversionRateSnapshot({
      fromCurrency: from,
      toCurrency: "USD",
      offers: input.offers,
      observedAtUtc,
      maxAgeMs,
      nowMs,
    });
    const b = buildOffersConversionRateSnapshot({
      fromCurrency: "USD",
      toCurrency: to,
      offers: input.offers,
      observedAtUtc,
      maxAgeMs,
      nowMs,
    });
    if (a.ok && b.ok && a.path !== "IDENTITY" && b.path !== "IDENTITY") {
      // Normalize both legs to MULTIPLY rates then compose.
      const rateA = a.snapshot.direction === "MULTIPLY" ? a.snapshot.rate : 1 / a.snapshot.rate;
      const rateB = b.snapshot.direction === "MULTIPLY" ? b.snapshot.rate : 1 / b.snapshot.rate;
      const composed = rateA * rateB;
      if (!finitePositive(composed)) {
        return {
          ok: false,
          code: "FX_CONVERSION_NON_FINITE",
          message: "USD cross composition produced a non-finite rate.",
        };
      }
      const older =
        parseObservedAtMs(a.snapshot.observedAtUtc)! <= parseObservedAtMs(b.snapshot.observedAtUtc)!
          ? a.snapshot.observedAtUtc
          : b.snapshot.observedAtUtc;
      return {
        ok: true,
        path: "CROSS_USD",
        snapshot: {
          fromCurrency: from,
          toCurrency: to,
          rate: composed,
          direction: "MULTIPLY",
          source: `cross:${a.snapshot.source}+${b.snapshot.source}`,
          observedAtUtc: older,
          maxAgeMs,
        },
      };
    }
  }

  return {
    ok: false,
    code: "FX_RATE_UNAVAILABLE",
    message: `No verified Offers conversion path for ${from}→${to}.`,
  };
}
