/**
 * Step 2 — Orchestrate proposal generation with persistence + idempotency.
 */
import type { ConversionRateSnapshot } from "../simulation-risk/currency-conversion.js";
import type { AtSimContractMetaInput } from "../simulation-risk/types.js";
import type { AtOrderPreparationHandoff } from "../result-intake/types.js";
import { buildOrderProposal } from "./engine.js";
import { getAtOrderProposalStore } from "./store.js";
import {
  AT_ORDER_PROPOSAL_PHASE,
  AT_ORDER_PROPOSAL_SCHEMA,
  type AtOrderProposalPublicStatus,
  type AtOrderProposalRecord,
} from "./types.js";

export interface GenerateOrderProposalInput {
  handoff: AtOrderPreparationHandoff | null;
  canonicalDecision?: "BUY" | "SELL" | "NO_TRADE" | null;
  entryPrice?: number | null;
  entryZoneLow?: number | null;
  entryZoneHigh?: number | null;
  stopLoss?: number | null;
  verifiedEquity?: number | null;
  accountCurrency?: string | null;
  equityFresh?: boolean | null;
  usableMargin?: number | null;
  usedMargin?: number | null;
  marginFresh?: boolean | null;
  accountIdMasked?: string | null;
  strategyAllocationPercent?: number | null;
  individualOrderAllocation?: number | null;
  allocationCurrency?: string | null;
  existingCommittedExposure?: number | null;
  pendingProposalReservations?: number | null;
  contract?: AtSimContractMetaInput | null;
  contractFresh?: boolean | null;
  sdkMinQuantity?: number | null;
  legacyLotStep?: number | null;
  marginPerUnitAccount?: number | null;
  brokerMaxQuantity?: number | null;
  exposureAuthoritative?: boolean | null;
  existingExposure?: number | null;
  maxExposureLimit?: number | null;
  conversionRateSnapshot?: ConversionRateSnapshot | null;
  systemMasterOn?: boolean | null;
  tradingEnabled?: boolean | null;
  emergencyEntryLock?: boolean | null;
  environment?: "DEMO" | "LIVE" | null;
  timeframe?: string | null;
  strategyId?: string | null;
  strategyRationale?: string[];
  supportingEvidence?: string[];
  conflictingEvidence?: string[];
  analysisConfidencePct?: number | null;
  confidenceCalibrationFlag?: boolean;
  invalidationConditions?: string[];
  nowMs?: number;
  /** When false, do not persist (unit tests). Default true. */
  persist?: boolean;
}

export function getOrderProposalPublicStatus(
  storageRoot?: string,
): AtOrderProposalPublicStatus {
  const store = getAtOrderProposalStore(storageRoot);
  const readyCount = store.list(80).filter((p) => p.lifecycle === "PROPOSAL_READY").length;
  return {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    latest: store.latest(),
    allocationConfig: store.getAllocationConfig(),
    activeReservationTotal: store.activeReservationTotal(),
    activeProposalCount: readyCount,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "ORDER PROPOSAL stage only. Capital allocation % persists in Automated Trading controls. "
      + "Per-order allocation persists here. Never places broker orders.",
  };
}

export function generateOrderProposalFromHandoff(
  input: GenerateOrderProposalInput,
  storageRoot?: string,
): { record: AtOrderProposalRecord; duplicate: boolean } {
  const store = getAtOrderProposalStore(storageRoot);
  const cfg = store.getAllocationConfig();
  const pending =
    input.pendingProposalReservations !== undefined && input.pendingProposalReservations !== null
      ? input.pendingProposalReservations
      : store.activeReservationTotal();

  const individualOrderAllocation =
    input.individualOrderAllocation !== undefined
      ? input.individualOrderAllocation
      : cfg.individualOrderAllocation;

  const built = buildOrderProposal({
    ...input,
    individualOrderAllocation,
    allocationCurrency: input.allocationCurrency ?? cfg.allocationCurrency,
    pendingProposalReservations: pending,
    existingCommittedExposure: input.existingCommittedExposure ?? 0,
    configVersion: cfg.configVersion,
    allocationUpdatedAtUtc: cfg.updatedAtUtc,
  });

  if (input.persist === false) {
    return { record: built, duplicate: false };
  }

  return store.upsertProposal(built);
}
