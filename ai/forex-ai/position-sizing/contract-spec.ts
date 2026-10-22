/**
 * Resolve verified instrument contract specs from provider metadata.
 * Never invents pip size, lot size, or ounce multipliers.
 */
import type { InstrumentContractSpec, QuantityUnit, ContractConvention } from "./types.js";
import { isFiniteNumber } from "./decimal.js";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function unavailableContractSpec(
  instrumentId: string,
  provider: string,
  reason: string,
): InstrumentContractSpec {
  return {
    instrumentId,
    provider,
    quoteCurrency: null,
    contractCurrency: null,
    convention: "unknown",
    pointSize: null,
    pipCostAccount: null,
    baseUnitSize: null,
    contractMultiplier: null,
    quantityMin: null,
    quantityMax: null,
    quantityStep: null,
    quantityUnit: "unknown",
    tickSize: null,
    marginRate: null,
    marginPerLotAccount: null,
    verified: false,
    source: "unavailable",
    unavailableReason: reason,
    observedAt: null,
  };
}

/**
 * Build a contract spec from ForexConnect Offers-normalized fields / MarketInstrument.metadata.
 */
export function contractSpecFromForexConnectMetadata(input: {
  instrumentId: string;
  metadata: Record<string, unknown> | null | undefined;
  quoteCurrency?: string | null;
  contractCurrency?: string | null;
  instrumentTypeLabel?: string | null;
  observedAt?: string | null;
}): InstrumentContractSpec {
  const md = input.metadata ?? {};
  const pointSize = num(md.pointSize ?? md.PointSize);
  const pipCostAccount = num(md.pipCost ?? md.PipCost ?? md.pipCostAccount);
  const baseUnitSize = num(md.baseUnitSize ?? md.BaseUnitSize);
  const contractMultiplier = num(md.contractMultiplier ?? md.ContractMultiplier);
  const sdkMinQuantity = num(md.minQuantity ?? md.MinQuantity ?? md.quantityMin);
  const quantityMax = num(md.quantityMax ?? md.maxQuantity);
  // Phase 56.2.5 — do not invent 0.01 step. Prefer BaseUnitSize as increment when present
  // (ForexConnect: amounts must be multiples of BaseUnitSize). Legacy lotStep often equals MinQuantity.
  const legacyLotStep = num(md.lotStep ?? md.LotStep);
  const reportedStep = num(md.quantityStep);
  const tickSize = num(md.tickSize ?? md.TickSize) ?? pointSize;
  // Decimal rate only — FXCM absolute MMR must not be mapped here.
  const marginRate = num(md.marginRate);
  const marginPerLotAccount = num(md.marginPerLotAccount ?? md.mmrPerLot ?? md.MmrPerLot);
  const quoteCurrency = str(input.quoteCurrency) ?? str(md.quoteCurrency) ?? str(md.quoteAsset);
  const contractCurrency =
    str(input.contractCurrency) ?? str(md.contractCurrency) ?? str(md.ContractCurrency);

  const label = String(input.instrumentTypeLabel ?? md.instrumentTypeLabel ?? "").toLowerCase();
  const isBullion = label.includes("bullion") || /^(XAU|XAG)/i.test(input.instrumentId);
  const isXau = /XAU/i.test(input.instrumentId);
  const isCrypto = label.includes("crypto");

  // Phase 56.4.0 — XAU ContractMultiplier: when Offers omit it but BaseUnitSize===1 and
  // PointSize+PipCost are attested, treat multiplier as 1 (FXCM 1 contract = 1 oz). Never invent for non-XAU.
  let resolvedContractMultiplier = contractMultiplier;
  if (
    resolvedContractMultiplier == null
    && isXau
    && baseUnitSize === 1
    && pointSize != null
    && pipCostAccount != null
  ) {
    resolvedContractMultiplier = 1;
  }

  let convention: ContractConvention = "unknown";
  let quantityUnit: QuantityUnit = "unknown";
  // Phase 56.2.4 — XAU/USD: prefer contracts (FXCM published 1 contract = 1 oz).
  // Do not label XAU as "lots" merely because PipCost exists.
  if (
    isXau
    && isBullion
    && pointSize != null
    && (pipCostAccount != null || resolvedContractMultiplier != null)
  ) {
    convention = "ounce_contract";
    quantityUnit = "contracts";
  } else if (pipCostAccount != null && pointSize != null) {
    convention = "fx_pip_cost_lot";
    quantityUnit = "lots";
  } else if (baseUnitSize != null && pointSize != null) {
    convention = "fx_base_unit";
    quantityUnit = "lots";
  } else if (isBullion && resolvedContractMultiplier != null && pointSize != null) {
    convention = "ounce_contract";
    quantityUnit = "ounces";
  } else if (isCrypto && (reportedStep != null || legacyLotStep != null || baseUnitSize != null)) {
    convention = "crypto_base_qty";
    quantityUnit = "base_units";
  } else if (
    resolvedContractMultiplier != null
    && resolvedContractMultiplier !== 1
    && pointSize != null
  ) {
    convention = "cfd_multiplier";
    quantityUnit = "contracts";
  }

  // Resolve min/step without inventing contradictory 0.01 vs 1 for XAU contracts.
  let quantityStep: number | null = null;
  let quantityMin: number | null = null;
  if (quantityUnit === "contracts" && isXau) {
    // Increment = BaseUnitSize (SDK rule). Never invent 0.01.
    quantityStep = baseUnitSize;
    quantityMin = sdkMinQuantity
      ?? (legacyLotStep != null && Math.abs(legacyLotStep - 0.01) > 1e-12 ? legacyLotStep : null)
      ?? (reportedStep != null && Math.abs(reportedStep - 0.01) > 1e-12 ? reportedStep : null)
      ?? baseUnitSize;
    // If only invented 0.01 signals exist alongside missing base — leave null (fail closed upstream).
    if (quantityStep == null) {
      quantityMin = null;
    }
  } else if (quantityUnit === "lots") {
    quantityStep = reportedStep
      ?? legacyLotStep
      ?? (pipCostAccount != null && pointSize != null ? 0.01 : null);
    quantityMin = sdkMinQuantity ?? (quantityStep != null ? 0.01 : null);
  } else {
    quantityStep = reportedStep ?? legacyLotStep ?? baseUnitSize;
    quantityMin = sdkMinQuantity ?? quantityStep;
  }

  const usable =
    (convention === "fx_pip_cost_lot" && pointSize != null && pipCostAccount != null)
    || (convention === "fx_base_unit" && pointSize != null && baseUnitSize != null)
    || (convention === "ounce_contract" && resolvedContractMultiplier != null && pointSize != null)
    || (convention === "cfd_multiplier" && resolvedContractMultiplier != null && pointSize != null)
    || (convention === "crypto_base_qty" && quantityStep != null);

  if (!usable) {
    const present: string[] = [];
    if (pointSize != null) present.push("PointSize");
    if (pipCostAccount != null) present.push("PipCost");
    if (baseUnitSize != null) present.push("BaseUnitSize");
    if (contractMultiplier != null) present.push("ContractMultiplier");
    if (quantityStep != null) present.push("LotStep/quantityStep");
    if (sdkMinQuantity != null) present.push("MinQuantity");
    if (marginRate != null) present.push("marginRate");
    if (marginPerLotAccount != null) present.push("mmrPerLot");
    return unavailableContractSpec(
      input.instrumentId,
      "FOREXCONNECT",
      "Verified contract sizing fields are incomplete for this instrument "
        + `(have: ${present.length ? present.join(", ") : "none"}; `
        + "need PointSize+PipCost, or PointSize+BaseUnitSize, or PointSize+ContractMultiplier for bullion). "
        + "Fields are never invented.",
    );
  }

  return {
    instrumentId: input.instrumentId,
    provider: "FOREXCONNECT",
    quoteCurrency,
    contractCurrency,
    convention,
    pointSize,
    pipCostAccount,
    baseUnitSize,
    contractMultiplier:
      resolvedContractMultiplier ?? (convention.startsWith("fx_") ? 1 : null),
    quantityMin,
    quantityMax,
    quantityStep,
    quantityUnit,
    tickSize,
    marginRate,
    marginPerLotAccount,
    verified: true,
    source: baseUnitSize != null || marginPerLotAccount != null
      ? "forexconnect-offers+trading-settings"
      : "forexconnect-offers",
    unavailableReason: null,
    observedAt: input.observedAt ?? null,
  };
}

