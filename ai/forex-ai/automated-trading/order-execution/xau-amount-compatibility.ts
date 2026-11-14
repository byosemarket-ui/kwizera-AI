/**
 * XAU/USD dynamic-sizing vs FXCM AMOUNT compatibility classification.
 * There is no fixed owner lot cap: quantity comes from the account-balance risk engine.
 * Never invents metadata. Never rounds quantity up. Never submits orders.
 *
 * Verified FXCM convention (offer 4001):
 *   AMOUNT = baseUnitSize × lots  (must be a positive integer)
 *   minQuantity / quantityStep are AMOUNT (contract) units, not "FX lots".
 */
export type XauAmountCompatibilityClass =
  | "COMPATIBLE"
  | "AWAITING_SIZED_PROPOSAL"
  | "BROKER_MAPPING_DEFECT"
  | "BROKER_MINIMUM_EXCEEDS_RISK_BUDGET"
  | "BROKER_QUANTITY_STEP_INVALID"
  | "INSUFFICIENT_BROKER_EVIDENCE";

export interface ClassifyXauAmountCompatibilityInput {
  baseUnitSize: number | null | undefined;
  minQuantity: number | null | undefined;
  /** AMOUNT increment; defaults to minQuantity semantics when absent (step check skipped). */
  quantityStep?: number | null | undefined;
  /** Risk-sized lots from the authoritative proposal (null when no sized proposal exists). */
  lots?: number | null;
}

export interface ClassifyXauAmountCompatibilityResult {
  classification: XauAmountCompatibilityClass;
  amount: number | null;
  minLotsFromBroker: number | null;
  code: string;
  message: string;
  placesOrders: false;
  mutatesBroker: false;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isIntegerMultiple(value: number, step: number): boolean {
  const units = value / step;
  return Math.abs(units - Math.round(units)) <= 1e-9;
}

/**
 * Classify whether the risk-sized XAU quantity forms a valid FXCM AMOUNT under verified metadata.
 */
export function classifyXauAmountCompatibility(
  input: ClassifyXauAmountCompatibilityInput,
): ClassifyXauAmountCompatibilityResult {
  const base = {
    placesOrders: false as const,
    mutatesBroker: false as const,
  };

  if (!finitePositive(input.baseUnitSize) || !finitePositive(input.minQuantity)) {
    return {
      ...base,
      classification: "INSUFFICIENT_BROKER_EVIDENCE",
      amount: null,
      minLotsFromBroker: null,
      code: "BROKER_METADATA_UNAVAILABLE",
      message:
        "XAU baseUnitSize/minQuantity unavailable from read-only ForexConnect metadata — refuse to invent AMOUNT mapping.",
    };
  }
  const minLotsFromBroker = input.minQuantity / input.baseUnitSize;
  const step = finitePositive(input.quantityStep) ? input.quantityStep : null;

  if (!finitePositive(input.lots)) {
    return {
      ...base,
      classification: "AWAITING_SIZED_PROPOSAL",
      amount: null,
      minLotsFromBroker,
      code: "POSITION_SIZE_UNAVAILABLE",
      message:
        `Dynamic sizing (no fixed owner cap): broker minimum ${input.minQuantity} AMOUNT = ${minLotsFromBroker} lots`
        + `${step != null ? `, step ${step} AMOUNT` : ""}. Quantity is set per proposal from the 25% balance risk budget.`,
    };
  }

  const lots = input.lots;
  const rawAmount = input.baseUnitSize * lots;
  const amount = Math.round(rawAmount);
  if (Math.abs(rawAmount - amount) > 1e-9 || amount <= 0) {
    return {
      ...base,
      classification: "BROKER_MAPPING_DEFECT",
      amount: null,
      minLotsFromBroker,
      code: "BROKER_QUANTITY_CONVERSION_UNVERIFIED",
      message: `baseUnitSize(${input.baseUnitSize}) × lots(${lots}) = ${rawAmount} is not a positive integer FXCM AMOUNT.`,
    };
  }
  if (amount < input.minQuantity) {
    return {
      ...base,
      classification: "BROKER_MINIMUM_EXCEEDS_RISK_BUDGET",
      amount,
      minLotsFromBroker,
      code: "BROKER_MINIMUM_EXCEEDS_RISK_BUDGET",
      message:
        `Risk-sized AMOUNT ${amount} (${lots} lots) is below broker minimum ${input.minQuantity} AMOUNT `
        + `(${minLotsFromBroker} lots). Quantity is never rounded up to meet the minimum.`,
    };
  }
  if (step != null && !isIntegerMultiple(amount, step)) {
    return {
      ...base,
      classification: "BROKER_QUANTITY_STEP_INVALID",
      amount,
      minLotsFromBroker,
      code: "BROKER_QUANTITY_STEP_INVALID",
      message: `AMOUNT ${amount} is not a multiple of broker step ${step}.`,
    };
  }

  return {
    ...base,
    classification: "COMPATIBLE",
    amount,
    minLotsFromBroker,
    code: "OK",
    message: `Lots ${lots} → AMOUNT ${amount} meets FXCM minQuantity ${input.minQuantity}${step != null ? ` and step ${step}` : ""}.`,
  };
}
