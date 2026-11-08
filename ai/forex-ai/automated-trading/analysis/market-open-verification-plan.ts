/**
 * Stage 7.3 — Market-open verification plan for the four tracked FX instruments.
 * Markets closed ≠ application failure. Historical/synthetic results must stay labelled.
 * Never fabricates PROPOSAL_READY as live.
 */
import { STAGE3_TRACKED_INSTRUMENTS, type Stage3TrackedInstrument } from "../risk-policy/types.js";

export type PipelineStepProvenance =
  | "HISTORICAL"
  | "SYNTHETIC_TEST_DATA"
  | "LIVE"
  | "NOT_RUN";

export interface MarketOpenInstrumentGate {
  instrument: Stage3TrackedInstrument;
  requireFreshQuoteChange: true;
  requireQuoteTimestampUtc: true;
  requireProvenanceLive: true;
  requireSpreadObservationNotStale: true;
  maxQuoteAgeMs: number;
  mayUseStaleWeekendCache: false;
}

export interface CanonicalPipelineVerificationPlan {
  instruments: Stage3TrackedInstrument[];
  marketClosedIsNotAppFailure: true;
  historicalTestingAllowed: true;
  mayLabelHistoricalAsLiveProposal: false;
  mayFabricateProposalReadyAsLive: false;
  steps: Array<{
    id: string;
    name: string;
    allowedOfflineProvenance: PipelineStepProvenance[];
    marketOpenRequiredForLive: boolean;
  }>;
  marketOpenGates: MarketOpenInstrumentGate[];
  ownerApprovalsBeforeLiveCanonicalProposal: string[];
  note: string;
}

export const MARKET_OPEN_MAX_QUOTE_AGE_MS = 30_000;

export function getCanonicalPipelineVerificationPlan(): CanonicalPipelineVerificationPlan {
  const steps: CanonicalPipelineVerificationPlan["steps"] = [
    {
      id: "market_data",
      name: "Market Data",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: true,
    },
    {
      id: "historical_data",
      name: "Historical Data",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "market_structure",
      name: "Market Structure",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "technical_analysis",
      name: "Technical Analysis",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "mtf_analysis",
      name: "Multi-Timeframe Analysis",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "ai_reasoning",
      name: "AI Reasoning",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "trade_scenario",
      name: "Trade Scenario",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "proposal_construction",
      name: "Proposal Construction",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "risk_validation",
      name: "Risk Validation",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
    {
      id: "proposal_persistence",
      name: "Proposal Persistence",
      allowedOfflineProvenance: ["HISTORICAL", "SYNTHETIC_TEST_DATA"],
      marketOpenRequiredForLive: false,
    },
  ];

  return {
    instruments: [...STAGE3_TRACKED_INSTRUMENTS],
    marketClosedIsNotAppFailure: true,
    historicalTestingAllowed: true,
    mayLabelHistoricalAsLiveProposal: false,
    mayFabricateProposalReadyAsLive: false,
    steps,
    marketOpenGates: STAGE3_TRACKED_INSTRUMENTS.map((instrument) => ({
      instrument,
      requireFreshQuoteChange: true as const,
      requireQuoteTimestampUtc: true as const,
      requireProvenanceLive: true as const,
      requireSpreadObservationNotStale: true as const,
      maxQuoteAgeMs: MARKET_OPEN_MAX_QUOTE_AGE_MS,
      mayUseStaleWeekendCache: false as const,
    })),
    ownerApprovalsBeforeLiveCanonicalProposal: [
      "Approved absolute_price spread + slippage policies for all four instruments",
      "Confirm market-open LIVE quote provenance per instrument",
      "Separate approval before any DEMO order submission / margin proposed-order probe that mutates",
    ],
    note:
      "While FX is closed, exercise the pipeline only with HISTORICAL/SYNTHETIC_TEST_DATA labels. "
      + "At market open, verify fresh quote changes + timestamps + LIVE provenance before any live canonical proposal claim.",
  };
}

/**
 * Classify a proposal result for operator reporting.
 * Historical fixtures must never be reported as live PROPOSAL_READY.
 */
export function classifyProposalProvenanceLabel(input: {
  dataProvenance: PipelineStepProvenance;
  lifecycle: string | null | undefined;
}): {
  reportAsLiveProposal: boolean;
  label: string;
  note: string;
} {
  const lifecycle = String(input.lifecycle || "");
  if (input.dataProvenance === "LIVE") {
    return {
      reportAsLiveProposal: lifecycle === "PROPOSAL_READY",
      label: lifecycle === "PROPOSAL_READY" ? "LIVE_PROPOSAL_READY" : `LIVE_${lifecycle || "UNKNOWN"}`,
      note: "Live provenance — lifecycle reported as-is.",
    };
  }
  if (input.dataProvenance === "HISTORICAL" || input.dataProvenance === "SYNTHETIC_TEST_DATA") {
    return {
      reportAsLiveProposal: false,
      label: `${input.dataProvenance}_${lifecycle || "RESULT"}`,
      note: "Historical/synthetic result — do not label as live PROPOSAL_READY.",
    };
  }
  return {
    reportAsLiveProposal: false,
    label: `NOT_LIVE_${lifecycle || "UNKNOWN"}`,
    note: "Missing LIVE provenance — refuse live proposal claim.",
  };
}
