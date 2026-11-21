/**
 * Deterministic currency/instrument relevance — informational only.
 * Never produces BUY/SELL ranking inputs.
 */
import type { HfmEconomicEvent, HfmEventImpactSummary } from "./types.js";

const MAJOR_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "CADJPY",
  "CHFJPY",
  "EURAUD",
  "EURCAD",
  "EURNZD",
  "GBPAUD",
  "GBPCAD",
  "GBPNZD",
  "AUDCAD",
  "AUDNZD",
  "CADCHF",
  "NZDCAD",
  "AUDCHF",
  "NZDCHF",
  "XAUUSD",
] as const;

export function normalizeHfmSymbol(symbol: string): string {
  return String(symbol ?? "").trim().toUpperCase();
}

/** Currencies present in a symbol like EURUSD or XAUUSD. */
export function currenciesInSymbol(symbol: string): string[] {
  const s = normalizeHfmSymbol(symbol);
  if (s === "XAUUSD" || s.startsWith("XAU")) return ["USD", "XAU"];
  if (s.length >= 6) {
    const a = s.slice(0, 3);
    const b = s.slice(3, 6);
    return [a, b].filter(Boolean);
  }
  return [];
}

export function instrumentsForCurrency(currency: string): string[] {
  const c = currency.toUpperCase();
  if (c === "USD") {
    return MAJOR_PAIRS.filter(
      (p) => p.includes("USD") || p === "XAUUSD",
    ) as unknown as string[];
  }
  return MAJOR_PAIRS.filter((p) => p.includes(c)) as unknown as string[];
}

export function eventRelevantToSymbol(event: HfmEconomicEvent, symbol: string): boolean {
  const ccy = event.currency.toUpperCase();
  const parts = currenciesInSymbol(symbol);
  if (parts.includes(ccy)) return true;
  if (ccy === "USD" && (parts.includes("USD") || normalizeHfmSymbol(symbol).includes("XAU"))) {
    return true;
  }
  return false;
}

export function importanceFromImpact(impact: string): HfmEventImpactSummary["importance"] {
  const i = impact.toLowerCase();
  if (i === "high") return "HIGH";
  if (i === "medium") return "MEDIUM";
  if (i === "low") return "LOW";
  if (i === "holiday") return "HOLIDAY";
  return "UNKNOWN";
}

/**
 * Surprise only when both forecast and actual are non-empty strings.
 * Does not invent numeric comparison when units are ambiguous — returns raw note.
 */
export function computeSurpriseNote(forecast: string, actual: string): {
  surprise: string | null;
  comparable: boolean;
} {
  const f = forecast.trim();
  const a = actual.trim();
  if (!f || !a) return { surprise: null, comparable: false };
  if (f === a) return { surprise: "ACTUAL_EQUALS_FORECAST", comparable: true };
  return { surprise: `ACTUAL="${a}" vs FORECAST="${f}" (string compare; not a calibrated score)`, comparable: true };
}

export function buildEventImpactSummary(event: HfmEconomicEvent): HfmEventImpactSummary {
  const { surprise, comparable } = computeSurpriseNote(event.forecast, event.actual);
  return {
    eventId: event.eventId,
    importance: importanceFromImpact(event.impact),
    relevantCurrencies: [event.currency.toUpperCase()],
    relevantInstruments: instrumentsForCurrency(event.currency),
    forecastAvailable: Boolean(event.forecast.trim()),
    previousAvailable: Boolean(event.previous.trim()),
    actualAvailable: Boolean(event.actual.trim()),
    surprise,
    surpriseComparable: comparable,
    directionalImplication: "UNSPECIFIED",
    volatilityWindowNote:
      "Potential volatility around scheduledAtUtc ±60m — informational only; not a trade signal.",
  };
}

export function filterEventsForSymbol(
  events: HfmEconomicEvent[],
  symbol: string,
  max = 40,
): HfmEconomicEvent[] {
  return events.filter((e) => eventRelevantToSymbol(e, symbol)).slice(0, max);
}
