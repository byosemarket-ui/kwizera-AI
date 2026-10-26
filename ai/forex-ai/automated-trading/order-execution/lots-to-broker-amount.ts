/**
 * Phase 59.0.6 — Convert DEMO lots → ForexConnect broker amount (offline).
 * Contract (Gehtsoft OpenPosition + this repo's mutation_demo):
 *   amount = base_unit_size * lots
 * Never invents baseUnitSize. Never silently upsizes. Never calls the broker.
 */
export interface LotsToBrokerAmountInput {
  lots: number;
  baseUnitSize: number | null | undefined;
  /** Optional SDK min order amount (contracts). When unknown, omit. */
  minQuantity?: number | null;
  /** Hard DEMO clamp used by sidecar mutation_demo (1..50). */
  maxLots?: number;
}

export interface LotsToBrokerAmountResult {
  ok: boolean;
  amount: number | null;
  lots: number | null;
  baseUnitSize: number | null;
  code:
    | "OK"
    | "LOTS_INVALID"
    | "LOTS_OUT_OF_RANGE"
    | "BASE_UNIT_SIZE_UNKNOWN"
    | "BASE_UNIT_SIZE_INVALID"
    | "AMOUNT_INVALID"
    | "AMOUNT_BELOW_MIN_QUANTITY";
  message: string;
  /** True only when conversion used explicit broker baseUnitSize (no invented default). */
  usedBrokerBaseUnitSize: boolean;
}

function finitePositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && Number.isFinite(n) && n > 0;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Pure lots → amount. Rejects unknown/invalid baseUnitSize instead of defaulting to 1.
 */
export function lotsToBrokerAmount(input: LotsToBrokerAmountInput): LotsToBrokerAmountResult {
  const maxLots = input.maxLots ?? 50;

  if (!finitePositiveInt(input.lots)) {
    return {
      ok: false,
      amount: null,
      lots: null,
      baseUnitSize: null,
      code: "LOTS_INVALID",
      message: "lots must be a positive integer.",
      usedBrokerBaseUnitSize: false,
    };
  }
  if (input.lots > maxLots) {
    return {
      ok: false,
      amount: null,
      lots: input.lots,
      baseUnitSize: null,
      code: "LOTS_OUT_OF_RANGE",
      message: `lots must be <= ${maxLots} for DEMO request construction.`,
      usedBrokerBaseUnitSize: false,
    };
  }

  if (input.baseUnitSize == null || input.baseUnitSize === undefined) {
    return {
      ok: false,
      amount: null,
      lots: input.lots,
      baseUnitSize: null,
      code: "BASE_UNIT_SIZE_UNKNOWN",
      message: "baseUnitSize unavailable from TradingSettings — refuse to invent amount.",
      usedBrokerBaseUnitSize: false,
    };
  }
  if (!finitePositive(input.baseUnitSize) || !Number.isInteger(input.baseUnitSize)) {
    return {
      ok: false,
      amount: null,
      lots: input.lots,
      baseUnitSize: null,
      code: "BASE_UNIT_SIZE_INVALID",
      message: "baseUnitSize must be a positive integer from TradingSettings.",
      usedBrokerBaseUnitSize: false,
    };
  }

  const amount = input.baseUnitSize * input.lots;
  if (!Number.isInteger(amount) || amount <= 0 || !Number.isFinite(amount)) {
    return {
      ok: false,
      amount: null,
      lots: input.lots,
      baseUnitSize: input.baseUnitSize,
      code: "AMOUNT_INVALID",
      message: "Computed broker amount is not a positive integer.",
      usedBrokerBaseUnitSize: true,
    };
  }

  if (
    input.minQuantity != null
    && finitePositive(input.minQuantity)
    && amount < input.minQuantity
  ) {
    return {
      ok: false,
      amount: null,
      lots: input.lots,
      baseUnitSize: input.baseUnitSize,
      code: "AMOUNT_BELOW_MIN_QUANTITY",
      message: `Computed amount ${amount} is below broker minQuantity ${input.minQuantity}.`,
      usedBrokerBaseUnitSize: true,
    };
  }

  return {
    ok: true,
    amount,
    lots: input.lots,
    baseUnitSize: input.baseUnitSize,
    code: "OK",
    message: `amount=${amount} from baseUnitSize=${input.baseUnitSize} * lots=${input.lots}.`,
    usedBrokerBaseUnitSize: true,
  };
}
