import type { ForexRouteId } from "./forex-routes";

export type ConnectionState = "loading" | "empty" | "not-connected" | "error" | "ready";
export type MarketQuoteStatus = "not-connected" | "unavailable" | "error" | "ready";
export type SessionClockStatus = "open" | "closed" | "opening-soon" | "closing-soon";

export interface ForexInstrument {
  symbol: string;
  name: string;
}

export interface MarketQuote {
  instrument: ForexInstrument;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  spread: number | null;
  volume: number | null;
  status: MarketQuoteStatus;
  dataSource: string | null;
}

export interface WatchlistEntry {
  instrument: ForexInstrument;
  watched: boolean;
  quote: MarketQuote;
}

export interface MarketSessionWindow {
  id: "sydney" | "tokyo" | "london" | "new-york";
  label: string;
  openUtcMinutes: number;
  closeUtcMinutes: number;
}

export interface MarketSessionView {
  id: MarketSessionWindow["id"];
  label: string;
  status: SessionClockStatus;
  hoursLabel: string;
}

export interface ServiceConnection {
  id: string;
  label: string;
  state: ConnectionState;
  detail: string;
}

export interface DashboardQuickAction {
  id: ForexRouteId;
  label: string;
}

export interface ActivityItem {
  id: string;
  label: string;
  occurredAt: string | null;
}

const MINUTES_PER_DAY = 24 * 60;

export const FOREX_INSTRUMENTS: ForexInstrument[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar" },
  { symbol: "GBP/USD", name: "Pound / US Dollar" },
  { symbol: "USD/JPY", name: "US Dollar / Yen" },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar" },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar" },
  { symbol: "XAU/USD", name: "Gold / US Dollar" },
];

export const FOREX_SESSION_WINDOWS: MarketSessionWindow[] = [
  { id: "sydney", label: "Sydney", openUtcMinutes: 21 * 60, closeUtcMinutes: 6 * 60 },
  { id: "tokyo", label: "Tokyo", openUtcMinutes: 0, closeUtcMinutes: 9 * 60 },
  { id: "london", label: "London", openUtcMinutes: 7 * 60, closeUtcMinutes: 16 * 60 },
  { id: "new-york", label: "New York", openUtcMinutes: 12 * 60, closeUtcMinutes: 21 * 60 },
];

export const FOREX_SERVICE_CONNECTIONS: ServiceConnection[] = [
  { id: "market-data", label: "Market Data", state: "not-connected", detail: "Not connected" },
  { id: "ai-analysis", label: "AI Analysis", state: "not-connected", detail: "Not connected" },
  { id: "signal-engine", label: "Signal Engine", state: "not-connected", detail: "Not connected" },
  { id: "trading-account", label: "Trading Account", state: "not-connected", detail: "Not connected" },
];

export const FOREX_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: "markets", label: "Open Markets" },
  { id: "watchlist", label: "Open Watchlist" },
  { id: "charts", label: "Open Charts" },
  { id: "technical-analysis", label: "Open Technical Analysis" },
  { id: "ai-analysis", label: "Open AI Analysis" },
  { id: "signals", label: "Open Signals" },
  { id: "strategies", label: "Open Strategies" },
  { id: "trade-journal", label: "Open Trade Journal" },
  { id: "risk-management", label: "Open Risk Management" },
  { id: "performance", label: "Open Performance" },
  { id: "market-intelligence", label: "Open Market Intelligence" },
];

export const FOREX_WATCHLIST: WatchlistEntry[] = [];
export const FOREX_ACTIVITY: ActivityItem[] = [];

export function unavailableQuote(instrument: ForexInstrument): MarketQuote {
  return {
    instrument,
    price: null,
    change: null,
    changePercent: null,
    high: null,
    low: null,
    spread: null,
    volume: null,
    status: "not-connected",
    dataSource: null,
  };
}

export function marketOverviewQuotes(): MarketQuote[] {
  return FOREX_INSTRUMENTS.map(unavailableQuote);
}

export function formatUtcClock(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

function utcMinutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function inSessionWindow(now: number, open: number, close: number): boolean {
  if (open === close) return false;
  if (open < close) return now >= open && now < close;
  return now >= open || now < close;
}

function minutesUntil(now: number, target: number): number {
  return (target - now + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function formatHourRange(openUtcMinutes: number, closeUtcMinutes: number): string {
  const fmt = (value: number) => {
    const hours = Math.floor(value / 60) % 24;
    const minutes = value % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };
  return `${fmt(openUtcMinutes)}–${fmt(closeUtcMinutes)} UTC`;
}

export function sessionStatusLabel(status: SessionClockStatus): string {
  if (status === "open") return "Open";
  if (status === "opening-soon") return "Opening Soon";
  if (status === "closing-soon") return "Closing Soon";
  return "Closed";
}

export function resolveMarketSessions(now: Date = new Date()): MarketSessionView[] {
  const minute = utcMinutesOfDay(now);
  return FOREX_SESSION_WINDOWS.map((window) => {
    const open = inSessionWindow(minute, window.openUtcMinutes, window.closeUtcMinutes);
    const untilClose = minutesUntil(minute, window.closeUtcMinutes);
    const untilOpen = minutesUntil(minute, window.openUtcMinutes);
    let status: SessionClockStatus = "closed";
    if (open && untilClose <= 60) status = "closing-soon";
    else if (open) status = "open";
    else if (untilOpen <= 60) status = "opening-soon";
    return {
      id: window.id,
      label: window.label,
      status,
      hoursLabel: formatHourRange(window.openUtcMinutes, window.closeUtcMinutes),
    };
  });
}

export function formatQuoteValue(value: number | null, fallback: string): string {
  if (value === null || Number.isNaN(value)) return fallback;
  return String(value);
}

export function quoteStatusLabel(status: MarketQuoteStatus): string {
  if (status === "ready") return "Live";
  if (status === "error") return "Error";
  if (status === "unavailable") return "Unavailable";
  return "Market data unavailable";
}
