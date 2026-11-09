/**
 * Stage 3 — FXCM DEMO margin verification & position feasibility (read-only).
 * Never invents contract size/MMR. Never raises owner max 0.01 lots.
 * Never calls create_order_request / send_request.
 */
import {
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
} from "../order-proposal/types.js";
import { attestProposedOrderMargin } from "../risk-policy/margin.js";
import { STAGE3_TRACKED_INSTRUMENTS, type Stage3TrackedInstrument } from "../risk-policy/types.js";
import { evaluateBrokerQuantityContract } from "./broker-quantity-contract.js";
import { lotsToBrokerAmount } from "./lots-to-broker-amount.js";
import {
  assessRoMarginMetadata,
  type RoInstrumentMarginSnapshot,
} from "./margin-ro-metadata.js";
import { explainXauOwnerLotIncompatibility } from "./xau-owner-lot-compatibility.js";
import { SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION } from "../risk-policy/slippage-evidence.js";

export const STAGE3_FEASIBILITY_SCHEMA = "kwizera.at-stage3-position-feasibility.v1" as const;

export type MarginEvidenceClass =
  | "BROKER_REPORTED_MMR"
  | "APPLICATION_ESTIMATED"
  | "MISSING"
  | "STALE_ACCOUNT"
  | "FIXTURE_LABELLED";

export type PositionFeasibilityVerdict =
  | "FEASIBLE_AT_OWNER_MAX"
  | "BLOCKED"
  | "UNVERIFIED";

export interface InstrumentBrokerMetadataInput {
  instrument: Stage3TrackedInstrument | string;
  baseUnitSize: number | null;
  minQuantity: number | null;
  /** Prefer lotStep/amountStep when distinct. */
  quantityIncrement: number | null;
  mmrPerLot: number | null;
  pointSize?: number | null;
  pipCostAccount?: number | null;
  maxQuantity?: number | null;
  accountCurrency?: string | null;
  usableMargin?: number | null;
  accountBalance?: number | null;
  accountEquity?: number | null;
  accountFresh?: boolean | null;
  sourceAuthoritative: boolean;
  evidenceSource: "live_broker" | "documentation" | "cached" | "mock_fixture";
  observedAtUtc: string | null;
  /** Explicit unit label from broker docs/row when known — never invented. */
  quantityUnitLabel?: string | null;
}

export interface InstrumentPositionFeasibility {
  instrument: string;
  evidenceSource: InstrumentBrokerMetadataInput["evidenceSource"];
  evidenceClass: "LIVE_BROKER_RO" | "DOCUMENTATION" | "CACHED" | "FIXTURE";
  metadata: {
    baseUnitSize: number | null;
    minQuantity: number | null;
    quantityIncrement: number | null;
    mmrPerLot: number | null;
    pointSize: number | null;
    pipCostAccount: number | null;
    maxQuantity: number | null;
    quantityUnitLabel: string | null;
    formula: "amount = baseUnitSize * lots";
    unitInterpretation: string;
  };
  ownerMaxLots: typeof OWNER_MAX_QUANTITY;
  requestedLots: typeof OWNER_MAX_QUANTITY;
  amountConversion: ReturnType<typeof lotsToBrokerAmount>;
  quantityContract: ReturnType<typeof evaluateBrokerQuantityContract>;
  marginAttestation: ReturnType<typeof attestProposedOrderMargin>;
  marginEvidenceClass: MarginEvidenceClass;
  estimatedRequiredMargin: number | null;
  usableMargin: number | null;
  riskPolicyPreserved: {
    perOrderRiskTargetPercent: typeof PER_ORDER_RISK_TARGET_PERCENT;
    perOrderRiskMaximumPercent: typeof PER_ORDER_RISK_MAXIMUM_PERCENT;
    minTakeProfitR: 3;
    ownerMaxLots: typeof OWNER_MAX_QUANTITY;
    mayRaiseOwnerMaxLots: false;
  };
  stage1Blockers: string[];
  stage2Blockers: string[];
  blockers: string[];
  verdict: PositionFeasibilityVerdict;
  executionReady: false;
  placesOrders: false;
  mutatesBroker: false;
  note: string;
}

function evidenceClassOf(
  src: InstrumentBrokerMetadataInput["evidenceSource"],
): InstrumentPositionFeasibility["evidenceClass"] {
  if (src === "live_broker") return "LIVE_BROKER_RO";
  if (src === "documentation") return "DOCUMENTATION";
  if (src === "cached") return "CACHED";
  return "FIXTURE";
}

