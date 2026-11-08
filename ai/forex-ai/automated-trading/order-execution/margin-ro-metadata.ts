/**
 * Stage 7.3 — Read-only ForexConnect margin/instrument metadata readiness.
 * Never invents contract sizes or MMR. Never submits proposed orders.
 */
import { evaluateBrokerQuantityContract } from "./broker-quantity-contract.js";
import { explainXauOwnerLotIncompatibility } from "./xau-owner-lot-compatibility.js";
import { OWNER_MAX_QUANTITY } from "../order-proposal/types.js";

export interface RoInstrumentMarginSnapshot {
  instrument: string;
  baseUnitSize: number | null;
  minQuantity: number | null;
  mmrPerLot: number | null;
  quantityIncrement: number | null;
  /** True when fields came from live RO Offers/TradingSettings (caller asserts). */
  sourceAuthoritative: boolean;
  observedAtUtc: string | null;
}

export interface RoMarginMetadataAssessment {
  instrument: string;
  formula: "amount = baseUnitSize * lots";
  ownerMaxLots: typeof OWNER_MAX_QUANTITY;
  fieldsPresent: {
    baseUnitSize: boolean;
    minQuantity: boolean;
    mmrPerLot: boolean;
    quantityIncrement: boolean;
  };
  quantityContractSupportedAtOwnerMax: boolean;
  mmrAuthoritative: boolean;
  estimatedMarginAtOwnerMax: number | null;
  blockers: string[];
  xauRootCause: ReturnType<typeof explainXauOwnerLotIncompatibility> | null;
  maySubmitProposedOrderForMarginProbe: false;
  mayInventMissingFields: false;
  mayRaiseOwnerMaxLots: false;
  note: string;
}

/**
 * Assess RO instrument metadata for margin/quantity readiness at owner max 0.01 lots.
 */
export function assessRoMarginMetadata(
  snap: RoInstrumentMarginSnapshot,
): RoMarginMetadataAssessment {
  const contract = evaluateBrokerQuantityContract({
    requestedLots: OWNER_MAX_QUANTITY,
    baseUnitSize: snap.baseUnitSize,
    minQuantity: snap.minQuantity,
    mmrPerLot: snap.mmrPerLot,
    maxLotsPerOrder: OWNER_MAX_QUANTITY,
  });

  const blockers = [...contract.blockers];
  if (!snap.sourceAuthoritative) {
    blockers.push("RO_SOURCE_NOT_AUTHORITATIVE");
  }
  if (!snap.observedAtUtc) {
    blockers.push("RO_OBSERVATION_TIMESTAMP_MISSING");
  }

  const isXau = snap.instrument.replace(/\s+/g, "").toUpperCase() === "XAU/USD";
  const xauRootCause = isXau
    ? explainXauOwnerLotIncompatibility({
      baseUnitSize: snap.baseUnitSize,
      minQuantity: snap.minQuantity,
      mmrPerLot: snap.mmrPerLot,
    })
    : null;

  return {
    instrument: snap.instrument,
    formula: "amount = baseUnitSize * lots",
    ownerMaxLots: OWNER_MAX_QUANTITY,
    fieldsPresent: {
      baseUnitSize: snap.baseUnitSize != null && Number.isFinite(snap.baseUnitSize),
      minQuantity: snap.minQuantity != null && Number.isFinite(snap.minQuantity),
      mmrPerLot: snap.mmrPerLot != null && Number.isFinite(snap.mmrPerLot),
      quantityIncrement: snap.quantityIncrement != null && Number.isFinite(snap.quantityIncrement),
    },
    quantityContractSupportedAtOwnerMax: contract.requestedLotsSupported && snap.sourceAuthoritative,
    mmrAuthoritative: contract.mmrAuthoritative && snap.sourceAuthoritative,
    estimatedMarginAtOwnerMax: contract.estimatedMarginAccount,
    blockers: [...new Set(blockers)],
    xauRootCause,
    maySubmitProposedOrderForMarginProbe: false,
    mayInventMissingFields: false,
    mayRaiseOwnerMaxLots: false,
    note: isXau && xauRootCause
      ? xauRootCause.rootCauseSummary
      : contract.summary,
  };
}

/**
 * Owner-facing plan for proposed-order margin verification without submitting.
 */
export function getProposedOrderMarginVerificationPlan(): {
  maySubmitOrder: false;
  mayCallCreateOrderRequest: false;
  mayCallSendRequest: false;
  readOnlySources: string[];
  xauOwnerMaxIncompatibility: string;
  ownerApprovalForLiveProposedOrderProbe: string;
  note: string;
} {
  return {
    maySubmitOrder: false,
    mayCallCreateOrderRequest: false,
    mayCallSendRequest: false,
    readOnlySources: [
      "ForexConnect Offers row (baseUnitSize, minQuantity, pointSize)",
      "TradingSettings get_mmr / Offers MMR fallback when get_mmr null",
      "Account usableMargin (RO)",
      "attestProposedOrderMargin(mmrPerLot × lots) when contractVerified",
    ],
    xauOwnerMaxIncompatibility:
      "Documented DEMO XAU baseUnitSize=1 ⇒ amount=baseUnitSize*0.01=0.01 is not an integer AMOUNT "
      + "(AMOUNT_NOT_INTEGER) and owner max 0.01 < minLotsFromBroker=1 (OWNER_MAX_LOTS_BELOW_BROKER_MIN). "
      + "Do not raise owner max to fix this.",
    ownerApprovalForLiveProposedOrderProbe:
      "If a real proposed-order margin probe that creates a broker order is required, request separate owner approval. "
      + "This Stage 7.3 continuation prepares the plan only.",
    note: "Software attestation uses RO metadata only; never invents MMR/contract size.",
  };
}
