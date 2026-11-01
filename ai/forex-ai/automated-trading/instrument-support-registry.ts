/**
 * Phase 4.14B — Central instrument capability registry (market data vs execution).
 * Never invents broker contract fields. Quote support ≠ execution support.
 */
import { isInstrumentAllowlisted } from "./simulation-risk/allowlist.js";

export type InstrumentSupportState =
  | "DISCOVERED"
  | "METADATA_VERIFIED"
  | "QUOTE_SUPPORTED"
  | "HISTORY_SUPPORTED"
  | "ANALYSIS_SUPPORTED"
  | "EXECUTION_SUPPORTED"
  | "EXECUTION_BLOCKED"
  | "UNSUPPORTED";

export interface InstrumentSupportAssessment {
  provider: "FOREXCONNECT";
  symbol: string;
  providerSymbol: string;
  inCatalog: boolean;
  quoteSupported: boolean;
  historySupported: boolean;
  analysisSupported: boolean;
  /** True only when allowlisted AND quantity/margin gates are independently verified — never invent. */
  executionCandidateAllowlisted: boolean;
  executionSupported: false;
  executionBlocked: true;
  states: InstrumentSupportState[];
  blockers: string[];
  note: string;
}

/**
 * Assess capabilities from catalog presence. Execution always blocked here —
 * quantity/MMR gates live elsewhere and must remain fail-closed for 0.01 lots.
 */
export function assessForexConnectInstrumentSupport(input: {
  symbol: string | null | undefined;
  catalogOk: boolean | null | undefined;
  catalogHasSymbol: boolean;
}): InstrumentSupportAssessment {
  const symbol = String(input.symbol ?? "").trim();
  const blockers: string[] = [];
  const states: InstrumentSupportState[] = [];

  if (!symbol) {
    return {
      provider: "FOREXCONNECT",
      symbol: "",
      providerSymbol: "",
      inCatalog: false,
      quoteSupported: false,
      historySupported: false,
      analysisSupported: false,
      executionCandidateAllowlisted: false,
      executionSupported: false,
      executionBlocked: true,
      states: ["UNSUPPORTED"],
      blockers: ["INSTRUMENT_MISSING"],
      note: "No instrument selected.",
    };
  }

  states.push("DISCOVERED");
  const inCatalog = Boolean(input.catalogOk) && input.catalogHasSymbol;
  if (!input.catalogOk) {
    blockers.push("CATALOG_UNAVAILABLE");
  } else if (!input.catalogHasSymbol) {
    blockers.push("INSTRUMENT_NOT_IN_CATALOG");
    states.push("UNSUPPORTED");
  } else {
    states.push("METADATA_VERIFIED");
  }

  // Phase 4.14B — quote/history/analysis: any catalog-verified FC instrument.
  // Execution allowlist (XAU historical draft path) remains separate and is NOT sufficient for orders.
  const quoteSupported = inCatalog;
  const historySupported = inCatalog;
  const analysisSupported = inCatalog;
  if (quoteSupported) {
    states.push("QUOTE_SUPPORTED", "HISTORY_SUPPORTED", "ANALYSIS_SUPPORTED");
  }

  const executionCandidateAllowlisted = isInstrumentAllowlisted(symbol);
  states.push("EXECUTION_BLOCKED");
  blockers.push("EXECUTION_REQUIRES_QUANTITY_MARGIN_AND_AUTH_GATES");
  if (!executionCandidateAllowlisted) {
    blockers.push("NOT_ON_EXECUTION_DRAFT_ALLOWLIST");
  }
  blockers.push("OWNER_MAX_LOTS_0_01_LIKELY_BELOW_BROKER_MIN");

  return {
    provider: "FOREXCONNECT",
    symbol,
    providerSymbol: symbol,
    inCatalog,
    quoteSupported,
    historySupported,
    analysisSupported,
    executionCandidateAllowlisted,
    executionSupported: false,
    executionBlocked: true,
    states,
    blockers,
    note:
      "Quote/history/analysis may be supported for catalog instruments. Execution remains blocked until quantity, margin, and authorization are independently verified.",
  };
}
