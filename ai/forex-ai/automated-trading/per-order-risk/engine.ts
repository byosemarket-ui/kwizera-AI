/**
 * Stage 5 — Automated Per-Order Risk Management Engine.
 * Derives levels → builds proposal via existing order-proposal engine → monetary 3R → risk record.
 * Never places, submits, modifies, or cancels broker orders.
 */
import { randomUUID } from "node:crypto";
import type { AtBinaryDirection } from "../analysis/direction.js";
import {
  buildOrderProposal,
  type BuildOrderProposalInput,
} from "../order-proposal/engine.js";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import type { AnalysisPriceLevelLite } from "../simulation-risk/propose-levels.js";
import { deriveAutomaticOrderLevels } from "./auto-levels.js";
import { buildPerOrderRiskRecord } from "./build-record.js";
import { validateMonetaryRewardToRisk } from "./monetary-3r.js";
import type { PerOrderRiskRecord, PerOrderRiskRejection } from "./types.js";

export interface RunPerOrderRiskEngineInput extends Omit<BuildOrderProposalInput, "entryPrice" | "stopLoss"> {
  entryPrice?: number | null;
  stopLoss?: number | null;
  /** When true (default), auto-derive missing Entry/SL/TP from quote + structure + ATR. */
  autoLevels?: boolean;
  bid?: number | null;
  ask?: number | null;
  mid?: number | null;
  quoteFresh?: boolean | null;
  supportLevels?: AnalysisPriceLevelLite[] | null;
  resistanceLevels?: AnalysisPriceLevelLite[] | null;
  atrValue?: number | null;
  atrMethod?: string | null;
  atrMultiplier?: number | null;
  marketDataTimestampUtc?: string | null;
  spreadAtCalculation?: number | null;
  spreadPolicyStatus?: string | null;
  slippagePolicyStatus?: string | null;
  contractMetadataVersion?: string | null;
  costDataVerified?: boolean | null;
  estimatedCostsAccount?: number | null;
  /** Pre-assigned allocation identity; generated when omitted. */
  allocationId?: string | null;
}

