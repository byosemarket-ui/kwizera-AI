import type { Candle } from "./types";
import { LIVE_PRICE_UNAVAILABLE } from "../market-data/allow-development-market-data";

/** Instrument-aware display precision — never invents prices, only formats real values. */
export function pricePrecision(symbol: string, sample?: number | null): number {
  const raw = String(symbol ?? "");
  const upper = raw.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  if (upper.includes("JPY") || compact.endsWith("JPY")) return 3;
  if (compact.startsWith("XAU") || upper.startsWith("XAU/")) return 2;
  if (compact.startsWith("XAG") || upper.startsWith("XAG/")) return 3;
  if (/\.(US|EXT|UK|CA|DE|FR|JP|HK|NL)$/i.test(raw)) return 2;
  if (/^(US30|US2000|NAS100|SPX500|GER30|UK100|FRA40|AUS200|HKG33|JPN225|CHN50|EUSTX50|VOLX)/i.test(compact)) {
    return 1;
  }
  if (upper.includes("/")) return 5;
  if (/^[A-Z0-9]{5,20}$/.test(compact) && sample != null && Number.isFinite(sample)) {
    if (sample >= 1000) return 2;
    if (sample >= 1) return 4;
    return 6;
  }
  if (/^[A-Z0-9]{5,20}$/.test(compact)) return 4;
  return 5;
}

export function formatChartPrice(symbol: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return LIVE_PRICE_UNAVAILABLE;
  return value.toFixed(pricePrecision(symbol, value));
}

/** Binance volumes are genuine; ForexConnect/FXCM often seed placeholder 0/1 — hide those. */
export function hasGenuineVolume(
  provider: "BINANCE" | "FXCM" | "FOREXCONNECT" | null,
  candles: Candle[],
  displayVolume: number | null | undefined,
): boolean {
  if (displayVolume == null || !Number.isFinite(displayVolume)) return false;
  if (provider === "BINANCE") return true;
  if (provider !== "FXCM" && provider !== "FOREXCONNECT") return false;
  const vols = candles
    .map((c) => c.volume)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (vols.length === 0) return false;
  const unique = new Set(vols.map((v) => Number(v.toFixed(8))));
  if (unique.size === 1) {
    const only = vols[0]!;
    if (only === 0 || only === 1) return false;
  }
  return true;
}
