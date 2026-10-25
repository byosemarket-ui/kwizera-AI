/**
 * Phase 60.0.1 — formatting helpers for Trade Monitor.
 * Unknown / null values stay explicit — never coerce to a fake verified 0.
 */

export function formatUnavailable(label = "Unavailable"): string {
  return label;
}

export function formatOptionalNumber(
  value: number | null | undefined,
  options?: { digits?: number; prefix?: string; suffix?: string },
): string {
  if (value == null || !Number.isFinite(value)) return formatUnavailable();
  const digits = options?.digits ?? 2;
  const body = value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${options?.prefix ?? ""}${body}${options?.suffix ?? ""}`;
}

/**
 * Signed P/L text only when the value is a verified finite number.
 * Returns unavailable for null/NaN — never "0.00" for missing data.
 */
export function formatSignedPl(
  value: number | null | undefined,
  currency?: string | null,
): { text: string; tone: "positive" | "negative" | "neutral" | "unknown" } {
  if (value == null || !Number.isFinite(value)) {
    return { text: formatUnavailable(), tone: "unknown" };
  }
  const abs = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const ccy = currency ? ` ${currency}` : "";
  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  return { text: `${sign}${abs}${ccy}`, tone };
}

export function formatSide(side: string | null | undefined): string {
  const raw = String(side ?? "").trim().toUpperCase();
  if (!raw) return formatUnavailable();
  if (raw === "B" || raw === "BUY" || raw.includes("BUY")) return "BUY";
  if (raw === "S" || raw === "SELL" || raw.includes("SELL")) return "SELL";
  return raw;
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return formatUnavailable();
  const ms = Date.parse(String(iso));
  if (!Number.isFinite(ms)) return String(iso).slice(0, 32);
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function resolveQuoteFreshnessLabel(input: {
  sessionStatus?: string | null;
  streamState?: string | null;
  lastQuoteAt?: string | null;
  lastQuoteAgeMs?: number | null;
  updateCount?: number | null;
  staleMs?: number;
}): string {
  const status = String(input.sessionStatus || "").toUpperCase();
  if (!status || status === "DISCONNECTED" || status === "DISABLED" || status === "ERROR") {
    return "SESSION_DISCONNECTED";
  }
  const stream = String(input.streamState || "").toUpperCase();
  if (stream === "MARKET_INACTIVE") return "MARKET_INACTIVE";
  if (stream === "AUTHENTICATED_IDLE") return "SUBSCRIPTION_IDLE";
  const updates = typeof input.updateCount === "number" ? input.updateCount : 0;
  const age = input.lastQuoteAgeMs;
  const staleMs = input.staleMs ?? 15_000;
  if (!input.lastQuoteAt && updates <= 0) return "QUOTE_NOT_RECEIVED";
  if (typeof age === "number" && Number.isFinite(age) && age > staleMs) return "QUOTE_STALE";
  if (input.lastQuoteAt || updates > 0) return "QUOTE_RECEIVED";
  return "QUOTE_NOT_RECEIVED";
}