export interface RunPerOrderRiskEngineResult {
  proposal: AtOrderProposalRecord & { perOrderRisk: PerOrderRiskRecord };
  perOrderRisk: PerOrderRiskRecord;
  allocationId: string;
  levelsAutoDerived: boolean;
  entrySource: string | null;
  stopLossSource: string | null;
  takeProfitSource: string | null;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Run the Stage 5 automated per-order risk pipeline.
 * Does not submit to broker. Does not enable Execution Master.
 */
export function runAutomatedPerOrderRiskEngine(
  input: RunPerOrderRiskEngineInput,
): RunPerOrderRiskEngineResult {
  const allocationId = String(input.allocationId || "").trim() || randomUUID();
  const autoLevels = input.autoLevels !== false;
  const extraRejections: PerOrderRiskRejection[] = [];
  let levelsAutoDerived = false;
  let entrySource: string | null = null;
  let stopLossSource: string | null = null;
  let takeProfitSource: string | null = null;
  let structureUsed = false;
  let atrValue: number | null = finitePositive(input.atrValue) ? input.atrValue : null;
  let atrMethod: string | null = input.atrMethod ?? null;

  let entryPrice = finitePositive(input.entryPrice) ? input.entryPrice : null;
  let stopLoss = finitePositive(input.stopLoss) ? input.stopLoss : null;
  let takeProfitOverride: number | null = null;

  const direction: AtBinaryDirection | null =
    input.handoff?.canonicalDirection === "BUY" || input.handoff?.canonicalDirection === "SELL"
      ? input.handoff.canonicalDirection
      : input.canonicalDecision === "BUY" || input.canonicalDecision === "SELL"
        ? input.canonicalDecision
        : null;

  const needsLevels = entryPrice == null || stopLoss == null;

  if (autoLevels && needsLevels) {
    const digits = input.contract?.digits
      ?? (finitePositive(input.contract?.pointSize)
        ? Math.max(0, Math.round(-Math.log10(input.contract!.pointSize!)))
        : null);
    const derived = deriveAutomaticOrderLevels({
      direction,
      bid: input.bid,
      ask: input.ask,
      mid: input.mid,
      quoteFresh: input.quoteFresh,
      supportLevels: input.supportLevels,
      resistanceLevels: input.resistanceLevels,
      atrValue: input.atrValue,
      atrMethod: input.atrMethod,
      atrMultiplier: input.atrMultiplier,
      digits,
      entryOverride: entryPrice,
      stopLossOverride: stopLoss,
    });
    levelsAutoDerived = true;
    if (derived.ok) {
      entryPrice = derived.entryPrice;
      stopLoss = derived.stopLoss;
      takeProfitOverride = derived.takeProfit;
      entrySource = derived.entrySource;
      stopLossSource = derived.stopLossSource;
      takeProfitSource = derived.takeProfitSource;
      structureUsed = derived.structureUsed;
      atrValue = derived.atrValue;
      atrMethod = derived.atrMethod;
    } else {
      entrySource = derived.entryPrice != null ? "partial" : null;
      if (derived.waitingForValidStopLoss || derived.code === "WAITING_FOR_VALID_STOP_LOSS") {
        extraRejections.push({
          code: "WAITING_FOR_VALID_STOP_LOSS",
          message: derived.message,
          instrument: input.instrument ?? input.handoff?.instrument ?? null,
        });
      } else if (derived.code === "ENTRY_UNAVAILABLE" || derived.code.startsWith("PROPOSE_ENTRY")) {
        extraRejections.push({
          code: derived.code === "PROPOSE_ENTRY_QUOTE_STALE" ? "MARKET_DATA_STALE" : "ENTRY_UNAVAILABLE",
          message: derived.message,
          instrument: input.instrument ?? input.handoff?.instrument ?? null,
        });
      } else {
        extraRejections.push({
          code: derived.code,
          message: derived.message,
          instrument: input.instrument ?? input.handoff?.instrument ?? null,
        });
      }
      if (derived.entryPrice != null) entryPrice = derived.entryPrice;
      if (derived.stopLoss != null) stopLoss = derived.stopLoss;
    }
  } else if (finitePositive(input.entryPrice) && finitePositive(input.stopLoss)) {
    entrySource = "explicit";
    stopLossSource = "explicit";
    takeProfitSource = "engine-3R";
  }

  const built = buildOrderProposal({
    ...input,
    entryPrice,
    stopLoss,
  });

  // Attach provenance notes
  if (levelsAutoDerived) {
    built.notes.push(
      `STAGE_5_AUTO_LEVELS: entry=${entrySource ?? "n/a"}; stopLoss=${stopLossSource ?? "n/a"}; `
      + `takeProfit=${takeProfitSource ?? "n/a"}.`,
    );
  }
  built.notes.push(
    `STAGE_5_ALLOCATION_ID=${allocationId} — independent per-order capital/risk budget.`,
  );
  built.notes.push(
    "STAGE_5: Modeled SL risk ≠ guaranteed realized loss (gaps/slippage). No broker mutation.",
  );

  // Merge waiting / level failures into blockers when proposal would otherwise look incomplete.
  for (const r of extraRejections) {
    if (!built.blockers.some((b) => String(b.code) === String(r.code))) {
      built.blockers.push({ code: r.code, message: r.message });
      if (built.lifecycle === "PROPOSAL_READY") {
        built.lifecycle = "BLOCKED";
      }
    }
  }

  // Monetary 3R validation after quantity sizing (price-distance 3R already applied in engine).
  let expectedMonetaryProfit: number | null = null;
  let actualRewardToRiskRatio: number | null = built.pricePlan.plannedRewardRiskRatio;
  let monetary3rOk: boolean | null = null;

  if (
    built.lifecycle === "PROPOSAL_READY"
    && built.quantity.normalizedQuantity != null
    && built.pricePlan.entryPrice != null
    && built.pricePlan.stopLoss != null
    && built.pricePlan.takeProfit != null
  ) {
    // Prefer engine TP; if auto-levels produced TP, ensure it matches price plan.
    if (takeProfitOverride != null && built.pricePlan.takeProfit == null) {
      built.pricePlan.takeProfit = takeProfitOverride;
    }
    const m3r = validateMonetaryRewardToRisk({
      direction: built.direction,
      entryPrice: built.pricePlan.entryPrice,
      stopLoss: built.pricePlan.stopLoss,
      takeProfit: built.pricePlan.takeProfit,
      quantity: built.quantity.normalizedQuantity,
      contract: input.contract,
      costDataVerified: input.costDataVerified,
      estimatedCostsAccount: input.estimatedCostsAccount,
    });
    if (!m3r.ok) {
      monetary3rOk = false;
      built.lifecycle = "BLOCKED";
      built.blockers.push({ code: m3r.code, message: m3r.message });
      built.quantity.normalizedQuantity = null;
      built.brokerPrep.amountQuantity = null;
      built.capital.riskValidationStatus = "FAIL";
      expectedMonetaryProfit = m3r.expectedMonetaryProfit;
      actualRewardToRiskRatio = m3r.actualRewardToRiskRatio;
      extraRejections.push({
        code: m3r.code,
        message: m3r.message,
        instrument: built.instrument,
        proposalId: built.proposalId,
        actual: m3r.actualRewardToRiskRatio,
        required: 3,
      });
    } else {
      monetary3rOk = true;
      expectedMonetaryProfit = m3r.expectedMonetaryProfit;
      actualRewardToRiskRatio = m3r.actualRewardToRiskRatio;
      built.notes.push(`STAGE_5_MONETARY_3R: ratio=${m3r.actualRewardToRiskRatio.toFixed(4)}; ${m3r.costsNote}`);
    }
  } else if (built.lifecycle === "PROPOSAL_READY") {
    // Incomplete geometry despite READY — fail closed.
    monetary3rOk = false;
    built.lifecycle = "BLOCKED";
    built.blockers.push({
      code: "MONETARY_3R_UNVERIFIED",
      message: "Proposal marked ready without complete prices/quantity for monetary 3R — blocked.",
    });
  }

  const perOrderRisk = buildPerOrderRiskRecord({
    proposal: built,
    allocationId,
    accountIdMasked: input.accountIdMasked,
    marketDataTimestampUtc: input.marketDataTimestampUtc,
    spreadAtCalculation: input.spreadAtCalculation,
    spreadPolicyStatus: input.spreadPolicyStatus,
    slippagePolicyStatus: input.slippagePolicyStatus,
    contractMetadataVersion: input.contractMetadataVersion,
    expectedMonetaryProfit,
    actualRewardToRiskRatio,
    monetary3rOk,
    levelProvenance: {
      entrySource,
      stopLossSource,
      takeProfitSource,
      atrValue,
      atrMethod,
      structureUsed,
    },
    extraRejections,
    nowMs: input.nowMs,
  });

  const proposal = Object.assign(built, { perOrderRisk }) as AtOrderProposalRecord & {
    perOrderRisk: PerOrderRiskRecord;
  };

  return {
    proposal,
    perOrderRisk,
    allocationId,
    levelsAutoDerived,
    entrySource,
    stopLossSource,
    takeProfitSource,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
  };
}
