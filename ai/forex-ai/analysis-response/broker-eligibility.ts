/**
 * Phase 50D — Broker ticket eligibility.
 * Binance (and other non-FXCM) analysis must never imply FXCM ticket readiness.
 * Never places, modifies, or closes broker orders.
 */

export const FXCM_TICKET_INELIGIBLE_MESSAGE =
  "BROKER INSTRUMENT NOT VERIFIED — FXCM TICKET INELIGIBLE";

export type FxcmTicketEligibilityStatus =
  | "ELIGIBLE_WHEN_RISK_CLEARS"
  | "INELIGIBLE_PROVIDER"
  | "INELIGIBLE_UNMAPPED"
  | "INELIGIBLE_CONFLICT";

export interface FxcmTicketEligibility {
  schemaVersion: "forex-fxcm-ticket-eligibility-v1";
  eligible: boolean;
  status: FxcmTicketEligibilityStatus;
  message: string | null;
  blockerCode: "FXCM_TICKET_INELIGIBLE" | "FXCM_PROVIDER_ISOLATION" | "FXCM_MAP_UNRESOLVED" | "FXCM_MAP_CONFLICT" | null;
  analysisProvider: string;
  instrument: string;
  note: string;
  /** Explicit: this module never submits orders. */
  placesOrders: false;
}

export function evaluateFxcmTicketEligibility(input: {
  provider: string | null | undefined;
  instrument: string | null | undefined;
  /** Optional FXCM mapping status when the analysis provider is FXCM/ForexConnect. */
  fxcmMappingStatus?: "RESOLVED" | "UNRESOLVED" | "CONFLICT" | null;
}): FxcmTicketEligibility {
  const provider = String(input.provider ?? "").toUpperCase();
  const instrument = String(input.instrument ?? "").trim() || "unknown";
  const base = {
    schemaVersion: "forex-fxcm-ticket-eligibility-v1" as const,
    analysisProvider: provider || "UNKNOWN",
    instrument,
    placesOrders: false as const,
  };

  if (provider === "BINANCE") {
    return {
      ...base,
      eligible: false,
      status: "INELIGIBLE_PROVIDER",
      message: FXCM_TICKET_INELIGIBLE_MESSAGE,
      blockerCode: "FXCM_PROVIDER_ISOLATION",
      note:
        `${instrument} was analyzed on Binance. Binance symbols are not FXCM instruments. `
        + "Directional BUY/SELL may remain available; FXCM contracts, units, and ticket quantities are not inferred from Binance data.",
    };
  }

  if (provider && provider !== "FOREXCONNECT" && provider !== "FXCM") {
    return {
      ...base,
      eligible: false,
      status: "INELIGIBLE_PROVIDER",
      message: FXCM_TICKET_INELIGIBLE_MESSAGE,
      blockerCode: "FXCM_TICKET_INELIGIBLE",
      note:
        `Provider ${provider} is not an FXCM/ForexConnect analysis source. `
        + "FXCM ticket fields stay blocked until a verified FXCM instrument mapping exists.",
    };
  }

  if (input.fxcmMappingStatus === "CONFLICT") {
    return {
      ...base,
      eligible: false,
      status: "INELIGIBLE_CONFLICT",
      message: FXCM_TICKET_INELIGIBLE_MESSAGE,
      blockerCode: "FXCM_MAP_CONFLICT",
      note: "FXCM symbol mapping is in conflict — ticket quantities withheld.",
    };
  }

  if (input.fxcmMappingStatus === "UNRESOLVED") {
    return {
      ...base,
      eligible: false,
      status: "INELIGIBLE_UNMAPPED",
      message: FXCM_TICKET_INELIGIBLE_MESSAGE,
      blockerCode: "FXCM_MAP_UNRESOLVED",
      note: "FXCM symbol mapping is unresolved — ticket quantities withheld.",
    };
  }

  if (provider === "FOREXCONNECT" || provider === "FXCM") {
    return {
      ...base,
      eligible: true,
      status: "ELIGIBLE_WHEN_RISK_CLEARS",
      message: null,
      blockerCode: null,
      note:
        "FXCM/ForexConnect instrument path — ticket quantities still require verified contract metadata, "
        + "entry/stop structure, and risk eligibility. No broker order is placed by this analysis.",
    };
  }

  return {
    ...base,
    eligible: false,
    status: "INELIGIBLE_PROVIDER",
    message: FXCM_TICKET_INELIGIBLE_MESSAGE,
    blockerCode: "FXCM_TICKET_INELIGIBLE",
    note: "Provider unknown — FXCM ticket ineligible.",
  };
}
