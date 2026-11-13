/**
 * Phase 2–4 reconciliation — classify XAU/USD owner-lot vs FXCM AMOUNT compatibility.
 * Never invents metadata. Never raises owner limits. Never submits orders.
 *
 * Verified FXCM DEMO convention (offer 4001):
 *   AMOUNT = baseUnitSize × lots  (must be positive integer)
 *   minQuantity is minimum AMOUNT (contracts), not “FX lots”.
 */
export type XauAmountCompatibilityClass =
  | "COMPATIBLE"
  | "BROKER_MAPPING_DEFECT"
  | "BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT"
  | "OWNER_CONFIGURATION_REQUIRED"
  | "INSUFFICIENT_BROKER_EVIDENCE";

export interface ClassifyXauAmountCompatibilityInput {
  baseUnitSize: number | null | undefined;
  minQuantity: number | null | undefined;
  ownerMaxLots: number;
  /** Optional: proposed lots under evaluation (defaults to ownerMaxLots). */
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

/**
 * Classify whether owner max lots can form a valid FXCM XAU AMOUNT under verified metadata.
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
      code: "BROKER_METADATA_MISSING",
      message:
        "XAU baseUnitSize/minQuantity unavailable from read-only ForexConnect metadata — refuse to invent AMOUNT mapping.",
    };
  }

  const lots = finitePositive(input.lots) ? input.lots : input.ownerMaxLots;
  if (!finitePositive(lots) || !finitePositive(input.ownerMaxLots)) {
    return {
      ...base,
      classification: "OWNER_CONFIGURATION_REQUIRED",
      amount: null,
      minLotsFromBroker: input.minQuantity / input.baseUnitSize,
      code: "OWNER_MAX_LOTS_INVALID",
      message: "Owner maximum lots must be a finite number > 0.",
    };
  }

  const rawAmount = input.baseUnitSize * lots;
  const amount = Math.round(rawAmount);
  const minLotsFromBroker = input.minQuantity / input.baseUnitSize;
  const amountIsInteger = Math.abs(rawAmount - amount) <= 1e-9 && amount > 0;

  if (!amountIsInteger || amount < input.minQuantity || lots + 1e-12 < minLotsFromBroker) {
    return {
      ...base,
      classification: "BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT",
      amount: amountIsInteger ? amount : null,
      minLotsFromBroker,
      code: "BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT",
      message:
        `FXCM XAU AMOUNT = baseUnitSize(${input.baseUnitSize}) × lots(${lots}) `
        + `→ ${rawAmount}; broker minQuantity(AMOUNT)=${input.minQuantity} requires ≥ ${minLotsFromBroker} lots. `
        + `Owner max ${input.ownerMaxLots} lots cannot satisfy the broker minimum without raising owner limits.`,
    };
  }

  if (lots > input.ownerMaxLots + 1e-12) {
    return {
      ...base,
      classification: "OWNER_CONFIGURATION_REQUIRED",
      amount,
      minLotsFromBroker,
      code: "LOTS_ABOVE_OWNER_MAX",
      message: `Proposed lots ${lots} exceed owner maximum ${input.ownerMaxLots}.`,
    };
  }

  return {
    ...base,
    classification: "COMPATIBLE",
    amount,
    minLotsFromBroker,
    code: "OK",
    message: `Lots ${lots} → AMOUNT ${amount} meets FXCM minQuantity ${input.minQuantity}.`,
  };
}
