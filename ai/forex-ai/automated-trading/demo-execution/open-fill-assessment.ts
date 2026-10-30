/**
 * Phase 3.10 — Fail-closed DEMO open fill amount assessment.
 * Compares requested broker amount (baseUnitSize × lots) to observed trade.amount.
 * Does not invent partial-fill streaming; a single mismatch fails closed.
 */

export type OpenFillAssessmentCode =
  | "OPEN_FILL_AMOUNT_OK"
  | "OPEN_FILL_AMOUNT_UNVERIFIED"
  | "OPEN_FILL_AMOUNT_MISMATCH"
  | "OPEN_FILL_BASE_UNIT_SIZE_UNVERIFIED"
  | "OPEN_FILL_LOTS_INVALID";

export interface OpenFillAssessment {
  ok: boolean;
  code: OpenFillAssessmentCode;
  requestedLots: number | null;
  baseUnitSize: number | null;
  requestedAmount: number | null;
  filledAmount: number | null;
  /** True when filledAmount is a positive finite number from the broker trade row. */
  filledAmountVerified: boolean;
  /** True only when filledAmount === requestedAmount and both verified. */
  fullFillConfirmed: boolean;
  /** True when filled is verified and strictly less than requested (unsafe partial). */
  partialFillSuspected: boolean;
  message: string;
}

function finitePositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Number.isInteger(n) && n > 0;
}

/**
 * Assess a single observed open fill against the requested size.
 * Multiple incremental fill events are NOT supported — callers must fail closed
 * rather than invent a streaming aggregator.
 */
export function assessOpenFillAmount(input: {
  requestedLots: number;
  baseUnitSize: number | null | undefined;
  /** Broker trade.amount in base units (same units as baseUnitSize × lots). */
  filledAmount: number | null | undefined;
}): OpenFillAssessment {
  const lots = input.requestedLots;
  if (!finitePositiveInt(lots)) {
    return {
      ok: false,
      code: "OPEN_FILL_LOTS_INVALID",
      requestedLots: Number.isFinite(lots) ? lots : null,
      baseUnitSize: null,
      requestedAmount: null,
      filledAmount: null,
      filledAmountVerified: false,
      fullFillConfirmed: false,
      partialFillSuspected: false,
      message: "Requested lots must be a positive integer before fill amount can be assessed.",
    };
  }

  if (!finitePositiveInt(input.baseUnitSize)) {
    return {
      ok: false,
      code: "OPEN_FILL_BASE_UNIT_SIZE_UNVERIFIED",
      requestedLots: lots,
      baseUnitSize: null,
      requestedAmount: null,
      filledAmount: null,
      filledAmountVerified: false,
      fullFillConfirmed: false,
      partialFillSuspected: false,
      message: "baseUnitSize unverified — cannot convert lots to broker amount for fill checks.",
    };
  }

  const requestedAmount = input.baseUnitSize * lots;
  const filledRaw = input.filledAmount;
  if (filledRaw == null || !Number.isFinite(Number(filledRaw))) {
    return {
      ok: false,
      code: "OPEN_FILL_AMOUNT_UNVERIFIED",
      requestedLots: lots,
      baseUnitSize: input.baseUnitSize,
      requestedAmount,
      filledAmount: null,
      filledAmountVerified: false,
      fullFillConfirmed: false,
      partialFillSuspected: false,
      message: "Broker trade amount missing/invalid — refuse to treat open as a confirmed full fill.",
    };
  }

  const filledAmount = Number(filledRaw);
  if (!Number.isInteger(filledAmount) || filledAmount <= 0) {
    return {
      ok: false,
      code: "OPEN_FILL_AMOUNT_UNVERIFIED",
      requestedLots: lots,
      baseUnitSize: input.baseUnitSize,
      requestedAmount,
      filledAmount,
      filledAmountVerified: false,
      fullFillConfirmed: false,
      partialFillSuspected: false,
      message: "Broker trade amount must be a positive integer in base units.",
    };
  }

  if (filledAmount === requestedAmount) {
    return {
      ok: true,
      code: "OPEN_FILL_AMOUNT_OK",
      requestedLots: lots,
      baseUnitSize: input.baseUnitSize,
      requestedAmount,
      filledAmount,
      filledAmountVerified: true,
      fullFillConfirmed: true,
      partialFillSuspected: false,
      message: "Observed fill amount matches requested baseUnitSize × lots.",
    };
  }

  const partial = filledAmount < requestedAmount;
  return {
    ok: false,
    code: "OPEN_FILL_AMOUNT_MISMATCH",
    requestedLots: lots,
    baseUnitSize: input.baseUnitSize,
    requestedAmount,
    filledAmount,
    filledAmountVerified: true,
    fullFillConfirmed: false,
    partialFillSuspected: partial,
    message: partial
      ? `Partial/undersize fill: filled=${filledAmount} requested=${requestedAmount}. Fail closed; reconcile before new entries.`
      : `Oversize/unexpected fill: filled=${filledAmount} requested=${requestedAmount}. Fail closed; reconcile before new entries.`,
  };
}

/** True when a lifecycle record should block additional DEMO entries. */
export function blocksAdditionalDemoEntries(record: {
  state?: string | null;
  lastCode?: string | null;
  fillConfirmed?: boolean;
  tradeId?: string | null;
  remainingAmount?: number | null;
}): boolean {
  if (!record.fillConfirmed || !record.tradeId) return false;
  if (record.remainingAmount != null && !(Number(record.remainingAmount) > 0)) return false;
  if (record.state === "PROTECTION_FAILED") return true;
  if (record.state === "RECONCILIATION_REQUIRED") return true;
  const code = String(record.lastCode || "");
  return (
    code === "OPEN_FILL_AMOUNT_MISMATCH"
    || code === "OPEN_FILL_AMOUNT_UNVERIFIED"
    || code === "PROTECTION_UNVERIFIED"
  );
}
