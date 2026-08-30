import type { DiscountInfo } from "./types";

/** Deterministic discount — only when previous > current. */
export function calculateDiscount(
  previousPrice: number | null,
  currentPrice: number | null,
): DiscountInfo {
  if (
    previousPrice == null
    || currentPrice == null
    || !Number.isFinite(previousPrice)
    || !Number.isFinite(currentPrice)
    || previousPrice <= currentPrice
  ) {
    return { percent: null, valid: false, label: null, ownership: "SYSTEM_CALCULATED" };
  }
  const percent = Math.round(((previousPrice - currentPrice) / previousPrice) * 100);
  return {
    percent,
    valid: true,
    label: `SAVE ${percent}%`,
    ownership: "SYSTEM_CALCULATED",
  };
}

export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatPrice(value: number | null, currency: string): string {
  if (value == null) return "";
  const cur = currency.trim() || "RWF";
  return `${value.toLocaleString()} ${cur}`;
}
