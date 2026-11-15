import type { HfmFreshness, HfmQuoteState } from "./types";

export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function formatPrice(value: number | null | undefined, digits?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const d = typeof digits === "number" && digits >= 0 && digits <= 8 ? digits : 5;
  return value.toFixed(d);
}

export function formatSpread(q: HfmQuoteState): string {
  if (q.spread == null || !Number.isFinite(q.spread)) return "—";
  if (q.point && q.point > 0) {
    const points = q.spread / q.point;
    return Number.isFinite(points) ? points.toFixed(1) : formatPrice(q.spread, q.digits);
  }
  return formatPrice(q.spread, q.digits);
}

export function quoteDirection(q: HfmQuoteState): "up" | "down" | "flat" {
  if (q.prevMid == null) return "flat";
  const mid = (q.bid + q.ask) / 2;
  if (mid > q.prevMid) return "up";
  if (mid < q.prevMid) return "down";
  return "flat";
}

export function freshnessLabel(f: HfmFreshness): string {
  switch (f) {
    case "LIVE":
      return "LIVE";
    case "MARKET_CLOSED":
      return "MARKET CLOSED";
    case "STALE":
      return "STALE";
    case "DISCONNECTED":
      return "DISCONNECTED";
    case "WAITING_FOR_DATA":
      return "WAITING FOR DATA";
    case "DATA_UNAVAILABLE":
      return "DATA UNAVAILABLE";
    default:
      return String(f);
  }
}

export function formatUtcClock(ms = Date.now()): string {
  return new Date(ms).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function formatAge(ageSec: number | null | undefined, lastEventAt: number | null): string {
  if (typeof ageSec === "number" && Number.isFinite(ageSec)) {
    if (ageSec < 60) return `${ageSec.toFixed(1)}s`;
    if (ageSec < 3600) return `${Math.round(ageSec / 60)}m`;
    return `${(ageSec / 3600).toFixed(1)}h`;
  }
  if (lastEventAt) {
    const s = (Date.now() - lastEventAt) / 1000;
    return formatAge(s, null);
  }
  return "—";
}
