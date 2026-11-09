/**
 * Stage 1 Part 2 — FXCM AMOUNT ↔ application lots conversion helpers.
 *
 * ForexConnect contract (verified offline + LIVE DEMO metadata):
 *   amount = baseUnitSize × lots
 * AMOUNT is a positive integer. quantityMin / amountStep live in AMOUNT space.
 * pipCost / mmrPerLot are per 1.0 lot (not per AMOUNT unit).
 *
 * Never invents baseUnitSize. Never rounds quantity upward. Never treats XAU
 * contracts as ounces without broker documentation.
 */

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function nearlyInteger(n: number): boolean {
  return Math.abs(n - Math.round(n)) <= 1e-9;
}

export interface AmountSpaceConstraints {
  /** Broker AMOUNT minimum (getMinQuantity). */
  amountMin: number;
  /** Broker AMOUNT increment (BaseUnitSize / amountStep). */
  amountStep: number;
  /** Broker AMOUNT maximum when supplied. */
  amountMax: number | null;
}

export interface LotsSpaceConstraints {
  lotsMin: number;
  lotsStep: number;
  lotsMax: number | null;
  baseUnitSize: number;
  amountMin: number;
  amountStep: number;
  amountMax: number | null;
}

export type AmountToLotsResult =
  | { ok: true; lots: LotsSpaceConstraints; notes: string[] }
  | { ok: false; code: string; message: string; notes: string[] };

/**
 * Convert verified AMOUNT-space min/step/max into lots-space sizing constraints.
 * Requires positive integer baseUnitSize from TradingSettings.
 */
export function amountConstraintsToLots(input: {
  baseUnitSize: number | null | undefined;
  amountMin: number | null | undefined;
  amountStep: number | null | undefined;
  amountMax?: number | null | undefined;
}): AmountToLotsResult {
  const notes: string[] = [];
  if (!finitePositive(input.baseUnitSize) || !Number.isInteger(input.baseUnitSize)) {
    return {
      ok: false,
      code: "FXCM_BASE_UNIT_SIZE_INVALID",
      message:
        "baseUnitSize must be a positive integer from TradingSettings "
        + "(amount = baseUnitSize × lots). Fractional/invented values are rejected.",
      notes,
    };
  }
  const base = input.baseUnitSize;
  if (!finitePositive(input.amountMin) || !finitePositive(input.amountStep)) {
    return {
      ok: false,
      code: "FXCM_AMOUNT_CONSTRAINTS_UNVERIFIED",
      message: "Broker AMOUNT min/step unverified — lots conversion blocked.",
      notes,
    };
  }
  const amountMin = input.amountMin;
  const amountStep = input.amountStep;
  const amountMax =
    finitePositive(input.amountMax) ? input.amountMax : null;

  const lotsMin = amountMin / base;
  const lotsStep = amountStep / base;
  if (!finitePositive(lotsMin) || !finitePositive(lotsStep)) {
    return {
      ok: false,
      code: "FXCM_LOTS_CONSTRAINTS_INVALID",
      message: `Derived lots min/step invalid (amountMin=${amountMin}, amountStep=${amountStep}, base=${base}).`,
      notes,
    };
  }
  // Lots constraints must cleanly divide — otherwise risk↔amount mapping is ambiguous.
  if (!nearlyInteger(lotsMin / lotsStep)) {
    return {
      ok: false,
      code: "FXCM_LOTS_MIN_NOT_MULTIPLE_OF_STEP",
      message: `lotsMin=${lotsMin} is not a multiple of lotsStep=${lotsStep}.`,
      notes,
    };
  }

  let lotsMax: number | null = null;
  if (amountMax != null) {
    lotsMax = amountMax / base;
    if (!finitePositive(lotsMax)) {
      return {
        ok: false,
        code: "FXCM_LOTS_MAX_INVALID",
        message: `Derived lotsMax invalid from amountMax=${amountMax}.`,
        notes,
      };
    }
    notes.push(`Broker amountMax=${amountMax} → lotsMax=${lotsMax}.`);
  }

  notes.push(
    `AMOUNT→lots: baseUnitSize=${base}, amountMin=${amountMin}, amountStep=${amountStep} `
      + `→ lotsMin=${lotsMin}, lotsStep=${lotsStep}.`,
  );
  notes.push("Risk/margin use per-lot pipCost/mmr; quantity sized in lots then converted to AMOUNT.");

  return {
    ok: true,
    lots: {
      lotsMin,
      lotsStep,
      lotsMax,
      baseUnitSize: base,
      amountMin,
      amountStep,
      amountMax,
    },
    notes,
  };
}

/**
 * Convert sized lots → ForexConnect integer AMOUNT without upward rounding.
 * Rejects non-integer AMOUNT results.
 */
export function lotsToFxcmAmount(input: {
  lots: number;
  baseUnitSize: number;
  amountMin?: number | null;
}): {
  ok: boolean;
  amount: number | null;
  code: string;
  message: string;
} {
  if (!finitePositive(input.lots)) {
    return { ok: false, amount: null, code: "LOTS_INVALID", message: "lots must be finite > 0." };
  }
  if (!finitePositive(input.baseUnitSize) || !Number.isInteger(input.baseUnitSize)) {
    return {
      ok: false,
      amount: null,
      code: "BASE_UNIT_SIZE_INVALID",
      message: "baseUnitSize must be a positive integer.",
    };
  }
  const raw = input.baseUnitSize * input.lots;
  const amount = Math.round(raw);
  if (!Number.isFinite(raw) || raw <= 0) {
    return { ok: false, amount: null, code: "AMOUNT_INVALID", message: "Computed AMOUNT invalid." };
  }
  if (Math.abs(raw - amount) > 1e-9 || !Number.isInteger(amount) || amount <= 0) {
    return {
      ok: false,
      amount: null,
      code: "AMOUNT_NOT_INTEGER",
      message:
        `baseUnitSize(${input.baseUnitSize}) × lots(${input.lots}) = ${raw} is not an integer AMOUNT.`,
    };
  }
  if (finitePositive(input.amountMin) && amount < input.amountMin) {
    return {
      ok: false,
      amount: null,
      code: "AMOUNT_BELOW_MIN_QUANTITY",
      message: `Computed AMOUNT ${amount} < broker minQuantity ${input.amountMin}.`,
    };
  }
  return {
    ok: true,
    amount,
    code: "OK",
    message: `amount=${amount} from baseUnitSize=${input.baseUnitSize} × lots=${input.lots}.`,
  };
}
