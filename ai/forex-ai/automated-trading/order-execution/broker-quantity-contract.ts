/**
 * Phase 4.9 — Authoritative ForexConnect quantity + margin contract (offline).
 *
 * Documented conversion (Gehtsoft OpenPosition + mutation_demo + TradingSettings):
 *   amount = baseUnitSize × lots
 * ForexConnect AMOUNT must be a positive integer.
 * minQuantity is the minimum AMOUNT (contracts), not a fractional lot invention.
 * mmrPerLot is absolute margin for 1.0 lot when TradingSettings get_mmr returns it.
 *
 * Never invents baseUnitSize, minQuantity, or mmrPerLot.
 */
import { lotsToBrokerAmount, type LotsToBrokerAmountResult } from "./lots-to-broker-amount.js";

export interface BrokerQuantityContractInput {
  /** UI / grant lots requested (e.g. 0.01). */
  requestedLots: number;
  baseUnitSize: number | null | undefined;
  /** Broker minimum order AMOUNT (contracts), when known. */
  minQuantity?: number | null;
  /** Absolute margin for 1.0 lot, when known. */
  mmrPerLot?: number | null;
  /** Owner/system max lots per order (must not be silently raised). */
  maxLotsPerOrder?: number | null;
}

export interface BrokerQuantityContractResult {
  formula: "amount = baseUnitSize * lots";
  requestedLots: number;
  baseUnitSize: number | null;
  minQuantity: number | null;
  mmrPerLot: number | null;
  /** minQuantity / baseUnitSize when both positive integers/finite. */
  minLotsFromBroker: number | null;
  /** lots → amount conversion result. */
  amountConversion: LotsToBrokerAmountResult;
  /** Estimated margin = mmrPerLot × requestedLots when mmr authoritative. */
  estimatedMarginAccount: number | null;
  mmrAuthoritative: boolean;
  /** True only when amount conversion OK and requested lots ≥ broker min lots. */
  requestedLotsSupported: boolean;
  /**
   * True when owner maxLotsPerOrder is strictly below broker min lots —
   * the owner's bound cannot be satisfied on this instrument/account.
   */
  ownerMaxBelowBrokerMin: boolean;
  blockers: string[];
  summary: string;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Evaluate whether requested lots are supported by broker contract fields.
 * Fail-closed when specs are missing; never rounds up to satisfy integer AMOUNT.
 */
export function evaluateBrokerQuantityContract(
  input: BrokerQuantityContractInput,
): BrokerQuantityContractResult {
  const blockers: string[] = [];
  const baseUnitSize = finitePositive(input.baseUnitSize) ? Number(input.baseUnitSize) : null;
  const minQuantity = finitePositive(input.minQuantity) ? Number(input.minQuantity) : null;
  const mmrPerLot = finitePositive(input.mmrPerLot) ? Number(input.mmrPerLot) : null;
  const maxLotsPerOrder = finitePositive(input.maxLotsPerOrder) ? Number(input.maxLotsPerOrder) : null;

  const amountConversion = lotsToBrokerAmount({
    lots: input.requestedLots,
    baseUnitSize: input.baseUnitSize,
    minQuantity: input.minQuantity,
  });

  if (!amountConversion.ok) blockers.push(amountConversion.code);

  let minLotsFromBroker: number | null = null;
  if (baseUnitSize != null && minQuantity != null) {
    minLotsFromBroker = minQuantity / baseUnitSize;
    if (!Number.isFinite(minLotsFromBroker) || minLotsFromBroker <= 0) {
      minLotsFromBroker = null;
      blockers.push("MIN_LOTS_FROM_BROKER_INVALID");
    }
  } else if (baseUnitSize != null && minQuantity == null) {
    blockers.push("MIN_QUANTITY_UNVERIFIED");
  }

  const mmrAuthoritative = mmrPerLot != null;
  if (!mmrAuthoritative) blockers.push("MMR_PER_LOT_UNVERIFIED");

  const estimatedMarginAccount =
    mmrAuthoritative && finitePositive(input.requestedLots)
      ? mmrPerLot! * input.requestedLots
      : null;

  let ownerMaxBelowBrokerMin = false;
  if (maxLotsPerOrder != null && minLotsFromBroker != null) {
    if (maxLotsPerOrder + 1e-12 < minLotsFromBroker) {
      ownerMaxBelowBrokerMin = true;
      blockers.push("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
    }
  }

  const requestedLotsSupported =
    amountConversion.ok
    && !ownerMaxBelowBrokerMin
    && (minLotsFromBroker == null
      || (finitePositive(input.requestedLots) && input.requestedLots + 1e-12 >= minLotsFromBroker));

  if (
    amountConversion.ok
    && minLotsFromBroker != null
    && finitePositive(input.requestedLots)
    && input.requestedLots + 1e-12 < minLotsFromBroker
  ) {
    blockers.push("REQUESTED_LOTS_BELOW_BROKER_MIN");
  }

  const summary = [
    `lots=${input.requestedLots}`,
    `baseUnitSize=${baseUnitSize ?? "null"}`,
    `rawAmount=${baseUnitSize != null && finitePositive(input.requestedLots) ? baseUnitSize * input.requestedLots : "n/a"}`,
    `amountCode=${amountConversion.code}`,
    `minQuantity=${minQuantity ?? "null"}`,
    `minLotsFromBroker=${minLotsFromBroker ?? "null"}`,
    `mmrPerLot=${mmrPerLot ?? "null"}`,
    `supported=${requestedLotsSupported}`,
  ].join("; ");

  return {
    formula: "amount = baseUnitSize * lots",
    requestedLots: input.requestedLots,
    baseUnitSize,
    minQuantity,
    mmrPerLot,
    minLotsFromBroker,
    amountConversion,
    estimatedMarginAccount,
    mmrAuthoritative,
    requestedLotsSupported,
    ownerMaxBelowBrokerMin,
    blockers: [...new Set(blockers)],
    summary,
  };
}
