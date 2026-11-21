import {
  HFM_FUNDAMENTALS_MAX_EVENTS_PER_QUERY,
  HFM_SMT_DOCS_URL,
} from "./contracts.js";
import { economicCalendarEnableInstructions, economicCalendarGateAvailability } from "./gate.js";
import { getBackgroundRefreshEnabled } from "./refresh.js";
import { buildHfmFundamentalsPackageForSnapshot } from "./snapshot-join.js";
import { getHfmFundamentalsStorage } from "./storage.js";
import type { HfmEconomicEvent } from "./types.js";

export function buildFundamentalsStatusPublic(): Record<string, unknown> {
  const availability = economicCalendarGateAvailability();
  return {
    ok: true,
    availability,
    licensingCleared: availability !== "LICENSING_BLOCKED",
    providerEnabled: availability !== "NOT_CONFIGURED" && availability !== "LICENSING_BLOCKED",
    liveAllowed: availability === "OK",
    backgroundRefreshEnabled: getBackgroundRefreshEnabled(),
    providerId: "SHOWMYTRADES",
    docsUrl: HFM_SMT_DOCS_URL,
    enableInstructions: economicCalendarEnableInstructions(),
    rankingUnaffected: true,
    informationalOnly: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

export async function buildPublicCalendarQuery(input: {
  currencies?: string[];
  impacts?: string[];
  limit?: number;
  symbol?: string;
}): Promise<Record<string, unknown>> {
  const availability = economicCalendarGateAvailability();
  if (availability === "LICENSING_BLOCKED" || availability === "NOT_CONFIGURED") {
    return {
      ok: false,
      found: false,
      availability,
      events: [],
      count: 0,
      message:
        availability === "LICENSING_BLOCKED"
          ? "Licensing gate not cleared — calendar display blocked."
          : "Economic calendar provider not enabled.",
      enableInstructions: economicCalendarEnableInstructions(),
      attribution: null,
      backgroundRefreshEnabled: false,
      placesOrders: false,
      mutatesBroker: false,
    };
  }

  const storage = getHfmFundamentalsStorage();
  const state = await storage.loadProviderState();
  let events = await storage.loadLatestEvents();
  const currencies = (input.currencies ?? []).map((c) => c.toUpperCase()).filter(Boolean);
  const impacts = (input.impacts ?? []).map((i) => i.toLowerCase()).filter(Boolean);
  if (currencies.length) {
    events = events.filter((e) => currencies.includes(e.currency.toUpperCase()));
  }
  if (impacts.length) {
    events = events.filter((e) => impacts.includes(e.impact.toLowerCase()));
  }
  const limit = Math.max(
    1,
    Math.min(HFM_FUNDAMENTALS_MAX_EVENTS_PER_QUERY, Math.floor(input.limit ?? 50)),
  );
  events = events
    .slice()
    .sort((a, b) => a.scheduledTs - b.scheduledTs)
    .slice(0, limit);

  return {
    ok: true,
    found: events.length > 0,
    availability: events.length ? "OK" : state?.lastSuccessAtUtc ? "EMPTY" : "UNAVAILABLE",
    count: events.length,
    events: events.map(publicEvent),
    attribution: state?.attribution ?? null,
    lastSuccessAtUtc: state?.lastSuccessAtUtc ?? null,
    backgroundRefreshEnabled: false,
    rankingUnaffected: true,
    placesOrders: false,
    mutatesBroker: false,
  };
}

export async function buildPublicCalendarEvent(eventId: string): Promise<Record<string, unknown>> {
  const availability = economicCalendarGateAvailability();
  if (availability === "LICENSING_BLOCKED" || availability === "NOT_CONFIGURED") {
    return {
      ok: false,
      found: false,
      availability,
      event: null,
      message: "Calendar access blocked by feature/licensing gate.",
      placesOrders: false,
      mutatesBroker: false,
    };
  }
  const event = await getHfmFundamentalsStorage().loadEvent(eventId);
  if (!event) {
    return {
      ok: false,
      found: false,
      availability: "UNAVAILABLE",
      code: "EVENT_NOT_FOUND",
      event: null,
      placesOrders: false,
      mutatesBroker: false,
    };
  }
  return {
    ok: true,
    found: true,
    availability: "OK",
    event: publicEvent(event),
    placesOrders: false,
    mutatesBroker: false,
  };
}

export async function buildPublicFundamentalsSnapshotSummary(input: {
  snapshotId: string;
  symbol: string;
}): Promise<Record<string, unknown>> {
  const pkg = await buildHfmFundamentalsPackageForSnapshot({
    snapshotId: input.snapshotId,
    symbol: input.symbol,
    persist: false,
  });
  return {
    ok: pkg.availability !== "LICENSING_BLOCKED" && pkg.availability !== "NOT_CONFIGURED",
    found: pkg.events.length > 0,
    availability: pkg.availability,
    package: {
      packageId: pkg.packageId,
      snapshotId: pkg.snapshotId,
      symbol: pkg.symbol,
      asOfUtc: pkg.asOfUtc,
      availability: pkg.availability,
      freshness: pkg.freshness,
      completeness: pkg.completeness,
      eventIds: pkg.eventIds,
      events: pkg.events.map(publicEvent),
      impacts: pkg.impacts,
      attribution: pkg.attribution,
      qualityWarnings: pkg.qualityWarnings,
      rankingUnaffected: true,
      informationalOnly: true,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function publicEvent(e: HfmEconomicEvent): Record<string, unknown> {
  return {
    eventId: e.eventId,
    providerEventId: e.providerEventId,
    title: e.title,
    currency: e.currency,
    category: e.category,
    impact: e.impact,
    scheduledAtUtc: e.scheduledAtUtc,
    forecast: e.forecast,
    previous: e.previous,
    actual: e.actual,
    period: e.period,
    status: e.status,
    movedFrom: e.movedFrom,
    confidence: e.confidence,
    completeness: e.completeness,
    qualityWarnings: e.qualityWarnings,
    retrievedAtUtc: e.retrievedAtUtc,
  };
}
