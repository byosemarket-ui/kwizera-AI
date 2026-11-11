/**
 * Stage 2 — Authoritative canonical analysis → proposal pipeline report.
 * One auditable view. Never invents SL/TP/size. Never submits broker orders.
 * Propagates Stage 1 spread/slippage blockers. Historical ≠ live PROPOSAL_READY.
 */
import {
  classifyMarketDataMode,
  type DataModeClassification,
  type MarketDataMode,
} from "../analysis/data-mode.js";
import { classifyProposalProvenanceLabel } from "../analysis/market-open-verification-plan.js";
import type { CanonicalAnalysisResult } from "../analysis/canonical-analysis.types.js";
import type { AtOrderProposalRecord } from "./types.js";
import {
  SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION,
} from "../risk-policy/slippage-evidence.js";
import { usesDynamicPerTradeSpreadEligibility } from "../risk-policy/types.js";

export const STAGE2_CANONICAL_PIPELINE_SCHEMA = "kwizera.at-canonical-pipeline.v1" as const;

export type ProposalDisplayStatus =
  | "WATCHING"
  | "BLOCKED"
  | "WAITING"
  | "READY"
  | "NO_PROPOSAL";

export interface Stage1BlockerPropagation {
  WAITING_FOR_LIVE_MARKET: boolean;
  WAITING_FOR_CONTROLLED_DEMO_EVIDENCE: boolean;
  WAITING_FOR_OWNER_APPROVAL: boolean;
  codes: string[];
}

