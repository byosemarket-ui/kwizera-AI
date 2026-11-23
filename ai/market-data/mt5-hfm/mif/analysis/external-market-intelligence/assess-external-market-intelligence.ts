/**
 * Phase 07 — assessMifExternalMarketIntelligence (HFM_MT5).
 * Uses cached/fixture calendar events only. No live HTTP. No background worker.
 * Does not confirm/invalidate Phase 04 lifecycle. Not probability.
 */
import { createHash } from "node:crypto";
import {
  currenciesInSymbol,
  eventRelevantToSymbol,
  filterEventsForSymbol,
  normalizeHfmSymbol,
} from "../../../fundamentals/impact.js";
import {
  economicCalendarGateAvailability,
  isEconomicCalendarLiveAllowed,
} from "../../../fundamentals/gate.js";
import type { HfmEconomicEvent } from "../../../fundamentals/types.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import {
  MIF_EXTERNAL_MARKET_CONTRACT_ID,
  MIF_EXTERNAL_MARKET_CONTRACT_VERSION,
  MIF_EXTERNAL_MARKET_ENGINE_ID,
  MIF_EXTERNAL_MARKET_ENGINE_VERSION,
  MIF_EXTERNAL_MARKET_MODEL_VERSION,
  MIF_EXTERNAL_MARKET_POLICY_ID,
  MIF_EXTERNAL_MARKET_POLICY_VERSION,
} from "./contracts.js";
import { assessEventRisk } from "./event-risk.js";
import { resolveExternalMarketIntelligencePolicy } from "./policies.js";
import { computeNumericSurprise } from "./surprise.js";
import {
  classifyTechnicalFundamentalAlignment,
  deriveFundamentalBias,
} from "./technical-fundamental-conflict.js";
import type {
  AssessMifExternalMarketIntelligenceInput,
  HfmExternalCapabilityMatrix,
  HfmInstrumentRelevanceRecord,
  MifExternalMarketIntelligenceAssessment,
  MifExternalMarketStatus,
} from "./types.js";

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function capabilityMatrix(
  calendarOk: boolean,
  fixtureMode: boolean,
): HfmExternalCapabilityMatrix {
  return {
    economicCalendar: calendarOk
      ? (fixtureMode ? "FIXTURE_ONLY" : "REUSED_AND_VERIFIED")
      : "BLOCKED_CONFIGURATION_REQUIRED",
    economicRelease: calendarOk ? "IMPLEMENTED" : "UNAVAILABLE",
    eventRisk: "IMPLEMENTED",
    instrumentRelevance: "IMPLEMENTED",
    surpriseCalculation: "IMPLEMENTED",
    financialNews: "NOT_IMPLEMENTED",
    newsSentiment: "NOT_IMPLEMENTED",
    centralBankPolicy: "NOT_IMPLEMENTED",
    crossAssetContext: "NOT_IMPLEMENTED",
    technicalFundamentalAlignment: "IMPLEMENTED",
    continuousIngestionWorker: "DISABLED_BY_POLICY",
  };
}

