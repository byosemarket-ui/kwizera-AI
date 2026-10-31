/**
 * Phase 4.10 — Offline scorer for DEMO instruments vs owner 0.01-lot bound.
 *
 * Uses only caller-supplied live (or mock) TradingSettings/Offers fields.
 * Never invents baseUnitSize, minQuantity, mmrPerLot, or round-ups.
 * Does not call the broker.
 */
import {
  evaluateBrokerQuantityContract,
  type BrokerQuantityContractResult,
} from "./broker-quantity-contract.js";

export const OWNER_MAX_LOTS_001 = 0.01;

export interface DiscoverableInstrumentRow {
  providerSymbol?: string | null;
  displaySymbol?: string | null;
  canonicalSymbol?: string | null;
  instrumentType?: string | null;
  instrumentTypeLabel?: string | null;
  tradingStatus?: string | null;
  baseUnitSize?: number | null;
  minQuantity?: number | null;
  /** Prefer lotStep only as amount-step hint when distinct from minQuantity. */
  lotStep?: number | null;
  amountStep?: number | null;
  pointSize?: number | null;
  pipCost?: number | null;
  mmrPerLot?: number | null;
  condDistStop?: number | null;
  condDistAvailable?: boolean | null;
  /** Evidence provenance for this row (required for honest reporting). */
  evidenceSource?: "live_broker" | "mock_fixture" | "documentation" | "cached" | "inferred";
}

export interface Instrument001LotScore {
  providerSymbol: string;
  displaySymbol: string | null;
  instrumentType: string | null;
  tradingStatus: string | null;
  evidenceSource: DiscoverableInstrumentRow["evidenceSource"];
  liveFields: {
    baseUnitSize: number | null;
    minQuantity: number | null;
    amountStep: number | null;
    pointSize: number | null;
    pipCost: number | null;
    mmrPerLot: number | null;
    condDistStop: number | null;
    condDistAvailable: boolean | null;
  };
  contract: BrokerQuantityContractResult;
  /** Amount step alignment when amountStep known (AMOUNT % step === 0). */
  amountStepOk: boolean | null;
  /** True only when quantity+min supported AND mmr authoritative (live evidence required for PASS). */
  compatible001Lot: boolean;
  blockers: string[];
}

export interface Discover001LotInstrumentsResult {
  requestedLots: number;
  formula: "amount = baseUnitSize * lots";
  scanned: number;
  compatible: Instrument001LotScore[];
  incompatibleSample: Instrument001LotScore[];
  missingSpecsCount: number;
  missingMmrCount: number;
  summary: string;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function symbolOf(row: DiscoverableInstrumentRow): string {
  return String(row.providerSymbol ?? row.displaySymbol ?? row.canonicalSymbol ?? "").trim();
}

/**
 * Score one instrument for owner 0.01 lots. Fail-closed on missing specs.
 */
export function scoreInstrumentFor001Lots(
  row: DiscoverableInstrumentRow,
  requestedLots: number = OWNER_MAX_LOTS_001,
): Instrument001LotScore {
  const providerSymbol = symbolOf(row) || "(unknown)";
  const evidenceSource = row.evidenceSource ?? "inferred";
  const amountStep = finitePositive(row.amountStep)
    ? Number(row.amountStep)
    : (finitePositive(row.lotStep) ? Number(row.lotStep) : null);

  const contract = evaluateBrokerQuantityContract({
    requestedLots,
    baseUnitSize: row.baseUnitSize,
    minQuantity: row.minQuantity,
    mmrPerLot: row.mmrPerLot,
    maxLotsPerOrder: requestedLots,
  });

  const blockers = [...contract.blockers];
  let amountStepOk: boolean | null = null;
  if (amountStep != null && contract.amountConversion.ok && contract.amountConversion.amount != null) {
    const amt = contract.amountConversion.amount;
    amountStepOk = Math.abs(amt / amountStep - Math.round(amt / amountStep)) < 1e-9;
    if (!amountStepOk) blockers.push("AMOUNT_NOT_ALIGNED_TO_STEP");
  } else if (amountStep == null && contract.amountConversion.ok) {
    // lotStep often aliases minQuantity; absence of a distinct step is NOT invented.
    amountStepOk = null;
  }

  if (evidenceSource !== "live_broker" && evidenceSource !== "mock_fixture") {
    // Documentation/cached/inferred never count as production PASS.
    blockers.push("EVIDENCE_NOT_LIVE");
  }

  const compatible001Lot =
    contract.requestedLotsSupported
    && contract.mmrAuthoritative
    && contract.minQuantity != null
    && amountStepOk !== false
    && !blockers.includes("MIN_QUANTITY_UNVERIFIED")
    && !blockers.includes("EVIDENCE_NOT_LIVE");

  return {
    providerSymbol,
    displaySymbol: row.displaySymbol == null ? null : String(row.displaySymbol),
    instrumentType: row.instrumentType == null
      ? (row.instrumentTypeLabel == null ? null : String(row.instrumentTypeLabel))
      : String(row.instrumentType),
    tradingStatus: row.tradingStatus == null ? null : String(row.tradingStatus),
    evidenceSource,
    liveFields: {
      baseUnitSize: finitePositive(row.baseUnitSize) ? Number(row.baseUnitSize) : null,
      minQuantity: finitePositive(row.minQuantity) ? Number(row.minQuantity) : null,
      amountStep,
      pointSize: finitePositive(row.pointSize) ? Number(row.pointSize) : null,
      pipCost: finitePositive(row.pipCost) ? Number(row.pipCost) : null,
      mmrPerLot: finitePositive(row.mmrPerLot) ? Number(row.mmrPerLot) : null,
      condDistStop: row.condDistStop != null && Number.isFinite(Number(row.condDistStop))
        ? Number(row.condDistStop)
        : null,
      condDistAvailable: row.condDistAvailable == null ? null : Boolean(row.condDistAvailable),
    },
    contract,
    amountStepOk,
    compatible001Lot,
    blockers: [...new Set(blockers)],
  };
}

/**
 * Scan a catalog of instruments for 0.01-lot + authoritative MMR compatibility.
 */
export function discover001LotCompatibleInstruments(
  rows: DiscoverableInstrumentRow[],
  opts?: { requestedLots?: number; incompatibleSampleLimit?: number },
): Discover001LotInstrumentsResult {
  const requestedLots = opts?.requestedLots ?? OWNER_MAX_LOTS_001;
  const sampleLimit = opts?.incompatibleSampleLimit ?? 25;
  const scores = (Array.isArray(rows) ? rows : []).map((r) => scoreInstrumentFor001Lots(r, requestedLots));
  const compatible = scores.filter((s) => s.compatible001Lot);
  const incompatible = scores.filter((s) => !s.compatible001Lot);
  const missingSpecsCount = scores.filter((s) =>
    s.liveFields.baseUnitSize == null || s.liveFields.minQuantity == null
  ).length;
  const missingMmrCount = scores.filter((s) => s.liveFields.mmrPerLot == null).length;

  return {
    requestedLots: OWNER_MAX_LOTS_001,
    formula: "amount = baseUnitSize * lots",
    scanned: scores.length,
    compatible,
    incompatibleSample: incompatible.slice(0, sampleLimit),
    missingSpecsCount,
    missingMmrCount,
    summary: compatible.length > 0
      ? `COMPATIBLE=${compatible.length} of ${scores.length} (requestedLots=${requestedLots})`
      : `NONE_COMPATIBLE scanned=${scores.length} missingSpecs=${missingSpecsCount} missingMmr=${missingMmrCount}`,
  };
}
