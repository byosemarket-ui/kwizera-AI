/**
 * Stage 3 — Map ForexConnect RO instrument rows → position feasibility report.
 * Never invents fields. Never mutates broker.
 */
import { STAGE3_TRACKED_INSTRUMENTS } from "../risk-policy/types.js";
import {
  buildStage3FeasibilityReport,
  type InstrumentBrokerMetadataInput,
  type Stage3FeasibilityReport,
} from "./stage3-position-feasibility.js";

export interface LiveRoInstrumentRow {
  providerSymbol?: string | null;
  displaySymbol?: string | null;
  canonicalSymbol?: string | null;
  baseUnitSize?: number | null;
  minQuantity?: number | null;
  lotStep?: number | null;
  pointSize?: number | null;
  pipCost?: number | null;
  mmrPerLot?: number | null;
  quantityUnitLabel?: string | null;
}

function norm(s: string): string {
  return s.replace(/[\s/_-]/g, "").toUpperCase();
}

function matchTracked(row: LiveRoInstrumentRow): string | null {
  const keys = [row.providerSymbol, row.displaySymbol, row.canonicalSymbol]
    .filter(Boolean)
    .map((k) => norm(String(k)));
  for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
    if (keys.includes(norm(inst))) return inst;
  }
  return null;
}

/**
 * Build Stage 3 report from a live (or fixture-labelled) instrument catalog + account snapshot.
 */
export function buildStage3FeasibilityFromInstrumentCatalog(input: {
  instruments: LiveRoInstrumentRow[];
  usableMargin?: number | null;
  accountBalance?: number | null;
  accountEquity?: number | null;
  accountCurrency?: string | null;
  accountFresh?: boolean | null;
  observedAtUtc?: string | null;
  evidenceSource?: InstrumentBrokerMetadataInput["evidenceSource"];
  sourceAuthoritative?: boolean;
  spreadPolicyByInstrument?: Partial<Record<string, string>>;
  slippagePolicyByInstrument?: Partial<Record<string, string>>;
  dataModeByInstrument?: Partial<Record<string, string>>;
  marketClosed?: boolean | null;
}): Stage3FeasibilityReport {
  const evidenceSource = input.evidenceSource ?? "live_broker";
  const sourceAuthoritative = input.sourceAuthoritative ?? evidenceSource === "live_broker";
  const observedAtUtc = input.observedAtUtc ?? new Date().toISOString();
  const byInst = new Map<string, LiveRoInstrumentRow>();
  for (const row of input.instruments) {
    const hit = matchTracked(row);
    if (hit && !byInst.has(hit)) byInst.set(hit, row);
  }

  const rows: InstrumentBrokerMetadataInput[] = STAGE3_TRACKED_INSTRUMENTS.map((inst) => {
    const row = byInst.get(inst);
    if (!row) {
      return {
        instrument: inst,
        baseUnitSize: null,
        minQuantity: null,
        quantityIncrement: null,
        mmrPerLot: null,
        usableMargin: input.usableMargin ?? null,
        accountBalance: input.accountBalance ?? null,
        accountEquity: input.accountEquity ?? null,
        accountCurrency: input.accountCurrency ?? null,
        accountFresh: input.accountFresh ?? null,
        sourceAuthoritative: false,
        evidenceSource: evidenceSource === "live_broker" ? "live_broker" : evidenceSource,
        observedAtUtc,
        quantityUnitLabel: null,
      };
    }
    return {
      instrument: inst,
      baseUnitSize: row.baseUnitSize ?? null,
      minQuantity: row.minQuantity ?? null,
      quantityIncrement: row.lotStep ?? row.minQuantity ?? null,
      mmrPerLot: row.mmrPerLot ?? null,
      pointSize: row.pointSize ?? null,
      pipCostAccount: row.pipCost ?? null,
      usableMargin: input.usableMargin ?? null,
      accountBalance: input.accountBalance ?? null,
      accountEquity: input.accountEquity ?? null,
      accountCurrency: input.accountCurrency ?? null,
      accountFresh: input.accountFresh ?? null,
      sourceAuthoritative,
      evidenceSource,
      observedAtUtc,
      quantityUnitLabel: row.quantityUnitLabel
        ?? "FXCM AMOUNT contracts (baseUnitSize×lots; not assumed ounces)",
    };
  });

  return buildStage3FeasibilityReport({
    rows,
    spreadPolicyByInstrument: input.spreadPolicyByInstrument,
    slippagePolicyByInstrument: input.slippagePolicyByInstrument,
    dataModeByInstrument: input.dataModeByInstrument,
    marketClosed: input.marketClosed,
  });
}
