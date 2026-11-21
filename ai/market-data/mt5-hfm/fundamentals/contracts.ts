/**
 * Phase 7 — HFM Economic Calendar contracts (calendar-only MVP).
 * Informational only — never modifies Phase 4 ranking or broker state.
 */

export const HFM_FUNDAMENTALS_PROVIDER_ID = "SHOWMYTRADES" as const;
export const HFM_ECONOMIC_EVENT_CONTRACT_ID = "kwizera.hfm.economic-event.v1" as const;
export const HFM_ECONOMIC_EVENT_CONTRACT_VERSION = "1.0.0" as const;
export const HFM_FUNDAMENTALS_PACKAGE_CONTRACT_ID =
  "kwizera.hfm.fundamentals-package.v1" as const;
export const HFM_FUNDAMENTALS_PACKAGE_CONTRACT_VERSION = "1.0.0" as const;

/** Both must be exactly "1" for live provider consumption / end-user display. */
export const HFM_ECONOMIC_CALENDAR_ENABLED_ENV = "KWIZERA_HFM_ECONOMIC_CALENDAR_ENABLED";
export const HFM_ECONOMIC_CALENDAR_LICENSING_ENV =
  "KWIZERA_HFM_ECONOMIC_CALENDAR_LICENSING_CLEARED";

export const HFM_SMT_CALENDAR_URL =
  "https://showmytrades.com/api/public/calendar/v1" as const;
export const HFM_SMT_CHANGES_URL =
  "https://showmytrades.com/api/public/calendar/v1/changes" as const;
export const HFM_SMT_DOCS_URL =
  "https://showmytrades.com/docs/api/economic-calendar" as const;
export const HFM_SMT_ATTRIBUTION_DEFAULT_TEXT = "Economic calendar by ShowMyTrades" as const;
export const HFM_SMT_ATTRIBUTION_DEFAULT_URL =
  "https://showmytrades.com/tools/economic-calendar" as const;

export const HFM_FUNDAMENTALS_MAX_EVENTS_PER_QUERY = 200;
export const HFM_FUNDAMENTALS_MAX_EVENTS_PER_PACKAGE = 40;
export const HFM_FUNDAMENTALS_MAX_RESPONSE_BYTES = 1_500_000;
export const HFM_FUNDAMENTALS_HTTP_TIMEOUT_MS = 15_000;
export const HFM_FUNDAMENTALS_REFRESH_MIN_INTERVAL_MS = 60_000;
export const HFM_FUNDAMENTALS_STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6h
export const HFM_FUNDAMENTALS_RETENTION_DAYS = 90;
export const HFM_FUNDAMENTALS_DEFAULT_DAYS = 14;
export const HFM_FUNDAMENTALS_MAX_DAYS = 30;

export const HFM_FUNDAMENTALS_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
] as const;

export type HfmFundamentalsCurrency = (typeof HFM_FUNDAMENTALS_CURRENCIES)[number];

export const HFM_FUNDAMENTALS_IMPACTS = ["high", "medium", "low", "holiday"] as const;

export type HfmFundamentalsAvailability =
  | "OK"
  | "PARTIAL"
  | "STALE"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "LICENSING_BLOCKED"
  | "EMPTY";

export type HfmEconomicEventStatus =
  | "scheduled"
  | "moved"
  | "tentative"
  | "cancelled"
  | "released"
  | "unknown";

export type HfmEconomicConfidence =
  | "official"
  | "sources_agree"
  | "single_source"
  | "sources_disagree"
  | "unknown";

export type HfmEconomicFreshness = "FRESH" | "STALE" | "UNKNOWN" | "DISABLED";
