/**
 * Normalized AI cost structure. Prices live in Admin data, never hardcoded per vendor.
 */

export const BILLING_UNITS = [
  "IMAGE",
  "MEGAPIXEL",
  "SECOND",
  "MINUTE",
  "REQUEST",
  "TOKEN",
  "CHARACTER",
  "GENERATION",
  "CUSTOM",
] as const;

export type BillingUnit = (typeof BILLING_UNITS)[number];

export interface ModelCostModel {
  billingUnit: BillingUnit;
  /** Optional configured input unit price. Null means not configured. */
  inputCost: number | null;
  /** Optional configured output unit price. Null means not configured. */
  outputCost: number | null;
  currency: string;
}

export function isBillingUnit(value: unknown): value is BillingUnit {
  return typeof value === "string" && (BILLING_UNITS as readonly string[]).includes(value);
}

export function normalizeCostModel(raw: unknown, fallbackCurrency = "USD"): ModelCostModel | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (!isBillingUnit(record.billingUnit)) return undefined;
  const inputCost = typeof record.inputCost === "number" && Number.isFinite(record.inputCost) ? record.inputCost : null;
  const outputCost = typeof record.outputCost === "number" && Number.isFinite(record.outputCost) ? record.outputCost : null;
  if (inputCost !== null && inputCost < 0) return undefined;
  if (outputCost !== null && outputCost < 0) return undefined;
  return {
    billingUnit: record.billingUnit,
    inputCost,
    outputCost,
    currency: typeof record.currency === "string" && record.currency.trim() ? record.currency.trim() : fallbackCurrency,
  };
}

export function emptyCostModel(currency = "USD"): ModelCostModel {
  return { billingUnit: "REQUEST", inputCost: null, outputCost: null, currency };
}
