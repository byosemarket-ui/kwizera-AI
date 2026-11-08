/**
 * Stage 7.3 — Explain XAU/USD vs owner max 0.01 lots without changing the owner max.
 * Root cause is broker contract math, not a silent sizing override.
 */
import { OWNER_MAX_QUANTITY } from "../order-proposal/types.js";
import { evaluateBrokerQuantityContract } from "./broker-quantity-contract.js";

export interface XauOwnerLotCompatibilityReport {
  instrument: "XAU/USD";
  ownerMaxLots: typeof OWNER_MAX_QUANTITY;
  formula: "amount = baseUnitSize * lots";
  rootCauseCodes: string[];
  rootCauseSummary: string;
  mayRaiseOwnerMaxLots: false;
  mayInventBaseUnitSize: false;
  contract: ReturnType<typeof evaluateBrokerQuantityContract>;
}

/**
 * Document why owner 0.01 lots is incompatible with a given broker contract snapshot.
 * Never raises OWNER_MAX_QUANTITY. Never invents missing fields.
 */
export function explainXauOwnerLotIncompatibility(input: {
  baseUnitSize: number | null | undefined;
  minQuantity?: number | null;
  mmrPerLot?: number | null;
}): XauOwnerLotCompatibilityReport {
  const contract = evaluateBrokerQuantityContract({
    requestedLots: OWNER_MAX_QUANTITY,
    baseUnitSize: input.baseUnitSize,
    minQuantity: input.minQuantity,
    mmrPerLot: input.mmrPerLot,
    maxLotsPerOrder: OWNER_MAX_QUANTITY,
  });

  const rootCauseCodes = [...contract.blockers];
  const parts: string[] = [];
  if (rootCauseCodes.includes("AMOUNT_NOT_INTEGER")) {
    parts.push(
      `baseUnitSize(${contract.baseUnitSize}) * ownerMaxLots(${OWNER_MAX_QUANTITY}) is not an integer FXCM AMOUNT`,
    );
  }
  if (rootCauseCodes.includes("OWNER_MAX_LOTS_BELOW_BROKER_MIN")) {
    parts.push(
      `owner max ${OWNER_MAX_QUANTITY} lots is below broker minLotsFromBroker=${contract.minLotsFromBroker}`,
    );
  }
  if (rootCauseCodes.includes("MMR_PER_LOT_UNVERIFIED")) {
    parts.push("mmrPerLot not authoritatively verified from TradingSettings/get_mmr");
  }
  if (rootCauseCodes.includes("BASE_UNIT_SIZE_UNKNOWN") || rootCauseCodes.includes("BASE_UNIT_SIZE_INVALID")) {
    parts.push("baseUnitSize missing/invalid — refuse invented contract size");
  }

  return {
    instrument: "XAU/USD",
    ownerMaxLots: OWNER_MAX_QUANTITY,
    formula: "amount = baseUnitSize * lots",
    rootCauseCodes,
    rootCauseSummary: parts.length > 0
      ? parts.join("; ")
      : (contract.requestedLotsSupported
        ? "Owner 0.01 lots is supported by the provided broker contract fields."
        : contract.summary),
    mayRaiseOwnerMaxLots: false,
    mayInventBaseUnitSize: false,
    contract,
  };
}