function unitInterpretation(baseUnitSize: number | null, label: string | null): string {
  if (label && label.trim()) {
    return `Broker/docs label=${label.trim()}; application lots convert via amount=baseUnitSize×lots. `
      + "Do not assume 1 unit = 1 ounce or 1 lot without that label.";
  }
  if (baseUnitSize == null) {
    return "baseUnitSize unknown — refuse invented lots/units/ounces mapping.";
  }
  return (
    `FXCM AMOUNT contracts = baseUnitSize(${baseUnitSize}) × UI lots. `
    + "UI 'lots' are application lots, not assumed ounces. minQuantity is minimum AMOUNT (contracts)."
  );
}

/**
 * Evaluate feasibility of owner-max 0.01 lots for one instrument from RO/docs snapshot.
 */
export function evaluateInstrumentPositionFeasibility(
  input: InstrumentBrokerMetadataInput,
  opts?: {
    spreadPolicyStatus?: string | null;
    slippagePolicyStatus?: string | null;
    dataMode?: string | null;
    marketClosed?: boolean | null;
  },
): InstrumentPositionFeasibility {
  const snap: RoInstrumentMarginSnapshot = {
    instrument: input.instrument,
    baseUnitSize: input.baseUnitSize,
    minQuantity: input.minQuantity,
    mmrPerLot: input.mmrPerLot,
    quantityIncrement: input.quantityIncrement,
    sourceAuthoritative: input.sourceAuthoritative && input.evidenceSource === "live_broker",
    observedAtUtc: input.observedAtUtc,
  };
  const metaAssess = assessRoMarginMetadata(snap);
  const amountConversion = lotsToBrokerAmount({
    lots: OWNER_MAX_QUANTITY,
    baseUnitSize: input.baseUnitSize,
    minQuantity: input.minQuantity,
  });
  const quantityContract = evaluateBrokerQuantityContract({
    requestedLots: OWNER_MAX_QUANTITY,
    baseUnitSize: input.baseUnitSize,
    minQuantity: input.minQuantity,
    mmrPerLot: input.mmrPerLot,
    maxLotsPerOrder: OWNER_MAX_QUANTITY,
  });

  const contractVerified =
    input.sourceAuthoritative
    && input.evidenceSource === "live_broker"
    && finitePositive(input.baseUnitSize)
    && finitePositive(input.mmrPerLot)
    && amountConversion.ok;

  let marginEvidenceClass: MarginEvidenceClass = "MISSING";
  if (input.evidenceSource === "mock_fixture") marginEvidenceClass = "FIXTURE_LABELLED";
  else if (input.accountFresh === false) marginEvidenceClass = "STALE_ACCOUNT";
  else if (finitePositive(input.mmrPerLot) && input.evidenceSource === "live_broker") {
    marginEvidenceClass = "BROKER_REPORTED_MMR";
  } else if (finitePositive(input.mmrPerLot)) {
    marginEvidenceClass = "APPLICATION_ESTIMATED";
  }

  const marginAttestation = attestProposedOrderMargin({
    usableMargin: input.usableMargin,
    mmrPerLot: input.mmrPerLot,
    lots: OWNER_MAX_QUANTITY,
    contractVerified,
    baseUnitSize: input.baseUnitSize,
  });

  const blockers = new Set<string>([
    ...quantityContract.blockers,
    ...metaAssess.blockers,
  ]);
  if (input.accountFresh === false) blockers.add("STALE_ACCOUNT_DATA");
  if (!finitePositive(input.mmrPerLot)) blockers.add("MMR_PER_LOT_UNVERIFIED");
  if (!finitePositive(input.baseUnitSize)) blockers.add("BASE_UNIT_SIZE_UNKNOWN");
  if (input.maxQuantity != null && finitePositive(input.maxQuantity)
    && OWNER_MAX_QUANTITY > input.maxQuantity + 1e-12) {
    blockers.add("OWNER_LOTS_ABOVE_BROKER_MAX");
  }
  if (marginAttestation.status === "UNAVAILABLE" || marginAttestation.status === "INVALID") {
    blockers.add(`MARGIN_ATTESTATION_${marginAttestation.status}`);
  }
  if (marginAttestation.status === "INSUFFICIENT") {
    blockers.add("INSUFFICIENT_USABLE_MARGIN");
  }
  if (input.evidenceSource !== "live_broker" || !input.sourceAuthoritative) {
    blockers.add("METADATA_NOT_LIVE_AUTHORITATIVE");
  }

  const stage1Blockers: string[] = [];
  if (!opts?.spreadPolicyStatus || opts.spreadPolicyStatus !== "VERIFIED") {
    stage1Blockers.push("WAITING_FOR_OWNER_APPROVAL");
    stage1Blockers.push("SPREAD_LIMIT_NOT_CONFIGURED");
  }
  if (!opts?.slippagePolicyStatus || opts.slippagePolicyStatus !== "VERIFIED") {
    stage1Blockers.push("WAITING_FOR_OWNER_APPROVAL");
    stage1Blockers.push("SLIPPAGE_LIMIT_NOT_CONFIGURED");
    stage1Blockers.push(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
    stage1Blockers.push("WAITING_FOR_CONTROLLED_DEMO_EVIDENCE");
  }
  if (opts?.marketClosed === true) stage1Blockers.push("WAITING_FOR_LIVE_MARKET");

  const stage2Blockers: string[] = [];
  const dm = String(opts?.dataMode || "").toUpperCase();
  if (dm && dm !== "LIVE") {
    stage2Blockers.push(`DATA_MODE_${dm}_NOT_LIVE`);
  }
  if (opts?.marketClosed === true) stage2Blockers.push("WAITING_FOR_LIVE_MARKET");

  for (const c of stage1Blockers) blockers.add(c);
  for (const c of stage2Blockers) blockers.add(c);

  const qtyOk = quantityContract.requestedLotsSupported && amountConversion.ok;
  const marginOk = marginAttestation.status === "VERIFIED";
  const liveAuth = input.evidenceSource === "live_broker" && input.sourceAuthoritative;

  let verdict: PositionFeasibilityVerdict = "UNVERIFIED";
  if (!liveAuth) verdict = "UNVERIFIED";
  else if (!qtyOk || blockers.has("OWNER_MAX_LOTS_BELOW_BROKER_MIN") || blockers.has("AMOUNT_NOT_INTEGER")) {
    verdict = "BLOCKED";
  } else if (!marginOk) {
    verdict = "UNVERIFIED";
  } else if (stage1Blockers.length > 0 || stage2Blockers.length > 0) {
    verdict = "BLOCKED";
  } else {
    verdict = "FEASIBLE_AT_OWNER_MAX";
  }

  const isXau = String(input.instrument).replace(/\s+/g, "").toUpperCase() === "XAU/USD";
  const xau = isXau
    ? explainXauOwnerLotIncompatibility({
      baseUnitSize: input.baseUnitSize,
      minQuantity: input.minQuantity,
      mmrPerLot: input.mmrPerLot,
    })
    : null;

  return {
    instrument: String(input.instrument),
    evidenceSource: input.evidenceSource,
    evidenceClass: evidenceClassOf(input.evidenceSource),
    metadata: {
      baseUnitSize: input.baseUnitSize,
      minQuantity: input.minQuantity,
      quantityIncrement: input.quantityIncrement,
      mmrPerLot: input.mmrPerLot,
      pointSize: input.pointSize ?? null,
      pipCostAccount: input.pipCostAccount ?? null,
      maxQuantity: input.maxQuantity ?? null,
      quantityUnitLabel: input.quantityUnitLabel ?? null,
      formula: "amount = baseUnitSize * lots",
      unitInterpretation: unitInterpretation(input.baseUnitSize, input.quantityUnitLabel ?? null),
    },
    ownerMaxLots: OWNER_MAX_QUANTITY,
    requestedLots: OWNER_MAX_QUANTITY,
    amountConversion,
    quantityContract,
    marginAttestation,
    marginEvidenceClass,
    estimatedRequiredMargin: marginAttestation.requiredMargin,
    usableMargin: input.usableMargin ?? null,
    riskPolicyPreserved: {
      perOrderRiskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
      perOrderRiskMaximumPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
      minTakeProfitR: 3,
      ownerMaxLots: OWNER_MAX_QUANTITY,
      mayRaiseOwnerMaxLots: false,
    },
    stage1Blockers: [...new Set(stage1Blockers)],
    stage2Blockers: [...new Set(stage2Blockers)],
    blockers: [...blockers],
    verdict,
    executionReady: false,
    placesOrders: false,
    mutatesBroker: false,
    note: xau
      ? xau.rootCauseSummary
      : (verdict === "FEASIBLE_AT_OWNER_MAX"
        ? "Owner 0.01 lots passes quantity+margin attestation under LIVE RO metadata (still non-submitting)."
        : `verdict=${verdict}; executionReady remains false.`),
  };
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export interface Stage3FeasibilityReport {
  schemaVersion: typeof STAGE3_FEASIBILITY_SCHEMA;
  stage: "STAGE_3_MARGIN_POSITION_FEASIBILITY";
  stage3Status: "PASS" | "NOT_RESOLVED";
  stage3EngineeringComplete: boolean;
  stage3LiveVerified: boolean;
  ownerMaxLots: typeof OWNER_MAX_QUANTITY;
  formula: "amount = baseUnitSize * lots";
  instruments: InstrumentPositionFeasibility[];
  trackedInstruments: Stage3TrackedInstrument[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  mayRaiseOwnerMaxLots: false;
  mayInventContractSize: false;
  note: string;
}

/**
 * Build Stage 3 report for the four tracked instruments.
 */
export function buildStage3FeasibilityReport(input: {
  rows: InstrumentBrokerMetadataInput[];
  spreadPolicyByInstrument?: Partial<Record<string, string>>;
  slippagePolicyByInstrument?: Partial<Record<string, string>>;
  dataModeByInstrument?: Partial<Record<string, string>>;
  marketClosed?: boolean | null;
}): Stage3FeasibilityReport {
  const byKey = new Map(input.rows.map((r) => [String(r.instrument).toUpperCase().replace(/\s+/g, ""), r]));
  const instruments = STAGE3_TRACKED_INSTRUMENTS.map((inst) => {
    const row = byKey.get(inst) ?? {
      instrument: inst,
      baseUnitSize: null,
      minQuantity: null,
      quantityIncrement: null,
      mmrPerLot: null,
      sourceAuthoritative: false,
      evidenceSource: "mock_fixture" as const,
      observedAtUtc: null,
    };
    return evaluateInstrumentPositionFeasibility(row, {
      spreadPolicyStatus: input.spreadPolicyByInstrument?.[inst] ?? "NOT_CONFIGURED",
      slippagePolicyStatus: input.slippagePolicyByInstrument?.[inst] ?? "NOT_CONFIGURED",
      dataMode: input.dataModeByInstrument?.[inst] ?? (input.marketClosed ? "MARKET_CLOSED" : "UNKNOWN"),
      marketClosed: input.marketClosed,
    });
  });

  const liveVerified = instruments.every(
    (i) => i.evidenceClass === "LIVE_BROKER_RO" && i.verdict === "FEASIBLE_AT_OWNER_MAX",
  );

  return {
    schemaVersion: STAGE3_FEASIBILITY_SCHEMA,
    stage: "STAGE_3_MARGIN_POSITION_FEASIBILITY",
    stage3Status: liveVerified ? "PASS" : "NOT_RESOLVED",
    stage3EngineeringComplete: true,
    stage3LiveVerified: liveVerified,
    ownerMaxLots: OWNER_MAX_QUANTITY,
    formula: "amount = baseUnitSize * lots",
    instruments,
    trackedInstruments: [...STAGE3_TRACKED_INSTRUMENTS],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    mayRaiseOwnerMaxLots: false,
    mayInventContractSize: false,
    note:
      "Stage 3 read-only feasibility. BLOCKED/UNVERIFIED preferred over unsafe sizing. "
      + "Owner max 0.01 lots never raised to meet broker mins. Stage 1/2 blockers remain visible.",
  };
}

/**
 * Documented DEMO probe values from Phase 4.9 / Phase 4.10 live catalog scan reports.
 * NOT a substitute for a fresh live_broker re-fetch — offline regression / documentation only.
 * Source: docs/forex/PHASE_4_10_DEMO_001_LOT_INSTRUMENT_DISCOVERY.md (+ Phase 4.9 XAU contract).
 */
export const DOCUMENTED_DEMO_INSTRUMENT_CONTRACTS: InstrumentBrokerMetadataInput[] = [
  {
    instrument: "EUR/USD",
    baseUnitSize: 1000,
    minQuantity: 1000,
    quantityIncrement: 1000,
    mmrPerLot: null,
    pointSize: 0.00001,
    sourceAuthoritative: false,
    evidenceSource: "documentation",
    observedAtUtc: null,
    quantityUnitLabel: "FXCM AMOUNT contracts (baseUnitSize×lots)",
  },
  {
    instrument: "GBP/USD",
    baseUnitSize: 1000,
    minQuantity: 1000,
    quantityIncrement: 1000,
    mmrPerLot: null,
    pointSize: 0.00001,
    sourceAuthoritative: false,
    evidenceSource: "documentation",
    observedAtUtc: null,
    quantityUnitLabel: "FXCM AMOUNT contracts (baseUnitSize×lots)",
  },
  {
    instrument: "USD/JPY",
    baseUnitSize: 1000,
    minQuantity: 1000,
    quantityIncrement: 1000,
    mmrPerLot: null,
    pointSize: 0.001,
    sourceAuthoritative: false,
    evidenceSource: "documentation",
    observedAtUtc: null,
    quantityUnitLabel: "FXCM AMOUNT contracts (baseUnitSize×lots)",
  },
  {
    instrument: "XAU/USD",
    baseUnitSize: 1,
    minQuantity: 1,
    quantityIncrement: 1,
    mmrPerLot: 4.42,
    pointSize: 0.01,
    pipCostAccount: 0.01,
    sourceAuthoritative: false,
    evidenceSource: "documentation",
    observedAtUtc: null,
    quantityUnitLabel: "FXCM AMOUNT contracts (not assumed ounces)",
  },
];
