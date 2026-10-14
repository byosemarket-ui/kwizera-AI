/**
 * Account-currency conversion with freshness and direction checks.
 */
import type { ConversionRateQuote } from "./types.js";
import { isFiniteNumber } from "./decimal.js";

function normCcy(c: string): string {
  return String(c ?? "").trim().toUpperCase();
}

export function identityConversion(currency: string, observedAt: string): ConversionRateQuote {
  const c = normCcy(currency);
  return {
    fromCurrency: c,
    toCurrency: c,
    rate: 1,
    source: "identity",
    observedAt,
    inverted: false,
  };
}

/**
 * Resolve conversion from an ordered list of known quotes (e.g. Offers mid prices).
 * Supports direct, inverse, and simple one-hop cross via a common quote (USD).
 */
export function resolveConversionRate(input: {
  fromCurrency: string;
  toCurrency: string;
  quotes: Array<{
    base: string;
    quote: string;
    bid: number | null;
    ask: number | null;
    source: string;
    observedAt: string;
  }>;
  maxAgeMs: number;
  nowMs?: number;
}): { ok: true; quote: ConversionRateQuote } | { ok: false; reason: string } {
  const from = normCcy(input.fromCurrency);
  const to = normCcy(input.toCurrency);
  if (!from || !to) return { ok: false, reason: "Account or instrument currency is missing." };
  if (from === to) {
    return {
      ok: true,
      quote: identityConversion(from, new Date(input.nowMs ?? Date.now()).toISOString()),
    };
  }

  const now = input.nowMs ?? Date.now();
  const fresh = input.quotes.filter((q) => {
    const t = Date.parse(q.observedAt);
    if (!Number.isFinite(t)) return false;
    return now - t <= input.maxAgeMs;
  });
  if (!fresh.length) {
    return { ok: false, reason: "No fresh conversion quotes within the configured max age." };
  }

  const mid = (bid: number | null, ask: number | null): number | null => {
    if (isFiniteNumber(bid) && isFiniteNumber(ask) && bid > 0 && ask > 0) return (bid + ask) / 2;
    if (isFiniteNumber(bid) && bid > 0) return bid;
    if (isFiniteNumber(ask) && ask > 0) return ask;
    return null;
  };

  for (const q of fresh) {
    const base = normCcy(q.base);
    const quote = normCcy(q.quote);
    const m = mid(q.bid, q.ask);
    if (m == null) continue;
    if (base === from && quote === to) {
      return {
        ok: true,
        quote: {
          fromCurrency: from,
          toCurrency: to,
          rate: m,
          source: q.source,
          observedAt: q.observedAt,
          inverted: false,
        },
      };
    }
    if (base === to && quote === from) {
      return {
        ok: true,
        quote: {
          fromCurrency: from,
          toCurrency: to,
          rate: 1 / m,
          source: q.source,
          observedAt: q.observedAt,
          inverted: true,
        },
      };
    }
  }

  // One-hop cross via USD when both legs fresh.
  const via = "USD";
  if (from !== via && to !== via) {
    const legA = resolveConversionRate({
      fromCurrency: from,
      toCurrency: via,
      quotes: fresh,
      maxAgeMs: input.maxAgeMs,
      nowMs: now,
    });
    const legB = resolveConversionRate({
      fromCurrency: via,
      toCurrency: to,
      quotes: fresh,
      maxAgeMs: input.maxAgeMs,
      nowMs: now,
    });
    if (legA.ok && legB.ok) {
      return {
        ok: true,
        quote: {
          fromCurrency: from,
          toCurrency: to,
          rate: legA.quote.rate * legB.quote.rate,
          source: `cross:${legA.quote.source}+${legB.quote.source}`,
          observedAt: legA.quote.observedAt < legB.quote.observedAt
            ? legA.quote.observedAt
            : legB.quote.observedAt,
          inverted: legA.quote.inverted || legB.quote.inverted,
        },
      };
    }
  }

  return {
    ok: false,
    reason: `No valid conversion path from ${from} to ${to}.`,
  };
}

export function convertAmount(
  amount: number,
  conversion: ConversionRateQuote | null,
): number | null {
  if (!isFiniteNumber(amount) || !conversion || !isFiniteNumber(conversion.rate) || conversion.rate <= 0) {
    return null;
  }
  return amount * conversion.rate;
}