/**
 * Build a crypto/base-qty spec from explicit verified Binance-style filters.
 * Callers must supply filters from exchangeInfo — never hardcoded.
 */
export function contractSpecFromCryptoFilters(input: {
  instrumentId: string;
  quoteCurrency: string;
  stepSize: number;
  minQty: number;
  maxQty?: number | null;
  tickSize?: number | null;
  observedAt?: string | null;
  source?: string;
}): InstrumentContractSpec {
  if (!isFiniteNumber(input.stepSize) || input.stepSize <= 0) {
    return unavailableContractSpec(input.instrumentId, "BINANCE", "Missing verified LOT_SIZE stepSize.");
  }
  if (!isFiniteNumber(input.minQty) || input.minQty < 0) {
    return unavailableContractSpec(input.instrumentId, "BINANCE", "Missing verified LOT_SIZE minQty.");
  }
  return {
    instrumentId: input.instrumentId,
    provider: "BINANCE",
    quoteCurrency: input.quoteCurrency,
    contractCurrency: input.quoteCurrency,
    convention: "crypto_base_qty",
    pointSize: input.tickSize ?? null,
    pipCostAccount: null,
    baseUnitSize: null,
    contractMultiplier: 1,
    quantityMin: input.minQty,
    quantityMax: input.maxQty ?? null,
    quantityStep: input.stepSize,
    quantityUnit: "base_units",
    tickSize: input.tickSize ?? null,
    marginRate: null,
    marginPerLotAccount: null,
    verified: true,
    source: input.source ?? "binance-exchangeInfo",
    unavailableReason: null,
    observedAt: input.observedAt ?? null,
  };
}

/** Explicit fixture / admin-verified override for tests and controlled environments. */
export function contractSpecFromVerifiedOverride(
  spec: InstrumentContractSpec,
): InstrumentContractSpec {
  if (!spec.verified) {
    return unavailableContractSpec(spec.instrumentId, spec.provider, "Override mark as verified=false.");
  }
  return { ...spec, unavailableReason: null };
}
