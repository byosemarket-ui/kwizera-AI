/**
 * Deterministic event-risk from validated calendar events.
 * Importance + proximity only — does not claim volatility or direction.
 */
import type { HfmEconomicEvent } from "../../../fundamentals/types.js";
import { importanceFromImpact } from "../../../fundamentals/impact.js";
import type { HfmEventRiskAssessment, MifExternalMarketIntelligencePolicy } from "./types.js";
import { MIF_EXTERNAL_MARKET_MODEL_VERSION } from "./contracts.js";

function isCancelledOrUnknown(status: string): boolean {
  const s = status.toLowerCase();
  return s === "cancelled" || s === "unknown";
}

function isReleased(status: string): boolean {
  return status.toLowerCase() === "released";
}

export function assessEventRisk(input: {
  events: readonly HfmEconomicEvent[];
  asOfUtc: string;
  policy: MifExternalMarketIntelligencePolicy;
}): HfmEventRiskAssessment {
  const asOfMs = Date.parse(input.asOfUtc);
  if (!Number.isFinite(asOfMs)) {
    return {
      riskClass: "UNKNOWN_EVENT_RISK",
      asOfUtc: input.asOfUtc,
      relevantEventIds: [],
      nearestEventId: null,
      nearestEventTitle: null,
      nearestScheduledAtUtc: null,
      msUntilNearest: null,
      explanation: "invalid asOfUtc",
      methodologyVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
      doesNotGuaranteeVolatility: true,
      doesNotImplyDirection: true,
    };
  }

  const usable = input.events.filter((e) => !isCancelledOrUnknown(e.status));
  if (!usable.length) {
    return {
      riskClass: "NO_RELEVANT_EVENT",
      asOfUtc: input.asOfUtc,
      relevantEventIds: [],
      nearestEventId: null,
      nearestEventTitle: null,
      nearestScheduledAtUtc: null,
      msUntilNearest: null,
      explanation: "no relevant non-cancelled events",
      methodologyVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
      doesNotGuaranteeVolatility: true,
      doesNotImplyDirection: true,
    };
  }

  // Prefer upcoming/scheduled; released events do not elevate future risk by themselves.
  const upcoming = usable.filter((e) => !isReleased(e.status));
  const pool = upcoming.length ? upcoming : usable;

  let nearest: HfmEconomicEvent | null = null;
  let nearestAbs = Number.POSITIVE_INFINITY;
  for (const e of pool) {
    const t = e.scheduledTs * 1000;
    const abs = Math.abs(t - asOfMs);
    if (abs < nearestAbs) {
      nearestAbs = abs;
      nearest = e;
    }
  }

  const relevantEventIds = usable.map((e) => e.eventId);
  if (!nearest) {
    return {
      riskClass: "UNKNOWN_EVENT_RISK",
      asOfUtc: input.asOfUtc,
      relevantEventIds,
      nearestEventId: null,
      nearestEventTitle: null,
      nearestScheduledAtUtc: null,
      msUntilNearest: null,
      explanation: "could not locate nearest event",
      methodologyVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
      doesNotGuaranteeVolatility: true,
      doesNotImplyDirection: true,
    };
  }

  const msUntil = nearest.scheduledTs * 1000 - asOfMs;
  const absMs = Math.abs(msUntil);
  const imp = importanceFromImpact(nearest.impact);
  const released = isReleased(nearest.status);

  let riskClass: HfmEventRiskAssessment["riskClass"] = "LOW_EVENT_RISK";
  let explanation = "";

  if (released && absMs > input.policy.highRiskWindowMs) {
    riskClass = "LOW_EVENT_RISK";
    explanation = "nearest relevant event already released and outside high-risk window";
  } else if (imp === "HIGH" && absMs <= input.policy.highRiskWindowMs && !released) {
    riskClass = "HIGH_EVENT_RISK";
    explanation = `HIGH importance event within ±${input.policy.highRiskWindowMs}ms (proximity+importance)`;
  } else if (
    (imp === "HIGH" && absMs <= input.policy.elevatedRiskWindowMs && !released)
    || (imp === "MEDIUM" && absMs <= input.policy.highRiskWindowMs && !released)
  ) {
    riskClass = "ELEVATED_EVENT_RISK";
    explanation = "elevated proximity/importance window";
  } else if (imp === "HIGH" && absMs <= input.policy.moderateRiskWindowMs && !released) {
    riskClass = "MODERATE_EVENT_RISK";
    explanation = "HIGH importance within moderate window";
  } else if (imp === "UNKNOWN" || !nearest.scheduledAtUtc) {
    riskClass = "UNKNOWN_EVENT_RISK";
    explanation = "importance or schedule incomplete";
  } else {
    riskClass = "LOW_EVENT_RISK";
    explanation = "relevant events present but outside elevated windows";
  }

  return {
    riskClass,
    asOfUtc: input.asOfUtc,
    relevantEventIds,
    nearestEventId: nearest.eventId,
    nearestEventTitle: nearest.title,
    nearestScheduledAtUtc: nearest.scheduledAtUtc,
    msUntilNearest: msUntil,
    explanation,
    methodologyVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
    doesNotGuaranteeVolatility: true,
    doesNotImplyDirection: true,
  };
}