export interface CanonicalPipelineReport {
  schemaVersion: typeof STAGE2_CANONICAL_PIPELINE_SCHEMA;
  stage: "STAGE_2_CANONICAL_PROPOSAL_PIPELINE";
  stage2EngineeringComplete: boolean;
  stage2LiveVerified: boolean;
  stage2Status: "PASS" | "NOT_RESOLVED";
  instrument: string | null;
  dataMode: MarketDataMode;
  dataModeClassification: DataModeClassification;
  dataSource: string | null;
  dataTimestamps: {
    quoteEvaluatedAtUtc: string | null;
    analyzedAtUtc: string | null;
    proposalUpdatedAtUtc: string | null;
  };
  timeframesUsed: string[];
  marketDirection: "BUY" | "SELL" | null;
  confidencePct: number | null;
  confidenceDefinition: "ANALYSIS_CONFIDENCE — not a calibrated win probability";
  scenarios: {
    bullish: { present: boolean; note: string };
    bearish: { present: boolean; note: string };
  };
  entryZone: { low: number | null; high: number | null; entryPrice: number | null };
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  invalidationConditions: string[];
  spreadPolicyStatus: string | null;
  slippagePolicyStatus: string | null;
  perOrderRiskStatus: string | null;
  positionSizingStatus: string | null;
  marginVerificationStatus: string | null;
  proposalId: string | null;
  proposalLifecycle: string | null;
  displayStatus: ProposalDisplayStatus;
  displayReasons: string[];
  stage1: Stage1BlockerPropagation;
  reportAsLiveProposal: boolean;
  reportLabel: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

function policyWaiting(status: string | null | undefined): boolean {
  const s = String(status || "").toUpperCase();
  return !s || s === "NOT_CONFIGURED" || s === "INVALID" || s === "UNAVAILABLE" || s === "PENDING_APPROVAL";
}

function instrumentFromReportInput(input: {
  analysis?: { instrument?: string | null } | null;
  proposal?: { instrument?: string | null } | null;
}): string | null {
  return input.proposal?.instrument ?? input.analysis?.instrument ?? null;
}

/**
 * Build Stage 2 pipeline report from existing analysis + proposal artifacts.
 * Incomplete fields stay null — never invented.
 */
export function buildCanonicalPipelineReport(input: {
  analysis?: CanonicalAnalysisResult | null;
  proposal?: AtOrderProposalRecord | null;
  marketClosed?: boolean | null;
  cachedSnapshot?: boolean | null;
  syntheticOrTest?: boolean | null;
  historicalOnly?: boolean | null;
  spreadPolicyStatus?: string | null;
  slippagePolicyStatus?: string | null;
  slippageFillEvidenceAvailable?: boolean | null;
  perOrderRiskStatus?: string | null;
  positionSizingStatus?: string | null;
  marginVerificationStatus?: string | null;
}): CanonicalPipelineReport {
  const analysis = input.analysis ?? null;
  const proposal = input.proposal ?? null;

  const historicalOnly =
    input.historicalOnly
    ?? (analysis?.dataQuality === "INSUFFICIENT" && analysis?.quote?.quoteFresh !== true
      ? true
      : null);

  const inferredProvenance = input.cachedSnapshot
    ? "CACHED"
    : input.syntheticOrTest
      ? "SYNTHETIC_TEST_DATA"
      : historicalOnly === true
        ? "HISTORICAL"
        : analysis?.quote?.quoteFresh === true
          ? "LIVE"
          : analysis?.quote?.quoteFresh === false
            ? "STALE"
            : "UNKNOWN";

  const dataModeClassification = classifyMarketDataMode({
    marketClosed: input.marketClosed,
    cachedSnapshot: input.cachedSnapshot,
    syntheticOrTest: input.syntheticOrTest,
    quoteFresh: analysis?.quote?.quoteFresh ?? null,
    historicalOnly,
    freshnessOverall: analysis?.dataQuality ?? null,
    quoteProvenance: inferredProvenance,
    candleIsHistoricalSeries: true,
  });

  const spreadStatus = input.spreadPolicyStatus ?? null;
  const slipStatus = input.slippagePolicyStatus ?? null;
  const stage1Codes: string[] = [];
  if (input.marketClosed === true || dataModeClassification.code === "WAITING_FOR_LIVE_MARKET") {
    stage1Codes.push("WAITING_FOR_LIVE_MARKET");
  }
  if (input.slippageFillEvidenceAvailable === false || input.slippageFillEvidenceAvailable == null) {
    stage1Codes.push(SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION);
    stage1Codes.push("WAITING_FOR_CONTROLLED_DEMO_EVIDENCE");
  }
  // ACTIVE XAU: fixed spread ceiling governance is informational only — do not
  // block pipeline display on PENDING/NOT_CONFIGURED maxSpreadAbsolute.
  const dynamicSpreadPrimary = usesDynamicPerTradeSpreadEligibility(
    instrumentFromReportInput(input),
  );
  const spreadBlocksOwnerWait = !dynamicSpreadPrimary && policyWaiting(spreadStatus);
  if (spreadBlocksOwnerWait || policyWaiting(slipStatus)) {
    stage1Codes.push("WAITING_FOR_OWNER_APPROVAL");
  }

  const stage1: Stage1BlockerPropagation = {
    WAITING_FOR_LIVE_MARKET: stage1Codes.includes("WAITING_FOR_LIVE_MARKET"),
    WAITING_FOR_CONTROLLED_DEMO_EVIDENCE: stage1Codes.includes("WAITING_FOR_CONTROLLED_DEMO_EVIDENCE"),
    WAITING_FOR_OWNER_APPROVAL: stage1Codes.includes("WAITING_FOR_OWNER_APPROVAL"),
    codes: [...new Set(stage1Codes)],
  };

  const provenanceLabel = classifyProposalProvenanceLabel({
    dataProvenance:
      dataModeClassification.dataMode === "LIVE"
        ? "LIVE"
        : dataModeClassification.dataMode === "SYNTHETIC" || dataModeClassification.dataMode === "TEST"
          ? "SYNTHETIC_TEST_DATA"
          : dataModeClassification.dataMode === "HISTORICAL" || dataModeClassification.dataMode === "CACHED"
            || dataModeClassification.dataMode === "STALE" || dataModeClassification.dataMode === "MARKET_CLOSED"
            ? "HISTORICAL"
            : "NOT_RUN",
    lifecycle: proposal?.lifecycle ?? null,
  });

  const displayReasons: string[] = [...dataModeClassification.reasons, ...stage1.codes];
  let displayStatus: ProposalDisplayStatus = "NO_PROPOSAL";

  if (!proposal) {
    displayStatus = analysis ? "WATCHING" : "NO_PROPOSAL";
    if (!analysis) displayReasons.push("No canonical analysis or proposal present.");
    else displayReasons.push(`Analysis finalOutcome=${analysis.finalOutcome}; no proposal constructed.`);
  } else if (proposal.lifecycle === "BLOCKED" || proposal.lifecycle === "REJECTED") {
    displayStatus = "BLOCKED";
    displayReasons.push(...proposal.blockers.map((b) => `${b.code}: ${b.message}`));
  } else if (
    proposal.lifecycle === "PROPOSAL_READY"
    && dataModeClassification.mayClaimLiveProposalReady
    && stage1.codes.length === 0
  ) {
    displayStatus = "READY";
    displayReasons.push("Proposal READY under LIVE data with Stage 1 policies satisfied (still non-submitting).");
  } else if (proposal.lifecycle === "PROPOSAL_READY") {
    displayStatus = "WAITING";
    displayReasons.push(
      "Internal lifecycle PROPOSAL_READY exists but LIVE claim / Stage 1 gates block executable readiness.",
    );
    if (!dataModeClassification.mayClaimLiveProposalReady) {
      displayReasons.push(`dataMode=${dataModeClassification.dataMode} — not reportable as live READY.`);
    }
  } else if (
    proposal.lifecycle === "RECEIVED"
    || proposal.lifecycle === "CALCULATING"
    || proposal.lifecycle === "VALIDATING"
  ) {
    displayStatus = "WAITING";
  } else {
    displayStatus = "WATCHING";
  }

  const timeframes: string[] = [];
  if (analysis?.primaryTimeframe) timeframes.push(analysis.primaryTimeframe);
  if (analysis?.htf?.confirmationTimeframes?.length) {
    timeframes.push(...analysis.htf.confirmationTimeframes);
  }
  if (proposal?.timeframe && !timeframes.includes(proposal.timeframe)) {
    timeframes.push(proposal.timeframe);
  }

  const interp = analysis?.marketInterpretation ?? null;
  const bullishPresent = interp === "BULLISH" || analysis?.direction === "BUY"
    || analysis?.finalOutcome === "BUY_CANDIDATE";
  const bearishPresent = interp === "BEARISH" || analysis?.direction === "SELL"
    || analysis?.finalOutcome === "SELL_CANDIDATE";

  const liveVerified =
    dataModeClassification.dataMode === "LIVE"
    && displayStatus === "READY"
    && stage1.codes.length === 0;

  return {
    schemaVersion: STAGE2_CANONICAL_PIPELINE_SCHEMA,
    stage: "STAGE_2_CANONICAL_PROPOSAL_PIPELINE",
    stage2EngineeringComplete: true,
    stage2LiveVerified: liveVerified,
    stage2Status: liveVerified ? "PASS" : "NOT_RESOLVED",
    instrument: proposal?.instrument ?? analysis?.instrument ?? null,
    dataMode: dataModeClassification.dataMode,
    dataModeClassification,
    dataSource: analysis?.provider ?? null,
    dataTimestamps: {
      quoteEvaluatedAtUtc: analysis?.quote?.evaluatedAtUtc ?? null,
      analyzedAtUtc: analysis?.analyzedAtUtc ?? null,
      proposalUpdatedAtUtc: proposal?.updatedAtUtc ?? null,
    },
    timeframesUsed: [...new Set(timeframes)],
    marketDirection: proposal?.direction === "BUY" || proposal?.direction === "SELL"
      ? proposal.direction
      : analysis?.direction ?? null,
    confidencePct: proposal?.analysisConfidencePct ?? analysis?.confidencePct ?? null,
    confidenceDefinition: "ANALYSIS_CONFIDENCE — not a calibrated win probability",
    scenarios: {
      bullish: {
        present: !!bullishPresent,
        note: bullishPresent
          ? "Bullish scenario indicated by analysis interpretation/outcome."
          : "No bullish candidate asserted (fields not invented).",
      },
      bearish: {
        present: !!bearishPresent,
        note: bearishPresent
          ? "Bearish scenario indicated by analysis interpretation/outcome."
          : "No bearish candidate asserted (fields not invented).",
      },
    },
    entryZone: {
      low: proposal?.pricePlan?.entryZoneLow ?? null,
      high: proposal?.pricePlan?.entryZoneHigh ?? null,
      entryPrice: proposal?.pricePlan?.entryPrice ?? null,
    },
    stopLoss: proposal?.pricePlan?.stopLoss ?? null,
    takeProfit: proposal?.pricePlan?.takeProfit ?? null,
    riskRewardRatio: proposal?.pricePlan?.plannedRewardRiskRatio ?? null,
    invalidationConditions: proposal?.pricePlan?.invalidationConditions ?? [],
    spreadPolicyStatus: spreadStatus,
    slippagePolicyStatus: slipStatus,
    perOrderRiskStatus: input.perOrderRiskStatus
      ?? proposal?.perOrderRisk?.lifecycle
      ?? null,
    positionSizingStatus: input.positionSizingStatus
      ?? (proposal?.quantity?.normalizedQuantity != null ? "SIZED" : "NOT_SIZED"),
    marginVerificationStatus: input.marginVerificationStatus
      ?? (proposal?.quantity?.estimatedMargin != null ? "ESTIMATED" : "UNVERIFIED"),
    proposalId: proposal?.proposalId ?? null,
    proposalLifecycle: proposal?.lifecycle ?? null,
    displayStatus,
    displayReasons: displayReasons.slice(0, 24),
    stage1,
    reportAsLiveProposal: provenanceLabel.reportAsLiveProposal && dataModeClassification.mayClaimLiveProposalReady,
    reportLabel: provenanceLabel.label,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "Stage 2 canonical pipeline report. Non-submitting. "
      + "PROPOSAL_READY lifecycle under HISTORICAL/CACHED/TEST data is not a live executable claim. "
      + "Stage 1 spread/slippage blockers remain enforced.",
  };
}

/**
 * Fail-closed: incomplete price plan cannot become an executable-ready display.
 */
export function validateProposalPriceCompleteness(proposal: AtOrderProposalRecord | null | undefined): {
  complete: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  if (!proposal) return { complete: false, blockers: ["PROPOSAL_MISSING"] };
  if (proposal.pricePlan?.entryPrice == null && proposal.pricePlan?.entryZoneLow == null) {
    blockers.push("ENTRY_MISSING");
  }
  if (proposal.pricePlan?.stopLoss == null) blockers.push("STOP_LOSS_MISSING");
  if (proposal.pricePlan?.takeProfit == null) blockers.push("TAKE_PROFIT_MISSING");
  return { complete: blockers.length === 0, blockers };
}