function buildRelevance(
  symbol: string,
  events: readonly HfmEconomicEvent[],
): HfmInstrumentRelevanceRecord[] {
  const parts = currenciesInSymbol(symbol);
  const out: HfmInstrumentRelevanceRecord[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    const ccy = e.currency.toUpperCase();
    const key = `${symbol}:${ccy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const relevant = eventRelevantToSymbol(e, symbol);
    let relationshipType: HfmInstrumentRelevanceRecord["relationshipType"] = "UNRESOLVED";
    if (!relevant) {
      relationshipType = "UNRESOLVED";
    } else if (normalizeHfmSymbol(symbol).startsWith("XAU") && (ccy === "USD" || ccy === "XAU")) {
      relationshipType = "XAU_USD_CONTEXT";
    } else if (parts.includes(ccy)) {
      relationshipType = ccy === "USD" ? "USD_LEG" : "CURRENCY_LEG";
    } else if (ccy === "USD") {
      relationshipType = "USD_LEG";
    }
    out.push({
      symbol: normalizeHfmSymbol(symbol),
      currency: ccy,
      relationshipType: relevant ? relationshipType : "UNRESOLVED",
      relevant,
      rationale: relevant
        ? `event currency ${ccy} maps to symbol legs ${parts.join("/") || "n/a"}`
        : "RELEVANCE_UNRESOLVED — currency not mapped to symbol",
      configVersion: "phase07-relevance-v1",
    });
  }
  return out;
}

/**
 * Assess external market / fundamental intelligence from cache or fixtures.
 */
export function assessMifExternalMarketIntelligence(
  input: AssessMifExternalMarketIntelligenceInput,
): MifExternalMarketIntelligenceAssessment {
  const providerSymbol = normalizeHfmSymbol(input.providerSymbol);
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const asOfUtc = input.asOfUtc ?? assessmentTimestamp;
  const policy = resolveExternalMarketIntelligencePolicy(input.policy);
  const instrument = input.instrument ?? null;
  const gate = economicCalendarGateAvailability();
  const liveAllowed = isEconomicCalendarLiveAllowed();

  const baseLimitations = [
    "ShowMyTrades calendar cache/fixture only — no fabricated news or central-bank feed",
    "financial news / central-bank live feeds NOT_IMPLEMENTED in Phase 07",
    "event risk is proximity+importance — not guaranteed volatility or direction",
    "surprise delta is not a currency bullish/bearish trade signal",
    "does not alone confirm or invalidate Phase 04 lifecycle",
    "continuous external ingestion worker DISABLED_BY_POLICY",
    "scores are NOT win probability or event probability",
  ];

  const empty = (
    status: MifExternalMarketStatus,
    reason: string,
    missing: string[] = [],
  ): MifExternalMarketIntelligenceAssessment => {
    const id = idHash({ providerSymbol, status, reason });
    return {
      contractId: MIF_EXTERNAL_MARKET_CONTRACT_ID,
      contractVersion: MIF_EXTERNAL_MARKET_CONTRACT_VERSION,
      scope: "phase07-external-market-intelligence",
      assessmentId: input.assessmentId ?? `emi:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      instrument,
      policyId: policy.policyId || MIF_EXTERNAL_MARKET_POLICY_ID,
      policyVersion: policy.policyVersion || MIF_EXTERNAL_MARKET_POLICY_VERSION,
      engineId: MIF_EXTERNAL_MARKET_ENGINE_ID,
      engineVersion: MIF_EXTERNAL_MARKET_ENGINE_VERSION,
      modelVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
      assessmentTimestamp,
      status,
      calendarAvailability: input.calendarAvailability ?? gate,
      calendarFreshness: input.calendarFreshness ?? "DISABLED",
      calendarProviderId: null,
      dataSourceMode: "UNAVAILABLE",
      relevantEvents: [],
      relevance: [],
      surprises: [],
      eventRisk: {
        riskClass: "UNKNOWN_EVENT_RISK",
        asOfUtc,
        relevantEventIds: [],
        nearestEventId: null,
        nearestEventTitle: null,
        nearestScheduledAtUtc: null,
        msUntilNearest: null,
        explanation: reason,
        methodologyVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
        doesNotGuaranteeVolatility: true,
        doesNotImplyDirection: true,
      },
      technicalFundamentalAlignment: "INSUFFICIENT_FUNDAMENTAL_DATA",
      technicalBias: input.technicalBias?.overallTrendDirection ?? null,
      fundamentalBias: null,
      supportingEvidence: [],
      contradictingEvidence: [],
      missingInputs: missing,
      limitations: baseLimitations,
      capabilityMatrix: capabilityMatrix(false, false),
      fundamentalsPackageId: null,
      sourceRefs: {
        fundamentalsPackageId: null,
        deepTechnicalAssessmentId: input.technicalBias?.assessmentId ?? null,
        eventIds: [],
      },
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isWinProbability: false,
      isEventProbability: false,
      isCalibratedProbability: false,
      doesNotConfirmOrInvalidateLifecycleAlone: true,
      doesNotApproveExecution: true,
      analyticalFundamentalInformationOnly: true,
      backgroundRefreshEnabled: false,
      financialNewsStatus: "NOT_IMPLEMENTED",
      centralBankLiveFeedStatus: "NOT_IMPLEMENTED",
    };
  };

  if (!providerSymbol) {
    return empty("BLOCKED", "providerSymbol required", ["providerSymbol"]);
  }

  const pkg = input.fundamentalsPackage ?? null;
  let events: HfmEconomicEvent[] = [];
  let dataSourceMode: "LIVE_CACHE" | "FIXTURE" | "UNAVAILABLE" =
    input.dataSourceMode ?? "UNAVAILABLE";
  let calendarAvailability = input.calendarAvailability ?? gate;
  let calendarFreshness = input.calendarFreshness ?? "UNKNOWN";
  let packageId: string | null = null;

  if (pkg && Array.isArray(pkg.events) && pkg.events.length) {
    events = filterEventsForSymbol(pkg.events, providerSymbol, 40);
    packageId = pkg.packageId;
    calendarAvailability = pkg.availability;
    calendarFreshness = pkg.freshness;
    dataSourceMode = input.dataSourceMode
      ?? (pkg.availability === "OK" || pkg.availability === "PARTIAL" || pkg.availability === "STALE"
        ? "LIVE_CACHE"
        : "FIXTURE");
  } else if (input.events?.length) {
    events = filterEventsForSymbol([...input.events], providerSymbol, 40);
    dataSourceMode = input.dataSourceMode ?? "FIXTURE";
    calendarAvailability = input.calendarAvailability ?? "OK";
    calendarFreshness = input.calendarFreshness ?? "FRESH";
  } else if (!liveAllowed && gate === "LICENSING_BLOCKED") {
    return empty("LICENSING_BLOCKED", "licensing_not_cleared", ["licensing"]);
  } else if (!liveAllowed && gate === "NOT_CONFIGURED") {
    return empty("NOT_CONFIGURED", "calendar_provider_disabled", ["calendarEnabled"]);
  } else {
    return empty("INSUFFICIENT_DATA", "no_calendar_events_in_cache_or_fixture", ["events"]);
  }

  const relevance = buildRelevance(providerSymbol, events);
  const surprises = events.map((e) => ({
    eventId: e.eventId,
    surprise: computeNumericSurprise(e.forecast, e.actual),
  }));
  const releasedWithSurprise = surprises.filter(
    (s) => s.surprise.comparable && s.surprise.direction !== "IN_LINE" && s.surprise.direction !== "MISSING_VALUES",
  ).length;

  const eventRisk = assessEventRisk({ events, asOfUtc, policy });
  const technicalBias = input.technicalBias?.overallTrendDirection ?? null;
  const fundamentalBias = deriveFundamentalBias({
    releasedWithSurprise,
    hasRelevantEvents: events.length > 0,
  });
  const alignment = classifyTechnicalFundamentalAlignment({
    technicalBias,
    fundamentalBias,
    eventRisk: eventRisk.riskClass,
    hasFundamentalEvents: events.length > 0,
  });

  const supporting: string[] = [];
  const contradicting: string[] = [];
  for (const e of events.slice(0, 8)) {
    supporting.push(`event:${e.eventId}:${e.title}:${e.status}`);
  }
  supporting.push(`eventRisk=${eventRisk.riskClass}`);
  if (alignment.includes("CONFLICT") || alignment.includes("BULLISH_FUNDAMENTAL_BEARISH")
    || alignment.includes("BEARISH_FUNDAMENTAL_BULLISH")) {
    contradicting.push(`alignment=${alignment}`);
  }
  if (technicalBias && fundamentalBias && technicalBias !== fundamentalBias
    && technicalBias !== "NEUTRAL" && fundamentalBias !== "NEUTRAL"
    && technicalBias !== "UNKNOWN" && fundamentalBias !== "UNKNOWN") {
    contradicting.push(`tech=${technicalBias}_vs_fund=${fundamentalBias}`);
  }

  let status: MifExternalMarketStatus = "VALID";
  if (calendarFreshness === "STALE") status = "WARNING";
  if (calendarAvailability === "STALE") status = "WARNING";
  if (dataSourceMode === "FIXTURE") status = "WARNING";
  if (!events.length) status = "INSUFFICIENT_DATA";

  const id = idHash({
    contractId: MIF_EXTERNAL_MARKET_CONTRACT_ID,
    providerSymbol,
    packageId,
    eventIds: events.map((e) => e.eventId),
    risk: eventRisk.riskClass,
    alignment,
    model: MIF_EXTERNAL_MARKET_MODEL_VERSION,
  });

  return {
    contractId: MIF_EXTERNAL_MARKET_CONTRACT_ID,
    contractVersion: MIF_EXTERNAL_MARKET_CONTRACT_VERSION,
    scope: "phase07-external-market-intelligence",
    assessmentId: input.assessmentId ?? `emi:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    instrument,
    policyId: policy.policyId || MIF_EXTERNAL_MARKET_POLICY_ID,
    policyVersion: policy.policyVersion || MIF_EXTERNAL_MARKET_POLICY_VERSION,
    engineId: MIF_EXTERNAL_MARKET_ENGINE_ID,
    engineVersion: MIF_EXTERNAL_MARKET_ENGINE_VERSION,
    modelVersion: MIF_EXTERNAL_MARKET_MODEL_VERSION,
    assessmentTimestamp,
    status,
    calendarAvailability,
    calendarFreshness,
    calendarProviderId: "SHOWMYTRADES",
    dataSourceMode,
    relevantEvents: events,
    relevance,
    surprises,
    eventRisk,
    technicalFundamentalAlignment: alignment,
    technicalBias,
    fundamentalBias,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    missingInputs: [
      ...(!liveAllowed ? ["live_calendar_gates"] : []),
      "financial_news_feed",
      "central_bank_live_feed",
    ],
    limitations: baseLimitations,
    capabilityMatrix: capabilityMatrix(true, dataSourceMode === "FIXTURE"),
    fundamentalsPackageId: packageId,
    sourceRefs: {
      fundamentalsPackageId: packageId,
      deepTechnicalAssessmentId: input.technicalBias?.assessmentId ?? null,
      eventIds: events.map((e) => e.eventId),
    },
    diagnosticsSummary:
      `status=${status}; risk=${eventRisk.riskClass}; alignment=${alignment}; `
      + `events=${events.length}; mode=${dataSourceMode}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isWinProbability: false,
    isEventProbability: false,
    isCalibratedProbability: false,
    doesNotConfirmOrInvalidateLifecycleAlone: true,
    doesNotApproveExecution: true,
    analyticalFundamentalInformationOnly: true,
    backgroundRefreshEnabled: false,
    financialNewsStatus: "NOT_IMPLEMENTED",
    centralBankLiveFeedStatus: "NOT_IMPLEMENTED",
  };
}
